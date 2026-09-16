"""
Location API endpoints.

CRUD operations for geographic locations used in disaster risk assessments.
All endpoints are currently public; authentication will be added in a dedicated security phase.

Endpoints:
    POST   /api/v1/locations          — Create a new location
    GET    /api/v1/locations          — List locations (paginated, filterable)
    GET    /api/v1/locations/{id}     — Get a single location
    PUT    /api/v1/locations/{id}     — Update a location
    DELETE /api/v1/locations/{id}     — Delete a location
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.services import location_service

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.post(
    "",
    response_model=LocationRead,
    status_code=201,
    summary="Create a new location",
    description="Register a named geographic point for disaster risk monitoring.",
)
def create_location(
    data: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """Create a new location record."""
    location = location_service.create_location(db, data)
    return location


@router.get(
    "",
    response_model=dict,
    summary="List locations",
    description="Retrieve a paginated list of locations with optional filtering.",
)
def list_locations(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    country: Optional[str] = Query(None, description="Filter by country"),
    state: Optional[str] = Query(None, description="Filter by state"),
    search: Optional[str] = Query(None, description="Search by location name"),
    db: Session = Depends(get_db),
):
    """Return paginated locations."""
    skip = (page - 1) * page_size
    items, total = location_service.list_locations(
        db, skip=skip, limit=page_size, country=country, state=state, search=search
    )
    return {
        "items": [LocationRead.model_validate(loc) for loc in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if page_size > 0 else 0,
    }


@router.get(
    "/{location_id}",
    response_model=LocationRead,
    summary="Get a location",
    description="Retrieve a single location by its ID.",
)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
):
    """Fetch a location by ID."""
    location = location_service.get_location(db, location_id)
    if location is None:
        raise HTTPException(status_code=404, detail=f"Location {location_id} not found.")
    return location


@router.put(
    "/{location_id}",
    response_model=LocationRead,
    summary="Update a location",
    description="Partially update a location record.",
)
def update_location(
    location_id: int,
    data: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """Update an existing location."""
    location = location_service.get_location(db, location_id)
    if location is None:
        raise HTTPException(status_code=404, detail=f"Location {location_id} not found.")
    updated = location_service.update_location(db, location, data)
    return updated


@router.delete(
    "/{location_id}",
    status_code=204,
    summary="Delete a location",
    description="Delete a location and cascade to related events and alerts.",
)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
):
    """Delete a location by ID."""
    location = location_service.get_location(db, location_id)
    if location is None:
        raise HTTPException(status_code=404, detail=f"Location {location_id} not found.")
    location_service.delete_location(db, location)
