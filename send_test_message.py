import json
import logging
import time

import pika
from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic, BasicProperties

QUEUE_NAME = "transcoding_jobs"
PROGRESS_QUEUE_NAME = "transcoding_progress"
RESULTS_QUEUE_NAME = "transcoding_results"

# Job data with input_key, output_key, and transcode options
job_data = {
    "job_id": "test_job_2",
    "input_key": "test_chunk_2_in_1.mkv",
    "output_key": "test_chunk_2_out_1.mp4",
    "transcode_options": "filesrc location={{input_file}} ! matroskademux name=d \
        mp4mux name=mux ! filesink location={{output_file}} \
        d.audio_0 ! queue ! decodebin ! audioconvert ! voaacenc ! queue ! mux.audio_0 \
        d.video_0 ! queue ! decodebin ! videoscale ! video/x-raw,width=640,height=480 ! x265enc bitrate=768 tune=zerolatency ! {{progress}} ! h265parse ! queue ! mux.video_0",
}

# Configure logging
logging.getLogger("pika").setLevel(logging.WARNING)
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
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
    body=json.dumps(job_data),
)

start = time.time()

logging.info(f"Test job submitted: {job_data}")


def progress_callback(
    ch: BlockingChannel, method: Basic.Deliver, properties: BasicProperties, body: str
) -> None:
    """Handle progress updates by logging the job progress percentage."""
    msg = json.loads(body)
    logging.info(f"(Job: {msg['job_id']}) Progress: {msg['progress']:.2f}%")


# Consume messages from the progress queue
channel.basic_consume(
    queue=PROGRESS_QUEUE_NAME, on_message_callback=progress_callback, auto_ack=True
)


def result_callback(
    ch: BlockingChannel, method: Basic.Deliver, properties: BasicProperties, body: str
) -> None:
    """Handle job results by logging the job status."""
    msg = json.loads(body)
    logging.info(f"(Job: {msg['job_id']}) Result: {msg['status']}")
    if msg["job_id"] == job_data["job_id"] and msg["status"] == "completed":
        # This is the result for the test job, so stop consuming
        logging.info(f"Test job completed in {time.time() - start:.2f} seconds.")
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
