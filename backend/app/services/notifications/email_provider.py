import os
import smtplib
from email.message import EmailMessage

from app.models.alert import Alert
from app.models.user import User
from app.models.notification import DeliveryStatus, NotificationChannel
from app.services.notifications.base import NotificationProvider


class EmailProvider(NotificationProvider):
    """
    SMTP-based email provider.
    Relies on SMTP_* environment variables.
    """

    @property
    def channel(self) -> NotificationChannel:
        return NotificationChannel.EMAIL

    @property
    def provider_name(self) -> str:
        return "smtp"

    def send(self, alert: Alert, user: User) -> tuple[DeliveryStatus, str | None]:
        if not user.email_enabled:
            return DeliveryStatus.FAILED, "User email disabled"
            
        smtp_host = os.environ.get("SMTP_HOST")
        smtp_port = os.environ.get("SMTP_PORT", "587")
        smtp_user = os.environ.get("SMTP_USERNAME")
        smtp_pass = os.environ.get("SMTP_PASSWORD")
        smtp_from = os.environ.get("SMTP_FROM", "noreply@disastersense.local")

        if not smtp_host:
            return DeliveryStatus.NOT_CONFIGURED, "SMTP_HOST not configured"

        # Sanitize headers to prevent header injection
        safe_subject = alert.title.replace('\n', ' ').replace('\r', '')
        safe_email = user.email.replace('\n', '').replace('\r', '')
        
        event = alert.disaster_event
        
        msg = EmailMessage()
        msg.set_content(
            f"DISASTERSENSE ALERT\n"
            f"===================\n\n"
            f"Hazard: {event.hazard_type.value.upper()}\n"
            f"Severity: {event.severity.value.upper()}\n"
            f"Risk Score: {event.risk_score:.2f}\n"
            f"Location ID: {event.location_id}\n"
            f"Assessment Time: {event.event_time.strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
            f"Details: {alert.message}\n\n"
            f"Please take necessary precautions. Check DisasterSense for full details.\n"
        )
        msg["Subject"] = f"DisasterSense Alert: {safe_subject}"
        msg["From"] = smtp_from
        msg["To"] = safe_email

        try:
            with smtplib.SMTP(smtp_host, int(smtp_port), timeout=10) as server:
                server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            return DeliveryStatus.SENT, None
        except smtplib.SMTPRecipientsRefused:
            return DeliveryStatus.FAILED, "Permanent: Invalid recipient email."
        except smtplib.SMTPAuthenticationError:
            return DeliveryStatus.FAILED, "Permanent: SMTP authentication failed."
        except Exception as e:
            # Other exceptions (timeout, connection refused) are treated as transient/generic failures
            return DeliveryStatus.FAILED, f"Transient/Generic: {str(e)}"
