"""
Disaster Event API endpoints.

CRUD and filtering for AI-generated disaster prediction records.

Endpoints:
    POST   /api/v1/disaster-events          — Create a disaster event
    GET    /api/v1/disaster-events          — List events (paginated, filterable)
    GET    /api/v1/disaster-events/{id}     — Get a single event
    PUT    /api/v1/disaster-events/{id}     — Update an event
    DELETE /api/v1/disaster-events/{id}     — Delete an event
"""

import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.disaster_event import HazardType, SeverityLevel, RecordType
from app.schemas.disaster_event import (
    DisasterEventCreate,
    DisasterEventRead,
    DisasterEventUpdate,
)
from app.services import disaster_event_service

router = APIRouter(prefix="/disaster-events", tags=["Disaster Events"])


@router.post(
    "",
    response_model=DisasterEventRead,
    status_code=201,
    summary="Create a disaster event",
    description="Record a new disaster event prediction. Normally created by the risk assessment pipeline.",
)
def create_disaster_event(
    data: DisasterEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Insert a new disaster event record."""
    event = disaster_event_service.create_disaster_event(db, data)
    return event


@router.get(
    "",
    response_model=dict,
    summary="List disaster events",
    description="Retrieve a paginated, filterable list of disaster event records.",
)
def list_disaster_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    hazard_type: Optional[HazardType] = Query(None, description="Filter by hazard type (flood/landslide)"),
    severity: Optional[SeverityLevel] = Query(None, description="Filter by severity level"),
    record_type: Optional[RecordType] = Query(None, description="Filter by record type (e.g. historical, demo, predictive)"),
    location_id: Optional[int] = Query(None, description="Filter by location ID"),
    start_time: Optional[datetime] = Query(None, description="Filter events after this time"),
    end_time: Optional[datetime] = Query(None, description="Filter events before this time"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Return paginated disaster events with optional filters."""
    skip = (page - 1) * page_size
    items, total = disaster_event_service.list_disaster_events(
        db,
        skip=skip,
        limit=page_size,
        hazard_type=hazard_type,
        severity=severity,
        record_type=record_type,
        location_id=location_id,
        start_time=start_time,
        end_time=end_time,
    )
    return {
        "items": [DisasterEventRead.model_validate(e) for e in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if page_size > 0 else 0,
    }


@router.get(
    "/{event_id}",
    response_model=DisasterEventRead,
    summary="Get a disaster event",
    description="Retrieve a single disaster event by ID.",
)
def get_disaster_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Fetch a disaster event by ID."""
    event = disaster_event_service.get_disaster_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Disaster event {event_id} not found.")
    return event


@router.put(
    "/{event_id}",
    response_model=DisasterEventRead,
    summary="Update a disaster event",
    description="Partially update a disaster event record (severity, notes, alert status).",
)
def update_disaster_event(
    event_id: int,
    data: DisasterEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Update an existing disaster event."""
    event = disaster_event_service.get_disaster_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Disaster event {event_id} not found.")
    updates = data.model_dump(exclude_unset=True)
    updated = disaster_event_service.update_disaster_event(db, event, updates)
    return updated


@router.delete(
    "/{event_id}",
    status_code=204,
    summary="Delete a disaster event",
    description="Delete a disaster event and cascade to related alerts.",
)
def delete_disaster_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Delete a disaster event by ID."""
    event = disaster_event_service.get_disaster_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Disaster event {event_id} not found.")
    disaster_event_service.delete_disaster_event(db, event)
