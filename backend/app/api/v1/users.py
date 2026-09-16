"""
User management endpoints (Admin only).
"""

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User, UserRole
from app.schemas.user import UserRead, UserUpdate, UserPreferencesUpdate
from app.services.user_service import user_service

router = APIRouter()


@router.get("/", response_model=List[UserRead])
def read_users(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
) -> Any:
    """
    Retrieve users. Admin only.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserRead)
def read_user_by_id(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
) -> Any:
    """
    Get a specific user by id. Admin only.
    """
    user = user_service.get_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.RequireRole([UserRole.ADMIN])),
) -> Any:
    """
    Update a user. Admin only.
    """
    user = user_service.get_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
        
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me/preferences", response_model=UserPreferencesUpdate)
def read_user_preferences(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve current user's notification preferences.
    """
    return current_user


@router.put("/me/preferences", response_model=UserPreferencesUpdate)
def update_user_preferences(
    preferences: UserPreferencesUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update current user's notification preferences.
    """
    update_data = preferences.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
        
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
