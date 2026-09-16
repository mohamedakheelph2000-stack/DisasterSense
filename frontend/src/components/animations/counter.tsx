"use client";

import { animate } from "framer-motion";
import React, { useEffect, useRef } from "react";

interface CounterProps {
  from?: number;
  to: number;
  duration?: number;
  className?: string;
  formatter?: (value: number) => string;
}

export function Counter({
  from = 0,
  to,
  duration = 1.5,
  className,
  formatter = (val) => Math.round(val).toString(),
}: CounterProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const controls = animate(from, to, {
        duration,
        onUpdate(value) {
          node.textContent = formatter(value);
        },
        ease: "easeOut",
      });
      return () => controls.stop();
    }
  }, [from, to, duration, formatter]);

  return <span className={className} ref={nodeRef}>{formatter(from)}</span>;
}
