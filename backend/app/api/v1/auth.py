"""
Authentication endpoints.
"""

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserRegister, UserRead
from app.services.user_service import user_service

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserRegister,
) -> Any:
    """
    Register a new user.

    Self-registration always creates an active ``citizen`` account: the
    request schema does not expose ``role`` or ``is_active``. Privileged
    roles must be granted by an admin via ``PATCH /users/{id}``.
    """
    return user_service.create(db=db, obj_in=user_in)


@router.post("/login", response_model=Token)
async def login_access_token(
    request: Request,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    OAuth2 compatible token login, accepts either Form-Data (OAuth2 standard) or JSON.
    """
    content_type = request.headers.get("content-type", "")
    username = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("username") or body.get("email")
            password = body.get("password")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            username = form.get("username") or form.get("email")
            password = form.get("password")
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )

    user = user_service.authenticate(
        db, email=username, password=password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            subject=user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserRead)
def read_users_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user
