"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingGrid } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth/auth-context";
import {
  ingestionApi,
  type SourceItemsResponse,
  type SourceStatus,
  type SourcesResponse,
} from "@/lib/api/ingestion";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe2,
  Newspaper,
  Radar,
  RefreshCw,
  Siren,
  Timer,
} from "lucide-react";

const LIVE_REFRESH_MS = 5000;

const TRUST_LABEL: Record<string, string> = {
  government: "Government",
  scientific: "Scientific",
  "open-scientific": "Open scientific",
  "open-crowdsourced": "Open crowdsourced",
  news: "News wire",
  research: "Research monitor",
};

const CATEGORY_ICON: Record<string, typeof Globe2> = {
  weather: Activity,
  earthquake: Radar,
  event: Globe2,
  news: Newspaper,
  facility: Building2,
};

export default function DataSourcesPage() {
  const { user } = useAuth();
  const role = user?.role || "citizen";
  const canTrigger = role === "admin" || role === "responder";

  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<SourceItemsResponse | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const { data, error, loading, refreshing, lastUpdated, refetch } = useApi<SourcesResponse>(
    () => ingestionApi.getSources(),
    [],
    { refreshMs: LIVE_REFRESH_MS }
  );

  const openSource = async (key: string) => {
    if (expanded === key) {
      setExpanded(null);
      setItems(null);
      return;
    }
    setExpanded(key);
    setItems(null);
    setItemsError(null);
    setItemsLoading(true);
    try {
      setItems(await ingestionApi.getSourceItems(key, 25));
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : "Could not load records.");
    } finally {
      setItemsLoading(false);
    }
  };

  const runNow = async () => {
    setTriggering(true);
    setActionError(null);
    try {
      await ingestionApi.runIngestNow();
      await refetch({ background: true });
      if (expanded) {
        setItems(await ingestionApi.getSourceItems(expanded, 25));
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Ingest cycle failed.");
    } finally {
      setTriggering(false);
    }
  };

  const worker = data?.worker;

  return (
    <AppShell>
      <PageHeader
        eyebrow="24/7 INGESTION"
        title="Data Sources"
        description="Every trusted source the engine polls — government and scientific feeds, open weather data, satellite event tracking and disaster news — with its own cadence, latency and error history."
        meta={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-[11px] text-success">
              <span className="h-1.5 w-1.5 animate-blink rounded-full bg-success" />
              {worker?.running ? `PIPELINE RUNNING · ${worker.tick_seconds}s TICK` : "PIPELINE IDLE"}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {lastUpdated ? `updated ${lastUpdated.toLocaleTimeString()}` : "—"}
              {refreshing ? " · refreshing…" : ""}
            </span>
          </>
        }
        actions={
          <>
            {canTrigger && (
              <Button variant="outline" size="sm" onClick={runNow} disabled={triggering}>
                <Siren className={triggering ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
                Poll all now
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
      ) : !data ? (
        <EmptyState title="No source telemetry yet" />
      ) : (
        <>
          {/* ── Heartbeat ─────────────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Pipeline tick"
              value={worker?.tick_seconds ?? 0}
              suffix="s"
              tone="success"
              icon={<Timer className="h-4 w-4" />}
              hint={`${worker?.total_ticks ?? 0} cycles completed`}
            />
            <StatTile
              label="Sources healthy"
              value={`${worker?.sources_healthy ?? 0}/${worker?.sources_registered ?? 0}`}
              tone={(worker?.sources_with_errors ?? []).length ? "warning" : "success"}
              icon={<Globe2 className="h-4 w-4" />}
              hint={`${data.total_records} records held`}
            />
            <StatTile
              label="Fetches / failures"
              value={`${worker?.total_fetches ?? 0} / ${worker?.total_failures ?? 0}`}
              tone={worker?.total_failures ? "warning" : "neutral"}
              icon={<Activity className="h-4 w-4" />}
              hint="since process start"
            />
            <StatTile
              label="Current warnings"
              value={worker?.warnings?.total ?? 0}
              tone="primary"
              icon={<Radar className="h-4 w-4" />}
              hint={
                worker?.warnings?.generated_at
                  ? `analysed ${new Date(worker.warnings.generated_at).toLocaleTimeString()}`
                  : "awaiting first analysis"
              }
            />
          </div>

          {worker?.last_error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              Last pipeline error: {worker.last_error}
            </div>
          )}

          {/* ── Source cards ──────────────────────────────────────────────── */}
          {data.sources.length === 0 ? (
            <EmptyState title="No sources registered" description="The ingestion worker has not registered any source yet." />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {data.sources.map((source) => (
                <SourceCard
                  key={source.key}
                  source={source}
                  expanded={expanded === source.key}
                  onToggle={() => void openSource(source.key)}
                  items={items}
                  itemsLoading={itemsLoading}
                  itemsError={itemsError}
                />
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function SourceCard({
  source,
  expanded,
  onToggle,
  items,
  itemsLoading,
  itemsError,
}: {
  source: SourceStatus;
  expanded: boolean;
  onToggle: () => void;
  items: SourceItemsResponse | null;
  itemsLoading: boolean;
  itemsError: string | null;
}) {
  const Icon = CATEGORY_ICON[source.category] ?? Globe2;
  const lastSuccess = source.last_success ? relativeTime(source.last_success) : "never";

  return (
    <div className="panel flex flex-col">
      <div className="flex items-start gap-3 px-5 pt-5">
        <span
          className={
            source.healthy
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-success/30 bg-success/10 text-success"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 text-danger"
          }
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{source.label}</h3>
            <Badge variant={source.healthy ? "success" : "danger"} className="text-[10px] uppercase tracking-wider">
              {source.healthy ? "healthy" : "erroring"}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{source.org}</p>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-border/70 p-2 text-foreground/50 transition-colors hover:border-primary/40 hover:text-primary"
          aria-label={`Open ${source.label}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 px-5">
        <Badge variant="outline" className="text-[10px]">
          {TRUST_LABEL[source.trust] ?? source.trust}
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          every {source.cadence_seconds}s
        </Badge>
        <span className="font-mono text-[10px] text-muted-foreground">{source.category}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 px-5 py-4 text-xs">
        <div>
          <dt className="hud-label">Last success</dt>
          <dd className="mt-0.5 font-mono text-foreground/80">{lastSuccess}</dd>
        </div>
        <div>
          <dt className="hud-label">Latency</dt>
          <dd className="mt-0.5 font-mono text-foreground/80">
            {source.last_latency_ms !== null ? `${source.last_latency_ms} ms` : "—"}
            {source.avg_latency_ms !== null ? ` · avg ${source.avg_latency_ms} ms` : ""}
          </dd>
        </div>
        <div>
          <dt className="hud-label">Records</dt>
          <dd className="mt-0.5 font-mono text-foreground/80">
            {source.item_count} held · {source.total_fetches} fetches
          </dd>
        </div>
        <div>
          <dt className="hud-label">Failures</dt>
          <dd className="mt-0.5 font-mono text-foreground/80">
            {source.total_failures} total · {source.consecutive_errors} consecutive
          </dd>
        </div>
      </dl>

      {source.last_error && (
        <p className="mx-5 mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-danger">
          {source.last_error}
        </p>
      )}

      <button
        onClick={onToggle}
        className="mt-auto flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-foreground/60 transition-colors hover:text-foreground"
      >
        <span>{expanded ? "Hide latest records" : "Show latest records"}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="border-t border-border/60 bg-surface/40 px-5 py-4">
          {itemsLoading ? (
            <p className="font-mono text-[11px] text-muted-foreground">Loading records…</p>
          ) : itemsError ? (
            <p className="font-mono text-[11px] text-danger">{itemsError}</p>
          ) : items && items.items.length > 0 ? (
            <ul className="space-y-2">
              {items.items.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span
                    className={
                      item.severity_hint === "high"
                        ? "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                        : item.severity_hint === "medium"
                          ? "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                          : "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                    }
                  />
                  <div className="min-w-0">
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs leading-relaxed text-foreground/85 hover:text-primary hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="text-xs leading-relaxed text-foreground/85">{item.title}</span>
                    )}
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {item.hazard}
                      {item.place ? ` · ${item.place}` : ""}
                      {item.published_at ? ` · ${new Date(item.published_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">
              No records held yet. {source.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}
