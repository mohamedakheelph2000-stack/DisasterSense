import { apiClient } from './client';
import type { EmergencyResource } from './resources';

/* ------------------------------------------------------------------ sources */

export type SourceTrust =
  | 'government'
  | 'scientific'
  | 'open-scientific'
  | 'open-crowdsourced'
  | 'news'
  | 'research';

export interface SourceStatus {
  key: string;
  label: string;
  org: string;
  trust: SourceTrust | string;
  url: string;
  cadence_seconds: number;
  category: string;
  description: string;
  last_attempt: string | null;
  last_success: string | null;
  last_error: string | null;
  last_error_at: string | null;
  consecutive_errors: number;
  total_fetches: number;
  total_failures: number;
  records: number;
  last_latency_ms: number | null;
  avg_latency_ms: number | null;
  healthy: boolean;
  item_count: number;
}

export interface IngestWorkerStatus {
  running: boolean;
  tick_seconds: number;
  started_at: string | null;
  last_tick_at: string | null;
  next_tick_at: string | null;
  last_tick_duration_ms: number | null;
  total_ticks: number;
  total_fetches: number;
  total_failures: number;
  last_error: string | null;
  sources_registered: number;
  sources_healthy: number;
  sources_with_errors: string[];
  records_held: number;
  warnings: { total: number; counts: Record<string, number>; generated_at: string | null };
}

export interface SourcesResponse {
  sources: SourceStatus[];
  worker: IngestWorkerStatus;
  total_records: number;
}

export interface SourceItem {
  id: string;
  source_key: string;
  title: string;
  link: string;
  summary: string;
  published_at: string | null;
  fetched_at: string | null;
  category: string;
  hazard: string;
  latitude: number | null;
  longitude: number | null;
  place: string | null;
  severity_hint: string | null;
}

export interface SourceItemsResponse {
  source: SourceStatus;
  items: SourceItem[];
  payload: Record<string, unknown>;
}

/* ----------------------------------------------------------------- warnings */

export type WarningLevel = 'low' | 'medium' | 'high';

export interface WarningItem {
  area: string;
  state: string;
  hazard: string;
  warning_level: WarningLevel;
  reasons: string[];
  sources: string[];
  updated_at: string;
  location_id: number | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  risk_score: number | null;
  flood_score: number | null;
  landslide_score: number | null;
  secondary_hazard: string | null;
  severity: string | null;
  model_name: string | null;
  model_version: string | null;
  rainfall_24h_mm: number | null;
  external: boolean;
}

export interface WarningsResponse {
  generated_at: string | null;
  weather_available: boolean;
  weather_source: string | null;
  monitored_locations: number;
  external_signals_considered: number;
  counts: Record<string, number>;
  warnings: WarningItem[];
  flood_areas: WarningItem[];
  landslide_areas: WarningItem[];
  external_signals: Array<Record<string, unknown>>;
}

/* ------------------------------------------------------------------ nearby */

export interface EmergencyNumber {
  name: string;
  number: string;
  scope: string;
  description: string;
}

export interface NearbyGroup {
  key: string;
  label: string;
  count: number;
  items: EmergencyResource[];
}

export interface NearbyResponse {
  latitude: number;
  longitude: number;
  radius_km: number;
  generated_at: string;
  groups: NearbyGroup[];
  totals: Record<string, number>;
  grand_total?: number;
  emergency_numbers: EmergencyNumber[];
  source_note: string;
}

export interface NearbyParams {
  latitude: number;
  longitude: number;
  radius_km?: number;
  limit_per_type?: number;
  types?: string;
}

/* ------------------------------------------------------------------ client */

class IngestionAPI {
  getSources(): Promise<SourcesResponse> {
    return apiClient<SourcesResponse>('/sources');
  }

  getSourceItems(key: string, limit = 50): Promise<SourceItemsResponse> {
    return apiClient<SourceItemsResponse>(
      `/sources/${encodeURIComponent(key)}/items?limit=${limit}`
    );
  }

  getIngestStatus(): Promise<IngestWorkerStatus> {
    return apiClient<IngestWorkerStatus>('/ingest/status');
  }

  runIngestNow(): Promise<{ manual?: boolean; tick?: number; fetched?: number }> {
    return apiClient('/ingest/run-now', { method: 'POST' });
  }

  getWarnings(refresh = false): Promise<WarningsResponse> {
    return apiClient<WarningsResponse>(`/warnings${refresh ? '?refresh=true' : ''}`);
  }

  getNearby(params: NearbyParams): Promise<NearbyResponse> {
    const search = new URLSearchParams({
      latitude: params.latitude.toFixed(4),
      longitude: params.longitude.toFixed(4),
    });
    if (params.radius_km) search.set('radius_km', String(params.radius_km));
    if (params.limit_per_type) search.set('limit_per_type', String(params.limit_per_type));
    if (params.types) search.set('types', params.types);
    return apiClient<NearbyResponse>(`/resources/nearby?${search.toString()}`);
  }

  getEmergencyNumbers(): Promise<{ generated_at: string; numbers: EmergencyNumber[] }> {
    return apiClient('/resources/emergency-numbers');
  }
}

export const ingestionApi = new IngestionAPI();
