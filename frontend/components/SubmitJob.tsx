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
        <div className="">
            <h2 className="text-2xl font-bold mb-4 text-center">Submit Transcoding Job</h2>
            <div className="mb-4">
                <label htmlFor="input-s3-path" className="block text-sm font-medium leading-6 text-gray-900">
                    Input S3 Path
                </label>
                <input
                    type="text"
                    name="input-s3-path"
                    id="input-s3-path"
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    value={inputPath}
                    onChange={(e) => setInputPath(e.target.value)}
                />
            </div>
            <div className="mb-4">
                <label htmlFor="output-s3-path" className="block text-sm font-medium leading-6 text-gray-900">
                    Output S3 Path
                </label>
                <input
                    type="text"
                    name="output-s3-path"
                    id="output-s3-path"
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                />
            </div>
            <div className="mb-4">
                <label htmlFor="transcode-options" className="block text-sm font-medium leading-6 text-gray-900">
                    Transcoding Settings
                </label>
                <textarea
                    name="transcode-options"
                    id="transcode-options"
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    value={transcodeOptions}
                    onChange={(e) => setTranscodeOptions(e.target.value)}
                    rows={5}
                />
            </div>
            <div className="flex justify-center">
                {error && <div className="text-red-600 mb-4">{error}</div>}

            </div>
            <div className="flex justify-center">
                <button
                    className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    disabled={submitting}
                    onClick={handleSubmit}
                >
                    Submit Job
                </button>
            </div>
        </div>
    );
};

export default SubmitJob;
