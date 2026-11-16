"""Onboarding, sign-in, session tokens, profile, settings, consent and parent linking."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..middleware.rate_limit import auth_limit, email_limit, guest_limit
from ..models import (
    AuthToken,
    ConsentRecord,
    Guardianship,
    StudentProfile,
    User,
    UserSettings,
    utcnow,
)
from ..schemas import (
    ConsentIn,
    ConsentOut,
    EmailLoginIn,
    EmailRegisterIn,
    GuardianOut,
    GuestIn,
    GuestOut,
    LinkChildIn,
    OnboardingIn,
    PasswordForgotIn,
    PasswordResetIn,
    PasswordResetRequestOut,
    ProfileIn,
    ProfileOut,
    RefreshOut,
    SessionOut,
    SettingsIn,
    SettingsOut,
    ShareCodeOut,
    SignInMethodsOut,
    TranscriptSharingIn,
    UserOut,
)
from ..services import email_messages, passwords
from ..services import email as transport
from ..services.profile_facts import band_for_age
from ..services.profile_photos import photo_url
from ..security import (
    active_link_clause,
    attach_session_cookie,
    clear_session_cookie,
    device_hash_of,
    device_owner,
    ensure_settings,
    get_current_session,
    get_current_user,
    get_raw_token,
    issue_token,
    renew_session,
    require_parent,
    revoke_session,
    session_cookie_value,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Must stay inside the consent age bands the frontend offers, so a class choice
# and a stored age range are the same vocabulary. Classes 6 to 12 only: below that
# there is nothing in this app to serve, and a legacy row simply keeps the age it has.
CLASS_TO_AGE = {
    "class-6": "11-12",
    "class-7": "11-12",
    "class-8": "11-12",
    "class-9": "adult",
    "class-10": "adult",
    "class-11": "adult",
    "class-12": "adult",
}

# One answer for a wrong password and for an address with no account, so the endpoint
# cannot be asked which addresses are registered.
EMAIL_CANNOT_SIGN_IN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="The email address or password is incorrect.",
)

# The address belongs to an account already. The message says what to do rather than
# only what failed, because the person is usually one sign-in away from their own work.
EMAIL_TAKEN = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail=(
        "An account already uses this email address. Sign in with it instead, or use "
        "\"Forgot password\" if you do not know the password."
    ),
)

RESET_LINK_INVALID = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="This reset link is invalid or has expired. Ask for a new one.",
)

# The same sentence for every address, whether or not one uses it.
RESET_ANSWER = (
    "If an account signs in with that address, a reset link is on its way. "
    "The link works once and expires shortly."
)


# A share code is read out loud to a parent, so no look-alike characters: no I, O, 0 or 1.
SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_share_code(db: Session) -> str:
    for _ in range(25):
        code = "".join(secrets.choice(SHARE_CODE_ALPHABET) for _ in range(6))
        taken = db.scalars(
            select(StudentProfile.user_id).where(StudentProfile.share_code == code)
        ).first()
        if not taken:
            return code
    raise HTTPException(status_code=500, detail="Could not create a sharing code. Please try again.")


def _profile_payload(db: Session, student_id: int) -> ProfileOut | None:
    profile = db.get(StudentProfile, student_id)
    if profile is None:
        return None
    payload = ProfileOut.model_validate(profile)
    # Every response that carries the profile carries the photo's address with it, so a
    # screen never has to ask a second question to know whether an avatar exists.
    payload.profile_photo_url = photo_url(db, student_id)
    return payload


def _settings_payload(db: Session, user_id: int) -> SettingsOut:
    return SettingsOut.model_validate(ensure_settings(db, user_id))


def start_session(request: Request, response: Response, db: Session, user: User) -> str:
    """Mint a session and give it to this browser in a cookie the page cannot read.

    Issuing and attaching live in one function, deliberately. A token that only ever
    arrives in a body is a token the page must keep somewhere it can reach, which is the
    thing that used to be `localStorage`; splitting the two steps is how the fourth
    minting route forgets the cookie and that browser then has no session on reload.
    """
    token = issue_token(db, user.id)
    attach_session_cookie(request, response, token)
    return token


def session_for(db: Session, user: User, token: str) -> SessionOut:
    """The one shape every signed-in response takes.

    `token` is passed in rather than issued here, because the callers are genuinely
    different: a guest handshake or a fresh sign-up deserves a new session, while
    `GET /me` re-reads a session that already exists and must not quietly mint a second
    token nobody asked for.
    """
    student_id = _linked_student_id(db, user)
    return SessionOut(
        token=token,
        user=UserOut.model_validate(user),
        profile=_profile_payload(db, student_id) if student_id else None,
        settings=_settings_payload(db, user.id),
    )


def _linked_student_id(db: Session, user: User) -> int:
    """Whose profile this account acts on: a student's own, a parent's approved child.

    A pending request is not a link yet, so it contributes no profile to the parent's
    session — otherwise the request itself would already be showing the child's class,
    age and interests on the parent's own screen.
    """
    if user.role != "parent":
        return user.id
    link = db.scalars(
        select(Guardianship)
        .where(Guardianship.parent_id == user.id, active_link_clause())
        .limit(1)
    ).first()
    return link.student_id if link else 0


@router.post("/guest", response_model=GuestOut)
@guest_limit
def guest(
    request: Request,
    response: Response,
    payload: GuestIn,
    db: Session = Depends(get_db),
) -> GuestOut:
    """Hand this device back the account it used before, if there is one.

    There is no password to type: the browser holds a random id it made for
    itself, and the server answers with an ordinary session for the account that id
    created. Everything past this point is authorised by that session, not by the device
    id, so a stolen credential behaves like a stolen credential and a guessed id only
    reaches an account whose id the guesser already has.

    The id is compared as a digest, so this route is the only place the plaintext ever
    stands: a database read is not a list of ids that open accounts.
    """
    user = device_owner(db, payload.device_id, active_only=True)
    if user is None:
        return GuestOut(known=False)

    return GuestOut(
        known=True,
        session=session_for(db, user, start_session(request, response, db, user)),
    )


@router.post("/onboarding", response_model=SessionOut)
@auth_limit
def onboarding(
    request: Request,
    response: Response,
    payload: OnboardingIn,
    db: Session = Depends(get_db),
) -> SessionOut:
    if not payload.consent_profile:
        raise HTTPException(
            status_code=400,
            detail=(
                "We need permission from a parent or guardian before storing a child's "
                "profile. Please confirm the consent box to continue."
            ),
        )

    # One device, one account. Without this a second onboarding on the same
    # browser would leave two accounts sharing an id, and the device would quietly
    # reopen the older one every time.
    if payload.device_id:
        claimed = device_owner(db, payload.device_id)
        if claimed is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This device already has an account. Open the app to continue it, "
                    "or start a new one from Settings."
                ),
            )

    if payload.role == "student":
        user = User(
            role="student",
            display_name=payload.display_name.strip(),
            preferred_language=payload.preferred_language,
        )
        db.add(user)
        db.flush()
        student_id = user.id
        parent_id = None
    else:
        parent = User(
            role="parent",
            display_name=payload.display_name.strip(),
            preferred_language=payload.preferred_language,
        )
        db.add(parent)
        db.flush()
        user = parent
        parent_id = parent.id
        student_id = None
        # A parent is joined to a child only through the child's own share code
        # (`POST /api/parent/link`). Creating a child here would be a link nobody
        # on the child's side agreed to, so it happens only when a caller names a
        # child explicitly — the parent sign-up screen names none.
        child_name = (payload.student_name or "").strip()
        if child_name:
            student = User(
                role="student",
                display_name=child_name,
                preferred_language=payload.preferred_language,
            )
            db.add(student)
            db.flush()
            student_id = student.id
            db.add(
                Guardianship(
                    parent_id=parent.id,
                    student_id=student.id,
                    relationship=payload.relationship,
                    # This is not a link to an account that already existed: the
                    # guardian created the child's account in this same sign-up and
                    # gave profile consent for it. A code-based link to somebody
                    # else's account still waits for that student's approval.
                    consent_granted_at=utcnow(),
                )
            )

    if student_id is not None:
        db.add(
            StudentProfile(
                user_id=student_id,
                class_level=payload.class_level or payload.student_class_level,
                age_range=payload.age_range
                or CLASS_TO_AGE.get(payload.class_level or payload.student_class_level or "", None),
                share_code=new_share_code(db),
                interest_areas=payload.interest_areas,
                education_context=payload.education_context,
                financial_context=payload.financial_context,
            )
        )
    db.add(
        ConsentRecord(
            user_id=user.id,
            scope="profile",
            granted=True,
            note=f"Consent given during onboarding for age band {payload.consent_age}.",
        )
    )
    if payload.consent_voice:
        db.add(ConsentRecord(user_id=user.id, scope="voice", granted=True))
    db.add(UserSettings(user_id=user.id, language=payload.preferred_language))
    if payload.device_id:
        user.device_hash = device_hash_of(payload.device_id)
    db.commit()

    # Nothing else is minted here: this account is reached by the device that made it,
    # which is the point of running without a password.
    return SessionOut(
        token=start_session(request, response, db, user),
        user=UserOut.model_validate(user),
        profile=_profile_payload(db, student_id) if student_id is not None else None,
        settings=_settings_payload(db, user.id),
    )


@router.post("/email/register", response_model=SessionOut, status_code=201)
@auth_limit
def email_register(
    request: Request,
    response: Response,
    payload: EmailRegisterIn,
    db: Session = Depends(get_db),
) -> SessionOut:
    """Create an account named by an address and a password, then sign it in.

    The same shell every other account gets — a student's profile and sharing code, a
    consent row, settings — so nothing downstream can tell how the account was made.

    Registering is the *only* thing this does with an existing Google or Clerk account:
    an address that one of them already uses makes this a 409. The client cannot prove
    it owns an address, so equality alone is never enough to attach a password to an
    identity somebody else signed in with.
    """
    email = passwords.normalize_email(str(payload.email))
    problem = passwords.password_problem(payload.password, email)
    if problem:
        raise HTTPException(status_code=422, detail=problem)

    taken = db.scalars(
        select(User.id)
        .where(or_(User.login_email == email, User.contact_email == email))
        .limit(1)
    ).first()
    if taken is not None:
        raise EMAIL_TAKEN

    now = datetime.now(timezone.utc)
    user = User(
        role=payload.role,
        display_name=payload.display_name,
        preferred_language=payload.preferred_language,
        login_email=email,
        password_hash=passwords.hash_password(payload.password),
        password_updated_at=now,
        failed_login_count=0,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        # Two sign-ups raced for one address; the unique index decided, not this code.
        db.rollback()
        raise EMAIL_TAKEN

    if user.role == "student":
        db.add(
            StudentProfile(
                user_id=user.id,
                share_code=new_share_code(db),
                interest_areas=[],
            )
        )
    # The act of registering is the consent this row records, exactly like the Google
    # sign-in. It can be withdrawn from Settings the same way.
    db.add(
        ConsentRecord(
            user_id=user.id,
            scope="profile",
            granted=True,
            note="Consent given when creating an account with an email address and password.",
        )
    )
    db.add(UserSettings(user_id=user.id, language=payload.preferred_language))

    # A browser that already belongs to a guest account keeps that account. Taking the
    # device over here would make the earlier work unreachable on the only browser that
    # could open it.
    if payload.device_id and user.device_hash is None:
        claim = device_owner(db, payload.device_id)
        if claim is None:
            user.device_hash = device_hash_of(payload.device_id)
    db.commit()
    db.refresh(user)
    return session_for(db, user, start_session(request, response, db, user))


@router.post("/email/login", response_model=SessionOut)
@auth_limit
def email_login(
    request: Request,
    response: Response,
    payload: EmailLoginIn,
    db: Session = Depends(get_db),
) -> SessionOut:
    """Sign in with the address and password this account was created with.

    Three answers, and the differences between them matter: the same 401 for a wrong
    password and an unknown address; a 429 with the remaining minutes once the
    account's own counter reaches the limit; and the ordinary session when it matches.
    A closed account is answered like an unknown one, so erasure is not undone by a
    credential that still exists in somebody's password manager.
    """
    settings = get_settings()
    email = passwords.normalize_email(str(payload.email))
    user = db.scalars(
        select(User)
        .where(User.login_email == email, User.is_active.is_(True))
        .limit(1)
    ).first()
    now = datetime.now(timezone.utc)

    if user is None:
        # The same work as a real check, so a response time does not name the addresses
        # that have accounts.
        passwords.verify_dummy(payload.password)
        raise EMAIL_CANNOT_SIGN_IN

    if user.locked_until is not None and user.locked_until > now:
        remaining = max(1, int((user.locked_until - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Too many attempts on this account. Wait "
                f"{max(1, remaining // 60)} minute(s) and try again, or reset the password."
            ),
            headers={"Retry-After": str(remaining)},
        )

    if not passwords.verify_password(payload.password, user.password_hash):
        failures = (user.failed_login_count or 0) + 1
        if failures >= settings.password_lockout_attempts:
            user.locked_until = now + timedelta(minutes=settings.password_lockout_minutes)
            user.failed_login_count = 0
        else:
            user.failed_login_count = failures
        db.commit()
        raise EMAIL_CANNOT_SIGN_IN

    user.failed_login_count = 0
    user.locked_until = None
    if passwords.needs_rehash(user.password_hash):
        user.password_hash = passwords.hash_password(payload.password)
        user.password_updated_at = now
    # Signing in on a browser that has no account of its own makes it this one's, which
    # is what turns tomorrow's page load into a return rather than a password prompt.
    if payload.device_id and user.device_hash is None:
        claim = device_owner(db, payload.device_id)
        if claim is None:
            user.device_hash = device_hash_of(payload.device_id)
    db.commit()
    db.refresh(user)
    return session_for(db, user, start_session(request, response, db, user))


@router.post("/password/forgot", response_model=PasswordResetRequestOut)
@email_limit
def password_forgot(
    request: Request,
    payload: PasswordForgotIn,
    db: Session = Depends(get_db),
) -> PasswordResetRequestOut:
    """Mail a single-use reset link, if an account signs in with that address.

    The answer never varies. A registered address and a stranger's both get the same
    sentence, because a page that says "no account with that address" is a way to ask
    this database which families are here.

    Each request replaces the previous token, so only the newest mail works. A link
    forwarded to somebody else, or a mailbox opened a week later, has nothing to match.
    """
    if not transport.enabled():
        raise transport.disabled_error()
    email = passwords.normalize_email(str(payload.email))
    user = db.scalars(
        select(User)
        .where(User.login_email == email, User.is_active.is_(True))
        .limit(1)
    ).first()
    if user is not None and user.password_hash:
        token = passwords.new_reset_token()
        user.password_reset_hash = passwords.reset_token_hash(token)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=get_settings().password_reset_ttl_minutes
        )
        user.password_reset_used_at = None
        db.commit()
        # A send that the provider refused is not reported differently from an address
        # with no account; transport.log_line already names the template and outcome.
        email_messages.send_password_reset(
            db, user, token, get_settings().password_reset_ttl_minutes
        )
    return PasswordResetRequestOut(message=RESET_ANSWER)


@router.post("/password/reset", status_code=204)
@auth_limit
def password_reset(
    request: Request, payload: PasswordResetIn, db: Session = Depends(get_db)
) -> None:
    """Redeem the mailed token and set a new password.

    The token is checked before the password is judged, so a caller cannot use this
    route to learn which passwords the policy would accept without holding a link.
    Redeeming it ends every session and the browser handshake: a reset is how somebody
    recovers an account another person may still be holding, and a way in that survives
    it would make the reset a formality. Google and Clerk are identities rather than
    sessions and stay attached — the person who controls that provider still controls
    the account.
    """
    digest = passwords.reset_token_hash(payload.token)
    user = db.scalars(
        select(User)
        .where(User.password_reset_hash == digest, User.is_active.is_(True))
        .limit(1)
    ).first()
    now = datetime.now(timezone.utc)
    if (
        user is None
        or user.password_reset_used_at is not None
        or user.password_reset_expires_at is None
        or user.password_reset_expires_at <= now
    ):
        raise RESET_LINK_INVALID

    problem = passwords.password_problem(payload.password, user.login_email or "")
    if problem:
        raise HTTPException(status_code=422, detail=problem)

    user.password_hash = passwords.hash_password(payload.password)
    user.password_updated_at = now
    user.password_reset_used_at = now
    user.password_reset_hash = None
    user.password_reset_expires_at = None
    user.failed_login_count = 0
    user.locked_until = None
    user.device_hash = None
    db.execute(delete(AuthToken).where(AuthToken.user_id == user.id))
    db.commit()


@router.get("/me", response_model=SessionOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SessionOut:
    # An empty token on purpose: this reads the session that is already in the cookie or
    # the header, it does not hand out a second one.
    return session_for(db, user, "")


@router.post("/refresh", response_model=RefreshOut)
def refresh(
    request: Request,
    response: Response,
    record: AuthToken = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> RefreshOut:
    """Extend this session's expiry, up to the ceiling that sign-in was given.

    It is not a way to get a session — it needs one to work, and it returns the token
    unchanged, because minting a fresh token here would leave the old one either live or
    revoked by accident, and both of those are worse than a boring answer. The point is
    that a page which is open for a long time can ask, quietly, and the child keeps
    working; a page that stops asking loses the session a day later.

    The cookie is written again with whatever expiry the session ended up with. A session
    that rolls while its cookie stays put is one the browser stops presenting at the very
    moment the server decided to keep it, and the child would be signed out by a clock
    nobody can see.
    """
    before = record.expires_at
    renewed = renew_session(db, record)
    # Only a browser that authenticates by cookie has a jar to keep in step. A caller that
    # named its credential in a header is not being signed out by an expiry it can see.
    held = session_cookie_value(request)
    if held is not None:
        attach_session_cookie(request, response, held, expires_at=renewed.expires_at)
    # `expires_at` is what a screen reads when it wants to warn about a sign-in running
    # out. `extended` is compared against the expiry as it was *before* the call, because
    # `renew_session` hands back the same row it was given: asking the object whether it
    # moved always answers no. At the ceiling `extended` is the whole answer — nothing
    # happened, and the app should say so rather than pretending the session is fresh.
    return RefreshOut(
        expires_at=renewed.expires_at,
        extended=renewed.expires_at > before,
        session_started_at=renewed.created_at,
    )


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    token: str = Depends(get_raw_token),
    db: Session = Depends(get_db),
) -> None:
    """Sign out really ends the session on the server, not only in the browser.

    Both halves are needed and neither is enough alone. Deleting the row means the
    credential cannot be used again by anybody, even its owner; expiring the cookie means
    this browser stops offering it, so a later stranger at the same keyboard is not handed
    a token that only just stopped working.
    """
    revoke_session(db, token)
    clear_session_cookie(request, response)


@router.get("/methods", response_model=SignInMethodsOut)
def sign_in_methods(user: User = Depends(get_current_user)) -> SignInMethodsOut:
    """Which doors open this account, read from the row rather than from the client.

    Settings shows this so "connected with Google" is a fact from the database, not a
    local flag that could disagree with the server after an unlink on another device.
    """
    return SignInMethodsOut(
        device=bool(user.device_hash),
        google=bool(user.google_sub),
        email=bool(user.login_email or user.clerk_user_id),
    )


@router.patch("/profile", response_model=ProfileOut)
def update_profile(
    payload: ProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    student_id = user.id
    if user.role == "parent":
        link = db.scalars(
            select(Guardianship)
            .where(Guardianship.parent_id == user.id, active_link_clause())
            .limit(1)
        ).first()
        if not link:
            raise HTTPException(status_code=404, detail="No linked child profile found.")
        student_id = link.student_id

    profile = db.get(StudentProfile, student_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found.")

    data = payload.model_dump(exclude_unset=True)
    if "display_name" in data and data["display_name"]:
        student = db.get(User, student_id)
        if student and student.role == "student":
            student.display_name = data.pop("display_name")
        else:
            data.pop("display_name")
    for key, value in data.items():
        setattr(profile, key, value)
    if profile.age is not None:
        # The band follows the number rather than the other way round. `age_range`
        # is what the guide's framework and a portal's summary read, so it has to
        # say the same thing about this child that the child said themselves.
        profile.age_range = band_for_age(profile.age)
    elif "age" in data:
        # The number was taken back, so anything derived only from it goes too. The
        # class is the one other thing a band may legitimately come from, so a student
        # who answers both keeps the band their class implies rather than a stray one.
        profile.age_range = (
            CLASS_TO_AGE.get(profile.class_level) if profile.class_level else None
        )
    elif profile.class_level and not profile.age_range:
        profile.age_range = CLASS_TO_AGE.get(profile.class_level)
    db.commit()
    db.refresh(profile)
    saved = ProfileOut.model_validate(profile)
    saved.profile_photo_url = photo_url(db, student_id)
    return saved


@router.patch("/settings", response_model=SettingsOut)
def update_settings(
    payload: SettingsIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SettingsOut:
    settings = ensure_settings(db, user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return SettingsOut.model_validate(settings)


@router.get("/consent", response_model=list[ConsentOut])
def list_consent(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ConsentOut]:
    records = list(
        db.scalars(
            select(ConsentRecord).where(ConsentRecord.user_id == user.id).order_by(ConsentRecord.id)
        )
    )
    return [ConsentOut.model_validate(r) for r in records]


@router.post("/consent", response_model=ConsentOut)
def set_consent(
    payload: ConsentIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConsentOut:
    record = db.scalars(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == user.id, ConsentRecord.scope == payload.scope)
        .order_by(ConsentRecord.id.desc())
        .limit(1)
    ).first()
    if record is None:
        record = ConsentRecord(user_id=user.id, scope=payload.scope)
        db.add(record)
    record.granted = payload.granted
    if payload.scope == "history_sharing":
        # The switch on the privacy screen says withdrawal stops the parent's dashboard.
        # That promise is kept here rather than left to the family screen: a link that
        # was approved becomes revoked at this moment, and every parent route that
        # resolves a child stops finding one. Pending requests are cleared too — the
        # student has said no family sharing, and a queued request should not outlive it.
        if payload.granted:
            record.note = "The student allowed linked guardians to see the exploration summary."
        else:
            record.note = "The student withdrew family sharing. Every guardian link was ended."
            if user.role == "student":
                for link in db.scalars(
                    select(Guardianship).where(
                        Guardianship.student_id == user.id,
                        Guardianship.consent_withdrawn_at.is_(None),
                    )
                ):
                    link.consent_withdrawn_at = utcnow()
                    link.share_conversation_transcripts = False
    db.commit()
    db.refresh(record)
    return ConsentOut.model_validate(record)


# ------------------------------------------------------- parent / student linking


@router.get("/share-code", response_model=ShareCodeOut)
def get_share_code(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ShareCodeOut:
    """The student's own code. Nothing happens until they choose to hand it over."""
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only a student account has a sharing code.")
    profile = db.get(StudentProfile, user.id)
    if profile is None or not profile.share_code:
        return ShareCodeOut(
            code=None,
            note=(
                "A new code can be generated when you are ready to invite a parent "
                "or guardian."
            ),
        )
    return ShareCodeOut(
        code=profile.share_code,
        note=(
            "Share this only with a parent or guardian you choose. They will see the "
            "summary you allow, never your conversations, unless you turn that on."
        ),
    )


@router.post("/share-code/new", response_model=ShareCodeOut)
def rotate_share_code(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ShareCodeOut:
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only a student account has a sharing code.")
    profile = db.get(StudentProfile, user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="No student profile was found.")
    profile.share_code = new_share_code(db)
    db.commit()
    db.refresh(profile)
    return ShareCodeOut(
        code=profile.share_code,
        note="The previous code stopped working the moment this one was created.",
    )


@router.delete("/share-code", response_model=ShareCodeOut)
def revoke_share_code(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ShareCodeOut:
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only a student account has a sharing code.")
    profile = db.get(StudentProfile, user.id)
    if profile is None:
        raise HTTPException(status_code=404, detail="No student profile was found.")
    profile.share_code = None
    db.commit()
    return ShareCodeOut(
        code=None,
        note=(
            "Sharing code switched off. Links your student already approved stay linked "
            "until you remove them below."
        ),
    )


@router.post("/link-child", response_model=list[GuardianOut])
@auth_limit
def link_child(
    request: Request,
    payload: LinkChildIn,
    user: User = Depends(require_parent),
    db: Session = Depends(get_db),
) -> list[GuardianOut]:
    """Ask to join a student profile, using a code the student gave out.

    Knowing a name, an address or an account id gets a caller nowhere: the code is the
    only value this route will accept. Redeeming it creates a *request*; the student
    approves it in Family Access, and only then does any parent route resolve the child.
    """
    code = payload.code.strip().upper()
    profile = db.scalars(select(StudentProfile).where(StudentProfile.share_code == code)).first()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="That code did not match any profile. Ask your child to open Settings and share a new one.",
        )
    existing = db.scalars(
        select(Guardianship).where(
            Guardianship.parent_id == user.id, Guardianship.student_id == profile.user_id
        )
    ).first()
    if existing is None:
        db.add(
            Guardianship(
                parent_id=user.id,
                student_id=profile.user_id,
                relationship=payload.relationship,
                # Transcripts stay private until the student says otherwise.
                share_conversation_transcripts=False,
            )
        )
        db.commit()
    elif existing.status == "revoked":
        # One row per pair, so a renewed request reuses it rather than breaking the
        # unique rule. It goes back to pending: an earlier withdrawal is not consent.
        existing.consent_granted_at = None
        existing.consent_withdrawn_at = None
        existing.share_conversation_transcripts = False
        if payload.relationship:
            existing.relationship = payload.relationship
        db.commit()
    return list_guardians(user=user, db=db)


def _guardian_out(link: Guardianship, name: str) -> GuardianOut:
    active = link.is_active
    return GuardianOut(
        guardianship_id=link.id,
        name=name,
        relationship=link.relationship,
        status=link.status,
        consented_at=link.consent_granted_at,
        withdrawn_at=link.consent_withdrawn_at,
        can_see_summary=active,
        can_see_transcripts=active and link.share_conversation_transcripts,
        linked_at=link.created_at,
    )


@router.get("/guardians", response_model=list[GuardianOut])
def list_guardians(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[GuardianOut]:
    """For a student: which adults asked, which are approved, and what each one sees."""
    if user.role == "student":
        rows = list(
            db.scalars(
                select(Guardianship)
                .where(Guardianship.student_id == user.id)
                .order_by(Guardianship.id)
            )
        )
        out = []
        for link in rows:
            parent = db.get(User, link.parent_id)
            if parent is None:
                continue
            out.append(_guardian_out(link, parent.display_name))
        return out
    children = list(
        db.scalars(
            select(Guardianship)
            .where(Guardianship.parent_id == user.id)
            .order_by(Guardianship.id)
        )
    )
    out = []
    for link in children:
        child = db.get(User, link.student_id)
        if child is None:
            continue
        out.append(_guardian_out(link, child.display_name))
    return out


@router.post("/guardians/{guardianship_id}/approve", response_model=GuardianOut)
def approve_guardian_link(
    guardianship_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GuardianOut:
    """The student's own approval is what turns a request into sharing."""
    link = db.get(Guardianship, guardianship_id)
    if link is None or user.role != "student" or link.student_id != user.id:
        raise HTTPException(status_code=404, detail="That link was not found for this account.")
    link.consent_granted_at = utcnow()
    link.consent_withdrawn_at = None
    record = db.scalars(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == user.id, ConsentRecord.scope == "history_sharing")
        .order_by(ConsentRecord.id.desc())
        .limit(1)
    ).first()
    if record is None:
        record = ConsentRecord(user_id=user.id, scope="history_sharing")
        db.add(record)
    record.granted = True
    record.note = "The student approved a guardian link in Family Access."
    db.commit()
    db.refresh(link)
    parent = db.get(User, link.parent_id)
    return _guardian_out(link, parent.display_name if parent else "Guardian")


@router.delete("/guardians/{guardianship_id}", status_code=204)
def remove_guardian_link(
    guardianship_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Either side can break the link. The student always keeps control."""
    link = db.get(Guardianship, guardianship_id)
    if link is None or (user.role == "student" and link.student_id != user.id) or (
        user.role == "parent" and link.parent_id != user.id
    ):
        raise HTTPException(status_code=404, detail="That link was not found for this account.")
    db.delete(link)
    db.commit()


@router.patch("/guardians/{guardianship_id}/transcripts", response_model=GuardianOut)
def set_transcript_sharing(
    guardianship_id: int,
    payload: TranscriptSharingIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GuardianOut:
    """Only the student may open or close their own conversation transcripts."""
    link = db.get(Guardianship, guardianship_id)
    if link is None or link.student_id != user.id or user.role != "student":
        raise HTTPException(status_code=404, detail="That link was not found for this account.")
    if not link.is_active:
        raise HTTPException(
            status_code=409,
            detail=(
                "This link is waiting for your approval. Approve it in Family Access "
                "before choosing what the guardian may see."
            ),
        )
    link.share_conversation_transcripts = payload.share_transcripts
    db.commit()
    db.refresh(link)
    parent = db.get(User, link.parent_id)
    return _guardian_out(link, parent.display_name if parent else "Guardian")
