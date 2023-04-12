import logging
import time
from typing import Tuple

import pika
from pika.adapters.blocking_connection import BlockingChannel, BlockingConnection


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
    job_queue_name: str,
    progress_queue_name: str,
    results_queue_name: str,
) -> Tuple[BlockingChannel, BlockingConnection]:
    """
    Initialize the channels for the worker.

    :param connection: A blocking connection to the RabbitMQ server.
    :return: The channels for the worker.
    """
    connection = connect_rabbitmq(rabbitmq_host, rabbitmq_port, credentials)

    channel = connection.channel()

    # Initialize a standard queue for jobs
    channel.queue_declare(queue=job_queue_name)

    # Initialize a topic exchange for progress logs
    channel.exchange_declare(exchange="progress_logs", exchange_type="topic")
    # Initialize a queue for progress logs
    channel.queue_declare(queue=progress_queue_name)
    channel.queue_bind(
        exchange="progress_logs", queue=progress_queue_name, routing_key="progress"
    )

    # Initialize a topic exchange for results
    channel.exchange_declare(exchange="results_logs", exchange_type="topic")
    # Initialize a queue for results
    channel.queue_declare(queue=results_queue_name)
    channel.queue_bind(
        exchange="results_logs", queue=results_queue_name, routing_key="results"
    )

    return (channel, connection)
