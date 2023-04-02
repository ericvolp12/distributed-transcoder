import json
import logging
import pika

QUEUE_NAME = "transcoding_jobs"
PROGRESS_QUEUE_NAME = "transcoding_progress"

job_data = {
    "job_id": "test_job_1",
    "input_key": "test_chunk_in_1.mp4",
    "output_key": "test_chunk_out_1.mp4",
    "transcode_options": "videoconvert ! x264enc",
}

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

credentials = pika.PlainCredentials("guest", "guest")
parameters = pika.ConnectionParameters("localhost", 5672, "/", credentials)

connection = pika.BlockingConnection(parameters)
channel = connection.channel()
channel.queue_declare(queue=QUEUE_NAME)

channel.basic_publish(
    exchange="",
    routing_key=QUEUE_NAME,
    body=json.dumps(job_data),
)

logging.info(f"Test job submitted: {job_data}")

channel.queue_declare(queue=PROGRESS_QUEUE_NAME)

# Progress queue message format:
# {"job_id": "{job_id}", "progress": 34.5}


def callback(ch, method, properties, body):
    # Log the job progress percentage
    logging.info(f"Progress: {json.loads(body)['progress']:.2f}%")


channel.basic_consume(
    queue=PROGRESS_QUEUE_NAME, on_message_callback=callback, auto_ack=True
)

# Wait and let the callback run until we receive a keyboard interrupt
logging.info("Waiting for progress messages. Press CTRL+C to exit.")
try:
    channel.start_consuming()
except KeyboardInterrupt:
    channel.stop_consuming()
connection.close()
