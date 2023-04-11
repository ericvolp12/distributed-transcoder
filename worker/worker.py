import json
import logging
import os
import tempfile
import time
from dataclasses import asdict
from typing import Tuple
import threading

import boto3
import gi
import pika
from botocore.exceptions import ClientError
from distributed_transcoder_common import (
    JobProgressMessage,
    JobResultMessage,
    JobSubmissionMessage,
)
from errors import (
    FailedMidTranscode,
    FailedToParsePipeline,
    FailedToPlay,
    PipelineTimeout,
    TranscodeException,
)
from pika.channel import Channel
from pika.spec import Basic, BasicProperties
from work_queue import (
    JOB_QUEUE_NAME,
    PROGRESS_QUEUE_NAME,
    RESULTS_QUEUE_NAME,
    init_channels,
)

gi.require_version("Gst", "1.0")
from gi.repository import GLib, Gst

# Constants
AWS_ACCESS_KEY_ID = os.environ["AWS_ACCESS_KEY_ID"]
AWS_SECRET_ACCESS_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
AWS_S3_ENDPOINT_URL = os.environ["AWS_S3_ENDPOINT_URL"]
TIMEOUT_SECONDS = 60  # 1 minute


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
                exchange="",
                routing_key=PROGRESS_QUEUE_NAME,
                body=json.dumps(asdict(JobProgressMessage(job_id, round(percent, 4)))),
            )
            last_progress_time = time.time()
    else:
        logger.debug("Unexpected message: %s" % message_type)

    return True


def check_timeout(
    loop: GLib.MainLoop, pipeline: Gst.Pipeline, ch: Channel, job_id: str
):
    global last_progress_time
    global transcoding_error
    while True:
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
    global last_progress_time
    last_progress_time = time.time()

    global transcoding_error
    transcoding_error = (None, None)

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
    if transcoding_error:
        error_type, error_msg = transcoding_error
        if error_type == "pipeline_timeout":
            raise PipelineTimeout(error_msg)
        else:
            raise FailedMidTranscode(error_msg)

    return output_file


def handle_transcode_exception(
    ch: Channel,
    method: Basic.Deliver,
    e: TranscodeException,
    job_id: str,
):
    send_transcode_result(
        ch, method, "failed", job_id, error=str(e), error_type=e.error_type
    )


def send_transcode_result(
    ch: Channel,
    method: Basic.Deliver,
    status: str,
    job_id: str,
    output_s3_path: str = None,
    error: str = None,
    error_type: str = None,
):
    ch.basic_publish(
        exchange="",
        routing_key=RESULTS_QUEUE_NAME,
        body=json.dumps(
            asdict(
                JobResultMessage(
                    status,
                    job_id,
                    output_s3_path,
                    error,
                    error_type,
                )
            )
        ),
    )
    if error:
        logger.error(f"Transcoding failed: {error_type}")
    ch.basic_ack(delivery_tag=method.delivery_tag)


def process_workqueue_message(
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
            ch.basic_publish(
                exchange="",
                routing_key=RESULTS_QUEUE_NAME,
                body=json.dumps(
                    asdict(
                        JobResultMessage(
                            status="failed",
                            job_id=job_data.job_id,
                            error=str(e),
                            error_type="s3_download",
                        )
                    )
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
                job_data.transcode_options,
                ch,
                job_data.job_id,
            )
        except TranscodeException as e:
            handle_transcode_exception(ch, method, e, job_data.job_id)
            return
        except Exception as e:
            handle_transcode_exception(
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
            send_transcode_result(
                ch,
                method,
                "failed",
                job_data.job_id,
                error=str(e),
                error_type="s3_upload",
            )
            return

    # Send a completion message with the output chunk's blob ID
    send_transcode_result(
        ch,
        method,
        "completed",
        job_data.job_id,
        output_s3_path=job_data.output_s3_path,
    )
    logger.info("Job completed and result message sent")


def main():
    Gst.init(None)

    # Connect to RabbitMQ and set up a channel
    credentials = pika.PlainCredentials("guest", "guest")
    rabbitmq_host = "rabbitmq"
    rabbitmq_port = 5672

    try:
        channel, connection = init_channels(rabbitmq_host, rabbitmq_port, credentials)
        logger.info(f"Connected to RabbitMQ on {rabbitmq_host}:{rabbitmq_port}")
    except Exception:
        logger.error(
            f"Unable to connect to RabbitMQ on {rabbitmq_host}:{rabbitmq_port}"
        )
        return

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(
        queue=JOB_QUEUE_NAME,
        on_message_callback=lambda ch, method, properties, body: process_workqueue_message(
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
