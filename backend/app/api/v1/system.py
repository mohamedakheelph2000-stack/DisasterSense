import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, RequireRole
from app.core.database import check_db_connection
from app.models.user import User, UserRole
from app.models.notification import NotificationDelivery, DeliveryStatus, NotificationChannel
from app.schemas.system import SystemTelemetry, MLStatus, MLModelStatus, NotificationStatus, ProviderStatus
from ml.src.inference.risk_engine import risk_engine

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/status", response_model=SystemTelemetry)
def get_system_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole([UserRole.ADMIN])),
):
    db_ok = check_db_connection(db)
    
    # Provider statuses
    email_configured = os.environ.get("SMTP_HOST") is not None
    sms_configured = os.environ.get("SMS_API_KEY") is not None

    # Aggregate Delivery metrics (last 24 hours)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    
    deliveries_24h = db.query(NotificationDelivery).filter(NotificationDelivery.created_at >= yesterday).all()
    
    total_deliveries = len(deliveries_24h)
    successful = sum(1 for d in deliveries_24h if d.status == DeliveryStatus.SENT)
    failed = sum(1 for d in deliveries_24h if d.status == DeliveryStatus.FAILED)
    email_deliveries = sum(1 for d in deliveries_24h if d.channel == NotificationChannel.EMAIL)
    sms_deliveries = sum(1 for d in deliveries_24h if d.channel == NotificationChannel.SMS)

    notification_status = NotificationStatus(
        email=ProviderStatus(configured=email_configured, enabled=True),
        sms=ProviderStatus(configured=sms_configured, enabled=True),
        total_deliveries_24h=total_deliveries,
        successful_deliveries_24h=successful,
        failed_deliveries_24h=failed,
        email_deliveries_24h=email_deliveries,
        sms_deliveries_24h=sms_deliveries
    )

    # ML Models Status
    flood_real = getattr(risk_engine, "_real_flood_model", None) is not None
    flood_syn = getattr(risk_engine, "_flood_model", None) is not None
    flood_meta = getattr(risk_engine, "_real_flood_meta", None) or getattr(risk_engine, "_flood_meta", {}) or {}

    landslide_real = getattr(risk_engine, "_real_landslide_model", None) is not None
    landslide_syn = getattr(risk_engine, "_landslide_model", None) is not None
    landslide_meta = getattr(risk_engine, "_real_landslide_meta", None) or getattr(risk_engine, "_landslide_meta", {}) or {}

    ml_status = MLStatus(
        flood=MLModelStatus(
            loaded=flood_real or flood_syn,
            model_name=flood_meta.get("model_name"),
            model_version=flood_meta.get("model_version"),
            is_real=flood_real
        ),
        landslide=MLModelStatus(
            loaded=landslide_real or landslide_syn,
            model_name=landslide_meta.get("model_name"),
            model_version=landslide_meta.get("model_version"),
            is_real=landslide_real
        )
    )

    return SystemTelemetry(
        core_api="OPERATIONAL",
        database="OPERATIONAL" if db_ok else "UNAVAILABLE",
        ml_models=ml_status,
        notifications=notification_status
    )
