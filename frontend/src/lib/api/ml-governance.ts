import { apiClient } from "./client";
import { 
  FeedbackCreate, 
  FeedbackReviewRequest, 
  CandidateExportRecord,
  DatasetCandidateSummary
} from "./types/ml-governance";
export type { DatasetCandidateSummary };

export interface FeedbackResponse {
  id: number
  event_id?: number | null
  hazard_type: string
  feedback_type: string
  review_status: string
  observed_outcome?: string | null
  notes?: string | null
  feature_snapshot?: Record<string, any> | null
  provenance?: string | null
  evidence_type?: string | null
  evidence_reference?: string | null
  exclusion_reason?: string | null
  submitted_by_id?: number | null
  submitted_at: string
  reviewed_by_id?: number | null
  reviewed_at?: string | null
}

export const MLGovernanceApi = {
  async submitFeedback(data: any): Promise<FeedbackResponse> {
    return apiClient<FeedbackResponse>('/ml/governance/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async listFeedback(): Promise<FeedbackResponse[]> {
    return apiClient<FeedbackResponse[]>('/ml/governance/feedback')
  },

  async reviewFeedback(id: number, status: string, notes?: string): Promise<FeedbackResponse> {
    return apiClient<FeedbackResponse>(`/ml/governance/feedback/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ review_status: status, notes }),
    })
  },

  async approveGroundTruth(id: number, data: { evidence_type: string, evidence_reference: string, notes?: string }): Promise<FeedbackResponse> {
    return apiClient<FeedbackResponse>(`/ml/governance/feedback/${id}/approve-ground-truth`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getCandidates(): Promise<DatasetCandidateSummary[]> {
    return apiClient<DatasetCandidateSummary[]>('/ml/governance/datasets/candidates')
  },
  
  async generateCandidate(hazardType: string): Promise<DatasetCandidateSummary> {
    return apiClient<DatasetCandidateSummary>(`/ml/governance/datasets/candidates?hazard_type=${hazardType}`, {
      method: 'POST'
    })
  },

  async exportCandidate(id: number): Promise<any[]> {
    return apiClient<any[]>(`/ml/governance/datasets/candidates/${id}/export`)
  },
}
