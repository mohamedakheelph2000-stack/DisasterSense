"use client";

import { Cpu, Cloud, Map as MapIcon, Bell } from "lucide-react";
import { FadeIn } from "../animations/fade-in";
import { useConfig } from "@/lib/api/config";
import { Badge } from "../ui/badge";

interface StatusIndicatorProps {
  label: string;
  status: "online" | "synced" | "offline";
  icon: React.ElementType;
}

function StatusIndicator({ label, status, icon: Icon }: StatusIndicatorProps) {
  const isOnline = status === "online" || status === "synced";
  return (
    <div className="flex items-center space-x-2 text-sm bg-surface-muted/50 px-3 py-1.5 rounded-full border border-border">
      <div className={`relative flex h-2.5 w-2.5`}>
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-success' : 'bg-critical'}`}></span>
      </div>
      <span className="text-foreground/80 font-medium">{label}</span>
    </div>
  );
}

export function SystemStatusHero() {
  const { isDemoMode } = useConfig();

  return (
    <FadeIn direction="up">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 py-4 mb-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Command Center
            </h1>
            {isDemoMode && <Badge variant="warning">DEMO MODE</Badge>}
          </div>
          <p className="text-foreground/60 text-lg">AI-Powered Disaster Intelligence Platform</p>
        </div>

        <div className="flex flex-wrap gap-3 mt-2 md:mt-0">
          <StatusIndicator label="ML Engine" status="online" icon={Cpu} />
          <StatusIndicator label="Weather Data" status="synced" icon={Cloud} />
          <StatusIndicator label="Alerts" status="online" icon={Bell} />
          <StatusIndicator label="Maps" status="online" icon={MapIcon} />
        </div>
      </div>
    </FadeIn>
  );
}
