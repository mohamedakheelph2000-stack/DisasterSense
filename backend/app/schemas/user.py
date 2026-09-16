"""
User Pydantic schemas.

These schemas define the shape of data flowing in and out of the API.
They are strictly separated from the SQLAlchemy ORM model in user.py.

Naming convention:
    UserBase     — shared fields
    UserCreate   — fields accepted at creation (password in plain text, hashed by service)
    UserRead     — fields returned to the client (never includes hashed_password)
    UserUpdate   — fields allowed in a PATCH request (all optional)
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole


class UserBase(BaseModel):
    """Fields shared by create and read schemas."""

    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=200)
    role: UserRole = UserRole.CITIZEN
    is_active: bool = True
    
    phone_number: str | None = Field(None, max_length=20)
    email_enabled: bool = True
    sms_enabled: bool = False


class UserCreate(UserBase):
    """
    Schema accepted when creating a new user.

    plain_password is validated here; the service layer will hash it
    before storing in hashed_password.
    """

    plain_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("plain_password")
    @classmethod
    def password_must_not_be_trivial(cls, v: str) -> str:
        """Reject trivially weak passwords during creation."""
        if v.lower() in {"password", "12345678", "disastersense"}:
            raise ValueError("Password is too common. Choose a stronger password.")
        return v


class UserRead(UserBase):
    """
    Schema returned to API clients.

    Includes database-assigned fields; never includes hashed_password.
    """

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """All fields optional — used for PATCH requests."""

    full_name: str | None = Field(None, min_length=2, max_length=200)
    role: UserRole | None = None
    is_active: bool | None = None


class UserPreferencesUpdate(BaseModel):
    """Schema for updating user notification preferences."""
    
    phone_number: str | None = Field(None, max_length=20)
    email_enabled: bool | None = None
    sms_enabled: bool | None = None

    @field_validator("phone_number")
    @classmethod
    def sanitize_phone(cls, v: str | None) -> str | None:
        if not v:
            return None
        import re
        cleaned = re.sub(r"\s+", "", v)
        # Ensure it resembles an international phone number (e.g. +1234567890)
        if not re.match(r"^\+[1-9]\d{1,14}$", cleaned):
            raise ValueError("Phone number must follow E.164 format (e.g., +1234567890)")
        return cleaned
