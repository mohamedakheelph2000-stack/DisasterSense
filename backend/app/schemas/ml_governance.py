import json
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, validator
from app.models.ml_feedback import FeedbackType, ReviewStatus


class FeedbackCreate(BaseModel):
    event_id: Optional[int] = Field(None, description="Linked disaster event ID if applicable")
    hazard_type: str = Field(..., description="flood or landslide")
    feedback_type: FeedbackType = Field(..., description="Type of feedback")
    observed_outcome: Optional[str] = Field(None, description="What actually happened")
    notes: Optional[str] = Field(None, description="Additional notes from user")
    feature_snapshot: Optional[Dict[str, Any]] = Field(None, description="Snapshot of features used during prediction")
    provenance: Optional[str] = Field(None, description="Origin of the feedback (e.g. Citizen Report, Field Validation)")

    @validator("feature_snapshot", pre=True)
    def parse_snapshot(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v


class FeedbackReviewRequest(BaseModel):
    review_status: ReviewStatus = Field(..., description="New status (e.g., ACCEPTED, REJECTED, UNDER_REVIEW)")
    notes: Optional[str] = Field(None, description="Reviewer notes")


class GroundTruthApprovalRequest(BaseModel):
    evidence_type: str = Field(..., description="Type of evidence (e.g., 'verified_field_report')")
    evidence_reference: str = Field(..., description="Reference link or ID for the evidence")
    notes: Optional[str] = Field(None, description="Approval notes")


class FeedbackResponse(BaseModel):
    id: int
    event_id: Optional[int]
    hazard_type: str
    feedback_type: FeedbackType
    review_status: ReviewStatus
    observed_outcome: Optional[str]
    notes: Optional[str]
    feature_snapshot: Optional[Dict[str, Any]]
    provenance: Optional[str]
    evidence_type: Optional[str]
    evidence_reference: Optional[str]
    exclusion_reason: Optional[str]
    submitted_by_id: Optional[int]
    submitted_at: datetime
    reviewed_by_id: Optional[int]
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True

    @validator("feature_snapshot", pre=True)
    def parse_snapshot_out(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v


class DatasetCandidateSummary(BaseModel):
    id: int
    dataset_version: str
    hazard_type: str
    status: str
    record_count: int
    positive_samples: int
    negative_samples: int
    feature_schema: List[str]
    geographic_coverage: Optional[str]
    temporal_coverage: Optional[str]
    methodology: Optional[str]
    exclusions: Optional[str]
    
    included_count: int = 0
    excluded_count: int = 0
    duplicate_count: int = 0
    leakage_count: int = 0
    unknown_provenance_count: int = 0

    created_at: datetime
    created_by_id: Optional[int]


class CandidateExportRecord(BaseModel):
    feedback_id: int
    event_id: Optional[int]
    hazard_type: str
    feedback_type: str
    observed_outcome: Optional[str]
    feature_snapshot: Dict[str, Any]
    provenance: Optional[str]
    evidence_type: Optional[str]
    evidence_reference: Optional[str]
