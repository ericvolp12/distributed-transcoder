import { ChangeEvent, useState, useRef } from "react";
import axios, { AxiosProgressEvent } from "axios";

interface VideoUploadProps {
  onUpload: (inputPath: string) => void;
}

const VideoUpload: React.FC<VideoUploadProps> = ({ onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [inputS3Path, setInputS3Path] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
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
      <label
        htmlFor="file-upload"
        className="block text-xl font-bold mb-4 text-center"
      >
        Upload Source File
      </label>
      <div className="mt-2 flex rounded-md shadow-sm">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative flex items-center text-sm bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-l-md focus:outline-none focus:shadow-outline whitespace-nowrap"
        >
          Select File
        </button>
        <input
          type="file"
          id="file-upload"
          accept="video/*"
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
          className={`relative flex items-center text-sm bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-md focus:outline-none focus:shadow-outline whitespace-nowrap ${
            uploading ? "cursor-wait" : ""
          }`}
        >
          {inputS3Path
            ? "Upload Completed"
            : uploading
            ? "Uploading..."
            : "Upload"}
        </button>
      </div>
      {error && <p className="text-red-600 mt-4">{error}</p>}
      {uploadProgress !== null && (
        <div className="mt-4 text-center">
          <div className="h-2 w-full bg-gray-200">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-sm mt-2">Upload Progress: {uploadProgress}%</p>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
