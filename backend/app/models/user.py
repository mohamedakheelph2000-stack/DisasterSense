"""
User model.

Represents a platform operator or administrator who can log in,
view predictions, approve resource-allocation recommendations,
and manage alerts.

Authentication (JWT, password hashing) is NOT implemented here yet —
that belongs to a later prompt.  The model stores the fields required
to support it cleanly when that step arrives.
"""

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserRole(str, enum.Enum):
    """Enumeration of allowed platform roles.

    - ADMIN: Full access including model controls and user management.
    - RESPONDER: Responder access for managing disasters and alerts.
    - CITIZEN: Basic access for public risk information and risk assessments.
    """

    ADMIN = "admin"
    RESPONDER = "responder"
    CITIZEN = "citizen"


class User(Base):
    """
    Platform user account.

    This table will be extended with hashed_password and JWT refresh-token
    management in the authentication step.
    """

    __tablename__ = "users"

    # ── Primary key ────────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ────────────────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(320),  # RFC 5321 maximum email length
        unique=True,
        index=True,
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # ── Auth (placeholder — populated in auth step) ─────────────────────────────
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)

    # ── Role ────────────────────────────────────────────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=UserRole.CITIZEN,
    )

    # ── Preferences & Contact ───────────────────────────────────────────────────
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sms_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Status ──────────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Timestamps ──────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"
