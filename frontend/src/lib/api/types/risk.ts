export interface FeatureImpactResponse {
  feature: string;
  value: number;
  importance: number;
  impact_level: string;
}

export interface FloodAssessmentRequest {
  location_id?: number | null;
  rainfall_mm_24h: number;
  rainfall_intensity_mm_h: number;
  rainfall_duration_h: number;
  temperature_c: number;
  humidity_pct: number;
  elevation_m: number;
  slope_deg: number;
  drainage_capacity_score: number;
  soil_saturation_pct: number;
  historical_flood_count: number;
  distance_to_river_m: number;
}

export interface LandslideAssessmentRequest {
  location_id?: number | null;
  rainfall_mm_24h: number;
  rainfall_intensity_mm_h: number;
  slope_deg: number;
  elevation_m: number;
  soil_type_code: number;
  soil_moisture_pct: number;
  geological_stability_index: number;
  vegetation_cover_pct: number;
  historical_landslide_count: number;
  road_cut_proximity_m: number;
}

export interface RiskAssessmentResponse {
  hazard_type: string;
  risk_score: number;
  risk_level: string;
  severity: string;
  probability: number;
  model_name: string;
  model_version: string;
  dataset_version?: string | null;
  inference_source: string;
  mode: string;
  location_id?: number | null;
  event_id?: number | null;
  features_used: Record<string, number>;
  feature_impacts: FeatureImpactResponse[];
  assessed_at: string;
}
