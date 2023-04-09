import Navbar from "@/components/Navbar";
import "../styles/global.css";
import type { AppProps } from "next/app";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="flex flex-col h-screen">
      <Navbar></Navbar>
      <div className="bg-gray-100 flex-grow">
        <Component {...pageProps}></Component>
      </div>
    </div>
  );
}

export default MyApp;
