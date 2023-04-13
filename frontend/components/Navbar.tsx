import { Disclosure, Menu, Transition } from "@headlessui/react";
import Link from "next/link";
import { useRouter } from "next/router";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Navbar() {
  const router = useRouter();
  console.log(router.pathname);
  return (
    <Disclosure as="nav" className="bg-white shadow">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <div className="flex flex-shrink-0 items-center">
                  <img
                    className="block h-8 w-auto lg:hidden"
                    src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
                    alt="Distributed Transcoder"
                  />
                  <img
                    className="hidden h-8 w-auto lg:block"
                    src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600"
                    alt="Distributed Transcoder"
                  />
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  {/* Current: "border-indigo-500 text-gray-900", Default: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700" */}
                  <Link
                    href="/"
                    className={
                      "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium" +
                      (router.pathname === "/"
                        ? " border-indigo-500 text-gray-900"
                        : " border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700")
                    }
                  >
                    Jobs
                  </Link>
                  <Link
                    href="/presets"
                    className={
                      "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium" +
                      (router.pathname === "/presets"
                        ? " border-indigo-500 text-gray-900"
                        : " border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700")
                    }
                  >
                    Presets
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Disclosure>
  );
}
