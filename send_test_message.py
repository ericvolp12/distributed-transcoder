import json
import logging
import time
from dataclasses import asdict

import pika
from distributed_transcoder_common import (
    JobProgressMessage,
    JobResultMessage,
    JobSubmissionMessage,
)
from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic, BasicProperties

QUEUE_NAME = "transcoding_jobs"
PROGRESS_QUEUE_NAME = "transcoding_progress"
RESULTS_QUEUE_NAME = "transcoding_results"


job_submission_message = JobSubmissionMessage(
    job_id="test_job_2",
    input_s3_path="test_chunk_in_1.mp4",
    output_s3_path="test_chunk_out_1.mp4",
    transcode_options="filesrc location={{input_file}} ! qtdemux name=d \
        mp4mux name=mux ! filesink location={{output_file}} \
        d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 \
        d.video_0 ! decodebin ! videoscale ! video/x-raw,width=640,height=480 ! x265enc bitrate=768 ! {{progress}} ! h265parse ! mux.video_0",
)

# Configure logging
logging.getLogger("pika").setLevel(logging.WARNING)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s (%(name)s) [%(levelname)s]: %(message)s",
)

# Connect to RabbitMQ with credentials
credentials = pika.PlainCredentials("guest", "guest")
parameters = pika.ConnectionParameters("localhost", 5672, "/", credentials)

connection = pika.BlockingConnection(parameters)
channel = connection.channel()

# Declare the necessary queues
channel.queue_declare(queue=QUEUE_NAME)
channel.queue_declare(queue=PROGRESS_QUEUE_NAME)
channel.queue_declare(queue=RESULTS_QUEUE_NAME)

# Publish the job to the transcoding_jobs queue
channel.basic_publish(
    exchange="",
    routing_key=QUEUE_NAME,
    body=json.dumps(asdict(job_submission_message)),
)

start = time.time()

logging.info(f"Test job submitted: {job_submission_message}")


def progress_callback(
    ch: BlockingChannel, method: Basic.Deliver, properties: BasicProperties, body: str
) -> None:
    """Handle progress updates by logging the job progress percentage."""
    msg = JobProgressMessage(**json.loads(body))
    logging.info(f"(Job: {msg.job_id}) Progress: {msg.progress:.2f}%")


# Consume messages from the progress queue
channel.basic_consume(
    queue=PROGRESS_QUEUE_NAME, on_message_callback=progress_callback, auto_ack=True
)


def result_callback(
    ch: BlockingChannel, method: Basic.Deliver, properties: BasicProperties, body: str
) -> None:
    """Handle job results by logging the job status."""
    result = JobResultMessage(**json.loads(body))
    logging.info(f"(Job: {result.job_id}) Result: {result.status}")
    if result.status == "completed":
        # This is the result for the test job, so stop consuming
        logging.info(
            f"(Job: {result.job_id}) Successfully processed after {time.time() - start:.2f} seconds."
        )
        ch.stop_consuming()
    if result.status == "failed":
        # This is the result for the test job, so stop consuming
        logging.info(
            f"(Job: {result.job_id}) Failed to process after {time.time() - start:.2f} seconds: ({result.error_type}) {result.error}"
        )
        ch.stop_consuming()


# Consume messages from the results queue
channel.basic_consume(
    queue=RESULTS_QUEUE_NAME,
    on_message_callback=result_callback,
    auto_ack=True,
)

# Wait and let the callback run until we receive a keyboard interrupt
logging.info("Waiting for progress messages. Press CTRL+C to exit.")
try:
    channel.start_consuming()
except KeyboardInterrupt:
    channel.stop_consuming()
connection.close()
