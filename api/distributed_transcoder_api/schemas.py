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
    pipeline: str


class PresetUpdate(BaseModel):
    name: Optional[str] = None
    input_type: Optional[str] = None
    output_type: Optional[str] = None
    pipeline: Optional[str] = None
