// components/CircularProgress.tsx
import React from "react";

interface CircularProgressProps {
  progress: number;
  innerColor?: string;
  outerColor?: string;
  radius?: number;
  strokeWidth?: number;
  heightClass?: string;
  widthClass?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  innerColor = "#6366F1",
  outerColor = "#E5E7EB",
  radius = 10,
  strokeWidth = 3,
  heightClass = "h-4",
  widthClass = "w-4",
}) => {
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className={`inline-block ${heightClass} ${widthClass}}`}
    >
      <circle
        cx="12"
        cy="12"
        r={radius}
        strokeWidth={strokeWidth}
        stroke={outerColor}
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r={radius}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke={innerColor}
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
