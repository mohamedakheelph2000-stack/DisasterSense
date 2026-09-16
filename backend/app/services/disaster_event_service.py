"""
DisasterEvent service — business logic for creating, listing, and filtering
disaster event records in the database.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.disaster_event import DisasterEvent, HazardType, SeverityLevel, RecordType
from app.schemas.disaster_event import DisasterEventCreate


def create_disaster_event(db: Session, data: DisasterEventCreate) -> DisasterEvent:
    """Insert a new DisasterEvent record and return it."""
    event = DisasterEvent(**data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_disaster_event(db: Session, event_id: int) -> Optional[DisasterEvent]:
    """Fetch a single DisasterEvent by primary key, or None."""
    return db.get(DisasterEvent, event_id)


def list_disaster_events(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    hazard_type: Optional[HazardType] = None,
    severity: Optional[SeverityLevel] = None,
    record_type: Optional[RecordType] = None,
    location_id: Optional[int] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> tuple[list[DisasterEvent], int]:
    """
    Return a paginated, filtered list of disaster events.

    Returns (items, total_count).
    """
    query = select(DisasterEvent)

    if hazard_type is not None:
        query = query.where(DisasterEvent.hazard_type == hazard_type)
    if severity is not None:
        query = query.where(DisasterEvent.severity == severity)
    if record_type is not None:
        query = query.where(DisasterEvent.record_type == record_type)
    if location_id is not None:
        query = query.where(DisasterEvent.location_id == location_id)
    if start_time is not None:
        query = query.where(DisasterEvent.event_time >= start_time)
    if end_time is not None:
        query = query.where(DisasterEvent.event_time <= end_time)

    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar_one()

    query = query.order_by(DisasterEvent.event_time.desc()).offset(skip).limit(limit)
    items = list(db.execute(query).scalars().all())

    return items, total


def update_disaster_event(
    db: Session, event: DisasterEvent, updates: dict
) -> DisasterEvent:
    """Apply partial updates to a DisasterEvent record."""
    for field, value in updates.items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


def delete_disaster_event(db: Session, event: DisasterEvent) -> None:
    """Delete a DisasterEvent and cascade to related alerts."""
    db.delete(event)
    db.commit()
