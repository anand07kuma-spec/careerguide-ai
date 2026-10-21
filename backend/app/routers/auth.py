"""Onboarding, sign-in, session tokens, profile, settings, consent and parent linking."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import auth_limit, guest_limit
from ..models import (
    AuthToken,
    ConsentRecord,
    Guardianship,
    StudentProfile,
    User,
    UserSettings,
)
from ..schemas import (
    ComebackCodeOut,
    ComebackStatusOut,
    ConsentIn,
    ConsentOut,
    GuardianOut,
    GuestIn,
    GuestOut,
    LinkChildIn,
    LoginIn,
    OnboardingIn,
    ProfileIn,
    ProfileOut,
    RefreshOut,
    SessionOut,
    SettingsIn,
    SettingsOut,
    ShareCodeOut,
    TranscriptSharingIn,
    UserOut,
)
from ..services.profile_facts import band_for_age
from ..security import (
    CODE_ALPHABET,
    attach_session_cookie,
    clear_session_cookie,
    device_hash_of,
    device_owner,
    ensure_settings,
    find_account_by_code,
    format_code,
    get_current_session,
    get_current_user,
    get_raw_token,
    issue_token,
    renew_session,
    require_parent,
    revoke_session,
    set_code_for,
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


def new_share_code(db: Session) -> str:
    for _ in range(25):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        taken = db.scalars(
            select(StudentProfile.user_id).where(StudentProfile.share_code == code)
        ).first()
        if not taken:
            return code
    raise HTTPException(status_code=500, detail="Could not create a sharing code. Please try again.")


def _profile_payload(db: Session, student_id: int) -> ProfileOut | None:
    profile = db.get(StudentProfile, student_id)
    return ProfileOut.model_validate(profile) if profile else None


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

    `token` is passed in rather than issued here, because the three callers are
    genuinely different: a device arriving for the first time and a come-back code
    each deserve a new session, while `GET /me` re-reads a session that already
    exists and must not quietly mint a second token nobody asked for.
    """
    student_id = _linked_student_id(db, user)
    return SessionOut(
        token=token,
        user=UserOut.model_validate(user),
        profile=_profile_payload(db, student_id) if student_id else None,
        settings=_settings_payload(db, user.id),
    )


def _linked_student_id(db: Session, user: User) -> int:
    """Whose profile this account acts on: a student's own, a parent's one child."""
    if user.role != "parent":
        return user.id
    link = db.scalars(
        select(Guardianship).where(Guardianship.parent_id == user.id).limit(1)
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
        # A parent account is created alongside the child profile it supports.
        child_name = (payload.student_name or "").strip() or "My child"
        student = User(
            role="student",
            display_name=child_name,
            preferred_language=payload.preferred_language,
        )
        db.add(student)
        db.flush()
        user = parent
        student_id = student.id
        parent_id = parent.id
        db.add(
            Guardianship(
                parent_id=parent.id,
                student_id=student.id,
                relationship=payload.relationship,
            )
        )

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

    # No come-back code is minted here: this account is reached by the device that
    # made it, which is the point of running without a password.
    return SessionOut(
        token=start_session(request, response, db, user),
        user=UserOut.model_validate(user),
        profile=_profile_payload(db, student_id),
        settings=_settings_payload(db, user.id),
    )


@router.post("/login", response_model=SessionOut)
@auth_limit
def login(
    request: Request,
    response: Response,
    payload: LoginIn,
    db: Session = Depends(get_db),
) -> SessionOut:
    """Sign an existing account back in with its come-back code.

    Without this, signing out — or simply switching browser or phone — left no way
    back into an account that still held a child's profile on the server.
    """
    user = find_account_by_code(db, payload.code)
    # A code is how a device that has never been here joins an account, so it also
    # binds that device — which is what makes the next page load a return rather than a
    # second typing-out of a fifteen-character code. A device that already has its own
    # account is left alone: taking it over would silently move somebody else's child.
    if payload.device_id and user.device_hash is None:
        claim = device_owner(db, payload.device_id)
        if claim is None:
            user.device_hash = device_hash_of(payload.device_id)
    return session_for(db, user, start_session(request, response, db, user))


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


@router.get("/comeback-code", response_model=ComebackStatusOut)
def comeback_code_status(
    user: User = Depends(get_current_user),
) -> ComebackStatusOut:
    """Whether an account can sign in elsewhere yet. The code itself is unreadable."""
    if user.comeback_hash:
        return ComebackStatusOut(
            has_code=True,
            note=(
                "A code was created for this account and shown once. Only an "
                "unreadable check of it is stored, so it cannot be displayed again. "
                "Creating a new code switches the old one off."
            ),
        )
    return ComebackStatusOut(
        has_code=False,
        note=(
            "This account has no come-back code yet, so it can only be opened in the "
            "browser it was created in. Creating one lets you sign in again after "
            "clearing your browser data or changing device."
        ),
    )


@router.post("/comeback-code", response_model=ComebackCodeOut)
def create_comeback_code(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ComebackCodeOut:
    """Mint or replace the account's sign-in code. Shown once, then only as a digest."""
    return ComebackCodeOut(
        code=format_code(set_code_for(db, user)),
        note=(
            "Keep this code somewhere safe — anyone who has it can open this account, "
            "so do not share it. The previous code stopped working now."
        ),
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
            select(Guardianship).where(Guardianship.parent_id == user.id).limit(1)
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
    return ProfileOut.model_validate(profile)


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
            "Sharing code switched off. Families already linked stay linked until you "
            "remove them below."
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
    """A parent joins a student profile only by using a code the student gave them."""
    code = payload.code.strip().upper()
    profile = db.scalars(select(StudentProfile).where(StudentProfile.share_code == code)).first()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="That code did not match any profile. Ask your child to open Settings and share a new one.",
        )
    exists = db.scalars(
        select(Guardianship).where(
            Guardianship.parent_id == user.id, Guardianship.student_id == profile.user_id
        )
    ).first()
    if exists is None:
        db.add(
            Guardianship(
                parent_id=user.id,
                student_id=profile.user_id,
                relationship=payload.relationship,
                # Transcripts stay private until the student says otherwise.
                share_conversation_transcripts=False,
            )
        )
        db.add(
            ConsentRecord(
                user_id=profile.user_id,
                scope="history_sharing",
                granted=False,
                note="A guardian was linked by code. Conversation sharing is off by default.",
            )
        )
        db.commit()
    return list_guardians(user=user, db=db)


@router.get("/guardians", response_model=list[GuardianOut])
def list_guardians(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[GuardianOut]:
    """For a student: which adults can see this profile, and what each one sees."""
    if user.role == "student":
        rows = list(
            db.scalars(
                select(Guardianship).where(Guardianship.student_id == user.id)
            )
        )
        out = []
        for link in rows:
            parent = db.get(User, link.parent_id)
            if parent is None:
                continue
            out.append(
                GuardianOut(
                    guardianship_id=link.id,
                    name=parent.display_name,
                    relationship=link.relationship,
                    can_see_summary=True,
                    can_see_transcripts=link.share_conversation_transcripts,
                    linked_at=link.created_at,
                )
            )
        return out
    children = list(
        db.scalars(select(Guardianship).where(Guardianship.parent_id == user.id))
    )
    out = []
    for link in children:
        child = db.get(User, link.student_id)
        if child is None:
            continue
        out.append(
            GuardianOut(
                guardianship_id=link.id,
                name=child.display_name,
                relationship=link.relationship,
                can_see_summary=True,
                can_see_transcripts=link.share_conversation_transcripts,
                linked_at=link.created_at,
            )
        )
    return out


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
    link.share_conversation_transcripts = payload.share_transcripts
    db.commit()
    db.refresh(link)
    parent = db.get(User, link.parent_id)
    return GuardianOut(
        guardianship_id=link.id,
        name=parent.display_name if parent else "Guardian",
        relationship=link.relationship,
        can_see_summary=True,
        can_see_transcripts=link.share_conversation_transcripts,
        linked_at=link.created_at,
    )
