import { useState } from 'react';

interface SubmitJobProps {
    jobId: string;
    inputPath: string;
    setInputPath: (inputPath: string) => void;
    onJobSubmit: (id: string, outputPath: string, transcode_options: string) => void;
}

const SubmitJob: React.FC<SubmitJobProps> = ({ jobId, inputPath, setInputPath, onJobSubmit }) => {
    const [outputPath, setOutputPath] = useState('');
    const [transcodeOptions, setTranscodeOptions] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e) => {
        if (!inputPath || !outputPath || !jobId || !transcodeOptions) {
            setError('All fields are required');
            return;
        }

        setSubmitting(true);
        setError(null);

        const jobData = {
            job_id: jobId,
            input_s3_path: inputPath,
            output_s3_path: outputPath,
            transcode_options: transcodeOptions,
        };

        onJobSubmit(jobId, outputPath, transcodeOptions);

        try {
            const response = await fetch('http://localhost:8000/submit_job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData),
            });

            if (!response.ok) {
                const message = await response.text();
                setError(message);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Submit Transcoding Job</h2>
            <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                    Input S3 Path:
                </label>
                <input
                    type="text"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={inputPath}
                    onChange={(e) => setInputPath(e.target.value)}
                />
            </div>
            <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                    Output S3 Path:
                </label>
                <input
                    type="text"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                />
            </div>
            <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                    Transcode Options:
                </label>
                <textarea
                    className="shadow appearance-none-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={transcodeOptions}
                    onChange={(e) => setTranscodeOptions(e.target.value)}
                    rows={5}
                />
            </div>
            {error && <div className="text-red-600 mb-4">{error}</div>}
            <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                disabled={submitting}
                onClick={handleSubmit}
            >
                Submit Job
            </button>
        </div>
    );
};

export default SubmitJob;
