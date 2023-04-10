import { HashtagIcon } from "@heroicons/react/24/solid";
import { ReactNode, useState } from "react";
import DownloadVideo from "./DownloadVideo";
import JobProgress from "./JobProgress";
import SubmitJob from "./SubmitJob";
import VideoUpload from "./VideoUpload";

type Props = {
  children?: ReactNode;
  title?: string;
};

const Layout = ({ children, title = "Video Transcoding Service" }: Props) => {
  const [jobId, setJobId] = useState<string>("");
  const [outputPath, setOutputPath] = useState<string>("");
  const [inputPath, setInputPath] = useState<string>("");
  const [jobStatus, setJobStatus] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);

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

  return (
    <div className="min-h-fit">
      <div className="container mx-auto px-4 py-8 w-1/4 ">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">Submit a New Transcoding Job</h1>
        </div>
        <div className="mx-auto ">
          <div className="bg-white p-6 rounded shadow-md h-full mb-8">
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
                  className="block w-full rounded-none rounded-l-md border-0 py-1.5 pl-10 text-gray-700 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  value={jobId}
                  disabled={submitted}
                  onChange={(e) => setJobId(e.target.value)}
                  placeholder="Enter Job ID"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow-md h-full mb-8">
            <VideoUpload onUpload={handleUpload} jobId={jobId} />
          </div>
          <div className="bg-white p-6 rounded shadow-md h-full mb-8">
            <SubmitJob
              jobId={jobId}
              inputPath={inputPath}
              setInputPath={setInputPath}
              onJobSubmit={handleJobSubmit}
            />
          </div>
          <div className="bg-white p-6 rounded shadow-md h-full mb-8">
            <JobProgress jobId={jobId} setJobStatus={setJobStatus} />
          </div>
          <div className="bg-white p-6 rounded shadow-md h-full">
            <DownloadVideo outputPath={outputPath} jobStatus={jobStatus} />{" "}
            {/* Pass the outputPath to DownloadVideo */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
