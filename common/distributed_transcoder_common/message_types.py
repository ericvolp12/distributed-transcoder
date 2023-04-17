from dataclasses import dataclass
from typing import Optional


@dataclass
class JobSubmissionMessage:
    job_id: str
    input_s3_path: str
    output_s3_path: str
    transcode_options: str


@dataclass
class JobResultMessage:
    job_id: str
    status: str
    timestamp: Optional[float] = None
    worker_id: Optional[str] = None
    output_s3_path: Optional[str] = None
    error: Optional[str] = None
    error_type: Optional[str] = None


@dataclass
class JobProgressMessage:
    timestamp: float
    worker_id: str
    job_id: str
    progress: float
