"""Onboarding, session tokens, profile, settings, consent and parent linking."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    AuthToken,
    ConsentRecord,
    Guardianship,
    StudentProfile,
    User,
    UserSettings,
)
from ..schemas import (
    ConsentIn,
    ConsentOut,
    GuardianOut,
    LinkChildIn,
    OnboardingIn,
    ProfileIn,
    ProfileOut,
    SessionOut,
    SettingsIn,
    SettingsOut,
    ShareCodeOut,
    TranscriptSharingIn,
    UserOut,
)
from ..security import (
    ensure_settings,
    get_current_user,
    get_raw_token,
    issue_token,
    require_parent,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Must stay inside the consent age bands the frontend offers, so a class choice
# and a stored age range are the same vocabulary.
CLASS_TO_AGE = {
    "class-3": "9-10",
    "class-4": "9-10",
    "class-5": "9-10",
    "class-6": "11-12",
    "class-7": "11-12",
    "class-8": "11-12",
    "class-9": "adult",
    "class-10": "adult",
    "class-11": "adult",
    "class-12": "adult",
}

# No look-alike characters, because this is read out loud or typed by a child.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


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


@router.post("/onboarding", response_model=SessionOut)
def onboarding(payload: OnboardingIn, db: Session = Depends(get_db)) -> SessionOut:
    if not payload.consent_profile:
        raise HTTPException(
            status_code=400,
            detail=(
                "We need permission from a parent or guardian before storing a child's "
                "profile. Please confirm the consent box to continue."
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
    db.commit()

    token = issue_token(db, user.id)
    return SessionOut(
        token=token,
        user=UserOut.model_validate(user),
        profile=_profile_payload(db, student_id),
        settings=_settings_payload(db, user.id),
    )


@router.get("/me", response_model=SessionOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SessionOut:
    student_id = user.id
    if user.role == "parent":
        link = db.scalars(
            select(Guardianship).where(Guardianship.parent_id == user.id).limit(1)
        ).first()
        student_id = link.student_id if link else 0

    return SessionOut(
        token="",
        user=UserOut.model_validate(user),
        profile=_profile_payload(db, student_id) if student_id else None,
        settings=_settings_payload(db, user.id),
    )


@router.post("/logout", status_code=204)
def logout(token: str = Depends(get_raw_token), db: Session = Depends(get_db)) -> None:
    """Sign out really ends the session on the server, not only in the browser."""
    record = db.get(AuthToken, token)
    if record is not None:
        db.delete(record)
        db.commit()


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
    if profile.class_level and not profile.age_range:
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
def link_child(
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
