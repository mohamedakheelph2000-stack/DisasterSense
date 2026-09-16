import os
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from app.models.alert import Alert, AlertStatus
from app.models.disaster_event import DisasterEvent, SeverityLevel, HazardType
from app.models.user import User, UserRole
from app.models.notification import DeliveryStatus, NotificationChannel, NotificationDelivery
from app.services.notifications.email_provider import EmailProvider
from app.services.notifications.sms_provider import SMSProvider
from app.services.notifications.dispatcher import dispatch_alert_notifications


def test_email_provider_not_configured():
    provider = EmailProvider()
    user = User(email="test@test.com", email_enabled=True)
    alert = Alert(title="Test Alert", message="Details", disaster_event=DisasterEvent(severity=SeverityLevel.HIGH))
    
    # Ensure environment variables are clear
    with patch.dict(os.environ, clear=True):
        status, reason = provider.send(alert, user)
        assert status == DeliveryStatus.NOT_CONFIGURED
        assert "SMTP_HOST not configured" in reason


def test_sms_provider_not_configured():
    provider = SMSProvider()
    user = User(phone_number="+1234567890", sms_enabled=True)
    alert = Alert(title="Test Alert", message="Details")
    
    with patch.dict(os.environ, clear=True):
        status, reason = provider.send(alert, user)
        assert status == DeliveryStatus.NOT_CONFIGURED
        assert "SMS_API_KEY not configured" in reason


def test_email_provider_disabled_by_user():
    provider = EmailProvider()
    user = User(email="test@test.com", email_enabled=False)
    alert = Alert(title="Test Alert", message="Details")
    
    status, reason = provider.send(alert, user)
    assert status == DeliveryStatus.FAILED
    assert "disabled" in reason


def test_sms_provider_disabled_by_user():
    provider = SMSProvider()
    user = User(phone_number="+1234567890", sms_enabled=False)
    alert = Alert(title="Test Alert", message="Details")
    
    status, reason = provider.send(alert, user)
    assert status == DeliveryStatus.FAILED
    assert "disabled" in reason


def test_email_provider_success():
    provider = EmailProvider()
    user = User(email="test@test.local", email_enabled=True)
    event = DisasterEvent(hazard_type=HazardType.FLOOD, severity=SeverityLevel.HIGH, risk_score=0.9, location_id=1, model_version="1", event_time=datetime.now(timezone.utc))
    alert = Alert(title="Test Alert", message="Details", disaster_event=event)
    
    with patch.dict(os.environ, {"SMTP_HOST": "localhost"}):
        with patch("smtplib.SMTP") as mock_smtp:
            status, reason = provider.send(alert, user)
            assert status == DeliveryStatus.SENT
            assert reason is None


def test_sms_provider_success():
    provider = SMSProvider()
    user = User(phone_number="+1234567890", sms_enabled=True)
    event = DisasterEvent(hazard_type=HazardType.FLOOD, severity=SeverityLevel.HIGH, risk_score=0.9, location_id=1, model_version="1", event_time=datetime.now(timezone.utc))
    alert = Alert(title="Test Alert", message="Details", disaster_event=event)
    
    with patch.dict(os.environ, {"SMS_API_KEY": "test_key"}):
        status, reason = provider.send(alert, user)
        assert status == DeliveryStatus.SENT
        assert reason is None


def test_dispatcher_severity_rules(db_session):
    # Setup test data
    user = User(email="admin@test.local", full_name="Admin", role=UserRole.ADMIN, email_enabled=True, sms_enabled=True, phone_number="+1234567890", hashed_password="xyz")
    db_session.add(user)
    db_session.commit()
    
    event_high = DisasterEvent(hazard_type=HazardType.FLOOD, severity=SeverityLevel.HIGH, risk_score=0.80, location_id=1, model_version="1", event_time=datetime.now(timezone.utc))
    event_critical = DisasterEvent(hazard_type=HazardType.FLOOD, severity=SeverityLevel.CRITICAL, risk_score=0.95, location_id=1, model_version="1", event_time=datetime.now(timezone.utc))
    db_session.add_all([event_high, event_critical])
    db_session.commit()
    
    alert_high = Alert(location_id=1, disaster_event_id=event_high.id, title="HIGH", message="HIGH")
    alert_critical = Alert(location_id=1, disaster_event_id=event_critical.id, title="CRITICAL", message="CRITICAL")
    db_session.add_all([alert_high, alert_critical])
    db_session.commit()

    # Patch close to prevent dispatcher from killing the test session
    db_session.close = MagicMock()
    
    # Dispatch HIGH alert (Should only trigger Email)
    with patch("app.services.notifications.dispatcher._dispatch_to_user_channel") as mock_dispatch:
        with patch("app.services.notifications.dispatcher.SessionLocal", return_value=db_session):
            dispatch_alert_notifications(alert_high.id)
            assert mock_dispatch.call_count == 1
        
    # Dispatch CRITICAL alert (Should trigger Email and SMS)
    with patch("app.services.notifications.dispatcher._dispatch_to_user_channel") as mock_dispatch:
        with patch("app.services.notifications.dispatcher.SessionLocal", return_value=db_session):
            dispatch_alert_notifications(alert_critical.id)
            assert mock_dispatch.call_count == 2


@patch("time.sleep", return_value=None)
def test_idempotency_and_retries(mock_sleep, db_session):
    # Set up user and alert
    user = User(email="test@test.local", full_name="Test", role=UserRole.ADMIN, email_enabled=True, hashed_password="xyz")
    db_session.add(user)
    db_session.commit()

    event = DisasterEvent(hazard_type=HazardType.FLOOD, severity=SeverityLevel.HIGH, risk_score=0.9, location_id=1, model_version="1", event_time=datetime.now(timezone.utc))
    db_session.add(event)
    db_session.commit()

    alert = Alert(location_id=1, disaster_event_id=event.id, title="HIGH", message="HIGH")
    db_session.add(alert)
    db_session.commit()

    provider = EmailProvider()
    
    # 1. Test Transient Failure Retries
    with patch.object(provider, 'send', side_effect=Exception("Transient Network Error")) as mock_send:
        from app.services.notifications.dispatcher import _dispatch_to_user_channel
        _dispatch_to_user_channel(db_session, alert, user, provider)
        
        # It should retry 3 times (max_attempts)
        assert mock_send.call_count == 3
        
        # Check that it saved a FAILED delivery with retry_count = 2
        delivery = db_session.query(NotificationDelivery).filter_by(alert_id=alert.id).first()
        assert delivery.status == DeliveryStatus.FAILED
        assert delivery.retry_count == 2
        assert "Transient Network Error" in delivery.failure_reason

    # Clean up for next test
    db_session.delete(delivery)
    db_session.commit()

    # 2. Test Success
    with patch.object(provider, 'send', return_value=(DeliveryStatus.SENT, None)) as mock_send:
        _dispatch_to_user_channel(db_session, alert, user, provider)
        assert mock_send.call_count == 1
        
        # Check that it saved a SENT delivery
        delivery = db_session.query(NotificationDelivery).filter_by(alert_id=alert.id).first()
        assert delivery.status == DeliveryStatus.SENT
        assert delivery.retry_count == 0

    # 3. Test Idempotency (Should not send again because a SENT delivery exists)
    with patch.object(provider, 'send', return_value=(DeliveryStatus.SENT, None)) as mock_send:
        _dispatch_to_user_channel(db_session, alert, user, provider)
        
        # It should NOT call send again
        assert mock_send.call_count == 0

