import abc

from app.models.notification import DeliveryStatus, NotificationChannel
from app.models.alert import Alert
from app.models.user import User


class NotificationProvider(abc.ABC):
    """
    Abstract base class for notification providers.
    """

    @property
    @abc.abstractmethod
    def channel(self) -> NotificationChannel:
        """The channel this provider handles."""
        pass

    @property
    @abc.abstractmethod
    def provider_name(self) -> str:
        """Name of the provider implementation."""
        pass

    @abc.abstractmethod
    def send(self, alert: Alert, user: User) -> tuple[DeliveryStatus, str | None]:
        """
        Attempt to send a notification to the user for the given alert.
        
        Returns:
            A tuple of (DeliveryStatus, failure_reason).
            If status is SENT, failure_reason should be None.
            If status is NOT_CONFIGURED, the system gracefully ignores it.
        """
        pass
