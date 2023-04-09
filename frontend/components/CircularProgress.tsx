// components/CircularProgress.tsx
import React from "react";

interface CircularProgressProps {
  progress: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ progress }) => {
  const radius = 10;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="inline-block w-4 h-4 ml-1"
    >
      <circle
        cx="12"
        cy="12"
        r={radius}
        strokeWidth={strokeWidth}
        stroke="#E5E7EB"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r={radius}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke="#6366F1"
        fill="none"
        style={{
          strokeDasharray: `${circumference} ${circumference}`,
          strokeDashoffset: strokeDashoffset,
        }}
        transform={`rotate(-90 12 12)`}
      />
    </svg>
  );
};

export default CircularProgress;
