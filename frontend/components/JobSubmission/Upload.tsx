import { ChangeEvent, useState, useRef } from "react";
import axios, { AxiosProgressEvent } from "axios";
import {
  CloudArrowUpIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";

import CircularProgress from "../CircularProgress";

interface UploadProps {
  jobId: string;
  onUpload: (inputPath: string) => void;
}

const Upload: React.FC<UploadProps> = ({ onUpload, jobId: jobId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [inputS3Path, setInputS3Path] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    const ext = selectedFile?.name.split(".").pop();
    const modifiedFile = new File([selectedFile], `${jobId}_in.${ext}`, {
      type: selectedFile?.type,
      lastModified: selectedFile?.lastModified,
    });
    setFile(modifiedFile);
    setUploadProgress(null);
  };

  const uploadFile = async () => {
    if (!file) {
      setError("No file selected");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();

    formData.append("file", file);

    try {
      const response = await axios.request({
        url: "http://localhost:8000/upload",
        method: "POST",
        data: formData,
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      if (response.status !== 200) {
        const message = response.data;
        setError(message);
      } else {
        const data = response.data;
        setInputS3Path(data.filename);
        onUpload(data.filename);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div>
      <div className="mt-2 flex rounded-md shadow-sm">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative -mr-px inline-flex items-center gap-x-1.5 rounded-l-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 whitespace-nowrap"
        >
          Select File
        </button>
        <input
          type="file"
          id="file-upload"
          accept="video/*,.mkv"
          onChange={handleFileChange}
          disabled={uploading}
          ref={fileInputRef}
          className="hidden"
        />
        <input
          type="text"
          value={file?.name ?? ""}
          className="block w-full rounded-none border-0 py-1.5 pl-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          placeholder="No file selected"
          disabled
        />
        <button
          type="button"
          onClick={uploadFile}
          disabled={uploading}
          className={`relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 ${
            uploading ? "cursor-wait" : ""
          }`}
        >
          {inputS3Path ? (
            <DocumentCheckIcon className="inline-block w-6 h-6" />
          ) : uploading ? (
            <CircularProgress
              progress={uploadProgress}
              radius={10}
              strokeWidth={4}
              heightClass="h-6"
              widthClass="w-6"
              innerColor="#6366F1"
              outerColor="#CBD5E0"
            />
          ) : (
            <CloudArrowUpIcon className="inline-block w-6 h-6" />
          )}
        </button>
      </div>
      {error && <p className="text-red-600 mt-4">{error}</p>}
    </div>
  );
};

export default Upload;
