"""Bearer-token auth and server-side ownership checks.

Authorisation is enforced here, not in the frontend: a request can never reach
another family's data by substituting an id, because the student is always
resolved from the caller's own token.
"""

from __future__ import annotations

import hashlib
import hmac
import re
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

# ------------------------------------------------------------------ come-back codes

# Read out loud or typed by a child, so no look-alike characters: no I, O, 0 or 1.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 15
# Stretched over ~100 ms per guess, which is what makes an online attack pointless
# without needing a rate limiter that serverless hosting can't keep honest anyway.
CODE_ITERATIONS = 210_000

BAD_CODE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=(
        "That code does not match an account. Codes never contain O, I, 0 or 1, so "
        "those letters may have been mistaken for a number."
    ),
)


def normalize_code(value: str) -> str:
    """Groups and case don't matter: ABCDE-FGHIJ-KLMNO is one code."""
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def format_code(code: str) -> str:
    """Shown in groups of five, which is far easier to copy by hand."""
    return "-".join(code[i : i + 5] for i in range(0, len(code), 5))


def new_code() -> str:
    # 15 characters over a 32-symbol alphabet is ~75 bits of entropy.
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def _code_index(normalized: str) -> str:
    # A deterministic lookup key, not the proof: it only says which row to check.
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:48]


def _hash_code(normalized: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", normalized.encode("utf-8"), salt, CODE_ITERATIONS)
    return f"pbkdf2_sha256${CODE_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_code(normalized: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, iterations, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", normalized.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
    )
    return hmac.compare_digest(digest.hex(), digest_hex)


def set_code_for(db: Session, user: User) -> str:
    """Mint (or replace) the account's come-back code and return it in plaintext.

    This is the only moment the code exists as text on the server, so the caller
    has to show it immediately — it cannot be retrieved later.
    """
    code = new_code()
    user.comeback_index = _code_index(code)
    user.comeback_hash = _hash_code(code)
    db.commit()
    return code


def find_account_by_code(db: Session, value: str) -> User:
    normalized = normalize_code(value)
    if len(normalized) != CODE_LENGTH:
        raise BAD_CODE
    user = db.scalars(
        select(User).where(User.comeback_index == _code_index(normalized)).limit(1)
    ).first()
    if user is None or not user.is_active or not verify_code(normalized, user.comeback_hash):
        raise BAD_CODE
    return user


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
