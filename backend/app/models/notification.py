import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class NotificationChannel(str, enum.Enum):
    """Channels available for notification delivery."""
    EMAIL = "EMAIL"
    SMS = "SMS"


class DeliveryStatus(str, enum.Enum):
    """Delivery lifecycle states."""
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    NOT_CONFIGURED = "NOT_CONFIGURED"


class NotificationDelivery(Base):
    """
    Tracks external notifications (SMS/Email) sent to users.
    Used to monitor deliverability and prevent duplicate notifications for the same alert.
    """
    __tablename__ = "notification_deliveries"

    __table_args__ = (
        Index("ix_notification_alert_user_channel", "alert_id", "user_id", "channel"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    alert_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notificationchannel"),
        nullable=False,
    )
    
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, name="deliverystatus"),
        nullable=False,
        default=DeliveryStatus.PENDING,
    )

    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # Relationships
    user: Mapped["User"] = relationship("User") # noqa: F821
    alert: Mapped["Alert"] = relationship("Alert") # noqa: F821

    def __repr__(self) -> str:
        return f"<NotificationDelivery id={self.id} status={self.status} channel={self.channel}>"
