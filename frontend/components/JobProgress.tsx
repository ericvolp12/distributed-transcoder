import { useState, useEffect } from 'react';

interface JobProgressProps {
    jobId: string;
    setJobStatus: (status: string) => void;
}

interface JobResultMessage {
    status: string
    job_id: string
    output_s3_path: string
    error?: string
    error_type?: string
}

interface ProgressMessage {
    progress: number;
    job_id: string;
}

function isJobResultMessage(message: JobResultMessage | ProgressMessage): message is JobResultMessage {
    return (message as JobResultMessage).status !== undefined;
}

function isProgressMessage(message: JobResultMessage | ProgressMessage): message is ProgressMessage {
    return (message as ProgressMessage).progress !== undefined;
}

const JobProgress: React.FC<JobProgressProps> = ({ jobId, setJobStatus }) => {
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let ws: WebSocket;
        if (jobId) {
            ws = new WebSocket(`ws://localhost:8000/progress/${jobId}`);
            ws.onmessage = (message) => {
                if (error !== null) {
                    setError(null);
                }
                const data: JobResultMessage | ProgressMessage = JSON.parse(message.data);
                if (isJobResultMessage(data) && data.status === "completed") {
                    setProgress(100);
                    setJobStatus('completed');
                    return;
                }
                if (isJobResultMessage(data) && data.status === "failed") {
                    setError(data.error);
                    setJobStatus('failed');
                    return;
                }
                if (isProgressMessage(data)) {
                    setProgress(data.progress);
                    return;
                }
            };
            ws.onerror = (err) => {
                setError('Failed to retrieve Job Progress');
                setProgress(null);
            };
            ws.onclose = () => {
                console.log('Connection to Progress WebSocket closed');
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
                <div className="text-red-600 text-center absolute top-0 left-0 w-full h-6 flex items-center justify-center z-10">
                    {error}
                </div>
            )}
            {progress !== null && (
                <div className="h-6 w-full bg-gray-200 rounded-lg">
                    <div
                        className={`h-full bg-green-500 flex items-center text-sm rounded-lg whitespace-nowrap ${progress < 35 ? 'justify-start pl-2 text-black' : 'justify-center text-white'
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
