"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { apiClient, ApiError, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { useApi } from "@/hooks/use-api";
import { ArrowRight, Siren } from "lucide-react";
import {
  eventToRiskCardData,
  eventToRecentEvent,
  alertToDashboardAlert,
  healthToSystemStatus,
} from "@/lib/api/adapters";

import { CitizenDashboard } from "@/components/command-center/citizen-dashboard";
import { ResponderCommandCenter } from "@/components/command-center/responder-dashboard";
import { DateFilterBar } from "@/components/dashboard/date-filter-bar";
import { KeralaRiskRadar } from "@/components/dashboard/kerala-risk-radar";
import { SystemStatusHero } from "@/components/dashboard/system-status-hero";
import { ErrorBanner, ErrorState, LoadingGrid } from "@/components/ui/states";

interface DashboardPayload {
  floodRisk: any;
  landslideRisk: any;
  alerts: any[];
  events: any[];
  weather: any;
  trends: any[];
  systemStatus: any;
  clusters: any[];
  kerala: {
    locations: any[];
    news_feed: any[];
    overall_kerala_risk: { score: number; level: string };
  };
  lastSync: string | null;
  /** Live low/medium/high warning counts from the 5s analysis engine. */
  warningSummary: {
    generated_at: string | null;
    counts: Record<string, number>;
    total: number;
    flood_areas: number;
    landslide_areas: number;
  } | null;
  /** Endpoints that answered but returned nothing usable. */
  warnings: string[];
  /** Endpoint failures worth surfacing (network / 5xx), never silently dropped. */
  failures: string[];
}

async function settle<T>(
  endpoint: string
): Promise<{ ok: boolean; value: T | null; error: unknown }> {
  try {
    return { ok: true, value: await apiClient<T>(endpoint), error: null };
  } catch (error) {
    return { ok: false, value: null, error };
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || "citizen";

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const fetcher = useCallback(async (): Promise<DashboardPayload> => {
    const dateQuery = selectedDate ? `&date=${selectedDate}` : "";
    const keralaQuery = selectedDate ? `?date=${selectedDate}` : "";

    const [
      floodEvents,
      landslideEvents,
      alerts,
      recentEvents,
      health,
      environment,
      trends,
      clusters,
      kerala,
      warningBoard,
    ] = await Promise.all([
      settle<any>(`/disaster-events?hazard_type=flood&page_size=1${dateQuery}`),
      settle<any>(`/disaster-events?hazard_type=landslide&page_size=1${dateQuery}`),
      settle<any>(`/alerts?status=active&page_size=10${dateQuery}`),
      settle<any>(`/disaster-events?page_size=10${dateQuery}`),
      settle<any>("/health"),
      settle<any>("/environment/current"),
      settle<any>("/analytics/trends?days=14"),
      settle<any>("/spatial-risk/clusters?time_range=7d&record_type=predictive"),
      settle<any>(`/spatial-risk/kerala-live${keralaQuery}`),
      settle<any>("/warnings/summary"),
    ]);

    const failures: string[] = [];
    const warnings: string[] = [];
    for (const [name, res] of [
      ["flood events", floodEvents],
      ["landslide events", landslideEvents],
      ["alerts", alerts],
      ["event log", recentEvents],
      ["health", health],
      ["environment", environment],
      ["trends", trends],
      ["clusters", clusters],
      ["Kerala live feed", kerala],
      ["warning board", warningBoard],
    ] as const) {
      if (res.ok) continue;
      const err = res.error;
      const fatal = err instanceof ApiError && (err.isNetworkError || err.status >= 500);
      const label = `${name}: ${errorMessage(err)}`;
      if (fatal) failures.push(label);
      else if (err instanceof ApiError && err.isForbidden) warnings.push(`${name}: restricted`);
      else warnings.push(label);
    }

    // A dead backend is a hard failure — do not render a plausible-looking
    // empty dashboard as if the system were healthy.
    if (failures.length >= 3) {
      const first = new ApiError(
        0,
        "The DisasterSense backend is unreachable, so no live data can be shown. Start it with `uvicorn app.main:app --reload` from `backend/`.",
        "/dashboard"
      );
      throw first;
    }

    const floodItem = floodEvents.value?.items?.[0];
    const landslideItem = landslideEvents.value?.items?.[0];

    return {
      floodRisk: floodItem ? eventToRiskCardData(floodItem) : null,
      landslideRisk: landslideItem ? eventToRiskCardData(landslideItem) : null,
      alerts: (alerts.value?.items || []).map(alertToDashboardAlert),
      events: (recentEvents.value?.items || []).map((e: any) =>
        eventToRecentEvent(e)
      ),
      weather: environment.value,
      trends: trends.value?.items || trends.value || [],
      systemStatus: health.value ? healthToSystemStatus(health.value) : null,
      clusters: clusters.value?.clusters || [],
      kerala: {
        locations: kerala.value?.locations || [],
        news_feed: kerala.value?.news_feed || [],
        overall_kerala_risk: kerala.value?.overall_kerala_risk || {
          score: 0,
          level: "Low",
        },
      },
      lastSync: kerala.value?.last_sync || null,
      warningSummary: warningBoard.value || null,
      warnings,
      failures,
    };
  }, [selectedDate]);

  const { data, error, loading, refreshing, refetch, lastUpdated } =
    useApi<DashboardPayload>(fetcher, [selectedDate], {
      // Historical review mode must not be overwritten by the live poll.
      refreshMs: selectedDate ? 0 : 5_000,
    });

  const payload = data;
  const activeError = error;
  const activeLoading = loading;
  const activeRefreshing = refreshing;
  const activeRefetch = refetch;
  const activeUpdated = lastUpdated;

  const handleManualRefresh = async () => {
    setManualRefreshing(true);
    try {
      await apiClient("/spatial-risk/kerala-sync", { method: "POST" });
    } catch {
      // The sync trigger is best-effort; the next poll will recover.
    }
    await activeRefetch({ background: true });
    setManualRefreshing(false);
  };

  const floodScore = payload?.floodRisk?.risk_score || 0;
  const landslideScore = payload?.landslideRisk?.risk_score || 0;
  const overallScore = Math.max(
    floodScore,
    landslideScore,
    payload?.kerala.overall_kerala_risk?.score || 0
  );
  const overallLevel =
    overallScore >= 80
      ? "CRITICAL"
      : overallScore >= 60
        ? "HIGH"
        : overallScore >= 40
          ? "MODERATE"
          : "LOW";

  return (
    <AppShell>
      <SystemStatusHero />

      <LiveWarningStrip summary={payload?.warningSummary ?? null} />

      <DateFilterBar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onRefreshNow={handleManualRefresh}
        isRefreshing={activeRefreshing || manualRefreshing}
        lastSyncTime={payload?.lastSync || ""}
        lastUpdated={activeUpdated ? activeUpdated.toISOString() : ""}
      />

      {activeError ? (
        <div className="mb-5">
          <ErrorState error={activeError} onRetry={() => activeRefetch()} />
        </div>
      ) : null}

      {!activeError && payload?.warnings.length ? (
        <div className="mb-5 space-y-2">
          {payload.warnings.map((w) => (
            <ErrorBanner key={w} error={new Error(w)} />
          ))}
        </div>
      ) : null}

      {!activeError && activeLoading ? (
        <LoadingGrid rows={3} className="mb-5" />
      ) : null}

      {payload && (
        <>
          <KeralaRiskRadar
            locations={payload.kerala.locations}
            newsFeed={payload.kerala.news_feed}
            overallRisk={payload.kerala.overall_kerala_risk}
            lastSync={payload.lastSync || ""}
            loading={activeLoading}
          />

          {role === "citizen" ? (
            <CitizenDashboard
              data={payload}
              loading={activeLoading}
              error={null}
              onRetry={() => activeRefetch()}
              overallScore={overallScore}
              overallLevel={overallLevel}
            />
          ) : (
            <ResponderCommandCenter
              data={payload}
              loading={activeLoading}
              error={null}
              onRetry={() => activeRefetch()}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function LiveWarningStrip({ summary }: { summary: DashboardPayload["warningSummary"] }) {
  if (!summary) return null;
  const counts = summary.counts || {};
  const highCount = counts.high ?? 0;
  const mediumCount = counts.medium ?? 0;
  const lowCount = counts.low ?? 0;
  const totalWarnings = (summary.total ?? 0);

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface/50 px-4 py-2.5 transition-colors">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Siren className="h-4 w-4 text-primary" />
          <span>Active Warnings</span>
        </div>

        {totalWarnings === 0 ? (
          <span className="text-xs text-muted-foreground">
            No active alerts across monitored locations
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {highCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                <span>High:</span>
                <span className="font-mono font-semibold">{highCount}</span>
              </span>
            )}
            {mediumCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                <span>Moderate:</span>
                <span className="font-mono font-semibold">{mediumCount}</span>
              </span>
            )}
            {lowCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <span>Low:</span>
                <span className="font-mono">{lowCount}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <Link
        href="/warnings"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <span>Open Warning Board</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
