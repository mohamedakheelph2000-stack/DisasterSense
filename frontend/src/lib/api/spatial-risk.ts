import { apiClient } from "./client";
import { SpatialAggregationResponse } from "./types/spatial-risk";

export const SpatialRiskApi = {
  async getAggregation(params: {
    hazard_type?: string;
    time_range?: string;
    record_type?: string;
    min_lat?: number;
    max_lat?: number;
    min_lon?: number;
    max_lon?: number;
  } = {}): Promise<SpatialAggregationResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.hazard_type) searchParams.append("hazard_type", params.hazard_type);
    if (params.time_range) searchParams.append("time_range", params.time_range);
    if (params.record_type) searchParams.append("record_type", params.record_type);
    if (params.min_lat !== undefined) searchParams.append("min_lat", params.min_lat.toString());
    if (params.max_lat !== undefined) searchParams.append("max_lat", params.max_lat.toString());
    if (params.min_lon !== undefined) searchParams.append("min_lon", params.min_lon.toString());
    if (params.max_lon !== undefined) searchParams.append("max_lon", params.max_lon.toString());

    const queryString = searchParams.toString();
    const url = `/spatial-risk/aggregation${queryString ? `?${queryString}` : ""}`;
    
    return apiClient<SpatialAggregationResponse>(url);
  },

  async getClusters(params: {
    hazard_type?: string;
    time_range?: string;
    record_type?: string;
    min_lat?: number;
    max_lat?: number;
    min_lon?: number;
    max_lon?: number;
  } = {}): Promise<any> {
    const searchParams = new URLSearchParams();
    
    if (params.hazard_type) searchParams.append("hazard_type", params.hazard_type);
    if (params.time_range) searchParams.append("time_range", params.time_range);
    if (params.record_type) searchParams.append("record_type", params.record_type);
    if (params.min_lat !== undefined) searchParams.append("min_lat", params.min_lat.toString());
    if (params.max_lat !== undefined) searchParams.append("max_lat", params.max_lat.toString());
    if (params.min_lon !== undefined) searchParams.append("min_lon", params.min_lon.toString());
    if (params.max_lon !== undefined) searchParams.append("max_lon", params.max_lon.toString());

    const queryString = searchParams.toString();
    const url = `/spatial-risk/clusters${queryString ? `?${queryString}` : ""}`;
    
    return apiClient<any>(url);
  }
}
