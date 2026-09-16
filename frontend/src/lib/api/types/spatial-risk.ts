export interface SpatialCell {
  cell_id: string;
  center_lat: number;
  center_lon: number;
  hazard_type: string;
  record_type: string;
  average_risk: number;
  max_risk: number;
  min_risk: number;
  latest_risk: number;
  latest_assessment_time: string;
  assessment_count: number;
  high_risk_count: number;
  critical_risk_count: number;
  risk_category: string;
  provenance: string[];
}

export interface AggregationMetadata {
  time_window: string;
  hazard?: string;
  record_type: string;
  cell_size: number;
  total_cells: number;
  total_assessments: number;
}

export interface SpatialAggregationResponse {
  aggregation_metadata: AggregationMetadata;
  cells: SpatialCell[];
}

export interface ClusterMetadata {
  cluster_id: string;
  hazard_type: string;
  record_type: string;
  centroid_lat: number;
  centroid_lon: number;
  member_count: number;
  first_timestamp: string;
  latest_timestamp: string;
  duration_hours: number;
  average_risk: number;
  max_risk: number;
  high_risk_count: number;
  critical_risk_count: number;
  provenance: string[];
  quality_indicator: string;
}

export interface ClusterResponseMetadata {
  time_window: string;
  hazard?: string;
  record_type: string;
  total_clusters: number;
  total_assessments: number;
  spatial_threshold_km: number;
  temporal_threshold_hours: number;
}

export interface ClusterResponse {
  metadata: ClusterResponseMetadata;
  clusters: ClusterMetadata[];
}
