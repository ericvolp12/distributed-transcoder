import asyncio
import json
import logging
import os
import tempfile
from dataclasses import asdict
from typing import Dict

import boto3
import pika
from distributed_transcoder_common import (
    JobProgressMessage,
    JobResultMessage,
    JobSubmissionMessage,
)
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket
from fastapi.responses import StreamingResponse
from pika.adapters.blocking_connection import BlockingChannel
from pydantic import BaseModel
from starlette.websockets import WebSocketDisconnect

from .managers import EventManager
from .work_queue import JOB_QUEUE_NAME, consume_events, init_channels

# Constants
AWS_ACCESS_KEY_ID = os.environ["AWS_ACCESS_KEY_ID"]
AWS_SECRET_ACCESS_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
AWS_S3_ENDPOINT_URL = os.environ["AWS_S3_ENDPOINT_URL"]


class TranscodingJob(BaseModel):
    job_id: str
    input_s3_path: str
    output_s3_path: str
    transcode_options: str


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

app = FastAPI()
s3 = boto3.client(
    service_name="s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    endpoint_url=AWS_S3_ENDPOINT_URL,
)

credentials = pika.PlainCredentials("guest", "guest")
channel, connection = init_channels("rabbitmq", 5672, credentials)

last_progress_messages: Dict[str, JobProgressMessage] = {}
finished_jobs: Dict[str, JobResultMessage] = {}

event_manager = EventManager()


async def progress_callback(ch: BlockingChannel, method, properties, body):
    """
    Callback for when a progress message is received from the work queue.

    :param ch: The channel the message was received on.
    :param method: The method used to deliver the message.
    :param properties: The message properties.
    :param body: The message body.

    :return: None
    """
    msg = JobProgressMessage(**json.loads(body))
    # Store the progress message in a dictionary so we can serve it to newly connected clients
    last_progress_messages[msg.job_id] = msg
    await event_manager.send_message(
        msg.job_id, "progress", f"Progress: {msg.progress:.2f}%"
    )


async def result_callback(ch: BlockingChannel, method, properties, body):
    """
    Callback for when a result message is received from the work queue.

    :param ch: The channel the message was received on.
    :param method: The method used to deliver the message.
    :param properties: The message properties.
    :param body: The message body.

    :return: None
    """
    result = JobResultMessage(**json.loads(body))
    # Store the result in a dictionary so we can tell newly connected clients that the job is done
    finished_jobs[result.job_id] = result
    last_progress_messages.pop(result.job_id, None)
    if result.status == "completed":
        await event_manager.send_message(
            result.job_id, "completion", f"Job {result.job_id} completed."
        )
    if result.status == "failed":
        await event_manager.send_message(
            result.job_id,
            "completion",
            f"Job {result.job_id} failed: ({result.error_type}) {result.error}",
        )


loop = asyncio.get_event_loop()
loop.create_task(consume_events(channel, result_callback, progress_callback))


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile() as temp_file:
        temp_file.write(file.file.read())
        temp_file.flush()
        s3.upload_file(temp_file.name, S3_BUCKET_NAME, file.filename)
    return {"filename": file.filename}


@app.post("/submit_job")
async def submit_job(job: TranscodingJob):
    """
    Submit a job to the work queue.

    Args:
        job (TranscodingJob): The job to submit

    Returns:
        Dict[str, str]: A dictionary containing the job ID
    """
    job_submission_message = JobSubmissionMessage(**job.dict())
    channel.basic_publish(
        exchange="",
        routing_key=JOB_QUEUE_NAME,
        body=json.dumps(asdict(job_submission_message)),
    )
    return {"job_id": job.job_id}


@app.websocket("/progress/{job_id}")
async def progress(websocket: WebSocket, job_id: str):
    """
    Websocket endpoint for clients to connect to and receive progress messages for a job.

    If the job is already done, the client will receive a completion message and the connection will be closed.
    If the job is not done, the client will receive progress messages until it disconnects.

    Args:
        websocket (WebSocket): The websocket connection
        job_id (str): The ID of the job to watch

    Returns:
        None
    """
    await websocket.accept()
    logging.info(
        f"Client {websocket.client.host}:{websocket.client.port} is now watching job: {job_id}"
    )

    # If the job is already done, send the completion message and close the connection
    if job_id in finished_jobs:
        await websocket.send_text(
            f"Job {job_id} completed with status: {finished_jobs[job_id].status}"
        )
        await websocket.close()
        return

    # If we have a progress message for the job, send it to the client
    if job_id in last_progress_messages:
        await websocket.send_text(
            f"Progress: {last_progress_messages[job_id].progress:.2f}%"
        )

    # Add the client to the event manager so we can send it progress messages
    event_manager.add_connection(job_id, websocket)

    # Wait for the client to disconnect
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        event_manager.disconnect(job_id, websocket)
        logging.info(
            f"Client {websocket.client.host}:{websocket.client.port} disconnected from watching job: {job_id}"
        )


@app.get("/download/{filename}")
async def download_file(filename: str):
    if not s3.head_object(Bucket=S3_BUCKET_NAME, Key=filename):
        raise HTTPException(status_code=404, detail="File not found")

    fileobj = s3.get_object(Bucket=S3_BUCKET_NAME, Key=filename)
    file = fileobj["Body"].read()

    def file_stream():
        yield file

    return StreamingResponse(file_stream(), media_type="application/octet-stream")
