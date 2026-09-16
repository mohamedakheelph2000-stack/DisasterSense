"""
Risk Assessment API endpoints.

The core ML-powered prediction interface for DisasterSense.
Connects FastAPI to the shared RiskEngine via the risk_assessment_service.

Endpoints:
    POST /api/v1/risk-assessments/flood       — Flood risk prediction
    POST /api/v1/risk-assessments/landslide   — Landslide risk prediction
    GET  /api/v1/risk-assessments/provider     — Automatic provider status
"""

import sys
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.schemas.risk_assessment import (
    FloodAssessmentRequest,
    LandslideAssessmentRequest,
    RiskAssessmentResponse,
    FeatureImpactResponse,
    AutomaticProviderStatus,
)
from app.services import risk_assessment_service, location_service

# Ensure ml package is importable
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from ml.src.flood.flood_features import FloodInputSchema
from ml.src.landslide.landslide_features import LandslideInputSchema

router = APIRouter(prefix="/risk-assessments", tags=["Risk Assessments"])


def _build_response(
    result,
    location_id: Optional[int] = None,
    event_id: Optional[int] = None,
) -> RiskAssessmentResponse:
    """Convert a RiskAssessmentResult from the ML layer into an API response."""
    prediction_source = (
        "fallback_heuristic" if "heuristic" in result.model_version else "ml_model"
    )
    return RiskAssessmentResponse(
        hazard_type=result.hazard_type,
        risk_score=result.risk_score,
        risk_level=result.risk_level.value,
        severity=result.severity,
        probability=result.probability,
        model_name=result.model_name,
        model_version=result.model_version,
        prediction_source=prediction_source,
        input_mode=result.mode,
        location_id=location_id,
        event_id=event_id,
        features_used=result.features_used,
        feature_impacts=[
            FeatureImpactResponse(
                feature=exp.feature,
                value=exp.value,
                importance=exp.importance,
                impact_level=exp.impact_level,
            )
            for exp in result.explanation
        ],
        assessed_at=datetime.now(timezone.utc),
    )


@router.post(
    "/flood",
    response_model=RiskAssessmentResponse,
    summary="Flood risk prediction",
    description=(
        "Run a flood risk assessment using environmental parameters. "
        "Uses the trained ML model when available, otherwise falls back to a "
        "physics-based heuristic. If a valid location_id is provided, the "
        "assessment is persisted as a DisasterEvent for historical analytics."
    ),
)
def assess_flood_risk(
    request: FloodAssessmentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    mode: str = "manual",
):
    """Execute flood risk prediction through the RiskEngine."""
    try:
        result = risk_assessment_service.process_flood_request(db, request, mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Risk assessment engine error: {type(exc).__name__}",
        )

    # Persist if location_id is provided and valid
    event_id = None
    location_id = request.location_id
    if location_id is not None:
        event = risk_assessment_service.persist_assessment(
            db, result, location_id, background_tasks=background_tasks
        )
        event_id = event.id

    return _build_response(result, location_id=location_id, event_id=event_id)


@router.post(
    "/landslide",
    response_model=RiskAssessmentResponse,
    summary="Landslide risk prediction",
    description=(
        "Run a landslide risk assessment using terrain and geological parameters. "
        "Uses the trained ML model when available, otherwise falls back to a "
        "physics-based heuristic."
    ),
)
def assess_landslide_risk(
    request: LandslideAssessmentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    mode: str = "manual",
):
    """Execute landslide risk prediction through the RiskEngine."""
    try:
        result = risk_assessment_service.process_landslide_request(db, request, mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Risk assessment engine error: {type(exc).__name__}",
        )

    event_id = None
    location_id = request.location_id
    if location_id is not None:
        event = risk_assessment_service.persist_assessment(
            db, result, location_id, background_tasks=background_tasks
        )
        event_id = event.id

    return _build_response(result, location_id=location_id, event_id=event_id)


@router.get(
    "/provider",
    response_model=AutomaticProviderStatus,
    summary="Automatic weather provider status",
    description=(
        "Check whether an external weather/environmental data provider is configured. "
        "When available, automatic mode will pre-populate risk assessment inputs from "
        "real-time weather data."
    ),
)
def get_provider_status(
    current_user: User = Depends(deps.get_current_active_user),
):
    """Return the current automatic weather provider status."""
    return risk_assessment_service.AutomaticWeatherProvider.get_status()
