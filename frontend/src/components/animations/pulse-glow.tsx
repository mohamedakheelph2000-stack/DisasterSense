"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PulseGlowProps {
  children: ReactNode;
  color?: string;
  className?: string;
}

export function PulseGlow({ children, color = "rgba(var(--critical), 0.5)", className }: PulseGlowProps) {
  return (
    <div className={`relative ${className || ""}`}>
      {/* Glow layer */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
