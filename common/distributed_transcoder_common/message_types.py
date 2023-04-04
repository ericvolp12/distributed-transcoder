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
    status: str
    job_id: str
    output_s3_path: str
    error: Optional[str]
    error_type: Optional[str]


@dataclass
class JobProgressMessage:
    job_id: str
    progress: float
