import {
  CloudArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import { useEffect, useState } from "react";
import CircularProgress from "../CircularProgress";
import JobStatusProgress from "./StatusProgress";
import { ProgressMessage, isProgressMessage } from "../Messages";

interface Job {
  job_id: string;
  input_s3_path: string;
  output_s3_path: string;
  state: string;
  preset_id?: string;
  preset_name?: string;
  pipeline?: string;
  created_at: Date;
  updated_at: Date;
}

interface Alert {
  type: "error" | "success";
  message: string;
  autoDismiss?: boolean;
}

const JobList = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [jobProgress, setJobProgress] = useState<{ [jobId: string]: number }>(
    {}
  );

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    jobs.forEach((job) => {
      if (job.state === "in-progress") {
        handleJobProgress(job.job_id);
      }
    });
  }, [jobs]);

  const fetchJobs = async () => {
    try {
      const response = await fetch("http://localhost:8000/jobs");
      const data = await response.json();
      let temp_jobs = data.jobs.map((job) => ({
        ...job,
        created_at: new Date(job.created_at),
        updated_at: new Date(job.updated_at),
      }));

      const jobsWithPresetNames = await Promise.all(
        temp_jobs.map(async (job: Job) => {
          try {
            const presetName = await fetchPresetData(job.preset_id);
            return { ...job, preset_name: presetName };
          } catch (error) {
            console.error(error);
            return { ...job, preset_name: "Not found" };
          }
        })
      );
      setJobs(jobsWithPresetNames);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  };

  const handleJobProgress = (jobId: string) => {
    const ws = new WebSocket(`ws://localhost:8000/progress/${jobId}`);
    ws.onmessage = (message) => {
      const data: ProgressMessage = JSON.parse(message.data);

      if (isProgressMessage(data)) {
        setJobProgress((prevProgress) => ({
          ...prevProgress,
          [jobId]: data.progress,
        }));
      }
    };
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
    ws.onclose = () => {
      console.log("Connection to Progress WebSocket closed");
    };
    return () => {
      ws.close();
    };
  };

  const fetchPresetData = async (presetId: string) => {
    const response = await fetch(`http://localhost:8000/presets/${presetId}`);
    if (response.ok) {
      const preset = await response.json();
      return preset.name;
    } else {
      throw new Error("Failed to fetch preset data");
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    const response = await fetch(url);
    const reader = response.body.getReader();
    const contentLength = parseInt(response.headers.get("Content-Length"));

    let receivedLength = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      const progress = (receivedLength / contentLength) * 100;
      setProgress(progress);
    }

    const blob = new Blob(chunks);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    setLoadingJob(null);
    setProgress(0);

    setAlert({
      type: "success",
      message: "Download completed",
      autoDismiss: true,
    });
  };

  const handleDownload = async (s3_path: string, loading_job_id: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/signed_download/${s3_path}`
      );
      if (response.ok) {
        const data = await response.json();
        const filename = s3_path.split("/").pop();
        setLoadingJob(loading_job_id);
        await downloadFile(data.url.replace("minio", "localhost"), filename);
      } else {
        const message = await response.text();
        setAlert({ type: "error", message: `Error: ${message}` });
      }
    } catch (err) {
      setAlert({ type: "error", message: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = () => {
    setAlert(null);
  };

  useEffect(() => {
    if (alert && alert.autoDismiss) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-gray-900">
            Jobs
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all the transcoding jobs submitted to the Distributed
            Transcoder
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            type="button"
            href="/new_job"
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Submit Job
          </Link>
        </div>
      </div>
      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            {alert && (
              <div
                className={`rounded-md p-4 mb-4 ${
                  alert.type === "success" ? "bg-green-50" : "bg-yellow-50"
                }`}
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    {alert.type === "success" ? (
                      <CheckCircleIcon
                        className="h-5 w-5 text-green-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <ExclamationTriangleIcon
                        className="h-5 w-5 text-yellow-400"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        alert.type === "success"
                          ? "text-green-800"
                          : "text-yellow-800"
                      }`}
                    >
                      {alert.message}
                    </p>
                  </div>
                  <div className="ml-auto pl-3">
                    <div className="-mx-1.5 -my-1.5">
                      <button
                        type="button"
                        className={`inline-flex rounded-md p-1.5 ${
                          alert.type === "success"
                            ? "text-green-500 bg-green-50 hover:bg-green-100"
                            : "text-yellow-500 bg-yellow-50 hover:bg-yellow-100"
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          alert.type === "success"
                            ? "focus:ring-green-600 focus:ring-offset-green-50"
                            : "focus:ring-yellow-600 focus:ring-offset-yellow-50"
                        }`}
                        onClick={dismissAlert}
                      >
                        <span className="sr-only">Dismiss</span>
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loadingJob && (
              <div
                className="fixed inset-x-0 bottom-0 h-1 bg-indigo-600"
                style={{ width: `${progress}%` }}
              ></div>
            )}

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      ID
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Preset
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Input Path
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Output Path
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Updated At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {jobs.map((job) => (
                    <tr key={job.job_id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {job.job_id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {job.state === "in-progress" ? (
                          <JobStatusProgress
                            progress={jobProgress[job.job_id] || 0}
                          />
                        ) : (
                          job.state
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {job.preset_name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <button
                          type="button"
                          className="relative focus:outline-none"
                          onClick={() =>
                            handleDownload(
                              job.input_s3_path,
                              job.job_id + "_input"
                            )
                          }
                        >
                          {loadingJob === job.job_id + "_input" ? (
                            <CircularProgress progress={progress} />
                          ) : (
                            <CloudArrowDownIcon className="inline-block w-4 h-4 ml-1" />
                          )}
                        </button>
                        {" " + job.input_s3_path}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <button
                          type="button"
                          className="relative focus:outline-none"
                          onClick={() =>
                            handleDownload(
                              job.output_s3_path,
                              job.job_id + "_output"
                            )
                          }
                        >
                          {loadingJob === job.job_id + "_output" ? (
                            <CircularProgress progress={progress} />
                          ) : (
                            <CloudArrowDownIcon className="inline-block w-4 h-4 ml-1" />
                          )}
                        </button>
                        {" " + job.output_s3_path}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {job.updated_at.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobList;
