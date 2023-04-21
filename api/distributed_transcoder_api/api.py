import asyncio
import contextlib
import json
import logging
import os
import random
import string
import tempfile
from dataclasses import asdict
from typing import Dict, List, Optional, Union

import aio_pika
import boto3
from botocore.exceptions import ClientError
from distributed_transcoder_common import JobResultMessage, JobSubmissionMessage
from distributed_transcoder_common.models import (
    Job,
    JobOut,
    Preset,
    PresetOut,
    Playlist,
    PlaylistOut,
)
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.websockets import WebSocketDisconnect
from tortoise import Tortoise, connections
from tortoise.exceptions import DoesNotExist, IntegrityError

from .managers import EventManager
from .schemas import (
    JobUpdate,
    PlaylistShallowOut,
    PresetCreate,
    PlaylistCreateOut,
    PresetUpdate,
    TranscodingJob,
    PlaylistCreate,
)
from .seed import seed_presets
from .work_queue import JOB_QUEUE_NAME, WorkQueue, init_channels

# Constants
# S3 Config
S3_ACCESS_KEY_ID = os.environ["S3_ACCESS_KEY_ID"]
S3_SECRET_ACCESS_KEY = os.environ["S3_SECRET_ACCESS_KEY"]
S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
S3_ENDPOINT_URL = os.environ["S3_ENDPOINT_URL"]

# DB Config
POSTGRES_USER = os.environ["POSTGRES_USER"]
POSTGRES_PASSWORD = os.environ["POSTGRES_PASSWORD"]
POSTGRES_DB = os.environ["POSTGRES_DB"]
POSTGRES_HOST = os.environ["POSTGRES_HOST"]

# RabbitMQ Config
RMQ_HOST = os.environ["RMQ_HOST"]
RMQ_PORT = int(os.environ["RMQ_PORT"])
RMQ_USER = os.environ["RMQ_USER"]
RMQ_PASSWORD = os.environ["RMQ_PASSWORD"]

# Generate a random 5-character API Instance ID
api_instance_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format=f"%(asctime)s |{api_instance_id}| (%(name)s) [%(levelname)s]: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

for log_name, log_level in [
    ("pika", logging.CRITICAL),
    ("botocore", logging.WARNING),
    ("gst", logging.WARNING),
]:
    logging.getLogger(log_name).setLevel(log_level)

global channel


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> Dict[str, Union[WorkQueue, EventManager]]:
    logger.info("Lifecycle starting up...")
    logger.info("Initializing Tortoise ORM...")
    await Tortoise.init(
        db_url=f"postgres://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}/{POSTGRES_DB}",
        modules={"models": ["distributed_transcoder_common.models"]},
    )
    await Tortoise.generate_schemas()
    logger.info("Tortoise-ORM started")

    loop = asyncio.get_event_loop()
    global channel

    logger.info("Initializing RabbitMQ channels...")
    channel, connection = await init_channels(
        RMQ_HOST, RMQ_PORT, RMQ_USER, RMQ_PASSWORD
    )

    logger.info("Starting RabbitMQ event consumer...")
    event_manager = EventManager()
    event_consumer = WorkQueue(channel, event_manager, logger)
    # Start the event consumer and prevent it from being GC'd
    event_consumption = loop.create_task(event_consumer.consume_events())

    logger.info("Seeding presets...")
    await seed_presets()
    logger.info("Finished seeding presets")

    # Yield control back to the application
    yield {"event_manager": event_manager, "event_consumer": event_consumer}

    # Run on FastAPI shutdown
    logger.info("Closing RabbitMQ connection...")
    await connection.close()

    logger.info("Closing Tortoise ORM connection...")
    await connections.close_all()
    logger.info("Lifecycle shutdown complete")


app = FastAPI(lifespan=lifespan)


# Handle Tortoise ORM Exceptions
@app.exception_handler(DoesNotExist)
async def doesnotexist_exception_handler(request: Request, exc: DoesNotExist):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(IntegrityError)
async def integrityerror_exception_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=422,
        content={"detail": [{"loc": [], "msg": str(exc), "type": "IntegrityError"}]},
    )


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
    aws_access_key_id=S3_ACCESS_KEY_ID,
    aws_secret_access_key=S3_SECRET_ACCESS_KEY,
    endpoint_url=S3_ENDPOINT_URL,
)


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

    # Create a record in the database
    await Job.create(**job.dict())

    job_submission_message = JobSubmissionMessage(
        job_id=job.job_id,
        input_s3_path=job.input_s3_path,
        output_s3_path=job.output_s3_path,
        transcode_options=job.pipeline,
    )

    await channel.default_exchange.publish(
        aio_pika.Message(
            json.dumps(asdict(job_submission_message)).encode(),
            content_type="application/json",
        ),
        routing_key=JOB_QUEUE_NAME,
    )

    return {"job_id": job.job_id}


@app.get("/jobs", response_model=List[JobOut])
async def list_jobs(skip: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100)):
    jobs = (
        await Job.all()
        .offset(skip)
        .limit(limit)
        .prefetch_related("preset", "playlists")
    )
    if len(jobs) == 0:
        raise HTTPException(status_code=404, detail="No jobs found")
    return jobs


@app.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: str):
    job = await Job.get_or_none(job_id=job_id).prefetch_related("preset", "playlists")
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.put("/jobs/{job_id}", response_model=JobOut)
async def update_job(job_id: str, job: JobUpdate):
    existing_job = await Job.get_or_none(job_id=job_id).prefetch_related(
        "preset", "playlists"
    )
    if not existing_job:
        raise HTTPException(status_code=404, detail="Preset not found")

    for key, value in job.dict(exclude_none=True).items():
        setattr(existing_job, key, value)
    await existing_job.save()
    return existing_job


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


# GET Playlists
@app.get(
    "/playlists", response_model=Union[List[PlaylistOut], List[PlaylistShallowOut]]
)
async def list_playlists(
    skip: int = Query(0, ge=0),
    deep: bool = Query(False, description="Include full jobs in response"),
    limit: int = Query(10, ge=1, le=100),
    name: Optional[str] = None,
):
    query = Playlist.all().prefetch_related("jobs", "jobs__preset")

    if name:
        query = query.filter(name=name)

    playlists = await query.offset(skip).limit(limit)

    if len(playlists) == 0:
        raise HTTPException(status_code=404, detail="No playlists found")
    if deep:
        return playlists
    return [
        PlaylistShallowOut(
            playlist_id=str(playlist.id),
            name=playlist.name,
            jobs=[str(job.id) for job in playlist.jobs],
            created_at=playlist.created_at,
            updated_at=playlist.updated_at,
        )
        for playlist in playlists
    ]


@app.post("/playlists", response_model=PlaylistCreateOut)
async def create_playlist(playlist: PlaylistCreate):
    # Create the playlist
    new_playlist = await Playlist.create(
        name=playlist.name, input_s3_path=playlist.input_s3_path
    )

    # Create jobs for each preset
    jobs = []
    for idx, preset_id in enumerate(playlist.presets):
        job_id = f"{playlist.name}-{idx}"

        # Get the preset
        preset = await Preset.get_or_none(preset_id=preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")

        # Define the output S3 path
        output_s3_path = f"{new_playlist.id}/{preset_id}/{job_id}.mp4"

        # Create the job
        job = await Job.create(
            job_id=job_id,
            input_s3_path=playlist.input_s3_path,
            output_s3_path=output_s3_path,
            pipeline=preset.pipeline,
            preset_id=preset_id,
        )

        # Add the job to the playlist
        await new_playlist.jobs.add(job)

        job_submission_message = JobSubmissionMessage(
            job_id=job.job_id,
            input_s3_path=job.input_s3_path,
            output_s3_path=job.output_s3_path,
            transcode_options=job.pipeline,
        )

        await channel.default_exchange.publish(
            aio_pika.Message(
                json.dumps(asdict(job_submission_message)).encode(),
                content_type="application/json",
            ),
            routing_key=JOB_QUEUE_NAME,
        )

        jobs.append(job_id)

    await new_playlist.save()

    return PlaylistCreateOut(
        playlist_id=str(new_playlist.id),
        input_s3_path=playlist.input_s3_path,
        jobs=jobs,
    )


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
    logger.info(
        f"Client {websocket.client.host}:{websocket.client.port} is now watching job: {job_id}"
    )

    job = await Job.get_or_none(job_id=job_id)
    if not job:
        await websocket.send_json({"error": "Job not yet submitted"})

    # If the job is already done, send the completion message and close the connection
    if job.state != Job.STATE_IN_PROGRESS and job.state != Job.STATE_QUEUED:
        result_message = JobResultMessage(
            timestamp=None,
            worker_id=None,
            job_id=job.job_id,
            output_s3_path=job.output_s3_path,
            status=job.state,
            error=job.error,
            error_type=job.error_type,
        )
        await websocket.send_json(asdict(result_message))
        await websocket.close()
        return

    # If we have a progress message for the job, send it to the client
    if job_id in websocket.state.event_consumer.last_progress_messages:
        message = websocket.state.event_consumer.last_progress_messages[job_id]
        await websocket.send_json(asdict(message))

    # Add the client to the event manager so we can send it progress messages
    websocket.state.event_manager.add_connection(job_id, websocket)

    # Wait for the client to disconnect
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        websocket.state.event_manager.disconnect(job_id, websocket)
        logger.info(
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


@app.get("/signed_download/{filename:path}")
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
