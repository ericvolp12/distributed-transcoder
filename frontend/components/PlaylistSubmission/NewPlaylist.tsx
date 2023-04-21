import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  HashtagIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { useState, useEffect, Fragment } from "react";

import Submit from "./Submit";
import Upload from "./Upload";
import { Dialog, Transition } from "@headlessui/react";

interface Alert {
  type: "error" | "success";
  message: string;
  autoDismiss?: boolean;
}

const NewPlaylist = ({ setOpen, open }) => {
  const [provisionalPlaylistName, setProvisionalPlaylistName] =
    useState<string>("");
  const [playlistName, setPlaylistName] = useState<string>("");
  const [inputPath, setInputPath] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [playlistNameValidationStatus, setPlaylistNameValidationStatus] =
    useState<"idle" | "loading" | "valid" | "invalid">("idle");

  const dismissAlert = () => {
    setAlert(null);
  };

  useEffect(() => {
    if (alert && alert.autoDismiss) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const handleUpload = (path: string) => {
    // TODO: Implement the upload handling
    setInputPath(path);
  };

  const handlePlaylistSubmit = (playlistName: string) => {
    setPlaylistName(playlistName);
    setSubmitted(true);
    // Show a successful alert for 5 seconds, then dismiss the dialog
    setAlert({
      type: "success",
      message: "Playlist submitted successfully!",
      autoDismiss: true,
    });
    setTimeout(() => {
      // Clear the state
      setPlaylistName("");
      setProvisionalPlaylistName("");
      setPlaylistNameValidationStatus("idle");
      setInputPath("");
      setSubmitted(false);
      setOpen(false);
    }, 2500);
  };

  const handlePlaylistNameChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (provisionalPlaylistName !== "") {
      setPlaylistNameValidationStatus("loading");
      try {
        const response = await fetch(
          `http://localhost:8000/playlists?name=${provisionalPlaylistName}`,
          { method: "GET", headers: { "Content-Type": "application/json" } }
        );
        if (response.status === 404) {
          setPlaylistName(provisionalPlaylistName);
          setPlaylistNameValidationStatus("valid");
          return;
        } else if (response.status === 200) {
          setAlert({
            type: "error",
            message: `A Playlist with Name (${provisionalPlaylistName}) already exists, please use a different Playlist Name.`,
            autoDismiss: true,
          });
          setPlaylistNameValidationStatus("invalid");
        }
      } catch (err) {
        setAlert({
          type: "error",
          message: `Failed to validate Playlist Name: ${err.message}`,
          autoDismiss: true,
        });
        setPlaylistNameValidationStatus("invalid");
      }
    } else {
      setPlaylistNameValidationStatus("idle");
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
                              New Transcoding Playlist
                            </Dialog.Title>
                            <p className="text-sm text-gray-500">
                              Get started by filling in the information below to
                              submit your new transcoding playlist.
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
                        <div className="space-y-2 px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                          <div>
                            <label
                              htmlFor="playlist-identifier"
                              className="block text-sm font-medium leading-6 text-gray-900 sm:mt-1.5"
                            >
                              Assign a Playlist Name
                            </label>
                          </div>
                          <div className="sm:col-span-2 relative">
                            <input
                              type="text"
                              id="playlist-identifier"
                              className={`block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 pr-8 ${
                                playlistNameValidationStatus === "valid"
                                  ? "bg-green-50"
                                  : playlistNameValidationStatus === "invalid"
                                  ? "bg-red-50"
                                  : ""
                              }`}
                              value={provisionalPlaylistName}
                              disabled={submitted}
                              onChange={(e) =>
                                setProvisionalPlaylistName(e.target.value)
                              }
                              onBlur={handlePlaylistNameChange}
                              placeholder="Enter Playlist Name"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              {playlistNameValidationStatus === "loading" ? (
                                <HashtagIcon
                                  className="h-5 w-5 text-gray-500 "
                                  aria-hidden="true"
                                />
                              ) : playlistNameValidationStatus === "valid" ? (
                                <CheckCircleIcon
                                  className="h-5 w-5 text-green-400 "
                                  aria-hidden="true"
                                />
                              ) : playlistNameValidationStatus === "invalid" ? (
                                <ExclamationTriangleIcon
                                  className="h-5 w-5 text-red-400"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="relative">
                          <div className="space-y-2 px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                            <div>
                              <label
                                htmlFor="file-upload"
                                className="block text-sm font-medium leading-6 text-gray-900 sm:mt-1.5"
                              >
                                Upload Source File
                              </label>
                            </div>
                            <div className="sm:col-span-2">
                              <Upload
                                onUpload={handleUpload}
                                playlistName={playlistName}
                              />
                            </div>
                          </div>
                          {playlistNameValidationStatus !== "valid" && (
                            <div
                              className="absolute inset-0 bg-gray-300 opacity-50 z-10"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <div className="relative">
                          <div className="space-y-2 px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:space-y-0 sm:px-6 sm:py-5">
                            <div>
                              <h3 className="text-sm font-medium leading-6 text-gray-900">
                                Configure Playlist Jobs
                              </h3>
                            </div>
                            <div className="sm:col-span-2">
                              <Submit
                                playlistName={playlistName}
                                inputPath={inputPath}
                                onPlaylistSubmit={handlePlaylistSubmit}
                              />
                            </div>
                          </div>
                          {!(
                            playlistNameValidationStatus === "valid" &&
                            inputPath
                          ) && (
                            <div
                              className="absolute inset-0 bg-gray-300 opacity-50 z-10"
                              aria-hidden="true"
                            />
                          )}
                        </div>
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

export default NewPlaylist;
