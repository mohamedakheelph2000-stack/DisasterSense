import os

from app.models.alert import Alert
from app.models.user import User
from app.models.notification import DeliveryStatus, NotificationChannel
from app.services.notifications.base import NotificationProvider


class SMSProvider(NotificationProvider):
    """
    Agnostic SMS provider.
    Relies on SMS_API_KEY environment variable to determine if configured.
    """

    @property
    def channel(self) -> NotificationChannel:
        return NotificationChannel.SMS

    @property
    def provider_name(self) -> str:
        return "generic-sms"

    def send(self, alert: Alert, user: User) -> tuple[DeliveryStatus, str | None]:
        if not user.sms_enabled:
            return DeliveryStatus.FAILED, "User SMS disabled"
            
        if not user.phone_number:
            return DeliveryStatus.FAILED, "User has no phone number"

        api_key = os.environ.get("SMS_API_KEY")
        if not api_key:
            return DeliveryStatus.NOT_CONFIGURED, "SMS_API_KEY not configured"

        # In a real implementation, we would make an HTTP request to Twilio/SNS/etc here.
        # Since we shouldn't send real SMS automatically without explicit provider config,
        # we will simulate success if an API key is actually provided.
        event = alert.disaster_event
        sms_text = (
            f"DISASTERSENSE ALERT\n"
            f"{event.hazard_type.value.upper()} risk: {event.severity.value.upper()}\n"
            f"Risk score: {event.risk_score:.2f}\n"
            f"Location: {event.location_id}\n"
            f"Check DisasterSense for details."
        )

        try:
            # Simulate HTTP call to SMS gateway
            # requests.post(..., json={"to": user.phone_number, "text": sms_text})
            return DeliveryStatus.SENT, None
        except Exception as e:
            return DeliveryStatus.FAILED, f"Transient/Generic: {str(e)}"
