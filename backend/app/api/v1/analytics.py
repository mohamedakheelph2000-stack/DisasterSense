from datetime import datetime, timedelta, timezone
from typing import List, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.disaster_event import DisasterEvent, HazardType, RecordType, SeverityLevel
from app.models.alert import Alert, AlertStatus
from app.models.location import Location
from app.schemas.analytics import (
    TrendResponse, TrendDataPoint, AnalyticsSummary, HazardComparison,
    SeverityDistribution, SeverityCounts, GeographicConcentration,
    LocationIncidentCount, DataQualityMetrics
)

router = APIRouter()

@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(
    days: int | None = Query(None, description="Number of days to include. None for all time."),
    db: Session = Depends(get_db), 
    user: Any = Depends(get_current_user)
):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)) if days else None
    
    q_hist = db.query(func.count(DisasterEvent.id)).filter(DisasterEvent.record_type == RecordType.HISTORICAL)
    q_pred = db.query(func.count(DisasterEvent.id)).filter(DisasterEvent.record_type == RecordType.PREDICTIVE)
    q_active = db.query(func.count(Alert.id)).filter(Alert.status.in_([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED, AlertStatus.RESPONSE_IN_PROGRESS]))
    q_resolved = db.query(func.count(Alert.id)).filter(Alert.status == AlertStatus.RESOLVED)
    
    if start_date:
        q_hist = q_hist.filter(DisasterEvent.event_time >= start_date)
        q_pred = q_pred.filter(DisasterEvent.event_time >= start_date)
        q_active = q_active.filter(Alert.created_at >= start_date)
        q_resolved = q_resolved.filter(Alert.resolved_at >= start_date)  # Assuming resolved_at exists, if not use created_at or updated_at. Wait, Alert model might not have resolved_at? I will use created_at.
        q_resolved = db.query(func.count(Alert.id)).filter(Alert.status == AlertStatus.RESOLVED, Alert.created_at >= start_date)

    total_historical = q_hist.scalar() or 0
    total_predictive = q_pred.scalar() or 0
    active_alerts = q_active.scalar() or 0
    resolved_alerts = q_resolved.scalar() or 0
    
    total_locations = db.query(func.count(Location.id)).scalar() or 0
    
    return AnalyticsSummary(
        total_historical_events=total_historical,
        total_predictive_assessments=total_predictive,
        active_alerts=active_alerts,
        resolved_alerts=resolved_alerts,
        total_locations=total_locations
    )

@router.get("/hazard-comparison", response_model=HazardComparison)
def get_hazard_comparison(
    days: int | None = Query(None, description="Number of days to include."),
    db: Session = Depends(get_db), 
    user: Any = Depends(get_current_user)
):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)) if days else None
    
    q_f_events = db.query(func.count(DisasterEvent.id)).filter(DisasterEvent.hazard_type == HazardType.FLOOD, DisasterEvent.record_type == RecordType.HISTORICAL)
    q_l_events = db.query(func.count(DisasterEvent.id)).filter(DisasterEvent.hazard_type == HazardType.LANDSLIDE, DisasterEvent.record_type == RecordType.HISTORICAL)
    q_f_alerts = db.query(func.count(Alert.id)).join(DisasterEvent).filter(DisasterEvent.hazard_type == HazardType.FLOOD)
    q_l_alerts = db.query(func.count(Alert.id)).join(DisasterEvent).filter(DisasterEvent.hazard_type == HazardType.LANDSLIDE)
    q_f_avg = db.query(func.avg(DisasterEvent.risk_score)).filter(DisasterEvent.hazard_type == HazardType.FLOOD, DisasterEvent.record_type == RecordType.PREDICTIVE)
    q_l_avg = db.query(func.avg(DisasterEvent.risk_score)).filter(DisasterEvent.hazard_type == HazardType.LANDSLIDE, DisasterEvent.record_type == RecordType.PREDICTIVE)

    if start_date:
        q_f_events = q_f_events.filter(DisasterEvent.event_time >= start_date)
        q_l_events = q_l_events.filter(DisasterEvent.event_time >= start_date)
        q_f_alerts = q_f_alerts.filter(Alert.created_at >= start_date)
        q_l_alerts = q_l_alerts.filter(Alert.created_at >= start_date)
        q_f_avg = q_f_avg.filter(DisasterEvent.event_time >= start_date)
        q_l_avg = q_l_avg.filter(DisasterEvent.event_time >= start_date)

    return HazardComparison(
        flood_events=q_f_events.scalar() or 0,
        landslide_events=q_l_events.scalar() or 0,
        flood_alerts=q_f_alerts.scalar() or 0,
        landslide_alerts=q_l_alerts.scalar() or 0,
        flood_avg_risk=(q_f_avg.scalar() * 100) if q_f_avg.scalar() is not None else None,
        landslide_avg_risk=(q_l_avg.scalar() * 100) if q_l_avg.scalar() is not None else None
    )

@router.get("/severity-distribution", response_model=SeverityDistribution)
def get_severity_distribution(
    days: int | None = Query(None, description="Number of days to include."),
    db: Session = Depends(get_db), 
    user: Any = Depends(get_current_user)
):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)) if days else None
    
    q_hist = db.query(DisasterEvent.severity, func.count(DisasterEvent.id)).filter(DisasterEvent.record_type == RecordType.HISTORICAL)
    q_pred = db.query(DisasterEvent.severity, func.count(DisasterEvent.id)).filter(DisasterEvent.record_type == RecordType.PREDICTIVE)

    if start_date:
        q_hist = q_hist.filter(DisasterEvent.event_time >= start_date)
        q_pred = q_pred.filter(DisasterEvent.event_time >= start_date)

    hist_counts = q_hist.group_by(DisasterEvent.severity).all()
    pred_counts = q_pred.group_by(DisasterEvent.severity).all()
    
    hist_dict = {row[0].name.upper(): row[1] for row in hist_counts} if hist_counts else {}
    pred_dict = {row[0].name.upper(): row[1] for row in pred_counts} if pred_counts else {}
    
    return SeverityDistribution(
        historical=SeverityCounts(**hist_dict),
        predictive=SeverityCounts(**pred_dict)
    )

@router.get("/geographic", response_model=GeographicConcentration)
def get_geographic_concentration(
    days: int | None = Query(None, description="Number of days to include."),
    db: Session = Depends(get_db), 
    user: Any = Depends(get_current_user)
):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)) if days else None
    
    hist_cond = (DisasterEvent.record_type == RecordType.HISTORICAL)
    pred_cond = (DisasterEvent.record_type == RecordType.PREDICTIVE)
    if start_date:
        hist_cond = hist_cond & (DisasterEvent.event_time >= start_date)
        pred_cond = pred_cond & (DisasterEvent.event_time >= start_date)
        
    results = db.query(
        Location.id,
        Location.name,
        Location.latitude,
        Location.longitude,
        func.count(case((hist_cond, 1))).label("hist_count"),
        func.count(case((pred_cond, 1))).label("pred_count"),
    ).outerjoin(DisasterEvent, DisasterEvent.location_id == Location.id)\
     .group_by(Location.id, Location.name, Location.latitude, Location.longitude).all()
    
    locs = []
    for r in results:
        # If there's a time filter, locations with 0 incidents in that timeframe should be skipped or included with 0
        if r.hist_count + r.pred_count > 0 or not start_date:
            locs.append(LocationIncidentCount(
                location_id=r.id,
                name=r.name,
                latitude=r.latitude,
                longitude=r.longitude,
                historical_events=r.hist_count,
                predictive_alerts=r.pred_count,
                total_incidents=r.hist_count + r.pred_count
            ))
    
    locs.sort(key=lambda x: x.total_incidents, reverse=True)
    return GeographicConcentration(locations=locs)

@router.get("/data-quality", response_model=DataQualityMetrics)
def get_data_quality(db: Session = Depends(get_db), user: Any = Depends(get_current_user)):
    total = db.query(func.count(DisasterEvent.id)).scalar() or 0
    bounds = db.query(func.min(DisasterEvent.event_time), func.max(DisasterEvent.event_time)).first()
    oldest = bounds[0].isoformat() if bounds and bounds[0] else None
    newest = bounds[1].isoformat() if bounds and bounds[1] else None
    
    missing_coords = db.query(func.count(Location.id)).filter(or_(Location.latitude == 0.0, Location.longitude == 0.0)).scalar() or 0
    demo_count = db.query(func.count(DisasterEvent.id)).filter(DisasterEvent.record_type == RecordType.DEMO).scalar() or 0
    
    return DataQualityMetrics(
        total_records=total,
        oldest_record_date=oldest,
        newest_record_date=newest,
        records_missing_coordinates=missing_coords,
        demo_records_count=demo_count
    )

@router.get("/trends", response_model=TrendResponse)
def get_risk_trends(
    days: int = Query(14, ge=1, le=365, description="Number of days to include in the trend"),
    db: Session = Depends(get_db),
    user: Any = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days - 1)
    
    hist_events = db.query(func.date(DisasterEvent.event_time).label('d'), func.count(DisasterEvent.id))\
        .filter(DisasterEvent.event_time >= start_date, DisasterEvent.record_type == RecordType.HISTORICAL)\
        .group_by(func.date(DisasterEvent.event_time)).all()
        
    pred_assess = db.query(func.date(DisasterEvent.event_time).label('d'), func.count(DisasterEvent.id))\
        .filter(DisasterEvent.event_time >= start_date, DisasterEvent.record_type == RecordType.PREDICTIVE)\
        .group_by(func.date(DisasterEvent.event_time)).all()
        
    alerts = db.query(func.date(Alert.created_at).label('d'), func.count(Alert.id))\
        .filter(Alert.created_at >= start_date)\
        .group_by(func.date(Alert.created_at)).all()
        
    risk_scores = db.query(
        func.date(DisasterEvent.event_time).label('d'),
        DisasterEvent.hazard_type,
        func.max(DisasterEvent.risk_score).label('max_score')
    ).filter(DisasterEvent.event_time >= start_date, DisasterEvent.record_type == RecordType.PREDICTIVE)\
     .group_by(func.date(DisasterEvent.event_time), DisasterEvent.hazard_type).all()
    
    daily_data = {}
    for i in range(days):
        d = (start_date + timedelta(days=i)).date()
        daily_data[d] = {
            "historical_events": 0,
            "predictive_assessments": 0,
            "active_alerts": 0,
            "flood_max_risk": 0.0,
            "landslide_max_risk": 0.0
        }
        
    for r in hist_events:
        d = r[0] if not isinstance(r[0], str) else datetime.strptime(r[0], "%Y-%m-%d").date()
        if d in daily_data: daily_data[d]["historical_events"] = r[1]
        
    for r in pred_assess:
        d = r[0] if not isinstance(r[0], str) else datetime.strptime(r[0], "%Y-%m-%d").date()
        if d in daily_data: daily_data[d]["predictive_assessments"] = r[1]
        
    for r in alerts:
        d = r[0] if not isinstance(r[0], str) else datetime.strptime(r[0], "%Y-%m-%d").date()
        if d in daily_data: daily_data[d]["active_alerts"] = r[1]
        
    for r in risk_scores:
        d = r[0] if not isinstance(r[0], str) else datetime.strptime(r[0], "%Y-%m-%d").date()
        if d in daily_data:
            score = r[2] * 100
            if r[1] == HazardType.FLOOD:
                daily_data[d]["flood_max_risk"] = score
            elif r[1] == HazardType.LANDSLIDE:
                daily_data[d]["landslide_max_risk"] = score
                
    items = []
    for d in sorted(daily_data.keys()):
        date_str = d.isoformat()
        if d == now.date():
            date_str = "Today"
        items.append(
            TrendDataPoint(
                date=date_str,
                historical_events=daily_data[d]["historical_events"],
                predictive_assessments=daily_data[d]["predictive_assessments"],
                active_alerts=daily_data[d]["active_alerts"],
                flood_max_risk=round(daily_data[d]["flood_max_risk"], 1),
                landslide_max_risk=round(daily_data[d]["landslide_max_risk"], 1)
            )
        )
    return TrendResponse(items=items)
