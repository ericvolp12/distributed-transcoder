interface JobResultMessage {
  status: string;
  job_id: string;
  output_s3_path: string;
  error?: string;
  error_type?: string;
}

interface ErrorMessage {
  error: string;
}

interface ProgressMessage {
  progress: number;
  job_id: string;
}

function isJobResultMessage(
  message: JobResultMessage | ProgressMessage | ErrorMessage
): message is JobResultMessage {
  return (message as JobResultMessage).status !== undefined;
}

function isProgressMessage(
  message: JobResultMessage | ProgressMessage | ErrorMessage
): message is ProgressMessage {
  return (message as ProgressMessage).progress !== undefined;
}

function isErrorMessage(
  message: JobResultMessage | ProgressMessage | ErrorMessage
): message is ErrorMessage {
  return (message as ErrorMessage).error !== undefined;
}

export type { JobResultMessage, ErrorMessage, ProgressMessage };
export { isJobResultMessage, isProgressMessage, isErrorMessage };
