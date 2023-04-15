from typing import Optional

from pydantic import BaseModel


class TranscodingJob(BaseModel):
    job_id: str
    input_s3_path: str
    output_s3_path: str
    pipeline: Optional[str] = None
    preset_id: Optional[str] = None


class PresetCreate(BaseModel):
    name: str
    input_type: str
    output_type: str
    resolution: str
    video_encoding: str
    video_bitrate: str
    audio_encoding: str
    audio_bitrate: str
    pipeline: str


class PresetUpdate(BaseModel):
    name: Optional[str] = None
    input_type: Optional[str] = None
    output_type: Optional[str] = None
    pipeline: Optional[str] = None
    resolution: Optional[str] = None
    video_encoding: Optional[str] = None
    video_bitrate: Optional[str] = None
    audio_encoding: Optional[str] = None
    audio_bitrate: Optional[str] = None


class JobUpdate(BaseModel):
    input_s3_path: Optional[str] = None
    output_s3_path: Optional[str] = None
    pipeline: Optional[str] = None
    preset_id: Optional[str] = None
    state: Optional[str] = None
    error: Optional[str] = None
    error_type: Optional[str] = None
