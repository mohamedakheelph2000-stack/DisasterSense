import { apiClient } from "./client";
import { MLStatusResponse, MLHazardEvaluation, MLHazardComparisonResponse } from "./types/ml";

export async function getMLStatus(): Promise<MLStatusResponse> {
  return apiClient<MLStatusResponse>("/ml/status");
}

export async function getMLEvaluation(hazard: "flood" | "landslide"): Promise<MLHazardEvaluation> {
  return apiClient<MLHazardEvaluation>(`/ml/evaluation/${hazard}`);
}

export async function getMLExperiments(hazard: "flood" | "landslide"): Promise<MLHazardComparisonResponse> {
  return apiClient<MLHazardComparisonResponse>(`/ml/experiments/${hazard}`);
}
