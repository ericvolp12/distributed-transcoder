import Head from 'next/head';
import { ReactNode, useState } from 'react';
import DownloadVideo from './DownloadVideo';
import JobProgress from './JobProgress';
import SubmitJob from './SubmitJob';
import VideoUpload from './VideoUpload';

type Props = {
  children?: ReactNode;
  title?: string;
};

const Layout = ({ children, title = 'Video Transcoding Service' }: Props) => {
  const [jobId, setJobId] = useState<string>("");
  const [outputPath, setOutputPath] = useState<string>("");
  const [inputPath, setInputPath] = useState<string>("");

  const handleUpload = (inputPath: string) => {
    // TODO: Implement the upload handling
    setInputPath(inputPath);
  };

  const handleJobSubmit = (jobId: string, outputPath: string, transcodeOptions: string) => {
    setJobId(jobId);
    setOutputPath(outputPath); // Update the outputPath state
    // TODO: Implement the job submission handling
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Video Transcoding App</h1>
          <div className="w-64">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Job ID:
            </label>
            <input
              type="text"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded shadow-md h-full">
            <VideoUpload onUpload={handleUpload} />
            <DownloadVideo outputPath={outputPath} /> {/* Pass the outputPath to DownloadVideo */}
          </div>
          <div className="bg-white p-6 rounded shadow-md h-full">
            <SubmitJob jobId={jobId} inputPath={inputPath} setInputPath={setInputPath} onJobSubmit={handleJobSubmit} />
          </div>
          <div className="col-span-2">
            <JobProgress jobId={jobId} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
