export interface MLModelSummary {
  hazard: string;
  loaded: boolean;
  model_name?: string;
  model_version?: string;
  dataset_version?: string;
  inference_source?: string;
  is_real: boolean;
  feature_count?: number;
  feature_names?: string[];
}

export interface MLStatusResponse {
  flood: MLModelSummary;
  landslide: MLModelSummary;
}

export interface MLConfusionMatrix {
  matrix: number[][];
  labels: string[];
}

export interface MLFeatureImportance {
  feature: string;
  importance: number;
}

export interface MLEvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  confusion_matrix?: MLConfusionMatrix;
  dataset_size?: number;
  timestamp?: string;
}

export interface MLHazardEvaluation {
  hazard: string;
  model_name: string;
  model_version: string;
  dataset_version?: string;
  metrics?: MLEvaluationMetrics;
  feature_importance: MLFeatureImportance[];
  limitations?: string;
}

export interface MLModelComparison {
  model_name: string;
  is_best_model: boolean;
  metrics: MLEvaluationMetrics;
}

export interface MLHazardComparisonResponse {
  hazard: string;
  dataset_version: string;
  models: MLModelComparison[];
}
