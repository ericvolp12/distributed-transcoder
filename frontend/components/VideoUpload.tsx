import { ChangeEvent, useState } from 'react';
import axios, { AxiosProgressEvent } from 'axios';

interface VideoUploadProps {
    onUpload: (inputPath: string) => void;
}

const VideoUpload: React.FC<VideoUploadProps> = ({ onUpload }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState<boolean>(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [inputS3Path, setInputS3Path] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] ?? null;
        setFile(selectedFile);
        setUploadProgress(null);
    };

    const uploadFile = async () => {
        if (!file) {
            setError('No file selected');
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.request({
                url: 'http://localhost:8000/upload',
                method: 'POST',
                data: formData,
                onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
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
        <div className="text-center">
            <label className="block text-gray-700 text-sm font-bold mb-2">
                Select video file:
            </label>
            <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                disabled={uploading}
            />
            <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
                onClick={uploadFile}
                disabled={uploading}
            >
                {inputS3Path ? 'Upload Again?' : uploading ? 'Uploading...' : 'Upload'}
            </button>
            {error && <p className="text-red-600 mt-4">{error}</p>}
            {uploadProgress !== null && (
                <div className="mt-4">
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
