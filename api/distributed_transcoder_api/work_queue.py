import asyncio
import logging
from typing import Tuple, Callable
import aio_pika

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


async def consume_events(
    channel: aio_pika.Channel,
    result_callback: Callable,
    progress_callback: Callable,
):
    try:
        progress_queue = await channel.get_queue(PROGRESS_QUEUE_NAME)
        await progress_queue.consume(progress_callback)

        results_queue = await channel.get_queue(RESULTS_QUEUE_NAME)
        await results_queue.consume(result_callback)
    except Exception as e:
        logging.error(f"Error while consuming events: {e}")

    try:
        # Wait until terminate
        await asyncio.Future()
    finally:
        await channel.close()
