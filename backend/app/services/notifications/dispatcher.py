from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.alert import Alert
from app.models.disaster_event import SeverityLevel
from app.models.notification import NotificationDelivery, DeliveryStatus, NotificationChannel
from app.models.user import User, UserRole
from app.services.notifications.email_provider import EmailProvider
from app.services.notifications.sms_provider import SMSProvider

import logging
logger = logging.getLogger(__name__)

# Singletons for providers
_email_provider = EmailProvider()
_sms_provider = SMSProvider()


def dispatch_alert_notifications(alert_id: int):
    """
    Background task to dispatch external notifications for an alert.
    """
    db: Session = SessionLocal()
    try:
        alert = db.get(Alert, alert_id)
        if not alert:
            logger.error(f"Alert {alert_id} not found for dispatch.")
            return

        severity = alert.severity if alert.severity else alert.disaster_event.severity

        # Determine target channels based on severity policy
        target_channels = set()
        if severity == SeverityLevel.HIGH:
            target_channels.add(NotificationChannel.EMAIL)
        elif severity == SeverityLevel.CRITICAL:
            target_channels.add(NotificationChannel.EMAIL)
            target_channels.add(NotificationChannel.SMS)

        if not target_channels:
            logger.info(f"No external channels configured for severity {severity}.")
            return

        # Fetch eligible users (ADMIN and RESPONDER only for now to avoid spamming CITIZENs)
        # In a fully fleshed out system, this might check subscriptions.
        users = db.scalars(
            select(User).where(
                User.is_active == True,
                User.role.in_([UserRole.ADMIN, UserRole.RESPONDER])
            )
        ).all()

        for user in users:
            if NotificationChannel.EMAIL in target_channels:
                _dispatch_to_user_channel(db, alert, user, _email_provider)
            
            if NotificationChannel.SMS in target_channels:
                _dispatch_to_user_channel(db, alert, user, _sms_provider)

    except Exception as e:
        logger.exception(f"Failed to dispatch notifications for alert {alert_id}: {e}")
    finally:
        db.close()


import time

def _dispatch_to_user_channel(db: Session, alert: Alert, user: User, provider):
    """
    Dispatches a single notification to a user via a provider,
    ensuring duplicates are prevented.
    """
    # Check for duplicate successful delivery
    existing_success = db.scalar(
        select(NotificationDelivery).where(
            NotificationDelivery.alert_id == alert.id,
            NotificationDelivery.user_id == user.id,
            NotificationDelivery.channel == provider.channel,
            NotificationDelivery.status == DeliveryStatus.SENT
        )
    )
    if existing_success:
        logger.info(f"Skipping duplicate delivery for alert={alert.id}, user={user.id}, channel={provider.channel}")
        return

    # Basic retry loop for transient failures
    max_attempts = 3
    attempt = 0
    status = DeliveryStatus.FAILED
    reason = "Unknown failure"

    while attempt < max_attempts:
        attempt += 1
        try:
            status, reason = provider.send(alert, user)
            
            # If not configured or user disabled, no need to retry
            if status in (DeliveryStatus.NOT_CONFIGURED, DeliveryStatus.SENT) or (reason and "disabled" in reason.lower()):
                break
                
            # If failed, retry with backoff
            logger.warning(f"Delivery attempt {attempt} failed for alert={alert.id}, user={user.id}, channel={provider.channel}. Reason: {reason}")
            if attempt < max_attempts:
                time.sleep(2 ** attempt) # 2s, 4s backoff
        except Exception as e:
            status = DeliveryStatus.FAILED
            reason = f"Provider exception: {str(e)}"
            logger.warning(f"Delivery attempt {attempt} raised exception for alert={alert.id}, user={user.id}, channel={provider.channel}. Reason: {reason}")
            if attempt < max_attempts:
                time.sleep(2 ** attempt)

    # Log outcome
    if status == DeliveryStatus.SENT:
        logger.info(f"Successfully sent notification alert={alert.id}, user={user.id}, channel={provider.channel}")
    else:
        logger.error(f"Final failure sending notification alert={alert.id}, user={user.id}, channel={provider.channel}. Final status: {status}, Reason: {reason}")

    delivery = NotificationDelivery(
        alert_id=alert.id,
        user_id=user.id,
        channel=provider.channel,
        status=status,
        provider=provider.provider_name,
        failure_reason=reason,
        retry_count=attempt - 1
    )
    
    if status == DeliveryStatus.SENT:
        from datetime import datetime, timezone
        delivery.sent_at = datetime.now(timezone.utc)

    db.add(delivery)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save delivery record for alert={alert.id}: {e}")
