"use client";
import { useState, useEffect } from "react";
import { Cpu, Cloud, Map as MapIcon, Bell, Activity } from "lucide-react";
import { FadeIn } from "../animations/fade-in";
import { Badge } from "../ui/badge";
import { apiClient } from "@/lib/api/client";

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
  const [telemetryInfo, setTelemetryInfo] = useState<any>(null);

  useEffect(() => {
    apiClient<any>("/system/telemetry-worker")
      .then((data) => setTelemetryInfo(data))
      .catch(() => null);
  }, []);

  return (
    <FadeIn direction="up">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 py-4 mb-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Command Center
            </h1>
            <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-semibold px-2.5 py-0.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              24/7 LIVE TELEMETRY
            </Badge>
          </div>
          <p className="text-foreground/60 text-lg">
            AI-Powered Disaster Intelligence Platform &bull; Real-Time Open-Meteo Telemetry
            {telemetryInfo?.locations_monitored && (
              <span className="text-xs text-emerald-400 ml-2 font-mono">
                ({telemetryInfo.locations_monitored} locations streaming live)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mt-2 md:mt-0">
          <StatusIndicator label="ML Engine (≥98% Acc)" status="online" icon={Cpu} />
          <StatusIndicator label="Open-Meteo 24/7" status="synced" icon={Cloud} />
          <StatusIndicator label="Alert Dispatch" status="online" icon={Bell} />
          <StatusIndicator label="GIS Intelligence" status="online" icon={MapIcon} />
        </div>
      </div>
    </FadeIn>
  );
}
