import { useState } from 'react';

interface DownloadVideoProps {
    outputPath: string;
}

const DownloadVideo: React.FC<DownloadVideoProps> = ({ outputPath }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/signed_download/${outputPath}`);
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
        <div className="text-center mt-8">
            <h2 className="text-2xl font-bold mb-4">Download Transcoded Video</h2>
            {signedUrl ? (
                <a
                    href={signedUrl}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    download
                >
                    Download Video
                </a>
            ) : (
                <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    disabled={loading}
                    onClick={handleClick}
                >
                    Generate Download Link
                </button>
            )}
        </div>
    );
};

export default DownloadVideo;
