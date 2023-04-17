import asyncio
from datetime import datetime, timedelta
import json
import logging
from dataclasses import asdict
from typing import Dict, Tuple

import aio_pika
from distributed_transcoder_common.message_types import (
    JobProgressMessage,
    JobResultMessage,
)
from distributed_transcoder_common.models import Job

from .managers import EventManager

# Define constants for queues
JOB_QUEUE_NAME = "transcoding_jobs"
PROGRESS_QUEUE_NAME = "transcoding_progress"
RESULTS_QUEUE_NAME = "transcoding_results"


async def init_channels(
    rmq_host: str,
    rmq_port: int,
    rmq_user: str,
    rmq_password: str,
) -> Tuple[aio_pika.RobustChannel, aio_pika.RobustConnection]:
    """
    Initialize the channels for the worker.

    :param connection: A blocking connection to the RabbitMQ server.
    :return: The channels for the worker.
    """
    connection_attempts = 0
    retry_interval = 5
    while True:
        try:
            connection = await aio_pika.connect_robust(
                host=rmq_host,
                port=rmq_port,
                login=rmq_user,
                password=rmq_password,
            )
            break
        except aio_pika.exceptions.AMQPConnectionError:
            logging.info(
                f"Connection to RabbitMQ failed. Retrying in {retry_interval} seconds..."
            )
            connection_attempts += 1
            await asyncio.sleep(retry_interval)
            if connection_attempts >= 12:
                raise Exception("Could not connect to RabbitMQ after multiple retries.")

    logging.info("Connected to RabbitMQ")

    channel = await connection.channel()

    # Initialize a standard queue for jobs
    await channel.declare_queue(JOB_QUEUE_NAME)

    # Initialize a topic exchange for progress logs
    await channel.declare_exchange("progress_logs", aio_pika.ExchangeType.TOPIC)
    # Initialize a queue for progress logs
    progress_queue = await channel.declare_queue(PROGRESS_QUEUE_NAME)
    await progress_queue.bind("progress_logs", routing_key=f"{PROGRESS_QUEUE_NAME}.*")

    # Initialize a topic exchange for results
    await channel.declare_exchange("results_logs", aio_pika.ExchangeType.TOPIC)
    # Initialize a queue for results
    results_queue = await channel.declare_queue(RESULTS_QUEUE_NAME)
    await results_queue.bind("results_logs", routing_key=f"{RESULTS_QUEUE_NAME}.*")

    return (channel, connection)


class WorkQueue:
    def __init__(
        self,
        channel: aio_pika.Channel,
        event_manager: EventManager,
        logger: logging.Logger,
    ):
        self.channel = channel
        self.event_manager = event_manager
        self.last_progress_messages: Dict[str, JobProgressMessage] = {}
        self.logger = logger

    async def progress_callback(self, message: aio_pika.abc.AbstractIncomingMessage):
        """
        Callback for when a progress message is received from the work queue.

        :param ch: The channel the message was received on.
        :param method: The method used to deliver the message.
        :param properties: The message properties.
        :param body: The message body.

        :return: None
        """
        msg = JobProgressMessage(**json.loads(message.body.decode()))
        # Store the progress message in a dictionary so we can serve it to newly connected clients
        self.last_progress_messages[msg.job_id] = msg

        # Confirm the job exists in the database
        job = await Job.get_or_none(job_id=msg.job_id)
        if job is None:
            self.logger.info(f"Received progress message for unknown job {msg.job_id}")
            return
        await self.event_manager.send_message(msg.job_id, "progress", asdict(msg))

    async def result_callback(self, message: aio_pika.abc.AbstractIncomingMessage):
        """
        Callback for when a result message is received from the work queue.

        :param ch: The channel the message was received on.
        :param method: The method used to deliver the message.
        :param properties: The message properties.
        :param body: The message body.

        :return: None
        """
        result = JobResultMessage(**json.loads(message.body.decode()))
        # Remove the job from the in-progress tracker
        self.last_progress_messages.pop(result.job_id, None)
        # Confirm the job exists in the database
        job = await Job.get_or_none(job_id=result.job_id)
        if job is None:
            self.logger.info(f"Received result message for unknown job {result.job_id}")
            return
        if result.status == Job.STATE_COMPLETED or result.status == Job.STATE_FAILED:
            await self.event_manager.send_message(
                result.job_id, "completion", asdict(result)
            )

    async def consume_events(self):
        try:
            progress_queue = await self.channel.get_queue(PROGRESS_QUEUE_NAME)
            await progress_queue.consume(self.progress_callback)

            results_queue = await self.channel.get_queue(RESULTS_QUEUE_NAME)
            await results_queue.consume(self.result_callback)
        except Exception as e:
            self.logger.error(f"Error while consuming events: {e}")

        # Loop every 60 seconds to check if there are any in-progress jobs which have not made progress
        while True:
            self.logger.info("Checking for stalled jobs...")
            async for job in Job.filter(
                state=Job.STATE_IN_PROGRESS,
                updated_at__lt=datetime.now() - timedelta(minutes=1),
            ):
                self.logger.info(f"Checking job {job.job_id}...")
                # If the job has not made progress in more than a minute, mark it as stalled
                job_has_progress = job.job_id in self.last_progress_messages
                job_progress_too_old = False
                if job_has_progress:
                    job_progress_too_old = datetime.fromtimestamp(
                        self.last_progress_messages[job.job_id].timestamp
                    ) < (datetime.now() - timedelta(minutes=1))
                if not job_has_progress or job_progress_too_old:
                    self.logger.info(
                        f"Job {job.job_id} has not made progress in more than a minute, marking it as stalled."
                    )
                    job.state = Job.STATE_STALLED
                    await job.save()
                    try:
                        await self.event_manager.send_message(
                            job.job_id,
                            "completion",
                            asdict(
                                JobResultMessage(
                                    timestamp=None,
                                    worker_id=None,
                                    job_id=job.job_id,
                                    status=Job.STATE_STALLED,
                                    output_s3_path=None,
                                    error=None,
                                    error_type=None,
                                )
                            ),
                        )
                    except Exception as e:
                        self.logger.error(
                            f"Error while sending completion message: {e}"
                        )
                    self.logger.info(f"Job {job.job_id} marked as stalled.")
            self.logger.info("Finished checking for stalled jobs.")
            await asyncio.sleep(60)
