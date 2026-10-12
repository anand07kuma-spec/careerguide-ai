"""Bearer-token auth and server-side ownership checks.

Authorisation is enforced here, not in the frontend: a request can never reach
another family's data by substituting an id, because the student is always
resolved from the caller's own token.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import AuthToken, Guardianship, User, UserSettings

CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Please sign in again to continue.",
    headers={"WWW-Authenticate": "Bearer"},
)


def issue_token(db: Session, user_id: int) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            token=token,
            user_id=user_id,
            expires_at=datetime.now(timezone.utc)
            + timedelta(hours=settings.session_token_ttl_hours),
        )
    )
    db.commit()
    return token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise CREDENTIALS_EXC
    raw = authorization.split(" ", 1)[1].strip()
    record = db.get(AuthToken, raw)
    if record is None or record.expires_at < datetime.now(timezone.utc):
        raise CREDENTIALS_EXC
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise CREDENTIALS_EXC
    return user


def get_raw_token(authorization: str | None = Header(default=None)) -> str:
    """The bearer string itself, for routes that must revoke it."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise CREDENTIALS_EXC
    return authorization.split(" ", 1)[1].strip()


def get_student_user_id(user: User) -> int:
    """Students act on themselves; parents act on their linked child."""
    if user.role == "student":
        return user.id
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This area is for a student account. Open the parent dashboard instead.",
    )


def require_student(user: User = Depends(get_current_user)) -> int:
    return get_student_user_id(user)


def require_parent(user: User = Depends(get_current_user)) -> User:
    if user.role != "parent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This area is only available to a parent or guardian account.",
        )
    return user


def linked_student_ids(db: Session, parent_id: int) -> list[int]:
    return list(
        db.scalars(
            select(Guardianship.student_id).where(Guardianship.parent_id == parent_id)
        )
    )


def resolve_child(db: Session, parent: User, student_id: int) -> int:
    """A parent may only ever address a student explicitly linked to them."""
    if student_id not in linked_student_ids(db, parent.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No linked child profile was found for this account.",
        )
    return student_id


def ensure_settings(db: Session, user_id: int) -> UserSettings:
    existing = db.get(UserSettings, user_id)
    if existing is not None:
        return existing
    created = UserSettings(user_id=user_id)
    db.add(created)
    db.commit()
    db.refresh(created)
    return created
