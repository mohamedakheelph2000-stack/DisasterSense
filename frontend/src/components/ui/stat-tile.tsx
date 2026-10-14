"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/animations/animated-number";
import { Reveal } from "@/components/animations/motion";

const toneStyles: Record<string, string> = {
  neutral: "text-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  critical: "text-critical",
  primary: "text-primary",
};

const railStyles: Record<string, string> = {
  neutral: "from-foreground/40",
  info: "from-info",
  success: "from-success",
  warning: "from-warning",
  danger: "from-danger",
  critical: "from-critical",
  primary: "from-primary",
};

export interface StatTileProps {
  label: string;
  value: number | string;
  /** Numeric values animate; strings render verbatim. */
  decimals?: number;
  suffix?: string;
  prefix?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: keyof typeof toneStyles;
  delta?: { value: number; direction: "up" | "down" | "flat"; label?: string };
  className?: string;
  delay?: number;
}

export function StatTile({
  label,
  value,
  decimals = 0,
  suffix,
  prefix,
  hint,
  icon,
  tone = "neutral",
  delta,
  className,
  delay = 0,
}: StatTileProps) {
  const numeric = typeof value === "number" && Number.isFinite(value);

  return (
    <Reveal delay={delay} className={cn("h-full", className)}>
      <div className="panel panel-glow group relative flex h-full flex-col justify-between overflow-hidden p-4">
        <span
          className={cn(
            "absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent opacity-60",
            railStyles[tone]
          )}
        />
        <div className="flex items-start justify-between gap-2">
          <span className="hud-label">{label}</span>
          {icon && (
            <span className="text-foreground/30 transition-colors duration-300 group-hover:text-primary/70">
              {icon}
            </span>
          )}
        </div>

        <div
          className={cn(
            "stat-value tnum mt-3",
            toneStyles[tone]
          )}
        >
          {numeric ? (
            <AnimatedNumber
              value={value as number}
              decimals={decimals}
              suffix={suffix}
              prefix={prefix}
            />
          ) : (
            <span>{value}</span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
          {delta && <DeltaPill delta={delta} />}
        </div>
      </div>
    </Reveal>
  );
}

function DeltaPill({ delta }: { delta: NonNullable<StatTileProps["delta"]> }) {
  const color =
    delta.direction === "up"
      ? "text-danger bg-danger/10 border-danger/20"
      : delta.direction === "down"
        ? "text-success bg-success/10 border-success/20"
        : "text-muted-foreground bg-muted border-border";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px]",
        color
      )}
    >
      {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "■"}
      {delta.value}
      {delta.label ? <span className="opacity-70">{delta.label}</span> : null}
    </span>
  );
}
