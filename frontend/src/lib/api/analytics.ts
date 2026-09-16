import { apiClient as api } from "./client";

export interface TrendDataPoint {
  date: string;
  historical_events: number;
  predictive_assessments: number;
  active_alerts: number;
  flood_max_risk: number;
  landslide_max_risk: number;
}

export interface AnalyticsSummary {
  total_historical_events: number;
  total_predictive_assessments: number;
  active_alerts: number;
  resolved_alerts: number;
  total_locations: number;
}

export interface HazardComparison {
  flood_events: number;
  landslide_events: number;
  flood_alerts: number;
  landslide_alerts: number;
  flood_avg_risk: number | null;
  landslide_avg_risk: number | null;
}

export interface SeverityCounts {
  VERY_LOW: number;
  LOW: number;
  MODERATE: number;
  HIGH: number;
  CRITICAL: number;
}

export interface SeverityDistribution {
  historical: SeverityCounts;
  predictive: SeverityCounts;
}

export interface LocationIncidentCount {
  location_id: number;
  name: string;
  latitude: number;
  longitude: number;
  historical_events: number;
  predictive_alerts: number;
  total_incidents: number;
}

export interface GeographicConcentration {
  locations: LocationIncidentCount[];
}

export interface DataQualityMetrics {
  total_records: number;
  oldest_record_date: string | null;
  newest_record_date: string | null;
  records_missing_coordinates: number;
  demo_records_count: number;
}

export const analyticsApi = {
  getSummary: async (days?: number) => {
    const url = days ? `/analytics/summary?days=${days}` : "/analytics/summary";
    const data = await api<AnalyticsSummary>(url);
    return data;
  },
  
  getTrends: async (days: number = 14) => {
    const data = await api<{ items: TrendDataPoint[] }>(`/analytics/trends?days=${days}`);
    return data.items;
  },

  getHazardComparison: async (days?: number) => {
    const url = days ? `/analytics/hazard-comparison?days=${days}` : "/analytics/hazard-comparison";
    const data = await api<HazardComparison>(url);
    return data;
  },

  getSeverityDistribution: async (days?: number) => {
    const url = days ? `/analytics/severity-distribution?days=${days}` : "/analytics/severity-distribution";
    const data = await api<SeverityDistribution>(url);
    return data;
  },

  getGeographicConcentration: async (days?: number) => {
    const url = days ? `/analytics/geographic?days=${days}` : "/analytics/geographic";
    const data = await api<GeographicConcentration>(url);
    return data;
  },

  getDataQuality: async () => {
    const data = await api<DataQualityMetrics>("/analytics/data-quality");
    return data;
  }
};
