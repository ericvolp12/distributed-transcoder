import asyncio
import json
import logging
import os
import tempfile
from dataclasses import asdict
from typing import Dict, List, Optional

import boto3
import pika
from botocore.exceptions import ClientError
from distributed_transcoder_common import (
    JobProgressMessage,
    JobResultMessage,
    JobSubmissionMessage,
)
from fastapi import FastAPI, File, HTTPException, Query, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pika.adapters.blocking_connection import BlockingChannel
from starlette.websockets import WebSocketDisconnect
from tortoise import Tortoise
from tortoise.contrib.fastapi import register_tortoise

from .managers import EventManager
from .models import Job, JobOut, Preset, PresetOut
from .schemas import PresetCreate, PresetUpdate, TranscodingJob
from .seed import seed_presets
from .work_queue import JOB_QUEUE_NAME, consume_events, init_channels

# Constants
AWS_ACCESS_KEY_ID = os.environ["AWS_ACCESS_KEY_ID"]
AWS_SECRET_ACCESS_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
AWS_S3_ENDPOINT_URL = os.environ["AWS_S3_ENDPOINT_URL"]
POSTGRES_USER = os.environ["POSTGRES_USER"]
POSTGRES_PASSWORD = os.environ["POSTGRES_PASSWORD"]
POSTGRES_DB = os.environ["POSTGRES_DB"]
POSTGRES_HOST = os.environ["POSTGRES_HOST"]

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
origins = [
    "http://localhost",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
s3 = boto3.client(
    service_name="s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    endpoint_url=AWS_S3_ENDPOINT_URL,
)


register_tortoise(
    app,
    db_url=f"postgres://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}/{POSTGRES_DB}",
    modules={"models": ["distributed_transcoder_api.models"]},
    add_exception_handlers=True,
)


@app.on_event("startup")
async def seed_data():
    await Tortoise.generate_schemas()
    await seed_presets()
    logger.info("Finished seeding presets")


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
    # Update the job state to 'in-progress'
    await Job.filter(job_id=msg.job_id).update(state="in-progress")
    await event_manager.send_message(msg.job_id, "progress", asdict(msg))


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
    # Update the job state to 'completed' or 'failed'
    await Job.filter(job_id=result.job_id).update(
        state=result.status, error=result.error, error_type=result.error_type
    )
    if result.status == "completed" or result.status == "failed":
        await event_manager.send_message(result.job_id, "completion", asdict(result))


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
    if job.preset_id:
        preset = await Preset.get_or_none(preset_id=job.preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        job.preset_id = preset.preset_id
        job.pipeline = preset.pipeline
    elif job.pipeline is None:
        raise HTTPException(
            status_code=400,
            detail="Either preset_id or pipeline must be provided",
        )

    job_submission_message = JobSubmissionMessage(
        job_id=job.job_id,
        input_s3_path=job.input_s3_path,
        output_s3_path=job.output_s3_path,
        transcode_options=job.pipeline,
    )
    channel.basic_publish(
        exchange="",
        routing_key=JOB_QUEUE_NAME,
        body=json.dumps(asdict(job_submission_message)),
    )
    # Create a record in the database
    await Job.create(**job.dict())
    return {"job_id": job.job_id}


@app.get("/jobs", response_model=List[JobOut])
async def list_jobs(skip: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100)):
    jobs = await Job.all().offset(skip).limit(limit).prefetch_related("preset")
    if len(jobs) == 0:
        raise HTTPException(status_code=404, detail="No jobs found")
    return jobs


@app.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: str):
    job = await Job.get_or_none(job_id=job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/presets", response_model=PresetOut)
async def create_preset(preset: PresetCreate):
    new_preset = await Preset.create(**preset.dict())
    return new_preset


@app.get("/presets", response_model=List[PresetOut])
async def list_presets(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    input_type: Optional[str] = None,
    output_type: Optional[str] = None,
):
    query = Preset.all()

    if input_type:
        query = query.filter(input_type=input_type)

    if output_type:
        query = query.filter(output_type=output_type)

    presets = await query.offset(skip).limit(limit)

    if len(presets) == 0:
        raise HTTPException(status_code=404, detail="No presets found")
    return presets


@app.get("/presets/{preset_id}", response_model=PresetOut)
async def get_preset(preset_id: str):
    preset = await Preset.get_or_none(preset_id=preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset


@app.put("/presets/{preset_id}", response_model=PresetOut)
async def update_preset(preset_id: str, preset: PresetUpdate):
    existing_preset = await Preset.get_or_none(preset_id=preset_id)
    if not existing_preset:
        raise HTTPException(status_code=404, detail="Preset not found")

    for key, value in preset.dict(exclude_none=True).items():
        setattr(existing_preset, key, value)
    await existing_preset.save()
    return existing_preset


@app.delete("/presets/{preset_id}", response_model=PresetOut)
async def delete_preset(preset_id: str):
    preset = await Preset.get_or_none(preset_id=preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    await preset.delete()
    return preset


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

    job = await Job.get_or_none(job_id=job_id)
    if not job:
        await websocket.send_json({"error": "Job not yet submitted"})

    # If the job is already done, send the completion message and close the connection
    if job_id in finished_jobs:
        await websocket.send_json(asdict(finished_jobs[job_id]))
        await websocket.close()
        return

    # If we have a progress message for the job, send it to the client
    if job_id in last_progress_messages:
        await websocket.send_json(asdict(last_progress_messages[job_id]))

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


@app.get("/signed_download/{filename}")
async def generate_presigned_url(filename: str):
    try:
        # Generate a pre-signed URL for the given file
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET_NAME, "Key": filename},
            ExpiresIn=3600,  # URL valid for 1 hour
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not presigned_url:
        raise HTTPException(status_code=404, detail="File not found")

    return {"url": presigned_url}
