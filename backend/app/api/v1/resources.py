import math
from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.emergency_resource import EmergencyResource, ResourceType, VerificationStatus
from app.schemas.emergency_resource import PaginatedResourceResponse, EmergencyResourceResponse

router = APIRouter()

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
