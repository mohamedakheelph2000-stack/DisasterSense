"use client";

import { motion } from "framer-motion";
import { Counter } from "../animations/counter";

interface RiskGaugeProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

export function RiskGauge({ score, size = 120, strokeWidth = 10 }: RiskGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Use a semi-circle gauge (180 degrees)
  const arcLength = circumference / 2;
  const strokeDashoffset = arcLength - (score / 100) * arcLength;

  let colorClass = "text-success"; // 0-20
  if (score >= 80) colorClass = "text-critical";
  else if (score >= 60) colorClass = "text-danger";
  else if (score >= 40) colorClass = "text-warning";

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size / 2 + 10 }}>
      <svg width={size} height={size / 2} className="overflow-hidden">
        {/* Background Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-muted"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(180, ${size / 2}, ${size / 2})`}
          strokeLinecap="round"
        />
        {/* Animated Value Arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={colorClass}
          strokeDasharray={`${arcLength} ${circumference}`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          transform={`rotate(180, ${size / 2}, ${size / 2})`}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
        />
      </svg>
      {/* Absolute text inside the gauge */}
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className={`text-3xl font-bold ${colorClass}`}>
          <Counter to={score} duration={1.5} />
        </span>
      </div>
    </div>
  );
}
