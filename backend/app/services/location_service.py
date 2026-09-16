"""
Location service — business logic for CRUD operations on Location records.

Separates database operations from API routing for testability and reuse.
"""

from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.location import Location
from app.schemas.location import LocationCreate, LocationUpdate


def create_location(db: Session, data: LocationCreate) -> Location:
    """Insert a new Location record and return it."""
    loc = Location(**data.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


def get_location(db: Session, location_id: int) -> Optional[Location]:
    """Fetch a single Location by primary key, or None if missing."""
    return db.get(Location, location_id)


def list_locations(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    country: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
) -> tuple[list[Location], int]:
    """
    Return a paginated list of locations with optional filters.

    Returns (items, total_count).
    """
    query = select(Location)

    if country:
        query = query.where(Location.country == country)
    if state:
        query = query.where(Location.state == state)
    if search:
        query = query.where(Location.name.ilike(f"%{search}%"))

    # Total count for pagination metadata
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar_one()

    # Apply ordering and pagination
    query = query.order_by(Location.id.desc()).offset(skip).limit(limit)
    items = list(db.execute(query).scalars().all())

    return items, total


def update_location(
    db: Session, location: Location, data: LocationUpdate
) -> Location:
    """Apply partial updates to a Location record."""
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(location, field, value)
    db.commit()
    db.refresh(location)
    return location


def delete_location(db: Session, location: Location) -> None:
    """Delete a Location and cascade to related events and alerts."""
    db.delete(location)
    db.commit()
