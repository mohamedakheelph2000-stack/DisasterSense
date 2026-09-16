"""
ML Dataset Governance API endpoints.

Handles the submission, review, and approval of ML feedback.
Ensures real-v1 artifacts are immutable and approved ground-truth
is stored safely for offline candidate generation.
"""

import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api import deps
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.ml_feedback import MLFeedback, ReviewStatus, FeedbackType
from app.models.dataset_candidate import DatasetCandidate, CandidateStatus
from app.models.ml_governance_audit import MLGovernanceAudit
from app.models.disaster_event import DisasterEvent
from app.schemas.ml_governance import (
    FeedbackCreate,
    FeedbackResponse,
    FeedbackReviewRequest,
    GroundTruthApprovalRequest,
    DatasetCandidateSummary,
    CandidateExportRecord,
)

router = APIRouter(prefix="/ml/governance", tags=["ML Governance"])

def _log_audit(
    db: Session,
    actor_id: Optional[int],
    action: str,
    feedback_id: Optional[int] = None,
    candidate_id: Optional[int] = None,
    previous_state: Optional[str] = None,
    new_state: Optional[str] = None,
    decision: Optional[str] = None,
    note: Optional[str] = None,
):
    audit = MLGovernanceAudit(
        actor_id=actor_id,
        action=action,
        feedback_id=feedback_id,
        candidate_id=candidate_id,
        previous_state=previous_state,
        new_state=new_state,
        decision=decision,
        note=note
    )
    db.add(audit)
    db.flush()

@router.post("/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    request: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Submit operational feedback or field observations.
    Accessible by Citizen, Responder, Admin.
    """
    snapshot_str = None
    if request.feature_snapshot:
        snapshot_str = json.dumps(request.feature_snapshot)

    provenance = request.provenance or f"{current_user.role.value} submission"

    # Citizens can't mark things as confirmed ground truth directly without review
    if current_user.role == UserRole.CITIZEN and request.feedback_type == FeedbackType.CONFIRMED_EVENT:
        # Force to uncertain for citizen submissions if they try to claim ground truth
        request.feedback_type = FeedbackType.UNCERTAIN

    feedback = MLFeedback(
        event_id=request.event_id,
        hazard_type=request.hazard_type,
        feedback_type=request.feedback_type,
        review_status=ReviewStatus.SUBMITTED,
        observed_outcome=request.observed_outcome,
        notes=request.notes,
        feature_snapshot=snapshot_str,
        provenance=provenance,
        submitted_by_id=current_user.id,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    
    _log_audit(
        db=db,
        actor_id=current_user.id,
        action="SUBMIT_FEEDBACK",
        feedback_id=feedback.id,
        new_state=feedback.review_status.value
    )
    db.commit()
    return feedback


@router.get("/feedback", response_model=List[FeedbackResponse])
def list_feedback(
    review_status: Optional[ReviewStatus] = None,
    hazard_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """List feedback. Admin only."""
    query = db.query(MLFeedback)
    if review_status:
        query = query.filter(MLFeedback.review_status == review_status)
    if hazard_type:
        query = query.filter(MLFeedback.hazard_type == hazard_type)
        
    return query.order_by(MLFeedback.submitted_at.desc()).limit(100).all()


@router.get("/feedback/{feedback_id}", response_model=FeedbackResponse)
def get_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """Get specific feedback details. Admin only."""
    feedback = db.query(MLFeedback).filter(MLFeedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return feedback


@router.post("/feedback/{feedback_id}/review", response_model=FeedbackResponse)
def review_feedback(
    feedback_id: int,
    request: FeedbackReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """
    Move feedback through review stages. Enforces strict state machine.
    """
    feedback = db.query(MLFeedback).filter(MLFeedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    if request.review_status == ReviewStatus.APPROVED_GROUND_TRUTH:
        raise HTTPException(
            status_code=400, 
            detail="Use /approve-ground-truth endpoint for final approval."
        )

    # State machine validation
    valid_transitions = {
        ReviewStatus.SUBMITTED: [ReviewStatus.UNDER_REVIEW],
        ReviewStatus.UNDER_REVIEW: [ReviewStatus.ACCEPTED, ReviewStatus.REJECTED],
    }
    
    if request.review_status not in valid_transitions.get(feedback.review_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition from {feedback.review_status} to {request.review_status}"
        )

    prev_state = feedback.review_status.value
    feedback.review_status = request.review_status
    if request.notes:
        feedback.notes = f"{feedback.notes or ''}\nReview Note: {request.notes}"
        
    feedback.reviewed_by_id = current_user.id
    feedback.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    
    _log_audit(
        db=db,
        actor_id=current_user.id,
        action="REVIEW_FEEDBACK",
        feedback_id=feedback.id,
        previous_state=prev_state,
        new_state=feedback.review_status.value,
        decision=request.review_status.value,
        note=request.notes
    )
    db.commit()
    db.refresh(feedback)
    return feedback


@router.post("/feedback/{feedback_id}/approve-ground-truth", response_model=FeedbackResponse)
def approve_ground_truth(
    feedback_id: int,
    request: GroundTruthApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """
    Mark feedback as verified ground truth. Enforces strict rules:
    - Must come from ACCEPTED state
    - Requires evidence_type and evidence_reference
    - Rejects historical/evaluation records (Leakage Safeguard)
    """
    feedback = db.query(MLFeedback).filter(MLFeedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    if feedback.review_status != ReviewStatus.ACCEPTED:
        raise HTTPException(
            status_code=400,
            detail=f"Feedback must be ACCEPTED before approval, current state is {feedback.review_status}"
        )

    # Prevent self-approval of ground truth
    if feedback.submitted_by_id == current_user.id:
        raise HTTPException(
            status_code=403, 
            detail="Self-approval prevention: You cannot approve your own feedback as ground truth."
        )
        
    # Semantic Safeguards: enforce record_type policy
    if feedback.event_id:
        event = db.query(DisasterEvent).filter(DisasterEvent.id == feedback.event_id).first()
        if event and event.record_type:
            if event.record_type.value == 'demo':
                raise HTTPException(
                    status_code=400,
                    detail="Leakage Safeguard: Cannot promote DEMO records to ground truth."
                )
            # PREDICTIVE requires independent evidence (enforced by the schema requiring evidence_type/reference)
            # HISTORICAL is allowed but must pass leakage/deduplication checks during candidate generation

    prev_state = feedback.review_status.value
    feedback.review_status = ReviewStatus.APPROVED_GROUND_TRUTH
    feedback.evidence_type = request.evidence_type
    feedback.evidence_reference = request.evidence_reference
    
    if request.notes:
        feedback.notes = f"{feedback.notes or ''}\nApproval Note: {request.notes}"
        
    feedback.reviewed_by_id = current_user.id
    feedback.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    
    _log_audit(
        db=db,
        actor_id=current_user.id,
        action="APPROVE_GROUND_TRUTH",
        feedback_id=feedback.id,
        previous_state=prev_state,
        new_state=feedback.review_status.value,
        note=f"Evidence: {request.evidence_type} ({request.evidence_reference})"
    )
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/datasets/candidates", response_model=List[DatasetCandidateSummary])
def get_dataset_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """
    Get list of explicit dataset candidates.
    """
    candidates = db.query(DatasetCandidate).order_by(DatasetCandidate.created_at.desc()).all()
    results = []
    for c in candidates:
        features = json.loads(c.feature_schema) if c.feature_schema else []
        records = db.query(MLFeedback).join(DatasetCandidate.records).filter(DatasetCandidate.id == c.id).all()
        pos_samples = sum(1 for r in records if r.feedback_type in [FeedbackType.CONFIRMED_EVENT, FeedbackType.FALSE_NEGATIVE])
        
        results.append(
            DatasetCandidateSummary(
                id=c.id,
                dataset_version=c.version_name,
                hazard_type=c.hazard_type,
                status=c.status.value,
                record_count=len(records),
                positive_samples=pos_samples,
                negative_samples=len(records) - pos_samples,
                feature_schema=features,
                geographic_coverage=c.geographic_coverage,
                temporal_coverage=c.temporal_coverage,
                methodology=c.methodology,
                exclusions=c.exclusions,
                included_count=c.included_count,
                excluded_count=c.excluded_count,
                duplicate_count=c.duplicate_count,
                leakage_count=c.leakage_count,
                unknown_provenance_count=c.unknown_provenance_count,
                created_at=c.created_at,
                created_by_id=c.created_by_id
            )
        )
    return results


@router.post("/datasets/candidates", response_model=DatasetCandidateSummary)
def generate_dataset_candidate(
    hazard_type: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """
    Explicitly generate a candidate dataset from ALL unassigned APPROVED_GROUND_TRUTH records.
    Filters out duplicates and enforces Leakage Safeguards.
    """
    from dateutil import parser
    from app.models.location import Location

    approved = db.query(MLFeedback).filter(
        MLFeedback.review_status == ReviewStatus.APPROVED_GROUND_TRUTH,
        MLFeedback.hazard_type == hazard_type
    ).all()
    
    if not approved:
        raise HTTPException(status_code=400, detail="No approved ground truth records found for this hazard.")

    valid_records = []
    seen_events = set()
    included_locs_times = []  # List of tuples: (lat, lon, timestamp)
    
    stats = {
        "excluded_count": 0,
        "duplicate_count": 0,
        "leakage_count": 0,
        "unknown_provenance_count": 0
    }
    
    for record in approved:
        # Ignore already excluded records
        if record.exclusion_reason:
            stats["excluded_count"] += 1
            continue
            
        event = db.query(DisasterEvent).filter(DisasterEvent.id == record.event_id).first() if record.event_id else None
        
        # 1. EVALUATION CONTAMINATION CHECK
        if event and event.record_type and event.record_type.value == 'historical':
            if record.provenance and "test_set" in record.provenance.lower():
                record.exclusion_reason = "EVALUATION_CONTAMINATION: Record belongs to holdout test set"
                db.commit()
                stats["excluded_count"] += 1
                stats["leakage_count"] += 1
                continue

        # 2. UNKNOWN PROVENANCE
        if not record.provenance or record.provenance.lower() in ["unknown", ""]:
            record.exclusion_reason = "UNKNOWN_PROVENANCE: Record lacks clear origin"
            db.commit()
            stats["excluded_count"] += 1
            stats["unknown_provenance_count"] += 1
            continue

        # 3. TEMPORAL LEAKAGE CHECK
        if record.feature_snapshot and event and event.event_time:
            try:
                snap = json.loads(record.feature_snapshot)
                pred_time_str = snap.get("prediction_timestamp") or snap.get("timestamp")
                if pred_time_str:
                    pred_time = parser.parse(pred_time_str)
                    if pred_time.tzinfo is not None:
                        pred_time = pred_time.replace(tzinfo=None)
                    
                    event_time = event.event_time
                    if event_time.tzinfo is not None:
                        event_time = event_time.replace(tzinfo=None)

                    if pred_time > event_time:
                        record.exclusion_reason = "TEMPORAL_LEAKAGE: Feature snapshot timestamp is after ground-truth event time"
                        db.commit()
                        stats["excluded_count"] += 1
                        stats["leakage_count"] += 1
                        continue
            except Exception:
                pass

        # 4. EXACT EVENT_ID DUPLICATE
        if record.event_id:
            if record.event_id in seen_events:
                record.exclusion_reason = "DUPLICATE: Exact event_id already included (Spatial/Temporal leakage)"
                db.commit()
                stats["excluded_count"] += 1
                stats["duplicate_count"] += 1
                continue
            seen_events.add(record.event_id)

        # 5. CONSERVATIVE SPATIAL/TEMPORAL DUPLICATE
        is_spatial_dup = False
        if event and event.location_id:
            loc = db.query(Location).filter(Location.id == event.location_id).first()
            if loc:
                event_ts = event.event_time.timestamp()
                for (inc_lat, inc_lon, inc_ts) in included_locs_times:
                    # Very rough ~5km check (0.05 deg) and ~24h (86400s)
                    if abs(loc.latitude - inc_lat) < 0.05 and abs(loc.longitude - inc_lon) < 0.05:
                        if abs(event_ts - inc_ts) < 86400:
                            is_spatial_dup = True
                            break
                if not is_spatial_dup:
                    included_locs_times.append((loc.latitude, loc.longitude, event_ts))

        if is_spatial_dup:
            record.exclusion_reason = "POSSIBLE_DUPLICATE_EVENT: Another record exists within 5km/24h"
            db.commit()
            stats["excluded_count"] += 1
            stats["duplicate_count"] += 1
            continue

        valid_records.append(record)

    if not valid_records:
        raise HTTPException(status_code=400, detail="All candidate records were excluded due to leakage safeguards.")

    # Generate explicit candidate
    version = f"real-v2-candidate-{hazard_type}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    candidate = DatasetCandidate(
        version_name=version,
        hazard_type=hazard_type,
        status=CandidateStatus.DRAFT,
        feature_schema=json.dumps(["rainfall_mm_24h", "rainfall_intensity_mm_h", "antecedent_rainfall_7d_mm", "temperature_c", "humidity_pct", "elevation_m"]),
        geographic_coverage="Varies",
        temporal_coverage="Current",
        methodology="Admin Ground Truth Curation with Leakage Safeguards",
        created_by_id=current_user.id,
        included_count=len(valid_records),
        excluded_count=stats["excluded_count"],
        duplicate_count=stats["duplicate_count"],
        leakage_count=stats["leakage_count"],
        unknown_provenance_count=stats["unknown_provenance_count"]
    )
    
    candidate.records.extend(valid_records)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    _log_audit(
        db=db,
        actor_id=current_user.id,
        action="GENERATE_CANDIDATE",
        candidate_id=candidate.id,
        note=f"Included {len(valid_records)}, Excluded {stats['excluded_count']} duplicate/unsafe records."
    )
    db.commit()
    
    pos_samples = sum(1 for r in valid_records if r.feedback_type in [FeedbackType.CONFIRMED_EVENT, FeedbackType.FALSE_NEGATIVE])
    return DatasetCandidateSummary(
        id=candidate.id,
        dataset_version=candidate.version_name,
        hazard_type=candidate.hazard_type,
        status=candidate.status.value,
        record_count=len(valid_records),
        positive_samples=pos_samples,
        negative_samples=len(valid_records) - pos_samples,
        feature_schema=json.loads(candidate.feature_schema),
        geographic_coverage=candidate.geographic_coverage,
        temporal_coverage=candidate.temporal_coverage,
        methodology=candidate.methodology,
        exclusions=candidate.exclusions,
        included_count=candidate.included_count,
        excluded_count=candidate.excluded_count,
        duplicate_count=candidate.duplicate_count,
        leakage_count=candidate.leakage_count,
        unknown_provenance_count=candidate.unknown_provenance_count,
        created_at=candidate.created_at,
        created_by_id=candidate.created_by_id
    )

@router.get("/datasets/candidates/{candidate_id}/export", response_model=List[CandidateExportRecord])
def export_dataset_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """
    Export verified ground truth data from a specific explicit candidate.
    """
    candidate = db.query(DatasetCandidate).filter(DatasetCandidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    records = []
    for f in candidate.records:
        # Ignore excluded records
        if f.exclusion_reason:
            continue
            
        snapshot = {}
        if f.feature_snapshot:
            try:
                snapshot = json.loads(f.feature_snapshot)
            except Exception:
                pass
                
        records.append(
            CandidateExportRecord(
                feedback_id=f.id,
                event_id=f.event_id,
                hazard_type=f.hazard_type,
                feedback_type=f.feedback_type.value,
                observed_outcome=f.observed_outcome,
                feature_snapshot=snapshot,
                provenance=f.provenance,
                evidence_type=f.evidence_type,
                evidence_reference=f.evidence_reference
            )
        )
        
    _log_audit(
        db=db,
        actor_id=current_user.id,
        action="EXPORT_CANDIDATE",
        candidate_id=candidate.id
    )
    db.commit()
        
    return records
