import {
  CloudArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import "react-tooltip/dist/react-tooltip.css";
import { Tooltip } from "react-tooltip";

import { Job } from "../Models";
import {
  ProgressMessage,
  JobResultMessage,
  isJobResultMessage,
  isProgressMessage,
} from "../Messages";

import CircularProgress from "../CircularProgress";
import JobStatusProgress from "./StatusProgress";
import { Pagination } from "../Pagination/Pagination";
import NewJob from "../JobSubmission/NewJob";

interface Alert {
  type: "error" | "success";
  message: string;
  autoDismiss?: boolean;
}

const JobList = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobRefreshQueued, setJobRefreshQueued] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [jobProgress, setJobProgress] = useState<{ [jobId: string]: number }>(
    {}
  );
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [connectedSockets, setConnectedSockets] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  // Add a new state variable to track whether jobs are loading or not
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, [pageSize, currentPage]);

  useEffect(() => {
    jobs.forEach((job) => {
      if (job.state === "in-progress") {
        handleJobProgress(job.job_id);
      }
      if (job.state === "queued") {
        // Trigger a refresh of jobs in 10 seconds if one isn't already pending
        if (!jobRefreshQueued) {
          setJobRefreshQueued(true);
          setTimeout(() => {
            fetchJobs();
            setJobRefreshQueued(false);
          }, 10000);
        }
      }
    });
  }, [jobs]);

  // Update this function to toggle the job submission form
  const handleFormToggle = () => {
    setIsFormVisible(!isFormVisible);
  };

  const fetchJobsWithPagination = async (skip: number, limit: number) => {
    setJobsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/jobs?skip=${skip}&limit=${limit}`
      );

      if (response.status === 404) {
        setAlert({
          type: "error",
          message: "No jobs found",
          autoDismiss: true,
        });
        if (currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      }

      const data = await response.json();
      let temp_jobs = data.map((job) => ({
        ...job,
        created_at: new Date(job.created_at),
        updated_at: new Date(job.updated_at),
      }));

      setJobs(temp_jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setJobsLoading(false);
    }
  };

  const fetchJobs = async () => {
    await fetchJobsWithPagination((currentPage - 1) * pageSize, pageSize);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
    fetchJobs();
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchJobs();
  };

  const handleJobProgress = (jobId: string) => {
    if (connectedSockets.includes(jobId)) {
      return;
    }
    const ws = new WebSocket(`ws://localhost:8000/progress/${jobId}`);
    setConnectedSockets((prevSockets) => [...prevSockets, jobId]);
    ws.onmessage = (message) => {
      const data: ProgressMessage | JobResultMessage = JSON.parse(message.data);

      if (isProgressMessage(data)) {
        setJobProgress((prevProgress) => ({
          ...prevProgress,
          [jobId]: data.progress,
        }));
      } else if (isJobResultMessage(data)) {
        setJobProgress((prevProgress) => {
          const { [jobId]: _, ...rest } = prevProgress;
          return rest;
        });
        fetchJobs();
      }
    };
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
    ws.onclose = () => {
      console.log("Connection to Progress WebSocket closed");
      setConnectedSockets((prevSockets) =>
        prevSockets.filter((socket) => socket !== jobId)
      );
    };
    return () => {
      ws.close();
      setConnectedSockets((prevSockets) =>
        prevSockets.filter((socket) => socket !== jobId)
      );
    };
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
          <button
            type="button"
            onClick={handleFormToggle}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Submit Job
          </button>
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

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg sm:rounded-b-none">
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
                        ) : job.error ? (
                          <>
                            <div
                              data-tooltip-id={`error-tooltip-${job.job_id}`}
                              data-tooltip-content={`(${job.error_type}): ${job.error}`}
                              data-tooltip-place="left"
                            >
                              {job.state}
                            </div>
                            <Tooltip
                              id={`error-tooltip-${job.job_id}`}
                              className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip dark:bg-gray-700 whitespace-break-spaces max-w-xs"
                            />
                          </>
                        ) : (
                          job.state
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {job.preset.name}
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
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          handlePageChange={setCurrentPage}
          handlePageSizeChange={handlePageSizeChange}
          loading={jobsLoading}
        />
        <NewJob
          open={isFormVisible}
          setOpen={(state: boolean) => {
            if (!state) {
              fetchJobs();
            }
            setIsFormVisible(state);
          }}
        />
      </div>
    </div>
  );
};

export default JobList;
