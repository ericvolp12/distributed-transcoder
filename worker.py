import json
import os
import tempfile
import time
import logging
from typing import Optional, Tuple

import boto3
import gi
import pika
from gi.repository import GObject, Gst

gi.require_version("Gst", "1.0")
from gi.repository import GLib, Gst

# Constants
QUEUE_NAME = "transcoding_jobs"
PROGRESS_QUEUE_NAME = "transcoding_progress"
AWS_ACCESS_KEY_ID = os.environ["AWS_ACCESS_KEY_ID"]
AWS_SECRET_ACCESS_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
AWS_S3_ENDPOINT_URL = os.environ["AWS_S3_ENDPOINT_URL"]

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s]: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Set up S3 client
s3_client = boto3.client(
    service_name="s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    endpoint_url=AWS_S3_ENDPOINT_URL,
)


def connect_rabbitmq(
    host: str,
    port: int,
    credentials: pika.PlainCredentials,
    retry_interval: int = 5,
    max_retries: int = 12,
) -> pika.BlockingConnection:
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
            return pika.BlockingConnection(connection_parameters)
        except pika.exceptions.AMQPConnectionError:
            print(
                f"Connection to RabbitMQ failed. Retrying in {retry_interval} seconds..."
            )
            retries += 1
            time.sleep(retry_interval)

    raise Exception("Could not connect to RabbitMQ after multiple retries.")


def on_message(
    bus: Gst.Bus,
    message: Gst.Message,
    data: Tuple[GLib.MainLoop, Gst.Pipeline, pika.channel.Channel, str],
) -> bool:
    """
    Handle messages received from the GStreamer pipeline.

    :param bus: The GStreamer bus that received the message.
    :param message: The GStreamer message.
    :param data: A tuple containing the GLib main loop, the GStreamer pipeline, the progress channel, and the job ID.
    :return: True if the message was handled successfully.
    """
    loop, pipeline, progress_channel, job_id = data
    message_type = message.type
    if message_type == Gst.MessageType.ERROR:
        error, debug = message.parse_error()
        print("Error received: %s" % error)
        print("Debug info: %s" % debug)
        loop.quit()
    elif message_type == Gst.MessageType.EOS:
        print("End of stream")
        loop.quit()
    elif message_type == Gst.MessageType.STATE_CHANGED:
        old_state, new_state, pending_state = message.parse_state_changed()
        if message.src == pipeline:
            print(
                "Pipeline state changed from %s to %s"
                % (old_state.value_nick, new_state.value_nick)
            )
    elif message_type == Gst.MessageType.DURATION_CHANGED:
        pass
    elif message_type == Gst.MessageType.ELEMENT:
        structure = message.get_structure()
        if structure and structure.get_name() == "progress":
            percent: float = structure.get_double("percent-double")[1]
            logger.info("Progress: {:.1f}%".format(percent))
            progress_channel.basic_publish(
                exchange="",
                routing_key="transcoding_progress",
                body=json.dumps({"job_id": job_id, "progress": round(percent, 4)}),
            )
    else:
        print("Unexpected message: %s" % message_type)

    return True


def transcode(
    input_file: str,
    output_file: str,
    transcode_options: str,
    progress_channel: pika.channel.Channel,
    job_id: str,
) -> Optional[str]:
    """
    Transcode the input file to the output file using the specified transcode options and report progress to the channel.

    :param input_file: The path to the input file.
    :param output_file: The path to the output file.
    :param transcode_options: The GStreamer transcoding options.
    :param progress_channel: The RabbitMQ channel for reporting progress.
    :param job_id: The unique identifier for the transcoding job.
    :return: The path to the output file if successful, None otherwise.
    """
    Gst.init(None)
    pipeline_str = f"filesrc location={input_file} ! decodebin ! {transcode_options} ! progressreport update-freq=10 ! filesink location={output_file}"

    pipeline = Gst.parse_launch(pipeline_str)
    bus = pipeline.get_bus()
    bus.add_signal_watch()
    loop = GLib.MainLoop()
    bus.connect("message", on_message, (loop, pipeline, progress_channel, job_id))

    # Set the pipeline to the playing state
    ret = pipeline.set_state(Gst.State.PLAYING)
    if ret == Gst.StateChangeReturn.FAILURE:
        logger.error("Unable to set the pipeline to the playing state.")
        return None

    # Start the GLib main loop
    try:
        loop.run()
    except Exception as e:
        logger.error(f"An error occurred while running the main loop: {e}")
    finally:
        pipeline.set_state(Gst.State.NULL)

    return output_file


def process_message(
    ch: pika.channel.Channel,
    method: pika.spec.Basic.Deliver,
    properties: pika.spec.BasicProperties,
    body: bytes,
    progress_channel: pika.channel.Channel,
) -> None:
    """
    Process a transcoding job message received from the queue.

    :param ch: The RabbitMQ channel.
    :param method: The delivery method.
    :param properties: The message properties.
    :param body: The message body, containing the job data as JSON.
    """
    logger.info("Received a new transcoding job")
    job_data = json.loads(body)
    job_id = job_data["job_id"]
    input_key = job_data["input_key"]
    output_key = job_data["output_key"]
    transcode_options = job_data["transcode_options"]

    with tempfile.NamedTemporaryFile() as input_file, tempfile.NamedTemporaryFile() as output_file:
        # Download the input chunk
        dl_start = time.time()
        logger.info(f"Downloading input chunk from S3: {input_key}")
        s3_client.download_file(S3_BUCKET_NAME, input_key, input_file.name)
        logger.info(
            f"Chunk finished downloading to: {input_file.name} in {time.time() - dl_start} seconds"
        )

        # Transcode the input chunk
        logger.info(f"Starting transcoding with options: {transcode_options}")
        transcode(
            input_file.name,
            output_file.name,
            transcode_options,
            progress_channel,
            job_id,
        )
        logger.info("Transcoding completed")

        # Upload the output chunk
        logger.info(f"Uploading output chunk to S3: {output_key}")
        s3_client.upload_file(output_file.name, S3_BUCKET_NAME, output_key)

    # Send a completion message with the output chunk's blob ID
    ch.basic_publish(
        exchange="",
        routing_key="transcoding_results",
        body=json.dumps({"status": "completed", "output_key": output_key}),
    )
    ch.basic_ack(delivery_tag=method.delivery_tag)
    logger.info("Job completed and result message sent")


def main():
    GObject.threads_init()
    Gst.init(None)

    # Connect to RabbitMQ and set up a channel
    credentials = pika.PlainCredentials("guest", "guest")
    rabbitmq_host = "rabbitmq"
    rabbitmq_port = 5672

    connection = connect_rabbitmq(rabbitmq_host, rabbitmq_port, credentials)
    channel = connection.channel()
    channel.queue_declare(queue=QUEUE_NAME)

    # Set up a channel for reporting progress
    progress_channel = connection.channel()
    progress_channel.queue_declare(queue=PROGRESS_QUEUE_NAME)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(
        queue=QUEUE_NAME,
        on_message_callback=lambda ch, method, properties, body: process_message(
            ch, method, properties, body, progress_channel
        ),
    )

    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()

    connection.close()


if __name__ == "__main__":
    main()
