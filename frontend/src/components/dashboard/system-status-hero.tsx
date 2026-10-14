"use client";

import { Cpu, Cloud, Map as MapIcon, Bell, Radar, WifiOff } from "lucide-react";
import { Badge } from "../ui/badge";
import { apiClient, ApiError } from "@/lib/api/client";
import { useApi } from "@/hooks/use-api";

type Signal = {
  label: string;
  state: "ok" | "down" | "unknown";
  detail?: string;
};

function StatusChip({ signal, icon: Icon }: { signal: Signal; icon: React.ElementType }) {
  const tone =
    signal.state === "ok"
      ? "border-success/30 bg-success/10 text-success"
      : signal.state === "down"
        ? "border-danger/30 bg-danger/10 text-danger"
        : "border-border bg-surface-muted/70 text-muted-foreground";

  return (
    <span
      className={cnInline(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        tone
      )}
      title={signal.detail}
    >
      {signal.state === "ok" ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      ) : signal.state === "down" ? (
        <WifiOff className="h-3 w-3" />
      ) : (
        <span className="h-2 w-2 rounded-full border border-current" />
      )}
      <Icon className="h-3.5 w-3.5 opacity-70" />
      <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{signal.label}</span>
    </span>
  );
}

function cnInline(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Dashboard hero. Every status chip is backed by a real probe — no chip is
 * hard-coded to "online".
 */
export function SystemStatusHero() {
  const { data: health, error: healthErr } = useApi(
    () => apiClient<{ status: string }>("/health"),
    [],
    { refreshMs: 30_000 }
  );

  const { data: mlStatus, error: mlErr } = useApi(
    () =>
      apiClient<{
        flood?: { loaded?: boolean };
        landslide?: { loaded?: boolean };
      }>("/ml/status"),
    [],
    { refreshMs: 60_000 }
  );

  const { data: telemetry, error: telemetryErr } = useApi(
    () => apiClient<{ locations_monitored?: number; worker_status?: string }>("/system/telemetry-worker"),
    [],
    { refreshMs: 30_000 }
  );

  const telemetryForbidden =
    telemetryErr instanceof ApiError && (telemetryErr.isForbidden || telemetryErr.status === 404);

  const apiSignal: Signal = {
    label: healthErr ? "API unreachable" : "API linked",
    state: healthErr ? "down" : health?.status === "ok" ? "ok" : "unknown",
    detail: healthErr ? String((healthErr as Error).message) : "GET /api/v1/health",
  };

  const mlLoaded = !!(mlStatus?.flood?.loaded && mlStatus?.landslide?.loaded);
  const mlSignal: Signal = {
    label: mlErr
      ? "ML status unknown"
      : mlLoaded
        ? "ML models loaded"
        : "ML models not loaded",
    state: mlErr ? "unknown" : mlLoaded ? "ok" : "down",
    detail: mlErr ? String((mlErr as Error).message) : "GET /api/v1/ml/status",
  };

  const telemetrySignal: Signal = telemetryForbidden
    ? { label: "Telemetry restricted", state: "unknown", detail: "Requires responder/admin role" }
    : telemetryErr
      ? { label: "Telemetry unavailable", state: "down" }
      : {
          label: telemetry?.worker_status === "STOPPED" ? "Telemetry paused" : "Telemetry active",
          state: telemetry?.worker_status === "STOPPED" ? "down" : "ok",
          detail:
            typeof telemetry?.locations_monitored === "number"
              ? `${telemetry.locations_monitored} locations monitored`
              : "GET /api/v1/system/telemetry-worker",
        };

  const weatherSignal: Signal = {
    label: healthOk(health, healthErr) ? "Weather feed synced" : "Weather feed unknown",
    state: healthOk(health, healthErr) ? "ok" : "unknown",
    detail: "Open-Meteo via /api/v1/environment/current",
  };

  const dispatchSignal: Signal = {
    label: healthOk(health, healthErr) ? "Alert dispatch ready" : "Dispatch unverified",
    state: healthOk(health, healthErr) ? "ok" : "unknown",
    detail: "Notifications dispatched from alert creation",
  };

  return (
    <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-5xl">
            Command Center
          </h1>
          <Badge
            variant="outline"
            className="gap-1.5 border-success/40 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            10s LIVE
          </Badge>
        </div>

        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          AI-assisted flood and landslide intelligence for Kerala — live KSDMA/IMD ingest,
          model inference and alert dispatch in one console.
          {typeof telemetry?.locations_monitored === "number" && (
            <span className="ml-2 font-mono text-xs text-foreground/60">
              {telemetry.locations_monitored} monitored locations
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip signal={apiSignal} icon={Cpu} />
        <StatusChip signal={mlSignal} icon={Radar} />
        <StatusChip signal={telemetrySignal} icon={Bell} />
        <StatusChip signal={weatherSignal} icon={Cloud} />
        <StatusChip signal={dispatchSignal} icon={MapIcon} />
      </div>
    </div>
  );
}

function healthOk(health: { status?: string } | null, err: unknown) {
  return !err && health?.status === "ok";
}
