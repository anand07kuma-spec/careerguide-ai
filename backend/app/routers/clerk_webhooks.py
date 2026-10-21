"""Clerk's webhook, and the two jobs it is actually for.

Most Clerk integrations use this endpoint to copy a user across: email, name,
picture, the lot. This app stores none of those — `models.py` keeps a single
`clerk_user_id` pointer and nothing else, because a career app for class 6-12
students has no reason to hold a second copy of a child's contact details when the
identity provider already holds the first. So there is genuinely nothing to sync on
`user.updated`, and this file says so in its response rather than inventing work to
look busy.

What it *is* for is two events:

* **`user.deleted`.** When someone deletes their Clerk account, the pointer here
  becomes a door with nothing behind it: it names an identity that no longer exists,
  and while it stays set it blocks that Clerk user id from ever being reused. Clerk
  tells us, we switch the pointer off, and the student's own work is untouched —
  because that work was never Clerk's to delete.
* **`user.created`, for one address that was already waiting.** A person who typed an
  email address into the settings screen of this app and then signed up with that same
  address at Clerk has proved they can read it *there*, and it would be a strange
  product that made them click a second link to prove it again. So this event checks
  the verified addresses in the payload against accounts holding that address
  unconfirmed, and if one matches, it confirms that account's own address and sends
  the welcome message. Nothing else is taken from the payload, no address is stored
  that was not already stored, and an account that never asked for mail is not touched
  by an event that mentions it — which is the whole of the reason the match is on
  *this* table's pending addresses rather than on the event's user id.

Every delivery is signature-checked before a single field is read. An unsigned JSON
body that could set or clear `clerk_user_id`, or switch an email address on, would be
an account-takeover primitive.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..services import clerk
from ..services import email_consent as consent
from ..services import email as transport
from ..services import email_messages as messages

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

log = logging.getLogger(__name__)

# Events that change nothing here, listed so the answer is explicit rather than a
# silent default. `user.updated` changes fields this database deliberately does not
# hold, and a session opening is not an event about anybody's data.
NO_SYNC = ("user.updated", "user.updated_image_url", "session.created")


def _verified_addresses(data: dict[str, Any]) -> list[str]:
    """The addresses Clerk says this new account can read.

    Normalised the same way the settings route normalises what a person types, so the
    comparison is between two values in the same shape rather than between a header
    and a mailbox. Held for the length of this request only: a payload address is
    never written down, and this list exists to be *matched*, not to be copied.
    """
    values: list[str] = []
    rows = data.get("email_addresses")
    if not isinstance(rows, list):
        return values
    for row in rows:
        if not isinstance(row, dict) or not row.get("verified"):
            continue
        value = transport.normalize_address(str(row.get("email_address") or ""))
        if value and transport.valid_address(value) and value not in values:
            values.append(value)
    return values


@router.post("/clerk")
async def clerk_event(request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Receive one Clerk event. Returns what it did, never a child's data."""
    raw = await request.body()
    headers = {key.lower(): value for key, value in request.headers.items()}

    try:
        event = clerk.verify_webhook(raw, headers)
    except clerk.WebhookRejected as exc:
        # What was rejected, not why: a signature oracle is not worth building.
        log.info("Rejected a Clerk webhook delivery (%s)", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This delivery could not be verified.",
        ) from exc

    kind = str(event.get("type") or "")
    data = event.get("data") if isinstance(event.get("data"), dict) else {}

    if kind == "user.deleted":
        clerk_id = data.get("id")
        if not isinstance(clerk_id, str) or not clerk_id:
            return {"received": True, "handled": "ignored", "reason": "no user id in payload"}
        rows = list(
            db.scalars(select(User).where(User.clerk_user_id == clerk_id))
        )
        for user in rows:
            user.clerk_user_id = None
            user.clerk_linked_at = None
        db.commit()
        log.info(
            "Clerk account %s was deleted; disconnected from %d local account(s). "
            "No student data was touched.",
            clerk_id,
            len(rows),
        )
        return {"received": True, "handled": "disconnected", "accounts": len(rows)}

    if kind == "user.created":
        addresses = _verified_addresses(data)
        if not addresses:
            # The same shape as every other `user.created` answer, because a script
            # watching this endpoint reads one field, not a different one per branch.
            return {"received": True, "handled": "nothing-to-sync",
                    "accounts": 0, "reason": "no verified address"}
        # Only accounts that already hold this exact address, unconfirmed. The event
        # cannot create a mail relationship, only complete one a person started here.
        waiting = list(
            db.scalars(
                select(User).where(
                    User.contact_email.in_(addresses),
                    User.email_confirmed_at.is_(None),
                    User.is_active.is_(True),
                )
            )
        )
        delivered = 0
        for user in waiting:
            consent.confirm(db, user)
            answer = messages.send_welcome(db, user)
            if answer.delivered:
                delivered += 1
            log.info(
                "Clerk verified the address on account %d; welcome mail %s.",
                user.id,
                "delivered" if answer.delivered else answer.reason,
            )
        return {
            "received": True,
            "handled": "welcome" if waiting else "nothing-to-sync",
            "accounts": len(waiting),
            "delivered": delivered,
        }

    if kind in NO_SYNC:
        return {"received": True, "handled": "nothing-to-sync"}

    return {"received": True, "handled": "ignored"}
