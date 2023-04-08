import { useState } from "react";

interface DownloadVideoProps {
  outputPath: string;
  jobStatus: string;
}

const DownloadVideo: React.FC<DownloadVideoProps> = ({
  outputPath,
  jobStatus,
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/signed_download/${outputPath}`
      );
      if (response.ok) {
        const data = await response.json();
        setSignedUrl(data.url);
      } else {
        const message = await response.text();
        alert(`Error: ${message}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center">
      {signedUrl ? (
        <a
          href={signedUrl}
          target="_blank"
          className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          download
        >
          Download Video
        </a>
      ) : (
        <button
          className={`${
            jobStatus === "completed" ? "" : "disabled"
          } rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`}
          disabled={loading || jobStatus !== "completed"}
          onClick={handleClick}
        >
          Generate Download Link
        </button>
      )}
    </div>
  );
};

export default DownloadVideo;
