"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingGrid } from "@/components/ui/states";
import { Reveal } from "@/components/animations/motion";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth/auth-context";
import { ingestionApi, type WarningItem, type WarningLevel, type WarningsResponse } from "@/lib/api/ingestion";
import {
  AlertTriangle,
  CloudRain,
  ExternalLink,
  Globe2,
  Mountain,
  RefreshCw,
  Siren,
  Waves,
} from "lucide-react";

const LIVE_REFRESH_MS = 5000;

const LEVEL_META: Record<
  WarningLevel,
  { label: string; badge: "danger" | "warning" | "success"; chip: string; dot: string }
> = {
  high: {
    label: "HIGH WARNING",
    badge: "danger",
    chip: "border-danger/40 bg-danger/10 text-danger",
    dot: "bg-danger shadow-[0_0_10px_hsl(var(--danger))]",
  },
  medium: {
    label: "MEDIUM WARNING",
    badge: "warning",
    chip: "border-warning/40 bg-warning/10 text-warning",
    dot: "bg-warning shadow-[0_0_10px_hsl(var(--warning))]",
  },
  low: {
    label: "LOW WARNING",
    badge: "success",
    chip: "border-success/40 bg-success/10 text-success",
    dot: "bg-success",
  },
};

const HAZARD_META: Record<string, { label: string; icon: typeof Waves }> = {
  flood: { label: "Flood", icon: Waves },
  landslide: { label: "Landslide", icon: Mountain },
  earthquake: { label: "Earthquake", icon: AlertTriangle },
  cyclone: { label: "Cyclone", icon: CloudRain },
  volcano: { label: "Volcano", icon: AlertTriangle },
  wildfire: { label: "Wildfire", icon: AlertTriangle },
  weather: { label: "Severe Weather", icon: CloudRain },
  other: { label: "Other", icon: Globe2 },
};

type HazardFilter = "all" | "flood" | "landslide" | "other";

export default function WarningsPage() {
  const { user } = useAuth();
  const role = user?.role || "citizen";
  const canTrigger = role === "admin" || role === "responder";

  const [levelFilter, setLevelFilter] = useState<"all" | WarningLevel>("all");
  const [hazardFilter, setHazardFilter] = useState<HazardFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const { data, error, loading, refreshing, lastUpdated, refetch } = useApi<WarningsResponse>(
    () => ingestionApi.getWarnings(),
    [],
    { refreshMs: LIVE_REFRESH_MS }
  );

  const warnings = useMemo(() => data?.warnings ?? [], [data]);

  const filtered = useMemo(() => {
    return warnings.filter((w) => {
      if (levelFilter !== "all" && w.warning_level !== levelFilter) return false;
      if (hazardFilter === "all") return true;
      if (hazardFilter === "flood") return w.hazard === "flood";
      if (hazardFilter === "landslide") return w.hazard === "landslide";
      return w.hazard !== "flood" && w.hazard !== "landslide";
    });
  }, [warnings, levelFilter, hazardFilter]);

  const counts = data?.counts ?? { high: 0, medium: 0, low: 0 };

  const runAnalysisNow = async () => {
    setTriggering(true);
    setActionError(null);
    try {
      await ingestionApi.runIngestNow();
      await refetch({ background: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not trigger an ingest cycle.");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="24/7 ANALYSIS"
        title="Warning Board"
        description="Risk areas produced by the live ingestion engine: weather telemetry scored by the ML flood and landslide models, corroborated by government, scientific and news sources refreshed on a 5-second tick."
        meta={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-[11px] text-success">
              <span className="h-1.5 w-1.5 animate-blink rounded-full bg-success" />
              LIVE · AUTO-REFRESH {LIVE_REFRESH_MS / 1000}s
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {lastUpdated ? `updated ${lastUpdated.toLocaleTimeString()}` : "—"}
              {refreshing ? " · refreshing…" : ""}
            </span>
            {data && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {data.monitored_locations} locations · {data.external_signals_considered} external signals
              </span>
            )}
          </>
        }
        actions={
          <>
            {canTrigger && (
              <Button variant="outline" size="sm" onClick={runAnalysisNow} disabled={triggering}>
                <Siren className={triggering ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
                Run analysis now
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={loading}>
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </Button>
          </>
        }
      />

      {actionError && (
        <div role="alert" className="mb-5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {actionError}
        </div>
      )}

      {loading ? (
        <LoadingGrid rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          {/* ── Warning counters ─────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile
              label="High warnings"
              value={counts.high ?? 0}
              tone="danger"
              icon={<Siren className="h-4 w-4" />}
              hint="Act now"
              delay={0}
            />
            <StatTile
              label="Medium warnings"
              value={counts.medium ?? 0}
              tone="warning"
              icon={<AlertTriangle className="h-4 w-4" />}
              hint="Stay alert"
              delay={0.05}
            />
            <StatTile
              label="Low warnings"
              value={counts.low ?? 0}
              tone="success"
              icon={<Globe2 className="h-4 w-4" />}
              hint="Routine"
              delay={0.1}
            />
            <StatTile
              label="Flood areas"
              value={(data?.flood_areas ?? []).length}
              tone="info"
              icon={<Waves className="h-4 w-4" />}
              hint="Scored by ML"
              delay={0.15}
            />
            <StatTile
              label="Landslide areas"
              value={(data?.landslide_areas ?? []).length}
              tone="primary"
              icon={<Mountain className="h-4 w-4" />}
              hint="Scored by ML"
              delay={0.2}
            />
          </div>

          {/* ── Filters ──────────────────────────────────────────────────── */}
          <Reveal className="mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="hud-label mr-1">Level</span>
                {(["all", "high", "medium", "low"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setLevelFilter(level)}
                    className={
                      levelFilter === level
                        ? "rounded-lg border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium capitalize text-primary"
                        : "rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs capitalize text-foreground/70 hover:bg-surface hover:text-foreground"
                    }
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="hud-label mr-1">Hazard</span>
                {(["all", "flood", "landslide", "other"] as const).map((hazard) => (
                  <button
                    key={hazard}
                    onClick={() => setHazardFilter(hazard)}
                    className={
                      hazardFilter === hazard
                        ? "rounded-lg border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium capitalize text-primary"
                        : "rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-xs capitalize text-foreground/70 hover:bg-surface hover:text-foreground"
                    }
                  >
                    {hazard}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {/* ── Warning cards ────────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Globe2 className="h-5 w-5" />}
              title="No warnings match this filter"
              description={
                data && data.warnings.length === 0
                  ? "The engine is healthy and has analysed the current data — no area currently reaches a warning threshold."
                  : "Try widening the level or hazard filter."
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                {filtered.map((warning, index) => (
                  <WarningCard key={`${warning.area}-${warning.hazard}-${index}`} warning={warning} />
                ))}
              </div>

              {/* ── External signal feed ───────────────────────────────── */}
              <Panel
                label="External signals"
                title="Fetched in the last 8 hours"
                description="News wires, seismology and satellite event feeds matched to areas."
                actions={
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {(data?.external_signals ?? []).length}
                  </Badge>
                }
                bodyClassName="p-0"
                className="h-full"
              >
                <ul className="max-h-[720px] divide-y divide-border/60 overflow-y-auto">
                  {(data?.external_signals ?? []).map((signal, index) => {
                    const level = (signal.warning_level as WarningLevel) || "low";
                    const meta = LEVEL_META[level] ?? LEVEL_META.low;
                    return (
                      <li key={index} className="px-5 py-3.5">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          <span className="hud-label">{String(signal.area ?? "Global")}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {typeof signal.published_at === "string"
                              ? new Date(signal.published_at).toLocaleString()
                              : ""}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-foreground/80">
                          {String(signal.title ?? "")}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant={meta.badge} className="text-[10px] uppercase tracking-wider">
                            {level}
                          </Badge>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {String(signal.source_key ?? "").replace(/_/g, " ")}
                          </span>
                          {typeof signal.link === "string" && signal.link ? (
                            <a
                              href={signal.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                            >
                              source <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                  {(data?.external_signals ?? []).length === 0 && (
                    <li className="px-5 py-8 text-center text-xs text-muted-foreground">
                      No external signals in the current window.
                    </li>
                  )}
                </ul>
              </Panel>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function WarningCard({ warning }: { warning: WarningItem }) {
  const levelMeta = LEVEL_META[warning.warning_level] ?? LEVEL_META.low;
  const hazard = HAZARD_META[warning.hazard] ?? HAZARD_META.other;
  const HazardIcon = hazard.icon;
  const isModelled = typeof warning.risk_score === "number";

  return (
    <Reveal>
      <article className="panel panel-glow relative overflow-hidden">
        <span className={`absolute inset-x-0 top-0 h-px ${levelMeta.dot}`} />

        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${levelMeta.chip}`}
            >
              <HazardIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {warning.location_name || warning.area}
                </h3>
                <span className="font-mono text-[11px] text-muted-foreground">{warning.state}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {hazard.label} · {warning.secondary_hazard ? `secondary: ${warning.secondary_hazard}` : "primary hazard"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge variant={levelMeta.badge} className="font-mono tracking-[0.12em]">
              {levelMeta.label}
            </Badge>
            {isModelled && (
              <span className="font-mono text-[11px] text-foreground/70">
                risk {warning.risk_score?.toFixed(1)}
                {warning.risk_score !== undefined && warning.risk_score !== null
                  ? warning.risk_score >= 60
                    ? " · high"
                    : warning.risk_score >= 40
                      ? " · medium"
                      : " · low"
                  : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
          {warning.rainfall_24h_mm !== null && warning.rainfall_24h_mm !== undefined && (
            <span className="rounded-md border border-info/30 bg-info/10 px-2 py-0.5 font-mono text-[11px] text-info">
              rain 24h {warning.rainfall_24h_mm.toFixed(0)} mm
            </span>
          )}
          {warning.flood_score !== null && warning.flood_score !== undefined && (
            <span className="rounded-md border border-border bg-surface/60 px-2 py-0.5 font-mono text-[11px] text-foreground/70">
              flood {warning.flood_score}
            </span>
          )}
          {warning.landslide_score !== null && warning.landslide_score !== undefined && (
            <span className="rounded-md border border-border bg-surface/60 px-2 py-0.5 font-mono text-[11px] text-foreground/70">
              landslide {warning.landslide_score}
            </span>
          )}
          {warning.latitude !== null && warning.longitude !== null && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {warning.latitude?.toFixed(3)}, {warning.longitude?.toFixed(3)}
            </span>
          )}
          {warning.model_name && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {warning.model_name} {warning.model_version ?? ""}
            </span>
          )}
        </div>

        <ul className="mt-3 space-y-1.5 border-t border-border/60 px-5 py-4">
          {warning.reasons.slice(0, 5).map((reason, index) => (
            <li key={index} className="flex items-start gap-2 text-xs text-foreground/75">
              <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${levelMeta.dot}`} />
              <span className="leading-relaxed">{reason}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-5 py-3">
          <span className="hud-label mr-1">Sources</span>
          {warning.sources.map((source) => (
            <Badge key={source} variant="outline" className="font-mono text-[10px]">
              {source.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      </article>
    </Reveal>
  );
}
