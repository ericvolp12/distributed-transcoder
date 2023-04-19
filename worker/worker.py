import asyncio
from datetime import datetime
import json
import logging
import os
import random
import string
import tempfile
import threading
import time
from dataclasses import asdict
from typing import Tuple

import boto3
import gi
import pika
from botocore.exceptions import ClientError
from distributed_transcoder_common import (
    JobProgressMessage,
    JobResultMessage,
    JobSubmissionMessage,
)
from distributed_transcoder_common.models import Job, Preset
from errors import (
    FailedMidTranscode,
    FailedToParsePipeline,
    FailedToPlay,
    PipelineTimeout,
    TranscodeException,
)
from pika.channel import Channel
from pika.spec import Basic, BasicProperties
from tortoise import Tortoise
from work_queue import init_channels

gi.require_version("Gst", "1.0")
from gi.repository import GLib, Gst

# Constants
# S3 Config
S3_ACCESS_KEY_ID = os.environ["S3_ACCESS_KEY_ID"]
S3_SECRET_ACCESS_KEY = os.environ["S3_SECRET_ACCESS_KEY"]
S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
S3_ENDPOINT_URL = os.environ["S3_ENDPOINT_URL"]

# Worker Lifecycle Config
TIMEOUT_SECONDS = 60  # 1 minute

# DB Config
POSTGRES_USER = os.environ["POSTGRES_USER"]
POSTGRES_PASSWORD = os.environ["POSTGRES_PASSWORD"]
POSTGRES_DB = os.environ["POSTGRES_DB"]
POSTGRES_HOST = os.environ["POSTGRES_HOST"]

# Generate a random 5-character worker ID
worker_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))

# RabbitMQ Config
JOB_QUEUE_NAME = f"transcoding_jobs"
PROGRESS_QUEUE_NAME = f"transcoding_progress.{worker_id}"
RESULTS_QUEUE_NAME = f"transcoding_results.{worker_id}"
RMQ_HOST = os.environ["RMQ_HOST"]
RMQ_PORT = int(os.environ["RMQ_PORT"])
RMQ_USER = os.environ["RMQ_USER"]
RMQ_PASSWORD = os.environ["RMQ_PASSWORD"]

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format=f"%(asctime)s |{worker_id}| (%(name)s) [%(levelname)s]: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

for log_name, log_level in [
    ("pika", logging.CRITICAL),
    ("botocore", logging.WARNING),
    ("gst", logging.WARNING),
]:
    logging.getLogger(log_name).setLevel(log_level)

# Set up S3 client
s3_client = boto3.client(
    service_name="s3",
    aws_access_key_id=S3_ACCESS_KEY_ID,
    aws_secret_access_key=S3_SECRET_ACCESS_KEY,
    endpoint_url=S3_ENDPOINT_URL,
)


# Run an async task to connect to Tortoise
async def connect_tortoise():
    """
    Connect to the Tortoise database.
    """
    await Tortoise.init(
        db_url=f"postgres://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{POSTGRES_DB}",
        modules={"models": ["distributed_transcoder_common.models"]},
    )


# Start the async task in a coroutine
asyncio.get_event_loop().run_until_complete(connect_tortoise())


def on_gst_message(
    bus: Gst.Bus,
    message: Gst.Message,
    data: Tuple[GLib.MainLoop, Gst.Pipeline, Channel, str],
) -> bool:
    """
    Handle messages received from the GStreamer pipeline.

    :param bus: The GStreamer bus that received the message.
    :param message: The GStreamer message.
    :param data: A tuple containing the GLib main loop, the GStreamer pipeline, the progress channel, and the job ID.
    :return: True if the message was handled successfully.
    """
    loop, pipeline, ch, job_id = data
    message_type = message.type
    global last_progress_time
    global transcoding_error
    if message_type == Gst.MessageType.ERROR:
        error, debug = message.parse_error()
        logger.error("Error received: %s" % error)
        logger.error("Debug info: %s" % debug)
        transcoding_error = f"Error received from Pipeline Execution: {error}"
        loop.quit()
    elif message_type == Gst.MessageType.EOS:
        logger.info("End of stream")
        loop.quit()
    elif message_type == Gst.MessageType.STATE_CHANGED:
        old_state, new_state, pending_state = message.parse_state_changed()
        if message.src == pipeline:
            logger.info(
                "Pipeline state changed from %s to %s"
                % (old_state.value_nick, new_state.value_nick)
            )
    elif message_type == Gst.MessageType.DURATION_CHANGED:
        pass
    if message_type == Gst.MessageType.ELEMENT:
        structure = message.get_structure()
        if structure and structure.get_name() == "progress":
            percent: float = structure.get_double("percent-double")[1]
            logger.info("Progress: {:.1f}%".format(percent))
            ch.basic_publish(
                exchange="progress_logs",
                routing_key=PROGRESS_QUEUE_NAME,
                properties=BasicProperties(
                    content_type="application/json",
                    content_encoding="utf-8",
                ),
                body=json.dumps(
                    asdict(
                        JobProgressMessage(
                            timestamp=time.time(),
                            worker_id=worker_id,
                            job_id=job_id,
                            progress=round(percent, 4),
                        )
                    )
                ),
            )
            last_progress_time = time.time()
    else:
        logger.debug("Unexpected message: %s" % message_type)

    return True


def check_timeout(
    loop: GLib.MainLoop, pipeline: Gst.Pipeline, ch: Channel, job_id: str
):
    global last_progress_time, transcoding_error, job_finished
    while True:
        if job_finished:
            break
        if time.time() - last_progress_time > TIMEOUT_SECONDS:
            error_msg = f"Pipeline failed to progress after {TIMEOUT_SECONDS} seconds"
            error_type = "pipeline_timeout"
            transcoding_error = (error_type, error_msg)
            logger.error(error_msg)
            loop.quit()
            pipeline.set_state(Gst.State.NULL)
            break
        time.sleep(1)


def transcode(
    input_file: str,
    output_file: str,
    transcode_options: str,
    ch: Channel,
    job_id: str,
) -> str:
    """
    Transcode the input file to the output file using the specified transcode options and report progress to the channel.

    :param input_file: The path to the input file.
    :param output_file: The path to the output file.
    :param transcode_options: The GStreamer transcoding options.
    :param ch: The RabbitMQ channel for reporting progress.
    :param job_id: The unique identifier for the transcoding job.
    :return: The path to the output file if successful, None otherwise.
    """
    loop = GLib.MainLoop()

    pipeline_str = (
        transcode_options.replace("{{output_file}}", output_file)
        .replace("{{input_file}}", input_file)
        .replace("{{progress}}", "progressreport update-freq=10 silent=true")
    )

    logger.info(f"Starting transcoding with options: {pipeline_str}")

    try:
        pipeline = Gst.parse_launch(pipeline_str)
    except GLib.Error as e:
        logger.error(f"Unable to create pipeline: {e}")
        raise FailedToParsePipeline(e)

    bus = pipeline.get_bus()
    bus.add_signal_watch()
    bus.connect("message", on_gst_message, (loop, pipeline, ch, job_id))

    # Initialize global variables for mid-transcode error handling
    global last_progress_time, transcoding_error, job_finished
    last_progress_time = time.time()
    transcoding_error = (None, None)
    job_finished = False

    timeout_checker = threading.Thread(
        target=check_timeout, args=(loop, pipeline, ch, job_id)
    )
    timeout_checker.start()

    # Set the pipeline to the playing state
    ret = pipeline.set_state(Gst.State.PLAYING)
    if ret == Gst.StateChangeReturn.FAILURE:
        logger.error("Unable to set the pipeline to the playing state.")
        raise FailedToPlay("Unable to set the pipeline to the playing state.")

    # Start the GLib main loop
    try:
        loop.run()
    except Exception as e:
        logger.error(f"An error occurred while running the main loop: {e}")
        raise FailedMidTranscode(e)
    finally:
        pipeline.set_state(Gst.State.NULL)
        job_finished = True
    if transcoding_error[0] is not None:
        error_type, error_msg = transcoding_error
        if error_type == "pipeline_timeout":
            raise PipelineTimeout(error_msg)
        else:
            raise FailedMidTranscode(error_msg)

    return output_file


async def handle_transcode_exception(
    ch: Channel,
    method: Basic.Deliver,
    e: TranscodeException,
    job_id: str,
):
    await send_transcode_result(
        ch, method, Job.STATE_FAILED, job_id, error=str(e), error_type=e.error_type
    )


async def send_transcode_result(
    ch: Channel,
    method: Basic.Deliver,
    status: str,
    job_id: str,
    output_s3_path: str = None,
    error: str = None,
    error_type: str = None,
):
    ch.basic_publish(
        exchange="results_logs",
        routing_key=RESULTS_QUEUE_NAME,
        properties=BasicProperties(
            content_type="application/json",
            content_encoding="utf-8",
        ),
        body=json.dumps(
            asdict(
                JobResultMessage(
                    job_id=job_id,
                    status=status,
                    timestamp=time.time(),
                    worker_id=worker_id,
                    output_s3_path=output_s3_path,
                    error=error,
                    error_type=error_type,
                )
            )
        ),
    )
    if error:
        logger.error(f"Transcoding failed: {error_type}")
    # Update job state in DB
    job = await Job.get_or_none(job_id=job_id)
    if job is not None:
        job.state = status
        job.error = str(error)
        job.error_type = error_type
        job.transcode_completed_at = datetime.now()
        await job.save()
    ch.basic_ack(delivery_tag=method.delivery_tag)


async def process_workqueue_message(
    ch: Channel,
    method: Basic.Deliver,
    properties: BasicProperties,
    body: bytes,
) -> None:
    """
    Process a transcoding job message received from the queue.

    :param ch: The RabbitMQ channel.
    :param method: The delivery method.
    :param properties: The message properties.
    :param body: The message body, containing the job data as JSON.
    """
    logger.info("Received a new transcoding job")
    job_data = JobSubmissionMessage(**json.loads(body))

    # Confirm job hasn't been cancelled or already claimed
    job = await Job.get_or_none(job_id=job_data.job_id)

    if job is None:
        logger.info(
            f"Job {job_data.job_id} could not be found in the DB, skipping processing. Message body: {job_data}"
        )
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    if job.state == Job.STATE_CANCELLED:
        logger.info(f"Job {job_data.job_id} has been cancelled, skipping processing.")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    if job.state == Job.STATE_IN_PROGRESS:
        logger.info(
            f"Job {job_data.job_id} is already in progress, skipping processing."
        )
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    if job.state == Job.STATE_STALLED:
        logger.info(
            f"Job {job_data.job_id} stalled the last time it was attempted, skipping processing."
        )
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    elif job.state == Job.STATE_QUEUED:
        # Update job state to in progress
        job.state = Job.STATE_IN_PROGRESS
        job.transcode_started_at = datetime.now()
        await job.save()

        with tempfile.NamedTemporaryFile() as input_file, tempfile.NamedTemporaryFile() as output_file:
            # Download the input chunk
            dl_start = time.time()
            logger.info(f"Downloading input chunk from S3: {job_data.input_s3_path}")
            try:
                s3_client.download_file(
                    S3_BUCKET_NAME, job_data.input_s3_path, input_file.name
                )
            except ClientError as e:
                logger.error(f"Unable to download input chunk: {e}")
                await send_transcode_result(
                    ch,
                    method,
                    Job.STATE_FAILED,
                    job_data.job_id,
                    error=str(e),
                    error_type="s3_download",
                )
                return
            logger.info(
                f"Chunk finished downloading to: {input_file.name} in {time.time() - dl_start} seconds"
            )

            # Transcode the input chunk
            try:
                transcode(
                    input_file.name,
                    output_file.name,
                    job_data.transcode_options,
                    ch,
                    job_data.job_id,
                )
            except TranscodeException as e:
                await handle_transcode_exception(ch, method, e, job_data.job_id)
                return
            except Exception as e:
                await handle_transcode_exception(
                    ch, method, TranscodeException("unknown", str(e)), job_data.job_id
                )
                return
            logger.info("Transcoding completed")

            # Upload the output chunk
            logger.info(f"Uploading output chunk to S3: {job_data.output_s3_path}")
            try:
                s3_client.upload_file(
                    output_file.name, S3_BUCKET_NAME, job_data.output_s3_path
                )
            except ClientError as e:
                logger.error(f"Unable to upload output chunk: {e}")
                await send_transcode_result(
                    ch,
                    method,
                    Job.STATE_FAILED,
                    job_data.job_id,
                    error=str(e),
                    error_type="s3_upload",
                )
                return
    else:
        logger.error(f"Job {job_data.job_id} is in an unexpected state: {job.state}")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    # Send a completion message with the output chunk's blob ID
    await send_transcode_result(
        ch,
        method,
        Job.STATE_COMPLETED,
        job_data.job_id,
        output_s3_path=job_data.output_s3_path,
    )
    logger.info("Job completed and result message sent")


def main():
    Gst.init(None)

    # Connect to RabbitMQ and set up a channel
    credentials = pika.PlainCredentials(RMQ_USER, RMQ_PASSWORD)

    try:
        channel, connection = init_channels(
            RMQ_HOST,
            RMQ_PORT,
            credentials,
            JOB_QUEUE_NAME,
            RESULTS_QUEUE_NAME,
            PROGRESS_QUEUE_NAME,
        )
        logger.info(f"Connected to RabbitMQ on {RMQ_HOST}:{RMQ_PORT}")
    except Exception:
        logger.error(f"Unable to connect to RabbitMQ on {RMQ_HOST}:{RMQ_PORT}")
        return

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(
        queue=JOB_QUEUE_NAME,
        consumer_tag="worker-{}".format(worker_id),
        on_message_callback=lambda ch, method, properties, body: asyncio.get_event_loop().run_until_complete(
            process_workqueue_message(ch, method, properties, body)
        ),
    )

    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()

    connection.close()


if __name__ == "__main__":
    main()
