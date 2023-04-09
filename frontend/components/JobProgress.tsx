import { useState, useEffect } from "react";
import {
  ProgressMessage,
  JobResultMessage,
  ErrorMessage,
  isErrorMessage,
  isJobResultMessage,
  isProgressMessage,
} from "./Messages";

interface JobProgressProps {
  jobId: string;
  setJobStatus: (status: string) => void;
}

const JobProgress: React.FC<JobProgressProps> = ({ jobId, setJobStatus }) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    if (jobId) {
      ws = new WebSocket(`ws://localhost:8000/progress/${jobId}`);
      ws.onmessage = (message) => {
        const data: JobResultMessage | ProgressMessage | ErrorMessage =
          JSON.parse(message.data);

        if (isErrorMessage(data) && data.error) {
          setJobStatus("not_found");
          setError(data.error);
          setProgress(null);
          setSuccess(null);
        } else if (isJobResultMessage(data) && data.status === "completed") {
          setJobStatus("completed");
          setError(null);
          setProgress(100);
          setSuccess("Job Completed Successfully");
        } else if (isJobResultMessage(data) && data.status === "failed") {
          setJobStatus("failed");
          setError(data.error);
          setProgress(null);
          setSuccess(null);
        } else if (isProgressMessage(data)) {
          setJobStatus("in_progress");
          setError(null);
          setProgress(data.progress);
          setSuccess(null);
        }
      };
      ws.onerror = (err) => {
        setJobStatus("not_found");
        setError("Failed to retrieve Job Progress");
        setProgress(null);
        setSuccess(null);
      };
      ws.onclose = () => {
        console.log("Connection to Progress WebSocket closed");
      };
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [jobId]);

  if (!jobId) {
    return null;
  }
  return (
    <div className="w-full relative h-6">
      {error && (
        <div className="text-red-600 font-semibold text-center absolute top-0 left-0 w-full h-6 flex items-center justify-center z-10">
          {error}
        </div>
      )}
      {success && (
        <div className="text-green-600 font-semibold text-center absolute top-0 left-0 w-full h-6 flex items-center justify-center z-10">
          {success}
        </div>
      )}
      {progress !== null && success === null && (
        <div className="h-6 w-full bg-gray-200 rounded-lg">
          <div
            className={`h-full bg-green-500 flex items-center text-sm rounded-lg whitespace-nowrap ${
              progress < 35
                ? "justify-start pl-2 text-black"
                : "justify-center text-white"
            } font-semibold`}
            style={{ width: `${progress}%` }}
          >
            Job Progress: {progress.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default JobProgress;
