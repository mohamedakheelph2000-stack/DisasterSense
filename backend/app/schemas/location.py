"""
Location Pydantic schemas.

Defines the request and response shapes for location records.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class LocationBase(BaseModel):
    """Shared location fields."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    elevation_m: float | None = None
    district: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    country: str = Field("India", max_length=100)


class LocationCreate(LocationBase):
    """Fields accepted when creating a location."""
    pass


class LocationRead(LocationBase):
    """Fields returned to API clients."""

    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class LocationUpdate(BaseModel):
    """All fields optional — used for PATCH requests."""

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    latitude: float | None = Field(None, ge=-90.0, le=90.0)
    longitude: float | None = Field(None, ge=-180.0, le=180.0)
    elevation_m: float | None = None
    district: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    country: str | None = Field(None, max_length=100)
