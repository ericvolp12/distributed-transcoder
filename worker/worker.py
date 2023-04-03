import json
import logging
import os
import tempfile
import time
from typing import Tuple

import boto3
from botocore.exceptions import ClientError
import gi
import pika

gi.require_version("Gst", "1.0")
from gi.repository import GLib, Gst

# Constants
JOB_QUEUE_NAME = "transcoding_jobs"
PROGRESS_QUEUE_NAME = "transcoding_progress"
RESULTS_QUEUE_NAME = "transcoding_results"
AWS_ACCESS_KEY_ID = os.environ["AWS_ACCESS_KEY_ID"]
AWS_SECRET_ACCESS_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
AWS_S3_ENDPOINT_URL = os.environ["AWS_S3_ENDPOINT_URL"]

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s (%(name)s) [%(levelname)s]: %(message)s",
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
            logger.info(
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
    loop, pipeline, ch, job_id = data
    message_type = message.type
    if message_type == Gst.MessageType.ERROR:
        error, debug = message.parse_error()
        logger.error("Error received: %s" % error)
        logger.error("Debug info: %s" % debug)
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
    elif message_type == Gst.MessageType.ELEMENT:
        structure = message.get_structure()
        if structure and structure.get_name() == "progress":
            percent: float = structure.get_double("percent-double")[1]
            logger.info("Progress: {:.1f}%".format(percent))
            ch.basic_publish(
                exchange="",
                routing_key=PROGRESS_QUEUE_NAME,
                body=json.dumps({"job_id": job_id, "progress": round(percent, 4)}),
            )
    else:
        logger.debug("Unexpected message: %s" % message_type)

    return True


class TranscodeException(Exception):
    def __init__(self, error_type: str, *args):
        super().__init__(*args)
        self.error_type = error_type


class FailedToPlay(TranscodeException):
    "Raised when the pipeline cannot be played by GStreamer."

    def __init__(self, *args):
        super().__init__("pipeline_play", *args)


class FailedToParsePipeline(TranscodeException):
    "Raised when the pipeline cannot be parsed by GStreamer."

    def __init__(self, *args):
        super().__init__("pipeline_parse", *args)


class FailedMidTranscode(TranscodeException):
    "Raised when the pipeline fails after starting transcode."

    def __init__(self, *args):
        super().__init__("mid_transcode", *args)


def transcode(
    input_file: str,
    output_file: str,
    transcode_options: str,
    ch: pika.channel.Channel,
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
    bus.connect("message", on_message, (loop, pipeline, ch, job_id))

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

    return output_file


def handle_transcode_exception(
    ch: pika.channel.Channel,
    method: pika.spec.Basic.Deliver,
    e: TranscodeException,
    job_id: str,
):
    ch.basic_publish(
        exchange="",
        routing_key=RESULTS_QUEUE_NAME,
        body=json.dumps(
            {
                "status": "failed",
                "job_id": job_id,
                "error": str(e),
                "error_type": e.error_type,
            }
        ),
    )
    logger.error(f"Transcoding failed: {e.error_type}")
    ch.basic_ack(delivery_tag=method.delivery_tag)


def process_message(
    ch: pika.channel.Channel,
    method: pika.spec.Basic.Deliver,
    properties: pika.spec.BasicProperties,
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
    job_data = json.loads(body)
    job_id = job_data["job_id"]
    input_key = job_data["input_key"]
    output_key = job_data["output_key"]
    transcode_options = job_data["transcode_options"]

    with tempfile.NamedTemporaryFile() as input_file, tempfile.NamedTemporaryFile() as output_file:
        # Download the input chunk
        dl_start = time.time()
        logger.info(f"Downloading input chunk from S3: {input_key}")
        try:
            s3_client.download_file(S3_BUCKET_NAME, input_key, input_file.name)
        except ClientError as e:
            logger.error(f"Unable to download input chunk: {e}")
            ch.basic_publish(
                exchange="",
                routing_key=RESULTS_QUEUE_NAME,
                body=json.dumps(
                    {
                        "status": "failed",
                        "job_id": job_id,
                        "error": str(e),
                        "error_type": "s3_download",
                    }
                ),
            )
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return
        logger.info(
            f"Chunk finished downloading to: {input_file.name} in {time.time() - dl_start} seconds"
        )

        # Transcode the input chunk
        try:
            transcode(
                input_file.name,
                output_file.name,
                transcode_options,
                ch,
                job_id,
            )
        except TranscodeException as e:
            handle_transcode_exception(ch, method, e, job_id)
            return
        except Exception as e:
            handle_transcode_exception(
                ch, method, TranscodeException("unknown", str(e)), job_id
            )
            return
        logger.info("Transcoding completed")

        # Upload the output chunk
        logger.info(f"Uploading output chunk to S3: {output_key}")
        try:
            s3_client.upload_file(output_file.name, S3_BUCKET_NAME, output_key)
        except ClientError as e:
            logger.error(f"Unable to upload output chunk: {e}")
            ch.basic_publish(
                exchange="",
                routing_key=RESULTS_QUEUE_NAME,
                body=json.dumps(
                    {
                        "status": "failed",
                        "job_id": job_id,
                        "error": str(e),
                        "error_type": "s3_upload",
                    }
                ),
            )
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

    # Send a completion message with the output chunk's blob ID
    ch.basic_publish(
        exchange="",
        routing_key=RESULTS_QUEUE_NAME,
        body=json.dumps(
            {"status": "completed", "output_key": output_key, "job_id": job_id}
        ),
    )
    ch.basic_ack(delivery_tag=method.delivery_tag)
    logger.info("Job completed and result message sent")


def main():
    Gst.init(None)

    # Connect to RabbitMQ and set up a channel
    credentials = pika.PlainCredentials("guest", "guest")
    rabbitmq_host = "rabbitmq"
    rabbitmq_port = 5672

    try:
        connection = connect_rabbitmq(rabbitmq_host, rabbitmq_port, credentials)
    except Exception:
        logger.error(
            f"Unable to connect to RabbitMQ on {rabbitmq_host}:{rabbitmq_port}"
        )
        return

    # Initialize RabbitMQ Queues for each type of message stream
    channel = connection.channel()
    channel.queue_declare(queue=JOB_QUEUE_NAME)
    channel.queue_declare(queue=PROGRESS_QUEUE_NAME)
    channel.queue_declare(queue=RESULTS_QUEUE_NAME)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(
        queue=JOB_QUEUE_NAME,
        on_message_callback=lambda ch, method, properties, body: process_message(
            ch, method, properties, body
        ),
    )

    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()

    connection.close()


if __name__ == "__main__":
    main()