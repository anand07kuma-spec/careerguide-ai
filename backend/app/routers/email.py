"""The email an account can see, ask for, and take back.

Five routes, and the whole design of this one file is in why they are shaped like
this:

* **Typing an address does not make it usable.** `PUT /address` stores what was
  typed and mails a link to it; `POST /confirm` is the only thing in the backend
  that turns `email_confirmed_at` on. Nothing else in this app reads an unconfirmed
  address, so a mistyped or somebody-else's address receives exactly one message —
  the link — and never a child's report. That is also why the confirm route is
  public: a parent opening the link on the family phone is not signed in, and a
  feature that demanded a token would be a feature nobody uses.
* **Permission is per purpose, and lives in the consent table, not in here.** The
  two switches the settings screen writes go through the existing
  `POST /api/auth/consent`; this file only ever *reads* them, through
  `email_consent.may_send`. An endpoint that could grant itself permission would
  make the consent records decorative.
* **A refusal is a sentence, not a status code alone.** Every route answers with
  what actually happened (`MailOut`), including the ones where nothing was sent. A
  green tick after a refused send is the failure mode this file is written against.

One deliberate, small leak, noted where someone can see it: `PUT /address` says when
an address is already on another account rather than answering "saved" like every
other outcome. It is reachable only from a signed-in account, it reveals an address
the caller already typed, and the alternative — accepting it and letting the unique
index decide later — would promise a message that can never arrive. The right fix for
a household that shares one mailbox is the delete route, not a vaguer error.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, status
from fastapi.exceptions import HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import email_limit
from ..models import EmailJob, Result, User
from ..schemas import (
    EmailAddressIn,
    EmailConfirmOut,
    EmailStateOut,
    EmailTokenIn,
    MailOut,
    ParentInviteIn,
)
from ..security import get_current_user, get_student_user_id
from ..services import email as transport
from ..services import email_consent as consent
from ..services import email_jobs as jobs
from ..services import email_messages as messages

router = APIRouter(prefix="/api/email", tags=["email"])

log = logging.getLogger(__name__)

# A message this deployment cannot produce at all, said in the same terms a screen
# can print: not "503", but what a family would have to do about it.
NOT_ENABLED = (
    "Email is not switched on on this site yet, so nothing can be sent. Whoever "
    "runs it has to connect an email service first."
)
NO_ADDRESS = (
    "No confirmed email address is attached to this account, so nothing is sent. "
    "Add one below and open the link we mail to it."
)
PENDING_CONFIRMATION = (
    "This address is saved but not confirmed, so nothing is sent to it. Open the "
    "confirmation link we mailed — if it has gone or expired, save the address "
    "again for a new one."
)
CONFIRMED_ADDRESS = (
    "Messages go to this address only for the purposes switched on below, and "
    "removing it turns them all off."
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _state(db: Session, user: User) -> EmailStateOut:
    address = user.contact_email
    confirmed = consent.confirmed_address(user) is not None
    enabled = transport.enabled()
    if not enabled:
        note = NOT_ENABLED
    elif address is None:
        note = NO_ADDRESS
    elif not confirmed:
        note = PENDING_CONFIRMATION
    else:
        note = CONFIRMED_ADDRESS
    return EmailStateOut(
        address=address,
        confirmed=confirmed,
        pending_confirmation=bool(address) and not confirmed,
        purposes=consent.consent_state(db, user),
        enabled=enabled,
        note=note,
    )


def _answer(reason: str, *, queued: bool = False) -> MailOut:
    """One service word, turned into what the family can act on."""
    return MailOut(
        delivered=reason == "sent",
        queued=queued,
        reason=reason,
        note=messages.NOTES.get(reason, messages.NOTES["failed"]),
    )


def _from_row(job: EmailJob) -> MailOut:
    """Describe a queued request by what the row ended up doing.

    The queue is the only place a caller cannot see the provider's answer, so the
    row's own columns are the evidence: `skipped` carries the reason it refused, and
    `pending` means a retry is scheduled — or that no key is set and it is waiting
    for one, which the row records as `disabled` rather than as a failure.
    """
    if job.status == jobs.SENT:
        return _answer("sent")
    detail = job.detail or ""
    if job.status == jobs.PENDING:
        reason = detail if detail in messages.NOTES else "waiting"
        return MailOut(
            delivered=False,
            queued=True,
            reason=reason,
            note=messages.NOTES.get(reason)
            or (
                "It could not be sent just now, so it is queued and will be tried "
                "again. Nothing has been lost."
            ),
        )
    return _answer(detail if detail in messages.NOTES else "failed")


@router.get("", response_model=EmailStateOut)
def email_state(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmailStateOut:
    """What this account has agreed to, and what its address can receive.

    Asking also drains *this account's* rows, because there is no scheduler on the
    hosted deployment and a person who opens the settings screen is the nearest thing
    to one. It touches only their own jobs and creates nothing: the weekly summaries
    that belong to other accounts are made by `scripts/email_worker.py`, never by a
    page load.
    """
    jobs.drain_for(db, user.id, now=_now())
    return _state(db, user)


@router.put("/address", response_model=MailOut)
@email_limit
def attach_address(
    request: Request,
    payload: EmailAddressIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MailOut:
    """Attach an address to this account and mail its one link.

    A replacement counts as a new address: the previous confirmation is dropped, so
    `confirmed` can never describe a string this account no longer holds.
    """
    change = consent.request_confirmation(db, user, payload.address)
    if change.status == consent.INVALID:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=messages.NOTES["invalid-address"],
        )
    if change.status == consent.TAKEN:
        return MailOut(
            delivered=False,
            queued=False,
            reason=consent.TAKEN,
            note=(
                "That address is already confirmed on another account here. If one "
                "account uses it and now another needs to, remove it from the first "
                "account's settings and add it again here."
            ),
        )
    if change.status == consent.UNCHANGED:
        return MailOut(
            delivered=False,
            queued=False,
            reason="unchanged",
            note="That is already the confirmed address on this account.",
        )

    answer = messages.send_confirmation(db, user, change.token or "")
    log.info("Address attached for account %d (%s)", user.id, answer.reason)
    if answer.delivered:
        return MailOut(
            delivered=True,
            queued=False,
            reason="sent",
            note=(
                "A confirmation link is on its way. The address works for messages "
                f"only after it is opened, within {consent.valid_hours()} hours."
            ),
        )
    if answer.reason == "disabled":
        return MailOut(
            delivered=False,
            queued=False,
            reason="disabled",
            note=(
                "Your address is saved, but this site cannot mail anything yet, so "
                "there is no link to open. Nothing else will be sent to it until "
                "email is switched on and the address is confirmed."
            ),
        )
    return _answer(answer.reason)


@router.delete("/address", response_model=EmailStateOut)
@email_limit
def remove_email_address(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmailStateOut:
    """Forget the address, and with it every agreement that could only have been
    used to mail it. Queued messages are closed rather than left to find a new one."""
    jobs.cancel_pending(db, user.id, "no-address", _now())
    consent.remove_address(db, user)
    log.info("Address removed for account %d", user.id)
    return _state(db, user)


@router.post("/confirm", response_model=EmailConfirmOut)
@email_limit
def confirm_address(
    request: Request,
    payload: EmailTokenIn,
    db: Session = Depends(get_db),
) -> EmailConfirmOut:
    """Open a link. The only route in the backend that makes an address usable.

    Public on purpose, and therefore keyed on nothing but the token: 32 random bytes
    the server made, stored only as a hash, and expired after a day. A wrong token
    and an expired token get the same answer, because which of the two it was is a
    fact about the link, not about the account, and this route has no session to
    protect.
    """
    user = consent.find_pending(db, payload.token)
    if user is None:
        return EmailConfirmOut(
            confirmed=False,
            note=(
                "That link does not match an address waiting for confirmation, or it "
                "has expired. Add the address again to get a new one."
            ),
        )
    if not consent.mark_confirmed(db, user, payload.token):
        return EmailConfirmOut(
            confirmed=False,
            note="That link has already been used, or was replaced by a newer one.",
        )

    # The first message an address ever receives by choice. Sent here rather than
    # queued: this is the one moment the person is standing on the page waiting for
    # proof that mail works at all, and a welcome that arrives three drains later
    # proves nothing to anybody.
    welcome = messages.send_welcome(db, user)
    if welcome.delivered:
        note = "This address is confirmed. A welcome message has been sent to it."
    elif welcome.reason == "disabled":
        note = "This address is confirmed. No welcome message could be sent yet."
    else:
        note = (
            "This address is confirmed, but the welcome message did not go "
            f"out ({welcome.reason}). Everything else can still be sent to it."
        )
    log.info("Address confirmed for account %d (welcome: %s)", user.id, welcome.reason)
    return EmailConfirmOut(confirmed=True, note=note)


@router.post("/result/{result_id}", response_model=MailOut)
@email_limit
def mail_result(
    request: Request,
    result_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MailOut:
    """Send one finished questionnaire's summary to this account's own address.

    The student's decision, on the student's request, gated twice over: the consent
    scope has to be on, and the result has to belong to the caller. A parent asking
    for a copy gets the answer `not-agreed` and a switch they can turn on, which is
    the honest response when the agreement on file is the child's.
    """
    student_id = get_student_user_id(user)
    row = db.get(Result, result_id)
    if row is None or row.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "That result does not belong to this account, or it has been "
                "deleted. Nothing was sent."
            ),
        )

    job = jobs.enqueue(db, student_id, "email_result", ref_id=result_id)
    jobs.try_now(db, job)
    return _from_row(job)


@router.post("/invite-parent", response_model=MailOut)
@email_limit
def invite_parent(
    request: Request,
    payload: ParentInviteIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MailOut:
    """Mail an invitation to a guardian, at an address that is never written down.

    Only a student account may do this, and only with their own sharing code in the
    message — the code is the thing that makes the link safe to send, and it is the
    student's to revoke. Nothing here creates a guardianship: the adult has to accept
    it themselves, on the parent page, with the code.
    """
    student_id = get_student_user_id(user)
    student = db.get(User, student_id)
    answer = messages.send_parent_invite(db, student, payload.address)
    if answer.reason == "invalid-address":
        # The same answer `PUT /address` gives for the same mistake: a string that is
        # not an address is a bad request, not a send that happened to fail.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=messages.NOTES["invalid-address"],
        )
    log.info("Guardian invited by account %d (%s)", student_id, answer.reason)
    return _answer(answer.reason)
