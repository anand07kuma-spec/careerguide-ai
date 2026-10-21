"""Who may be mailed, and what they said yes to.

`app/services/email.py` can render and send. It cannot decide. Every question about
permission lives here, and it asks four of them in this order — a message is sent
only when all four answer yes:

1. Is there an address on this account, and has somebody proved they can read it?
   An address is stored in two states, and only one of them is usable: typed, and
   typed-then-confirmed by opening a link delivered to it. Nothing else in the
   backend reads the unconfirmed value, so a mistyped or borrowed address never
   receives a child's report, only the one message that asks its real owner to say
   it is theirs.
2. Has this account agreed to *this kind* of message? A result copy and the weekly
   summary each carry their own consent scope. A receipt and an invitation are
   transactional — a payment receipt nobody asked for is still the proof a family
   needs — so they need no scope, but they need a confirmed address just the same.
3. Can this deployment mail at all? If `RESEND_API_KEY` and `FROM_EMAIL` are unset,
   the answer to a route is "not enabled", never a silent drop.
4. Has this exact message already gone out? That is the queue's job, not this
   file's; see `app/services/email_jobs.py`.

Deleting an address is a real feature of this module rather than an UPDATE nobody
thought of: it switches off the three consents that could only ever have been used
to mail it, so the record of what was agreed to cannot outlive the thing it was
about.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ConsentRecord, User
from . import email as transport

# The kinds of message this app can produce. `welcome` is what a person gets once an
# address is confirmed; `confirm` is the link that gets there.
KINDS = ("confirm", "welcome", "result", "digest", "receipt", "invite")

# Kinds that may not go out without a separate, revocable agreement. Two scopes,
# because "mail me when I finish a questionnaire" and "mail me every week" are
# different decisions, and a settings screen that bundles them gets a yes nobody
# meant.
CONSENT_SCOPES = ("email_result", "email_digest")
KIND_SCOPE = {"result": "email_result", "digest": "email_digest"}

# A confirmation link that lives forever is a standing invitation to whoever finds
# the mail. A day is long enough for a parent to open it on the family phone and
# short enough that an old mail is not a way into a newer account.
CONFIRM_TOKEN_TTL_HOURS = 24

# Outcomes, so a route can answer with a sentence instead of guessing.
ADDED = "added"
UNCHANGED = "unchanged"
INVALID = "invalid"
TAKEN = "already-on-another-account"
NOT_FOUND = "not-found"
EXPIRED = "expired"


@dataclass(frozen=True)
class AddressChange:
    """What adding an address did, plus the token the caller has to mail."""

    status: str
    token: str | None = None

    @property
    def changed(self) -> bool:
        return self.status == ADDED


def _token_hash(token: str) -> str:
    # A plain SHA-256, not the PBKDF2 the come-back code uses: this value is 32
    # random bytes the server made, not a human's guessable word, so there is
    # nothing for stretching to defend against.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def confirmed_address(user: User) -> str | None:
    """The only address this backend will ever write to.

    Reads the confirmation, not just the column. An account that typed something and
    never opened the link has an address in `contact_email` and no way to receive
    anything — which is the state a mistyped address is supposed to end in.
    """
    if user.email_confirmed_at is None or not user.contact_email:
        return None
    return user.contact_email


def language_for(user: User) -> str:
    return user.preferred_language or "en"


def consented(db: Session, user: User, scope: str) -> bool:
    """The newest answer for one scope. There is no default yes anywhere in here."""
    record = db.scalars(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == user.id, ConsentRecord.scope == scope)
        .order_by(ConsentRecord.id.desc())
        .limit(1)
    ).first()
    return bool(record and record.granted)


def consent_state(db: Session, user: User) -> dict[str, bool]:
    """Both switches as the settings screen has to show them."""
    return {scope: consented(db, user, scope) for scope in CONSENT_SCOPES}


def may_send(db: Session, user: User, kind: str) -> tuple[bool, str]:
    """The four questions, in order, as one answer.

    The reason word is returned rather than raised: a caller that finds it cannot
    mail says "email is not enabled on this deployment" or "no address is confirmed
    on this account" on screen, which is a usable sentence for a family. A caller
    that catches an exception tends to become a caller that shows a green tick.
    """
    if kind not in KINDS:
        raise ValueError(f"Unknown email kind: {kind}")
    if not transport.enabled():
        return False, "disabled"
    if not user.is_active:
        return False, "closed"
    if confirmed_address(user) is None:
        return False, "no-address"
    scope = KIND_SCOPE.get(kind)
    if scope is not None and not consented(db, user, scope):
        return False, "not-agreed"
    return True, "ok"


def request_confirmation(db: Session, user: User, value: str) -> AddressChange:
    """Attach a typed address to this account and mint its one link.

    Nothing is sent from here. The caller mails `email_messages.send_confirmation`
    with the returned token, because a route that also holds the HTTP response has
    to be able to report a refused send rather than imply one happened.
    """
    address = transport.normalize_address(value)
    if not transport.valid_address(address):
        return AddressChange(INVALID)
    if confirmed_address(user) == address:
        return AddressChange(UNCHANGED)

    holder = db.scalars(
        select(User).where(User.contact_email == address, User.id != user.id).limit(1)
    ).first()
    if holder is not None:
        # Honest and specific, because this is the one refusal a family will hit:
        # two people, one shared Gmail. The address stays where it is proved, and
        # the way to move it is to delete it there first.
        return AddressChange(TAKEN)

    token = secrets.token_urlsafe(32)
    user.contact_email = address
    user.email_confirm_hash = _token_hash(token)
    user.email_confirm_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=CONFIRM_TOKEN_TTL_HOURS
    )
    # A new address is not the old one. Any previous confirmation goes with it,
    # so "confirmed" always means *this* string was opened at.
    user.email_confirmed_at = None
    db.commit()
    return AddressChange(ADDED, token)


def find_pending(db: Session, token: str) -> User | None:
    """The account waiting on this token, if it is still waiting."""
    raw = str(token or "").strip()
    if len(raw) < 20:
        return None
    user = db.scalars(
        select(User).where(User.email_confirm_hash == _token_hash(raw)).limit(1)
    ).first()
    if user is None:
        return None
    expires = user.email_confirm_expires_at
    if expires is not None and expires < datetime.now(timezone.utc):
        return None
    return user


def mark_confirmed(db: Session, user: User, token: str) -> bool:
    """Switch the address on, then destroy the key that switched it."""
    if user.email_confirm_hash != _token_hash(token):
        return False
    confirm(db, user)
    return True


def confirm(db: Session, user: User) -> None:
    """Make this account's typed address usable, without a token.

    The only caller that is allowed to reach past the link is Clerk's webhook, which
    arrives with a signature and a proof this app did not have to produce: the address
    was verified *there*, by the identity provider that just made the account, before
    any of it was ever written here. A third party's verification is good enough for
    "somebody can read this mailbox" and nothing else — it does not create a consent,
    switch on a purpose, or move an address from one account to another, all of which
    still require the account's own yes.
    """
    user.email_confirmed_at = datetime.now(timezone.utc)
    user.email_confirm_hash = None
    user.email_confirm_expires_at = None
    db.commit()


def remove_address(db: Session, user: User) -> None:
    """Forget the address, its confirmation, and every agreement that depended on it.

    The consents are switched off in writing rather than deleted: `consent_records`
    is the account's history of what was agreed, and a row saying "no" at the moment
    the address went away is a truer record than an absence.
    """
    user.contact_email = None
    user.email_confirm_hash = None
    user.email_confirm_expires_at = None
    user.email_confirmed_at = None
    for scope in CONSENT_SCOPES:
        record = db.scalars(
            select(ConsentRecord)
            .where(ConsentRecord.user_id == user.id, ConsentRecord.scope == scope)
            .order_by(ConsentRecord.id.desc())
            .limit(1)
        ).first()
        if record is None:
            record = ConsentRecord(user_id=user.id, scope=scope)
            db.add(record)
        record.granted = False
    db.commit()


def valid_hours() -> int:
    """For the confirmation mail's own sentence about how long it has."""
    return CONFIRM_TOKEN_TTL_HOURS
