"""
User service for handling user business logic, creation, and authentication.
"""

from typing import Optional, Union

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserRegister, UserUpdate
from app.core.security import get_password_hash, verify_password


class UserService:
    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    def get_by_id(self, db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    def create(
        self,
        db: Session,
        obj_in: Union[UserCreate, UserRegister],
        *,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
    ) -> User:
        """
        Create a user.

        ``role`` and ``is_active`` may only be supplied by a trusted caller.
        Schemas that do not carry those fields (``UserRegister``) always
        produce an active ``citizen`` account, which prevents privilege
        escalation through the public registration endpoint.
        """
        if self.get_by_email(db, obj_in.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists."
            )

        db_obj = User(
            email=obj_in.email,
            full_name=obj_in.full_name,
            hashed_password=get_password_hash(obj_in.plain_password),
            role=role if role is not None else getattr(obj_in, "role", UserRole.CITIZEN),
            is_active=is_active if is_active is not None else getattr(obj_in, "is_active", True),
            phone_number=getattr(obj_in, "phone_number", None),
            email_enabled=getattr(obj_in, "email_enabled", True),
            sms_enabled=getattr(obj_in, "sms_enabled", False),
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def authenticate(
        self, db: Session, email: str, password: str
    ) -> Optional[User]:
        user = self.get_by_email(db, email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user


# Singleton instance
user_service = UserService()
