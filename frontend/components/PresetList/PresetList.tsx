// PresetList.tsx
import { useEffect, useState } from "react";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Preset } from "../Models";
import NewPreset from "./NewPreset";
import { Pagination } from "../Pagination/Pagination";
import { PipelineModal } from "./PipelineModal";

const badgeClasses = {
  video_encoding: {
    h264: "bg-green-100 text-green-800",
    h265: "bg-yellow-100 text-yellow-800",
    vp9: "bg-red-100 text-red-800",
  },
  audio_encoding: {
    aac: "bg-green-100 text-green-800",
    mp3: "bg-yellow-100 text-yellow-800",
    vorbis: "bg-red-100 text-red-800",
  },
  format: {
    mp4: "bg-green-100 text-green-800",
    webm: "bg-yellow-100 text-yellow-800",
    ogg: "bg-red-100 text-red-800",
    mkv: "bg-blue-100 text-blue-800",
  },
};

const PresetList = () => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [isCreatePresetOpen, setIsCreatePresetOpen] = useState(false);

  useEffect(() => {
    fetchPresets();
  }, [pageSize, currentPage]);

  const handlePresetCreatedSuccessfully = () => {
    setIsCreatePresetOpen(false);
    fetchPresets();
  };

  const fetchPresetsWithPagination = async (skip: number, limit: number) => {
    setPresetsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/presets?skip=${skip}&limit=${limit}`
      );
      const data = await response.json();
      let temp_presets = data.map((preset: Preset) => ({
        ...preset,
        created_at: new Date(preset.created_at),
        updated_at: new Date(preset.updated_at),
      }));
      setPresets(temp_presets);
    } catch (error) {
      console.error("Error fetching presets:", error);
    } finally {
      setPresetsLoading(false);
    }
  };

  const fetchPresets = async () => {
    await fetchPresetsWithPagination((currentPage - 1) * pageSize, pageSize);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
    fetchPresets();
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchPresets();
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-gray-900">
            Presets
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all the available transcoding presets
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => setIsCreatePresetOpen(true)}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Create Preset
          </button>
        </div>
      </div>
      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-t-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      In
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Out
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Resolution
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Video Enc
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Video Bitrate
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Audio Enc
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Audio Bitrate
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Pipeline
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {presets.map((preset) => {
                    const openModal = () => setOpen(true);
                    const closeModal = () => setOpen(false);
                    return (
                      <tr key={preset.preset_id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {preset.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              preset.input_type in badgeClasses.format
                                ? badgeClasses.format[preset.input_type]
                                : ""
                            }`}
                          >
                            {preset.input_type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              preset.output_type in badgeClasses.format
                                ? badgeClasses.format[preset.output_type]
                                : ""
                            }`}
                          >
                            {preset.output_type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          {preset.resolution}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              preset.video_encoding in
                              badgeClasses.video_encoding
                                ? badgeClasses.video_encoding[
                                    preset.video_encoding
                                  ]
                                : ""
                            }`}
                          >
                            {preset.video_encoding}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          {preset.video_bitrate} kbps
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              preset.audio_encoding in
                              badgeClasses.audio_encoding
                                ? badgeClasses.audio_encoding[
                                    preset.audio_encoding
                                  ]
                                : ""
                            }`}
                          >
                            {preset.audio_encoding}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          {preset.audio_bitrate} kbps
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 text-center">
                          <button
                            onClick={() => {
                              setSelectedPipeline(preset.pipeline);
                              openModal();
                            }}
                          >
                            <DocumentMagnifyingGlassIcon className="inline-block w-5 h-6 -ml-1" />
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {preset.created_at.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PipelineModal
                open={open}
                setOpen={setOpen}
                pipeline={selectedPipeline}
              />
            </div>
          </div>
        </div>
      </div>
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        itemsOnThisPage={presets.length}
        handlePageChange={setCurrentPage}
        handlePageSizeChange={handlePageSizeChange}
        loading={presetsLoading}
      />
      <NewPreset
        onSuccess={handlePresetCreatedSuccessfully}
        open={isCreatePresetOpen}
        setOpen={(open) => setIsCreatePresetOpen(open)}
      />
    </div>
  );
};

export default PresetList;
