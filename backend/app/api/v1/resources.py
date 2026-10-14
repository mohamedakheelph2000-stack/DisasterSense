import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.emergency_resource import EmergencyResource, ResourceType, VerificationStatus
from app.schemas.emergency_resource import (
    NearbyResponse,
    PaginatedResourceResponse,
    EmergencyResourceResponse,
)

router = APIRouter()

# Universal Indian emergency numbers — public, always available, no network needed.
EMERGENCY_NUMBERS: List[Dict[str, str]] = [
    {"name": "Unified Emergency Response", "number": "112", "scope": "National", "description": "Police, fire and ambulance dispatch across India."},
    {"name": "Police", "number": "100", "scope": "National", "description": "State police control room."},
    {"name": "Fire & Rescue", "number": "101", "scope": "National", "description": "Fire service and rescue dispatch."},
    {"name": "Ambulance (Government)", "number": "102", "scope": "National", "description": "Government ambulance service."},
    {"name": "Emergency Ambulance", "number": "108", "scope": "National", "description": "Free emergency ambulance in most states, including Kerala."},
    {"name": "District Disaster Control Room", "number": "1077", "scope": "District", "description": "District-level disaster management control room."},
    {"name": "NDMA Control Room", "number": "1078", "scope": "National", "description": "National Disaster Management Authority helpline."},
    {"name": "Women Helpline", "number": "1091", "scope": "National", "description": "Emergency assistance for women."},
    {"name": "Childline", "number": "1098", "scope": "National", "description": "Emergency helpline for children in distress."},
]

NEARBY_GROUP_LABELS: Dict[str, str] = {
    ResourceType.HOSPITAL.value: "Hospitals & Clinics",
    ResourceType.AMBULANCE.value: "Ambulance Services",
    ResourceType.POLICE_STATION.value: "Police Stations",
    ResourceType.FIRE_STATION.value: "Fire & Rescue Stations",
    ResourceType.SHELTER.value: "Shelters",
    ResourceType.RELIEF_CENTER.value: "Relief Camps",
    ResourceType.OTHER_EMERGENCY_RESOURCE.value: "Other Emergency Resources",
}

DEFAULT_NEARBY_TYPES = [
    ResourceType.HOSPITAL,
    ResourceType.AMBULANCE,
    ResourceType.POLICE_STATION,
    ResourceType.FIRE_STATION,
]

def haversine_distance_sql(lat1, lon1, lat2, lon2):
    """
    Returns the SQLAlchemy expression for Haversine distance in kilometers.
    Assumes inputs are in degrees.
    """
    # Convert degrees to radians
    # pi / 180 = 0.017453292519943295
    rad = 0.017453292519943295
    
    dlat = (lat2 - lat1) * rad
    dlon = (lon2 - lon1) * rad
    
    a = func.sin(dlat / 2) * func.sin(dlat / 2) + \
        func.cos(lat1 * rad) * func.cos(lat2 * rad) * \
        func.sin(dlon / 2) * func.sin(dlon / 2)
        
    c = 2 * func.asin(func.sqrt(a))
    r = 6371.0 # Radius of earth in kilometers.
    return c * r

@router.get("", response_model=PaginatedResourceResponse)
def get_resources(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    resource_type: ResourceType | None = None,
    verification_status: VerificationStatus | None = None,
    latitude: float | None = Query(None, ge=-90.0, le=90.0),
    longitude: float | None = Query(None, ge=-180.0, le=180.0),
    radius_km: float | None = Query(None, ge=0.1, le=500.0),
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user)
):
    """
    Retrieve verified emergency resources.
    Supports proximity search if latitude, longitude, and radius_km are provided.
    Returns empty if no data has been populated.
    """
    # Since we are implementing an "unavailable state" with an empty dataset,
    # the queries will naturally return 0 results unless populated later.
    
    query = db.query(EmergencyResource)
    
    if resource_type:
        query = query.filter(EmergencyResource.resource_type == resource_type)
        
    if verification_status:
        query = query.filter(EmergencyResource.verification_status == verification_status)
        
    distance_expr = None
    if latitude is not None and longitude is not None and radius_km is not None:
        distance_expr = haversine_distance_sql(
            latitude, longitude, 
            EmergencyResource.latitude, EmergencyResource.longitude
        )
        query = query.filter(distance_expr <= radius_km)
        
    total = query.count()
    
    if distance_expr is not None:
        # If proximity search, sort by distance and select the distance
        results = query.add_columns(distance_expr.label("distance_km")).order_by(distance_expr).offset(skip).limit(limit).all()
        
        items = []
        for resource, dist in results:
            resource_dict = {c.name: getattr(resource, c.name) for c in resource.__table__.columns}
            resource_dict["distance_km"] = round(dist, 2)
            items.append(EmergencyResourceResponse(**resource_dict))
    else:
        results = query.order_by(EmergencyResource.id).offset(skip).limit(limit).all()
        items = [EmergencyResourceResponse.model_validate(r) for r in results]
        
    pages = math.ceil(total / limit) if limit > 0 else 0
    page = (skip // limit) + 1 if limit > 0 else 1
    
    return PaginatedResourceResponse(
        items=items,
        total=total,
        page=page,
        page_size=limit,
        pages=pages
    )

@router.get("/emergency-numbers", summary="Universal emergency phone numbers")
def get_emergency_numbers(user: Any = Depends(get_current_user)) -> Dict[str, Any]:
    """All-India emergency numbers — available even when external feeds are down."""
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "numbers": EMERGENCY_NUMBERS,
    }


@router.get("/nearby", summary="Nearby hospitals, ambulance, police and fire stations", response_model=NearbyResponse)
def get_nearby_resources(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(25.0, ge=0.1, le=500.0),
    limit_per_type: int = Query(10, ge=1, le=50),
    types: Optional[str] = Query(
        None,
        description="Comma separated resource types. Defaults to hospital, ambulance, police_station, fire_station.",
    ),
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user),
) -> Any:
    if types:
        wanted: List[ResourceType] = []
        for raw in types.split(","):
            value = raw.strip().lower()
            if not value:
                continue
            try:
                parsed = ResourceType(value)
            except ValueError:
                raise HTTPException(status_code=422, detail=f"Unknown resource type '{raw.strip()}'")
            if parsed not in wanted:
                wanted.append(parsed)
        if not wanted:
            wanted = list(DEFAULT_NEARBY_TYPES)
    else:
        wanted = list(DEFAULT_NEARBY_TYPES)

    distance_expr = haversine_distance_sql(latitude, longitude, EmergencyResource.latitude, EmergencyResource.longitude)

    groups: List[Dict[str, Any]] = []
    totals: Dict[str, int] = {}
    grand_total = 0

    for rtype in wanted:
        base = db.query(EmergencyResource).filter(
            EmergencyResource.resource_type == rtype,
            distance_expr <= radius_km,
        )
        count = base.count()
        rows = (
            base.add_columns(distance_expr.label("distance_km"))
            .order_by(distance_expr)
            .limit(limit_per_type)
            .all()
        )

        items: List[EmergencyResourceResponse] = []
        for resource, dist in rows:
            data = {c.name: getattr(resource, c.name) for c in resource.__table__.columns}
            data["distance_km"] = round(dist, 2)
            items.append(EmergencyResourceResponse(**data))

        totals[rtype.value] = count
        grand_total += count
        groups.append(
            {
                "key": rtype.value,
                "label": NEARBY_GROUP_LABELS.get(rtype.value, rtype.value.replace("_", " ").title()),
                "count": count,
                "items": items,
            }
        )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius_km,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "groups": groups,
        "totals": totals,
        "grand_total": grand_total,
        "emergency_numbers": EMERGENCY_NUMBERS,
        "source_note": (
            "Facility coordinates and phone numbers are sourced from OpenStreetMap "
            "contributors plus the seeded emergency directory. Always confirm on arrival."
        ),
    }


@router.get("/{resource_id}", response_model=EmergencyResourceResponse)
def get_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user)
):
    from fastapi import HTTPException
    resource = db.query(EmergencyResource).filter(EmergencyResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return EmergencyResourceResponse.model_validate(resource)
