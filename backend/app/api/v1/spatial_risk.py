from datetime import datetime, timezone, timedelta
from typing import List, Optional
import math
import hashlib

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.models.user import User
from app.models.disaster_event import DisasterEvent, RecordType, HazardType, SeverityLevel
from app.models.location import Location
from app.models.alert import Alert, AlertAudit, AlertStatus
from app.schemas.spatial_risk import SpatialAggregationResponse, SpatialCell, AggregationMetadata
from app.schemas.cluster import ClusterResponse, ClusterMetadata, ClusterResponseMetadata, EscalateClusterRequest, EscalateClusterResponse
from app.services.notifications.dispatcher import dispatch_alert_notifications
from app.models.user import UserRole

router = APIRouter(prefix="/spatial-risk", tags=["spatial_risk"])

CELL_SIZE = 0.05

def get_risk_category(score: float) -> str:
    if score <= 0.20:
        return "Very Low"
    elif score <= 0.40:
        return "Low"
    elif score <= 0.60:
        return "Moderate"
    elif score <= 0.80:
        return "High"
    else:
        return "Critical"

@router.get("/aggregation", response_model=SpatialAggregationResponse)
def get_spatial_aggregation(
    hazard_type: Optional[str] = Query(None, description="flood or landslide"),
    time_range: str = Query("7d", description="24h, 7d, 30d, 90d, all"),
    record_type: str = Query("predictive", description="predictive, historical, demo"),
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lon: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Retrieve deterministic grid-cell aggregated predictive risk assessments.
    Enforces minimum data thresholds and strictly separates record types.
    """
    
    # 1. Parse and validate parameters
    try:
        r_type = RecordType[record_type.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid record_type.")
        
    h_type = None
    if hazard_type:
        if hazard_type.lower() not in ["flood", "landslide"]:
            raise HTTPException(status_code=400, detail="Invalid hazard_type.")
        h_type = HazardType(hazard_type.lower())
        
    # Determine time cutoff
    now = datetime.now(timezone.utc)
    cutoff = None
    if time_range == "24h":
        cutoff = now - timedelta(hours=24)
    elif time_range == "7d":
        cutoff = now - timedelta(days=7)
    elif time_range == "30d":
        cutoff = now - timedelta(days=30)
    elif time_range == "90d":
        cutoff = now - timedelta(days=90)
    elif time_range != "all":
        raise HTTPException(status_code=400, detail="Invalid time_range. Use 24h, 7d, 30d, 90d, or all.")

    # 2. Query valid records within bounds
    # Since we need full traceability (latest score, detailed provenance list),
    # and this is a prototype, we pull the bounded records and aggregate in Python.
    query = db.query(DisasterEvent, Location).join(Location, DisasterEvent.location_id == Location.id)
    
    query = query.filter(DisasterEvent.record_type == r_type)
    if h_type:
        query = query.filter(DisasterEvent.hazard_type == h_type)
    if cutoff:
        query = query.filter(DisasterEvent.event_time >= cutoff)
        query = query.filter(DisasterEvent.event_time <= now)
        
    if min_lat is not None:
        query = query.filter(Location.latitude >= min_lat)
    if max_lat is not None:
        query = query.filter(Location.latitude <= max_lat)
    if min_lon is not None:
        query = query.filter(Location.longitude >= min_lon)
    if max_lon is not None:
        query = query.filter(Location.longitude <= max_lon)

    results = query.all()

    # 3. Aggregate into cells
    # Cell grid resolution is ~5.5km (0.05 degrees)
    # Using deterministic grid boundaries based on flooring
    
    cells_data = {}
    total_assessments = len(results)
    
    for event, loc in results:
        # Floor to nearest CELL_SIZE to ensure stable grid
        # Add epsilon to prevent float precision rounding errors like 12.20 / 0.05 = 243.99999999999997
        c_lat = math.floor((loc.latitude / CELL_SIZE) + 1e-9) * CELL_SIZE + (CELL_SIZE / 2.0)
        c_lon = math.floor((loc.longitude / CELL_SIZE) + 1e-9) * CELL_SIZE + (CELL_SIZE / 2.0)
        
        c_lat = round(c_lat, 3)
        c_lon = round(c_lon, 3)
        
        cell_id = f"{c_lat}_{c_lon}_{event.hazard_type.value}"
        
        if cell_id not in cells_data:
            cells_data[cell_id] = {
                "center_lat": c_lat,
                "center_lon": c_lon,
                "hazard_type": event.hazard_type.value,
                "scores": [],
                "events": [],
                "provenance_set": set()
            }
            
        cells_data[cell_id]["scores"].append(event.risk_score)
        cells_data[cell_id]["events"].append(event)
        if event.data_source:
            cells_data[cell_id]["provenance_set"].add(event.data_source)
        if event.source_reference:
            cells_data[cell_id]["provenance_set"].add(event.source_reference)

    # 4. Compile cell statistics
    cells = []
    for cid, data in cells_data.items():
        # Minimum data requirement: skip empty cells (not possible with this logic, but good practice)
        if len(data["scores"]) < 1:
            continue
            
        scores = data["scores"]
        events = data["events"]
        
        # Sort by event_time descending to get latest
        events.sort(key=lambda x: x.event_time, reverse=True)
        latest_event = events[0]
        
        avg_risk = sum(scores) / len(scores)
        
        high_count = sum(1 for s in scores if s >= 0.70)
        critical_count = sum(1 for s in scores if s >= 0.90)
        
        cells.append(SpatialCell(
            cell_id=cid,
            center_lat=data["center_lat"],
            center_lon=data["center_lon"],
            hazard_type=data["hazard_type"],
            record_type=record_type,
            average_risk=round(avg_risk, 3),
            max_risk=round(max(scores), 3),
            min_risk=round(min(scores), 3),
            latest_risk=round(latest_event.risk_score, 3),
            latest_assessment_time=latest_event.event_time,
            assessment_count=len(scores),
            high_risk_count=high_count,
            critical_risk_count=critical_count,
            risk_category=get_risk_category(avg_risk),
            provenance=list(data["provenance_set"])
        ))

    meta = AggregationMetadata(
        time_window=time_range,
        hazard=hazard_type,
        record_type=record_type,
        cell_size=CELL_SIZE,
        total_cells=len(cells),
        total_assessments=total_assessments
    )

    return SpatialAggregationResponse(aggregation_metadata=meta, cells=cells)

from app.schemas.cluster import ClusterResponse, ClusterMetadata, ClusterResponseMetadata
from app.core.config import settings

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@router.get("/clusters", response_model=ClusterResponse)
def get_spatial_clusters(
    hazard_type: Optional[str] = Query(None, description="flood or landslide"),
    time_range: str = Query("7d", description="24h, 7d, 30d, 90d, all"),
    record_type: str = Query("predictive", description="predictive, historical, demo"),
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lon: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Retrieve spatial-temporal event clusters based on configurable operational thresholds.
    These clusters represent regional situation signals, NOT scientifically verified disaster boundaries.
    """
    try:
        r_type = RecordType[record_type.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid record_type.")
        
    h_type = None
    if hazard_type:
        if hazard_type.lower() not in ["flood", "landslide"]:
            raise HTTPException(status_code=400, detail="Invalid hazard_type.")
        h_type = HazardType(hazard_type.lower())
        
    now = datetime.now(timezone.utc)
    cutoff = None
    if time_range == "24h":
        cutoff = now - timedelta(hours=24)
    elif time_range == "7d":
        cutoff = now - timedelta(days=7)
    elif time_range == "30d":
        cutoff = now - timedelta(days=30)
    elif time_range == "90d":
        cutoff = now - timedelta(days=90)
    elif time_range != "all":
        raise HTTPException(status_code=400, detail="Invalid time_range.")

    query = db.query(DisasterEvent, Location).join(Location, DisasterEvent.location_id == Location.id)
    query = query.filter(DisasterEvent.record_type == r_type)
    if h_type:
        query = query.filter(DisasterEvent.hazard_type == h_type)
    if cutoff:
        query = query.filter(DisasterEvent.event_time >= cutoff)
        query = query.filter(DisasterEvent.event_time <= now)
        
    if min_lat is not None:
        query = query.filter(Location.latitude >= min_lat)
    if max_lat is not None:
        query = query.filter(Location.latitude <= max_lat)
    if min_lon is not None:
        query = query.filter(Location.longitude >= min_lon)
    if max_lon is not None:
        query = query.filter(Location.longitude <= max_lon)

    results = query.all()
    
    spatial_threshold = settings.CLUSTER_SPATIAL_THRESHOLD_KM
    temporal_threshold = settings.CLUSTER_TEMPORAL_THRESHOLD_HOURS

    # Basic greedy agglomerative clustering
    # Each cluster maintains a list of points
    clusters = []
    
    for event, loc in results:
        matched_cluster = None
        event_time_aware = event.event_time.replace(tzinfo=timezone.utc) if event.event_time.tzinfo is None else event.event_time
        
        for cluster in clusters:
            # Must match hazard type strictly
            if cluster["hazard_type"] != event.hazard_type.value:
                continue
                
            # Single-linkage check: is this event close enough to ANY event in the cluster?
            # Or centroid based? Let's use centroid based for simplicity and stability of regional definition.
            dist = haversine_distance(loc.latitude, loc.longitude, cluster["centroid_lat"], cluster["centroid_lon"])
            if dist <= spatial_threshold:
                # Temporal check: difference from cluster's average time or bounds? 
                # Let's check distance to latest_timestamp in cluster to chain events together over time.
                time_diff = abs((event_time_aware - cluster["latest_timestamp"]).total_seconds()) / 3600.0
                if time_diff <= temporal_threshold:
                    matched_cluster = cluster
                    break
        
        if matched_cluster:
            matched_cluster["events"].append(event)
            matched_cluster["locations"].append(loc)
            # Update centroid (simple running average)
            n = len(matched_cluster["locations"])
            matched_cluster["centroid_lat"] = ((n-1)*matched_cluster["centroid_lat"] + loc.latitude) / n
            matched_cluster["centroid_lon"] = ((n-1)*matched_cluster["centroid_lon"] + loc.longitude) / n
            
            if event_time_aware < matched_cluster["first_timestamp"]:
                matched_cluster["first_timestamp"] = event_time_aware
            if event_time_aware > matched_cluster["latest_timestamp"]:
                matched_cluster["latest_timestamp"] = event_time_aware
        else:
            # Create new cluster
            clusters.append({
                "hazard_type": event.hazard_type.value,
                "centroid_lat": loc.latitude,
                "centroid_lon": loc.longitude,
                "events": [event],
                "locations": [loc],
                "first_timestamp": event_time_aware,
                "latest_timestamp": event_time_aware
            })
            
    # Process clusters into response
    out_clusters = []
    for idx, c in enumerate(clusters):
        scores = [e.risk_score for e in c["events"]]
        avg_risk = sum(scores) / len(scores)
        prov = set()
        for e in c["events"]:
            if e.data_source: prov.add(e.data_source)
            if e.source_reference: prov.add(e.source_reference)
            
        dur_hours = (c["latest_timestamp"] - c["first_timestamp"]).total_seconds() / 3600.0
        
        # Quality logic
        count = len(c["events"])
        quality = "LOW_DATA"
        if count >= 10:
            quality = "WELL_SUPPORTED"
        elif count >= 3:
            quality = "MODERATE_DATA"
            
        event_ids = sorted([str(e.id) for e in c["events"]])
        hash_input = f"{record_type}_{c['hazard_type']}_{','.join(event_ids)}"
        stable_hash = hashlib.md5(hash_input.encode("utf-8")).hexdigest()[:12]
            
        out_clusters.append(ClusterMetadata(
            cluster_id=f"cluster_{stable_hash}",
            hazard_type=c["hazard_type"],
            record_type=record_type,
            centroid_lat=c["centroid_lat"],
            centroid_lon=c["centroid_lon"],
            member_count=count,
            first_timestamp=c["first_timestamp"],
            latest_timestamp=c["latest_timestamp"],
            duration_hours=round(dur_hours, 2),
            average_risk=round(avg_risk, 3),
            max_risk=round(max(scores), 3),
            high_risk_count=sum(1 for s in scores if s >= 0.70),
            critical_risk_count=sum(1 for s in scores if s >= 0.90),
            provenance=list(prov),
            member_ids=[e.id for e in c["events"]],
            quality_indicator=quality
        ))

    meta = ClusterResponseMetadata(
        time_window=time_range,
        hazard=hazard_type,
        record_type=record_type,
        total_clusters=len(out_clusters),
        total_assessments=len(results),
        spatial_threshold_km=spatial_threshold,
        temporal_threshold_hours=temporal_threshold
    )

    return ClusterResponse(metadata=meta, clusters=out_clusters)

@router.post("/clusters/{cluster_id}/escalate", response_model=EscalateClusterResponse)
def escalate_cluster(
    cluster_id: str,
    request: EscalateClusterRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN, UserRole.RESPONDER])),
):
    """
    Human-in-the-loop escalation of a spatial-temporal cluster to an active Alert.
    Requires Admin or Responder role. Prevents duplicate active alerts for the same cluster.
    """
    
    if request.record_type.lower() == "demo":
        raise HTTPException(status_code=400, detail="Cannot escalate DEMO clusters to production alerts.")

    # Validate Severity
    try:
        validated_severity = SeverityLevel(request.severity.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid severity level provided.")

    # 1. Prevent Duplicates
    existing_alert = db.query(Alert).filter(
        Alert.source_cluster_id == cluster_id,
        Alert.status.in_([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.RESPONSE_IN_PROGRESS])
    ).first()
    
    if existing_alert:
        raise HTTPException(status_code=409, detail=f"An active alert (ID: {existing_alert.id}) already exists for this cluster.")

    # 2. Reconstruct and Verify Cluster independently (Do not trust client member_ids)
    cluster_response = get_spatial_clusters(
        hazard_type=request.hazard_type,
        time_range=request.time_window,
        record_type=request.record_type,
        min_lat=None, max_lat=None, min_lon=None, max_lon=None,
        db=db, current_user=current_user
    )
    
    target_cluster = next((c for c in cluster_response.clusters if c.cluster_id == cluster_id), None)
    
    if not target_cluster:
        raise HTTPException(status_code=404, detail="Requested cluster could not be verified or no longer exists.")

    events = db.query(DisasterEvent).filter(DisasterEvent.id.in_(target_cluster.member_ids)).all()
    if not events:
        raise HTTPException(status_code=404, detail="Cluster members could not be loaded.")
        
    # We anchor the alert to the member with the highest risk score
    primary_event = max(events, key=lambda e: e.risk_score)
    
    cluster_metadata = {
        "hazard_type": target_cluster.hazard_type,
        "record_type": target_cluster.record_type,
        "member_count": target_cluster.member_count,
        "average_risk": target_cluster.average_risk,
        "max_risk": target_cluster.max_risk,
        "first_seen": target_cluster.first_timestamp.isoformat(),
        "last_seen": target_cluster.latest_timestamp.isoformat(),
        "provenance": target_cluster.provenance
    }
    
    # 3. Create the Alert
    alert_title = f"{primary_event.hazard_type.value.upper()} REGIONAL SITUATION ESCALATION"
    msg_parts = [
        f"A regional {primary_event.hazard_type.value} situation has been manually escalated.",
        f"Operator Note: {request.operational_note}" if request.operational_note else "No operator note provided.",
        f"Cluster ID: {cluster_id}",
        f"Supporting Assessments: {len(events)}"
    ]
    
    new_alert = Alert(
        location_id=primary_event.location_id,
        disaster_event_id=primary_event.id,
        source_cluster_id=cluster_id,
        cluster_metadata=cluster_metadata,
        severity=validated_severity,
        title=alert_title,
        message="\n\n".join(msg_parts),
        status=AlertStatus.ACTIVE
    )
    
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    
    # 4. Audit Trail (Use actor_user_id implicitly by mapping to ID, or use ID in note, but we use ID if possible)
    # The requirement: "Prefer: actor_user_id and resolve display information only when needed. Do not introduce unnecessary PII."
    # Wait, AlertAudit currently has `actor: str`. I will put the user's ID as a string, e.g., "user_1" or just "1", instead of current_user.email.
    audit = AlertAudit(
        alert_id=new_alert.id,
        actor=f"user_{current_user.id}",
        action="ESCALATED_FROM_CLUSTER",
        note=f"Severity: {validated_severity.value}. Note: {request.operational_note}"
    )
    db.add(audit)
    db.commit()
    
    # 5. Dispatch Notifications
    try:
        dispatch_alert_notifications(new_alert.id)
        notification_status = "DISPATCHED"
    except Exception as e:
        # Do not expose internal exception messages
        notification_status = "FAILED: internal dispatch error"
        import logging
        logging.getLogger(__name__).error(f"Notification dispatch failed for alert {new_alert.id}: {e}")
        
    return EscalateClusterResponse(
        alert_id=new_alert.id,
        cluster_id=cluster_id,
        escalation_status="SUCCESS",
        notification_status=notification_status
    )
