"""The optional email sign-in, seen from this app's side.

Nothing in this file creates an account. The account already exists — this browser
made it on the first question — and these four routes either attach a Clerk identity
to it, or use an attached one to get back in from somewhere new.

The order of the checks is the whole security of the feature:

1. `services/clerk.py` asks Clerk whether a session token is real, and the user id
   is taken from *that* answer. No request here carries a user id, so there is
   nothing to claim and therefore nothing to forge.
2. Attaching also requires this app's own session, presented however that browser holds
   it. A Clerk account can only ever be linked to a device account the linker is already
   signed into, which is what stops someone from binding their email to a stranger's
   child record.
3. Signing in elsewhere returns a freshly issued session, and every read of a child's
   answers still checks it. A Clerk session on its own reaches no data at all — which is
   why the Next.js middleware does not gate `/app/*` on it.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import auth_limit
from ..models import User
from ..schemas import ClerkSessionIn, ClerkStatusOut, SessionOut
from ..security import get_current_user
from ..services import clerk
from .auth import session_for, start_session

router = APIRouter(prefix="/api/auth/clerk", tags=["auth"])


def _status(user: User) -> ClerkStatusOut:
    if user.clerk_user_id:
        return ClerkStatusOut(
            linked=True,
            linked_at=user.clerk_linked_at,
            available=True,
            note=(
                "This account can be opened with an email sign-in from any device. "
                "This browser still opens it too, and disconnecting the email takes "
                "nothing away."
            ),
        )
    return ClerkStatusOut(
        linked=False,
        linked_at=None,
        available=clerk.configured(),
        note=(
            "This account lives in this browser. Connecting an email lets you open "
            "the same work from another device; it does not move anything or delete "
            "the device account."
        ),
    )


@router.get("", response_model=ClerkStatusOut)
def status_of(
    user: User = Depends(get_current_user),
) -> ClerkStatusOut:
    """Whether this account has an email sign-in, and whether this deployment offers one."""
    return _status(user)


@router.post("/link", response_model=ClerkStatusOut)
@auth_limit
def link(
    request: Request,
    payload: ClerkSessionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClerkStatusOut:
    """Attach the Clerk account this browser is signed into to this account."""
    clerk.require_configured()
    clerk_id = clerk.verify_session_token(payload.session)

    if user.clerk_user_id == clerk_id:
        # Already attached. Answer without rewriting anything, so the account screen
        # keeps saying when the choice was *first* made rather than when the page was
        # refreshed.
        return _status(user)

    holder = db.scalars(
        select(User).where(User.clerk_user_id == clerk_id, User.id != user.id)
    ).first()
    if holder is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "That email is already connected to a different account here. Open "
                "that account, disconnect it from Settings → Account, then connect it "
                "again here — or use a different email."
            ),
        )
    if user.clerk_user_id and user.clerk_user_id != clerk_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This account is already connected to another email. Disconnect that "
                "one first, from Settings → Account."
            ),
        )

    user.clerk_user_id = clerk_id
    user.clerk_linked_at = datetime.now(timezone.utc)
    db.commit()
    return _status(user)


@router.post("/enter", response_model=SessionOut)
@auth_limit
def enter(
    request: Request,
    response: Response,
    payload: ClerkSessionIn,
    db: Session = Depends(get_db),
) -> SessionOut:
    """Sign in from a new device: Clerk's answer picks the account, this app issues the session."""
    clerk.require_configured()
    clerk_id = clerk.verify_session_token(payload.session)
    user = db.scalars(
        select(User)
        .where(User.clerk_user_id == clerk_id, User.is_active.is_(True))
        .order_by(User.id)
        .limit(1)
    ).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "That email is not connected to any work here yet. Open this site on "
                "the device you started on and connect the email from Settings → "
                "Account; after that, signing in here opens the same account."
            ),
        )
    return session_for(db, user, start_session(request, response, db, user))


@router.delete("/link", response_model=ClerkStatusOut)
def unlink(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClerkStatusOut:
    """Cut the email loose. The account and everything in it stay exactly where they are."""
    user.clerk_user_id = None
    user.clerk_linked_at = None
    db.commit()
    return ClerkStatusOut(
        linked=False,
        linked_at=None,
        available=clerk.configured(),
        note=(
            "Disconnected. This browser still opens this account as it always did, "
            "and nothing was deleted. Signing in with that email elsewhere will no "
            "longer find this account."
        ),
    )
