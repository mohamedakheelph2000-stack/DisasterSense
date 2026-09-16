"""
Token Pydantic schemas for authentication and authorization.
"""

from pydantic import BaseModel


class Token(BaseModel):
    """Schema for returning the access token."""
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Schema for the payload encoded inside the JWT."""
    sub: str | None = None
