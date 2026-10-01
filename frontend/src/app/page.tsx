"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
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

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || "citizen";

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [keralaData, setKeralaData] = useState<any>({
    locations: [],
    news_feed: [],
    overall_kerala_risk: { score: 0, level: "Low" },
  });

  const [data, setData] = useState<any>({
    floodRisk: null,
    landslideRisk: null,
    alerts: [],
    events: [],
    weather: null,
    trends: [],
    systemStatus: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (dateParam = selectedDate, isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError(null);
    }
    setIsRefreshing(true);

    try {
      const dateQuery = dateParam ? `&date=${dateParam}` : "";
      const keralaQuery = dateParam ? `?date=${dateParam}` : "";

      const [
        floodEventsRes,
        landslideEventsRes,
        alertsRes,
        recentEventsRes,
        healthRes,
        environmentRes,
        trendsRes,
        clustersRes,
        keralaRes
      ] = await Promise.all([
        apiClient<any>(`/disaster-events?hazard_type=flood&page_size=1${dateQuery}`).catch(() => null),
        apiClient<any>(`/disaster-events?hazard_type=landslide&page_size=1${dateQuery}`).catch(() => null),
        apiClient<any>(`/alerts?status=active&page_size=10${dateQuery}`).catch(() => null),
        apiClient<any>(`/disaster-events?page_size=10${dateQuery}`).catch(() => null),
        apiClient<any>("/health").catch(() => null),
        apiClient<any>("/environment/current").catch(() => null),
        apiClient<any>("/analytics/trends?days=14").catch(() => null),
        apiClient<any>("/spatial-risk/clusters?time_range=7d&record_type=predictive").catch(() => null),
        apiClient<any>(`/spatial-risk/kerala-live${keralaQuery}`).catch(() => null),
      ]);

      const floodRisk = floodEventsRes?.items?.length > 0 ? eventToRiskCardData(floodEventsRes.items[0]) : null;
      const landslideRisk = landslideEventsRes?.items?.length > 0 ? eventToRiskCardData(landslideEventsRes.items[0]) : null;
      const alerts = (alertsRes?.items || []).map(alertToDashboardAlert);
      const events = (recentEventsRes?.items || []).map((e: any) => eventToRecentEvent(e));
      const systemStatus = healthRes ? healthToSystemStatus(healthRes) : null;

      setData({
        floodRisk,
        landslideRisk,
        alerts,
        events,
        weather: environmentRes,
        trends: trendsRes?.items || [],
        systemStatus,
        clusters: clustersRes?.clusters || [],
      });

      if (keralaRes) {
        setKeralaData({
          locations: keralaRes.locations || [],
          news_feed: keralaRes.news_feed || [],
          overall_kerala_risk: keralaRes.overall_kerala_risk || { score: 0, level: "Low" },
        });
        setLastSyncTime(keralaRes.last_sync || new Date().toISOString());
      }
    } catch (err: any) {
      if (!isBackground) {
        setError(err.message || "Failed to load data.");
      }
    } finally {
      if (!isBackground) setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  // Initial fetch and on date change
  useEffect(() => {
    fetchDashboardData(selectedDate, false);
  }, [selectedDate, fetchDashboardData]);

  // 10-Second Auto-Refresh in Live mode (!selectedDate)
  useEffect(() => {
    if (selectedDate) return; // Do not auto-refresh when reviewing historical/specific date

    const timer = setInterval(() => {
      fetchDashboardData("", true);
    }, 10000); // 10 seconds continuous stream

    return () => clearInterval(timer);
  }, [selectedDate, fetchDashboardData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await apiClient("/spatial-risk/kerala-sync", { method: "POST" }).catch(() => null);
    } finally {
      fetchDashboardData(selectedDate, false);
    }
  };

  const floodScore = data.floodRisk?.risk_score || 0;
  const landslideScore = data.landslideRisk?.risk_score || 0;
  const overallScore = Math.max(floodScore, landslideScore, keralaData.overall_kerala_risk?.score || 0);
  const overallLevel = overallScore >= 80 ? "CRITICAL" : overallScore >= 60 ? "HIGH" : overallScore >= 40 ? "MODERATE" : "LOW";

  return (
    <AppShell>
      {/* Date Filter Bar & 10s Live Countdown */}
      <DateFilterBar
        selectedDate={selectedDate}
        onDateChange={(d) => setSelectedDate(d)}
        onRefreshNow={handleManualRefresh}
        isRefreshing={isRefreshing}
        lastSyncTime={lastSyncTime}
      />

      {/* Real-Time Kerala Risk Radar & Live News Stream */}
      <KeralaRiskRadar
        locations={keralaData.locations}
        newsFeed={keralaData.news_feed}
        overallRisk={keralaData.overall_kerala_risk}
        lastSync={lastSyncTime}
        loading={loading}
      />

      {/* Role-Specific Dashboard Views */}
      {role === "citizen" ? (
        <CitizenDashboard 
          data={data} 
          loading={loading} 
          error={error} 
          onRetry={() => fetchDashboardData(selectedDate, false)}
          overallScore={overallScore}
          overallLevel={overallLevel}
        />
      ) : (
        <ResponderCommandCenter 
          data={data} 
          loading={loading} 
          error={error} 
          onRetry={() => fetchDashboardData(selectedDate, false)} 
        />
      )}
    </AppShell>
  );
}
