import React, { useState, FormEvent, Fragment, MouseEventHandler } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Preset } from "../Models";
import { XMarkIcon } from "@heroicons/react/24/solid";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface NewPresetProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onSuccess: (
    preset: Omit<Preset, "preset_id" | "created_at" | "updated_at">
  ) => void;
}

interface Alert {
  type: "error" | "success";
  message: string;
  autoDismiss?: boolean;
}

const defaultPipeline =
  "filesrc location={{input_file}} ! matroskademux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1920, height=1080 ! x264enc bitrate=1024 ! {{progress}} ! h264parse ! mux.video_0";

const NewPreset: React.FC<NewPresetProps> = ({ open, setOpen, onSuccess }) => {
  const [name, setName] = useState("");
  const [alert, setAlert] = useState<Alert | null>(null);
  const [inputType, setInputType] = useState("");
  const [outputType, setOutputType] = useState("");
  const [pipeline, setPipeline] = useState(defaultPipeline);
  const [videoEncoding, setVideoEncoding] = useState("");
  const [videoBitrate, setVideoBitrate] = useState("");
  const [resolution, setResolution] = useState("");
  const [audioEncoding, setAudioEncoding] = useState("");
  const [audioBitrate, setAudioBitrate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const dismissAlert = () => {
    setAlert(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const preset: Omit<Preset, "preset_id" | "created_at" | "updated_at"> = {
      name,
      input_type: inputType,
      output_type: outputType,
      pipeline,
      video_encoding: videoEncoding,
      video_bitrate: videoBitrate,
      resolution,
      audio_encoding: audioEncoding,
      audio_bitrate: audioBitrate,
    };

    if (Object.values(preset).some((value) => value === "")) {
      setAlert({
        type: "error",
        message: "All fields are required.",
      });
      return;
    }

    // Validate {{input_file}}, {{output_file}}, and {{progress}} are present exactly once in pipeline
    const requiredPipelineVariables = [
      "{{input_file}}",
      "{{output_file}}",
      "{{progress}}",
    ];

    const pipelineVariables = requiredPipelineVariables.filter((variable) =>
      pipeline.includes(variable)
    );

    if (pipelineVariables.length !== requiredPipelineVariables.length) {
      setAlert({
        type: "error",
        message:
          "Pipeline must contain {{input_file}}, {{output_file}}, and {{progress}} exactly once.",
      });
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset),
      });

      if (!response.ok) {
        const message = await response.text();
        setAlert({
          type: "error",
          message: `Failed to Save Preset: ${message}`,
        });
      } else {
        // Reset state variables
        setName("");
        setInputType("");
        setOutputType("");
        setPipeline(defaultPipeline);
        setVideoEncoding("");
        setVideoBitrate("");
        setResolution("");
        setAudioEncoding("");
        setAudioBitrate("");
        setAlert({
          type: "success",
          message: "Preset successfully created!",
          autoDismiss: true,
        });
        setTimeout(() => {
          onSuccess(preset);
        }, 2500);
      }
    } catch (err) {
      setAlert({
        type: "error",
        message: `Failed to Save Preset: ${err.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={() => {}}>
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                  <form className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    <div className="flex-1">
                      <div className="bg-gray-50 px-4 py-6 sm:px-6">
                        <div className="flex items-start justify-between space-x-3">
                          <div className="space-y-1">
                            <Dialog.Title className="text-base font-semibold leading-6 text-gray-900">
                              Create a New Preset
                            </Dialog.Title>
                            <p className="text-sm text-gray-500">
                              Fill out all of the below fields to create a new
                              Preset for Transcoding Jobs
                            </p>
                          </div>
                          <div className="flex h-7 items-center">
                            <button
                              type="button"
                              className="text-gray-400 hover:text-gray-500"
                              onClick={() => setOpen(false)}
                            >
                              <span className="sr-only">Close panel</span>
                              <XMarkIcon
                                className="h-6 w-6"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6 py-6 sm:space-y-0 sm:divide-y sm:divide-gray-200 sm:py-0">
                        {alert && (
                          <div
                            className={`rounded-md p-4 mb-4 ${
                              alert.type === "success"
                                ? "bg-green-50"
                                : "bg-yellow-50"
                            }`}
                          >
                            <div className="flex">
                              <div className="flex-shrink-0">
                                {alert.type === "success" ? (
                                  <CheckCircleIcon
                                    className="h-5 w-5 text-green-400"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ExclamationTriangleIcon
                                    className="h-5 w-5 text-yellow-400"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              <div className="ml-3">
                                <p
                                  className={`text-sm font-medium ${
                                    alert.type === "success"
                                      ? "text-green-800"
                                      : "text-yellow-800"
                                  }`}
                                >
                                  {alert.message}
                                </p>
                              </div>
                              <div className="ml-auto pl-3">
                                <div className="-mx-1.5 -my-1.5">
                                  <button
                                    type="button"
                                    className={`inline-flex rounded-md p-1.5 ${
                                      alert.type === "success"
                                        ? "text-green-500 bg-green-50 hover:bg-green-100"
                                        : "text-yellow-500 bg-yellow-50 hover:bg-yellow-100"
                                    } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                      alert.type === "success"
                                        ? "focus:ring-green-600 focus:ring-offset-green-50"
                                        : "focus:ring-yellow-600 focus:ring-offset-yellow-50"
                                    }`}
                                    onClick={dismissAlert}
                                  >
                                    <span className="sr-only">Dismiss</span>
                                    <XMarkIcon
                                      className="h-5 w-5"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="preset_name"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Preset Name
                        </label>
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            name="preset_name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            id="preset_name"
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="Scale to 480p x265 (768 kbit) mp4->mkv"
                          />
                        </div>
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="input_type"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Input Container Type
                        </label>
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            name="input_type"
                            value={inputType}
                            onChange={(e) => setInputType(e.target.value)}
                            id="input_type"
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="mkv"
                          />
                        </div>
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="output_type"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Output Container Type
                        </label>
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            name="output_type"
                            id="output_type"
                            value={outputType}
                            onChange={(e) => setOutputType(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="mp4"
                          />
                        </div>
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="resolution"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Resolution
                        </label>
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            name="resolution"
                            id="resolution"
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="1920x1080"
                          />
                        </div>
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="video_encoding"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Video Encoding
                        </label>
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            name="video_encoding"
                            id="video_encoding"
                            value={videoEncoding}
                            onChange={(e) => setVideoEncoding(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="h264"
                          />
                        </div>
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="video_bitrate"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Video Bitrate (kbps)
                        </label>
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            name="video_bitrate"
                            id="video_bitrate"
                            value={videoBitrate}
                            onChange={(e) => setVideoBitrate(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="1024"
                          />
                        </div>
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="audio_encoding"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Audio Encoding
                        </label>
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            name="audio_encoding"
                            id="audio_encoding"
                            value={audioEncoding}
                            onChange={(e) => setAudioEncoding(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="aac"
                          />
                        </div>
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="audio_bitrate"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Audio Bitrate (kbps)
                        </label>
                        <div className="sm:col-span-2 relative">
                          <input
                            type="text"
                            name="audio_bitrate"
                            id="audio_bitrate"
                            value={audioBitrate}
                            onChange={(e) => setAudioBitrate(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="128"
                          />
                        </div>
                      </div>
                      <div className="px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                        <label
                          htmlFor="pipeline"
                          className="block text-sm font-medium leading-6 text-gray-900"
                        >
                          Pipeline Configuration
                        </label>
                        <div className="sm:col-span-2 relative">
                          <textarea
                            rows={10}
                            name="pipeline"
                            id="pipeline"
                            value={pipeline}
                            onChange={(e) => setPipeline(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            placeholder="filesrc location={{input_file}} ! matroskademux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1920, height=1080 ! x264enc bitrate=1024 ! {{progress}} ! h264parse ! mux.video_0"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between mt-6">
                        <button
                          onClick={(
                            e: React.MouseEvent<HTMLButtonElement, MouseEvent>
                          ) => {
                            e.preventDefault();
                            setOpen(false);
                          }}
                          className="ml-6 rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 bg-red-600 hover:bg-red-700  focus:ring-red-500"
                        >
                          Cancel
                        </button>
                        <button
                          className={
                            "mr-6 rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" +
                            `${
                              false
                                ? " bg-gray-400"
                                : " bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
                            }`
                          }
                          disabled={false}
                          onClick={handleSubmit}
                        >
                          Save Preset
                        </button>
                      </div>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default NewPreset;
