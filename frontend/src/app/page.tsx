"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiClient } from "@/lib/api/client";
import { API_CONFIG } from "@/lib/api/config";
import { useAuth } from "@/lib/auth/auth-context";
import {
  eventToRiskCardData,
  eventToRecentEvent,
  alertToDashboardAlert,
  healthToSystemStatus,
} from "@/lib/api/adapters";

import { CitizenDashboard } from "@/components/command-center/citizen-dashboard";
import { ResponderCommandCenter } from "@/components/command-center/responder-dashboard";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || "citizen";

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

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (API_CONFIG.IS_DEMO_MODE) {
        const [
          flood,
          landslide,
          alertsData,
          eventsData,
          weatherData,
          trendsData,
          statusData,
          clustersRes
        ] = await Promise.all([
          apiClient("/risk-assessments/flood").catch(() => null),
          apiClient("/risk-assessments/landslide").catch(() => null),
          apiClient("/alerts/active").catch(() => []),
          apiClient("/events/recent").catch(() => []),
          apiClient("/environment/current").catch(() => null),
          apiClient("/analytics/trends").catch(() => []),
          apiClient("/system/status").catch(() => null),
          apiClient<any>("/spatial-risk/clusters?time_range=7d&record_type=demo").catch(() => null),
        ]);

        setData({
          floodRisk: flood,
          landslideRisk: landslide,
          alerts: alertsData as any,
          events: eventsData as any,
          weather: weatherData,
          trends: trendsData as any,
          systemStatus: statusData,
          clusters: clustersRes?.clusters || [],
        });
      } else {
        const [
          floodEventsRes,
          landslideEventsRes,
          alertsRes,
          recentEventsRes,
          healthRes,
          environmentRes,
          trendsRes,
          clustersRes
        ] = await Promise.all([
          apiClient<any>("/disaster-events?hazard_type=flood&page_size=1").catch(() => null),
          apiClient<any>("/disaster-events?hazard_type=landslide&page_size=1").catch(() => null),
          apiClient<any>("/alerts?status=active&page_size=10").catch(() => null),
          apiClient<any>("/disaster-events?page_size=10").catch(() => null),
          apiClient<any>("/health").catch(() => null),
          apiClient<any>("/environment/current").catch(() => null),
          apiClient<any>("/analytics/trends?days=14").catch(() => null),
          apiClient<any>("/spatial-risk/clusters?time_range=7d&record_type=predictive").catch(() => null),
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
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const floodScore = data.floodRisk?.risk_score || 0;
  const landslideScore = data.landslideRisk?.risk_score || 0;
  const overallScore = Math.max(floodScore, landslideScore);
  const overallLevel = overallScore >= 80 ? "CRITICAL" : overallScore >= 60 ? "HIGH" : overallScore >= 40 ? "MODERATE" : "LOW";

  return (
    <AppShell>
      {loading && !error && !data.systemStatus ? (
         <div className="h-[80vh] flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-foreground/50 tracking-wider uppercase text-sm font-medium">Initializing Workspace</p>
         </div>
      ) : role === "citizen" ? (
        <CitizenDashboard 
          data={data} 
          loading={loading} 
          error={error} 
          onRetry={fetchDashboardData}
          overallScore={overallScore}
          overallLevel={overallLevel}
        />
      ) : (
        <ResponderCommandCenter 
          data={data} 
          loading={loading} 
          error={error} 
          onRetry={fetchDashboardData} 
        />
      )}
    </AppShell>
  );
}
