import asyncio
import logging
import time
from typing import Tuple, Callable

import pika
from pika.adapters.blocking_connection import BlockingChannel, BlockingConnection

# Define constants for queues
JOB_QUEUE_NAME = "transcoding_jobs"
PROGRESS_QUEUE_NAME = "transcoding_progress"
RESULTS_QUEUE_NAME = "transcoding_results"


def connect_rabbitmq(
    host: str,
    port: int,
    credentials: pika.PlainCredentials,
    retry_interval: int = 5,
    max_retries: int = 12,
) -> BlockingConnection:
    """
    Connect to RabbitMQ with the provided host, port, and credentials.

    :param host: The RabbitMQ host address.
    :param port: The RabbitMQ port.
    :param credentials: The authentication credentials for the RabbitMQ server.
    :param retry_interval: The interval (in seconds) between retries when the connection fails.
    :param max_retries: The maximum number of retries before giving up on connecting.
    :return: A blocking connection to the RabbitMQ server.
    """
    retries = 0
    while retries < max_retries:
        try:
            connection_parameters = pika.ConnectionParameters(
                host, port, "/", credentials
            )
            return BlockingConnection(connection_parameters)
        except pika.exceptions.AMQPConnectionError:
            logging.info(
                f"Connection to RabbitMQ failed. Retrying in {retry_interval} seconds..."
            )
            retries += 1
            time.sleep(retry_interval)

    raise Exception("Could not connect to RabbitMQ after multiple retries.")


def init_channels(
    rabbitmq_host: str,
    rabbitmq_port: int,
    credentials: pika.PlainCredentials,
) -> Tuple[BlockingChannel, BlockingConnection]:
    """
    Initialize the channels for the worker.

    :param connection: A blocking connection to the RabbitMQ server.
    :return: The channels for the worker.
    """
    connection = connect_rabbitmq(rabbitmq_host, rabbitmq_port, credentials)

    channel = connection.channel()

    # Initialize RabbitMQ Queues for each type of message stream
    channel.queue_declare(queue=JOB_QUEUE_NAME)
    channel.queue_declare(queue=PROGRESS_QUEUE_NAME)
    channel.queue_declare(queue=RESULTS_QUEUE_NAME)

    return (channel, connection)


async def consume_events(
    channel: BlockingChannel,
    result_callback: Callable,
    progress_callback: Callable,
):
    loop = asyncio.get_event_loop()
    while True:
        method, properties, body = await loop.run_in_executor(
            None, channel.basic_get, PROGRESS_QUEUE_NAME, True
        )
        if method is not None:
            await progress_callback(channel, method, properties, body)

        method, properties, body = await loop.run_in_executor(
            None, channel.basic_get, RESULTS_QUEUE_NAME, True
        )
        if method is not None:
            await result_callback(channel, method, properties, body)

        await asyncio.sleep(1)
