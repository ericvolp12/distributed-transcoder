import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  HashtagIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { useState, useEffect } from "react";
import Download from "./Download";
import Progress from "./Progress";
import Submit from "./Submit";
import Upload from "./Upload";

interface Alert {
  type: "error" | "success";
  message: string;
  autoDismiss?: boolean;
}

const NewJob = () => {
  const [provisionalJobID, setProvisionalJobID] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [outputPath, setOutputPath] = useState<string>("");
  const [inputPath, setInputPath] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [alert, setAlert] = useState<Alert | null>(null);

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

  const handleUpload = (path: string) => {
    // TODO: Implement the upload handling
    setInputPath(path);
  };

  const handleJobSubmit = (jobId: string, outputPath: string) => {
    setJobId(jobId);
    setOutputPath(outputPath); // Update the outputPath state
    setSubmitted(true);
    // TODO: Implement the job submission handling
  };

  const handleJobIDChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (provisionalJobID !== "") {
      try {
        const response = await fetch(
          `http://localhost:8000/jobs/${provisionalJobID}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (response.status === 404) {
          setJobId(provisionalJobID);
          return;
        } else if (response.status === 200) {
          setAlert({
            type: "error",
            message: `A Job with ID (${provisionalJobID}) already exists, please use a different Job ID.`,
            autoDismiss: true,
          });
        }
      } catch (err) {
        setAlert({
          type: "error",
          message: `Failed to validate Job ID: ${err.message}`,
          autoDismiss: true,
        });
      }
    }
  };

  return (
    <div className="min-h-fit">
      <div className="container mx-auto px-4 py-8 w-1/4 ">
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
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">Submit a New Transcoding Job</h1>
        </div>
        <div className="mx-auto ">
          <div className="bg-white p-6 px-8 rounded-lg shadow-md h-full mb-8">
            <label
              htmlFor="job-id"
              className="block text-xl font-bold mb-4 text-center"
            >
              Assign a Job ID
            </label>
            <div className="mt-2 flex rounded-md shadow-sm">
              <div className="relative flex-grow items-stretch focus-within:z-10">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <HashtagIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
                <input
                  type="text"
                  id="job-identifier"
                  className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-700 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  value={provisionalJobID}
                  disabled={submitted}
                  onChange={(e) => setProvisionalJobID(e.target.value)}
                  onBlur={handleJobIDChange}
                  placeholder="Enter Job ID"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 px-8 rounded-lg shadow-md h-full mb-8">
            <Upload onUpload={handleUpload} jobId={jobId} />
          </div>
          <div className="bg-white p-6 px-8 rounded-lg shadow-md h-full mb-8">
            <Submit
              jobId={jobId}
              inputPath={inputPath}
              onJobSubmit={handleJobSubmit}
            />
          </div>
          <div className="bg-white p-6 px-8 rounded-lg shadow-md h-full mb-8">
            <Progress jobId={jobId} setJobStatus={setJobStatus} />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md h-full">
            <Download outputPath={outputPath} jobStatus={jobStatus} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewJob;
