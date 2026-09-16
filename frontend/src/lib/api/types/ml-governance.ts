export type FeedbackType = "confirmed_event" | "false_positive" | "false_negative" | "uncertain" | "data_correction";
export type ReviewStatus = "submitted" | "under_review" | "accepted" | "rejected" | "approved_ground_truth";

export interface FeedbackCreate {
  event_id?: number | null;
  hazard_type: string;
  feedback_type: FeedbackType;
  observed_outcome?: string | null;
  notes?: string | null;
  feature_snapshot?: Record<string, any> | null;
  provenance?: string | null;
}

export interface FeedbackResponse {
  id: number;
  event_id?: number | null;
  hazard_type: string;
  feedback_type: FeedbackType;
  review_status: ReviewStatus;
  observed_outcome?: string | null;
  notes?: string | null;
  feature_snapshot?: Record<string, any> | null;
  provenance?: string | null;
  evidence_type?: string | null;
  evidence_reference?: string | null;
  exclusion_reason?: string | null;
  submitted_by_id?: number | null;
  submitted_at: string;
  reviewed_by_id?: number | null;
  reviewed_at?: string | null;
}

export interface FeedbackReviewRequest {
  review_status: ReviewStatus;
  notes?: string | null;
}

export interface DatasetCandidateSummary {
  id: number;
  dataset_version: string;
  hazard_type: string;
  status: string;
  record_count: number;
  positive_samples: number;
  negative_samples: number;
  feature_schema: string[];
  geographic_coverage: string;
  temporal_coverage: string;
  methodology: string;
  exclusions?: string;
  included_count: number;
  excluded_count: number;
  duplicate_count: number;
  leakage_count: number;
  unknown_provenance_count: number;
  created_at: string;
  created_by_id?: number;
}

export interface CandidateExportRecord {
  feedback_id: number;
  event_id?: number | null;
  hazard_type: string;
  feedback_type: string;
  observed_outcome?: string | null;
  feature_snapshot: Record<string, any>;
  provenance?: string | null;
}
