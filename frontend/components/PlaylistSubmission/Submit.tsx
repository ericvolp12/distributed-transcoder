import { TrashIcon } from "@heroicons/react/24/outline";
import { useState, useEffect, MouseEvent } from "react";

interface SubmitProps {
  playlistName: string;
  inputPath: string;
  onPlaylistSubmit: (id: string) => void;
}

interface PlaylistSubmitPayload {
  name: string;
  input_s3_path: string;
  presets: string[];
}

const Submit: React.FC<SubmitProps> = ({
  playlistName,
  inputPath,
  onPlaylistSubmit,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([null]);
  const [usePreset, setUsePreset] = useState(true);

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

  useEffect(() => {
    fetchPresets();
  }, [inputPath]);

  function handlePresetSelect(index: number, value: string) {
    const newSelectedPresets = [...selectedPresets];
    newSelectedPresets[index] = value;
    setSelectedPresets(newSelectedPresets);
  }

  function addPreset() {
    setSelectedPresets([...selectedPresets, null]);
  }

  function removePreset(index: number) {
    const newSelectedPresets = selectedPresets.filter((_, i) => i !== index);
    setSelectedPresets(newSelectedPresets);
  }

  const handleSubmit = async (e: MouseEvent) => {
    e.preventDefault();
    if (!inputPath || !playlistName || selectedPresets.length === 0) {
      setError("All fields are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    let playlistData: PlaylistSubmitPayload = {
      name: playlistName,
      input_s3_path: inputPath,
      presets: selectedPresets,
    };

    try {
      const response = await fetch("http://localhost:8000/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playlistData),
      });

      if (!response.ok) {
        const message = await response.text();
        setError(message);
      } else {
        // Reset state variables
        setSubmitting(false);
        setError(null);
        setSelectedPresets([]);
        setUsePreset(true);
        onPlaylistSubmit(playlistName);
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
          <div className="mt-2">
            {selectedPresets.map((selectedPreset, index) => (
              <div key={index} className="flex w-full items-center mt-2">
                <select
                  name={`preset-${index}`}
                  id={`preset-${index}`}
                  className="flex w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  value={selectedPreset || ""}
                  onChange={(e) => handlePresetSelect(index, e.target.value)}
                >
                  <option value="">Select a preset</option>
                  {presets.map((preset) => (
                    <option key={preset.preset_id} value={preset.preset_id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ml-2 text-red-600"
                  onClick={() => removePreset(index)}
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-2 rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
              onClick={addPreset}
            >
              Add Preset
            </button>
          </div>
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
            Submit Playlist
          </button>
        </div>
      </div>
    </div>
  );
};

export default Submit;
