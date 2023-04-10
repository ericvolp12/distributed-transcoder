import React from "react";

interface StatusProgressProps {
  progress: number | null;
}

const StatusProgress: React.FC<StatusProgressProps> = ({ progress }) => {
  const textColor = progress < 50 ? "text-gray-900" : "text-white";

  if (progress === null) {
    return null;
  }
  return (
    <div className="relative h-5 w-full bg-gray-200 rounded-lg">
      <div
        className="absolute h-full bg-green-500 rounded-lg"
        style={{ width: `${progress}%` }}
      ></div>
      <div
        className={`absolute top-0 left-0 w-full h-full flex items-center justify-center ${textColor}`}
      >
        <span className="text-xs">
          {progress >= 100 ? "completed" : `${progress.toFixed(2)}%`}
        </span>
      </div>
    </div>
  );
};

export default StatusProgress;
