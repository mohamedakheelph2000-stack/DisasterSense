"""
Alert API endpoints.

CRUD and lifecycle management for disaster alerts.

Endpoints:
    POST   /api/v1/alerts              — Create a new alert
    GET    /api/v1/alerts              — List alerts (paginated, filterable)
    GET    /api/v1/alerts/{id}         — Get a single alert
    PUT    /api/v1/alerts/{id}         — Update an alert
    POST   /api/v1/alerts/{id}/acknowledge — Acknowledge an alert
    POST   /api/v1/alerts/{id}/resolve     — Resolve an alert
    POST   /api/v1/alerts/{id}/dismiss     — Dismiss an alert
    DELETE /api/v1/alerts/{id}         — Delete an alert
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.alert import AlertStatus
from app.schemas.alert import (
    AlertCreate,
    AlertRead,
    AlertAcknowledge,
    AlertUpdate,
    AlertRespond,
    AlertNoteCreate,
)
from app.services import alert_service, location_service, disaster_event_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.post(
    "",
    response_model=AlertRead,
    status_code=201,
    summary="Create a new alert",
    description="Raise a new alert linked to a location and disaster event.",
)
def create_alert(
    data: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Create a new alert record."""
    # Validate foreign keys
    loc = location_service.get_location(db, data.location_id)
    if loc is None:
        raise HTTPException(status_code=404, detail=f"Location {data.location_id} not found.")
    event = disaster_event_service.get_disaster_event(db, data.disaster_event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Disaster event {data.disaster_event_id} not found.")

    alert = alert_service.create_alert(db, data)
    return alert


@router.get(
    "",
    response_model=dict,
    summary="List alerts",
    description="Retrieve a paginated, filterable list of alerts.",
)
def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[AlertStatus] = Query(None, description="Filter by alert status"),
    location_id: Optional[int] = Query(None, description="Filter by location ID"),
    disaster_event_id: Optional[int] = Query(None, description="Filter by disaster event ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Return paginated alerts."""
    skip = (page - 1) * page_size
    items, total = alert_service.list_alerts(
        db,
        skip=skip,
        limit=page_size,
        status=status,
        location_id=location_id,
        disaster_event_id=disaster_event_id,
    )
    return {
        "items": [AlertRead.model_validate(a) for a in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if page_size > 0 else 0,
    }


@router.get(
    "/{alert_id}",
    response_model=AlertRead,
    summary="Get an alert",
    description="Retrieve a single alert by its ID.",
)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Fetch an alert by ID."""
    alert = alert_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    return alert


@router.put(
    "/{alert_id}",
    response_model=AlertRead,
    summary="Update an alert",
    description="Partially update an alert record.",
)
def update_alert(
    alert_id: int,
    data: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Update an existing alert."""
    alert = alert_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    updates = data.model_dump(exclude_unset=True)
    updated = alert_service.update_alert(db, alert, updates)
    return updated


@router.post(
    "/{alert_id}/acknowledge",
    response_model=AlertRead,
    summary="Acknowledge an alert",
    description="Mark an alert as acknowledged by a named operator.",
)
def acknowledge_alert(
    alert_id: int,
    data: AlertAcknowledge,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Acknowledge an alert."""
    alert = alert_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    try:
        return alert_service.acknowledge_alert(db, alert, data, actor=current_user.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{alert_id}/respond",
    response_model=AlertRead,
    summary="Begin response to an alert",
    description="Transition alert status to RESPONSE_IN_PROGRESS and optionally add a note.",
)
def respond_alert(
    alert_id: int,
    data: AlertRespond,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Begin response to an alert."""
    alert = alert_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    try:
        return alert_service.respond_alert(db, alert, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{alert_id}/notes",
    response_model=AlertRead,
    summary="Add an audit note",
    description="Add a note to an alert without changing its status.",
)
def add_alert_note(
    alert_id: int,
    data: AlertNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Add a note to an alert."""
    alert = alert_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    try:
        return alert_service.add_alert_note(db, alert, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{alert_id}/resolve",
    response_model=AlertRead,
    summary="Resolve an alert",
    description="Mark an alert as resolved — the underlying hazard has been cleared.",
)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Resolve an alert."""
    alert = alert_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    try:
        return alert_service.resolve_alert(db, alert, actor=current_user.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{alert_id}/dismiss",
    response_model=AlertRead,
    summary="Dismiss an alert",
    description="Dismiss an alert without formal resolution.",
)
def dismiss_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Dismiss an alert."""
    alert = alert_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    try:
        return alert_service.dismiss_alert(db, alert, actor=current_user.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{alert_id}",
    status_code=204,
    summary="Delete an alert",
    description="Permanently delete an alert record.",
)
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.RESPONDER, UserRole.ADMIN])),
):
    """Delete an alert by ID."""
    alert = alert_service.get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    alert_service.delete_alert(db, alert)
