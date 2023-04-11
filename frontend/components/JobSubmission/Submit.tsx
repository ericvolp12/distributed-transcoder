import { useState, useEffect, MouseEvent } from "react";

interface SubmitProps {
  jobId: string;
  inputPath: string;
  onJobSubmit: (id: string, outputPath: string) => void;
}

interface JobSubmitPayload {
  job_id: string;
  input_s3_path: string;
  output_s3_path: string;
  preset_id?: string;
  pipeline?: string;
}

const Submit: React.FC<SubmitProps> = ({ jobId, inputPath, onJobSubmit }) => {
  const [outputPath, setOutputPath] = useState("");
  const [pipeline, setPipeline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [usePreset, setUsePreset] = useState(true);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const fileType = inputPath ? inputPath.split(".").at(-1) : null;
        const response = await fetch(
          `http://localhost:8000/presets?${
            inputPath ? `input_type=${fileType}` : ""
          }`
        );
        const presetsData = await response.json();
        setPresets(presetsData);
      } catch (error) {
        console.error("Error fetching presets:", error);
      }
    };

    fetchPresets();
  }, [inputPath]);

  const handlePresetChange = (e) => {
    const presetId = e.target.value;
    const preset = presets.find((p) => p.preset_id === presetId);
    setSelectedPreset(presetId);
    if (presetId) {
      const outPath = inputPath.replace(
        `_in.${preset?.input_type}`,
        `_out.${preset?.output_type}`
      );
      setOutputPath(outPath);
      setPipeline("");
    }
  };

  const handleToggleChange = (e) => {
    setUsePreset(e.target.checked);
    if (!e.target.checked) {
      setSelectedPreset(null);
      setPipeline("");
    }
  };

  const handleSubmit = async (e: MouseEvent) => {
    e.preventDefault();
    if (!inputPath || !outputPath || !jobId || (!pipeline && !selectedPreset)) {
      setError("All fields are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    let jobData: JobSubmitPayload = {
      job_id: jobId,
      input_s3_path: inputPath,
      output_s3_path: outputPath,
    };

    if (usePreset) {
      jobData = { ...jobData, preset_id: selectedPreset };
    } else {
      jobData = { ...jobData, pipeline };
    }

    try {
      const response = await fetch("http://localhost:8000/submit_job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      });

      if (!response.ok) {
        const message = await response.text();
        setError(message);
      } else {
        // Reset state variables
        const tempOutputPath = outputPath;
        setOutputPath("");
        setPipeline("");
        setSubmitting(false);
        setError(null);
        setSelectedPreset(null);
        setUsePreset(true);
        onJobSubmit(jobId, tempOutputPath);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="">
      <div className="mb-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="use-preset"
            className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
            checked={usePreset}
            onChange={handleToggleChange}
          />
          <label
            htmlFor="use-preset"
            className="ml-2 block text-sm font-medium leading-6 text-gray-900"
          >
            Use a Preset
          </label>
        </div>
        {usePreset ? (
          <div className="mt-2">
            <label
              htmlFor="preset"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Presets
            </label>
            <select
              name="preset"
              id="preset"
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              value={selectedPreset || ""}
              onChange={handlePresetChange}
            >
              <option value="">Select a preset</option>
              {presets.map((preset) => (
                <option key={preset.preset_id} value={preset.preset_id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-2">
            <label
              htmlFor="transcode-options"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Transcoding Pipeline
            </label>
            <textarea
              name="transcode-options"
              id="transcode-options"
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              value={pipeline}
              onChange={(e) => setPipeline(e.target.value)}
              rows={5}
              disabled={usePreset}
            />
          </div>
        )}
      </div>
      <div className="mb-4">
        <label
          htmlFor="output-s3-path"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
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
      <div className="flex justify-center">
        {error && <div className="text-red-600 mb-4">{error}</div>}
      </div>
      <div className="flex justify-end">
        <button
          className={
            "rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" +
            `${
              submitting
                ? " bg-gray-400"
                : " bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
            }`
          }
          disabled={submitting}
          onClick={handleSubmit}
        >
          Submit Job
        </button>
      </div>
    </div>
  );
};

export default Submit;
