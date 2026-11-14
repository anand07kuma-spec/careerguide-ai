"""The one photo an account may show beside its name.

Three routes, and none of them takes an account id: the row is always the caller's own,
resolved from the session by `require_student`. That is the whole of the authorisation
story — there is no parameter through which a request could name somebody else's
picture, so "replace my photo" cannot be turned into "replace theirs" by editing a URL.

The bytes are held in `profile_photos` behind an authenticated read rather than at a
public address, which is why `ProfileOut.profile_photo_url` says *where* to ask rather
than making the picture linkable. The frontend fetches it with the same cookie and
in-memory token every other call uses.

Replacement is an UPDATE of this account's row, committed only after the new image has
been validated and re-encoded. A rejected upload therefore leaves the saved photo
exactly as it was, and there is never a moment where an old picture has been deleted
and a new one has not yet arrived.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import photo_limit
from ..models import ProfilePhoto, StudentProfile
from ..schemas import ProfileOut
from ..security import require_student
from ..services.profile_photos import (
    MAX_UPLOAD_BYTES,
    PhotoRejected,
    normalize,
    photo_url,
)

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _profile_out(db: Session, student_id: int) -> ProfileOut:
    profile = db.get(StudentProfile, student_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    saved = ProfileOut.model_validate(profile)
    saved.profile_photo_url = photo_url(db, student_id)
    return saved


@router.post("/photo", response_model=ProfileOut)
@photo_limit
async def upload_photo(
    request: Request,
    photo: UploadFile = File(...),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> ProfileOut:
    """Take a photo from a device and keep the normalised square.

    The read is capped one byte past the limit rather than reading the file and then
    measuring it, so an oversized upload never occupies more than that in memory. The
    true format comes from decoding the bytes; the browser's filename and content type
    are hints this route does not act on.
    """
    raw = await photo.read(MAX_UPLOAD_BYTES + 1)
    await photo.close()

    try:
        normalized = normalize(raw)
    except PhotoRejected as rejected:
        raise HTTPException(status_code=rejected.status_code, detail=str(rejected)) from None

    row = db.get(ProfilePhoto, student_id)
    if row is None:
        row = ProfilePhoto(user_id=student_id)
        db.add(row)

    row.content_type = normalized.content_type
    row.image = normalized.image
    row.width = normalized.width
    row.height = normalized.height
    row.byte_size = normalized.byte_size
    row.updated_at = datetime.now(timezone.utc)
    db.commit()

    return _profile_out(db, student_id)


@router.get("/photo")
def read_photo(
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> Response:
    """This account's saved photo, behind the session that owns it.

    `private` keeps a shared laptop's browser from serving the picture to the next
    person to use it, and the version on the URL means a replaced photo is fetched
    rather than answered from a cache that only knows the old one.
    """
    row = db.get(ProfilePhoto, student_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No profile photo has been saved yet.")
    return Response(
        content=row.image,
        media_type=row.content_type,
        headers={
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'inline; filename="profile-photo.jpg"',
        },
    )


@router.delete("/photo", response_model=ProfileOut)
def remove_photo(
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> ProfileOut:
    """Delete the row, which is also the only copy of the bytes.

    Removing a photo that is not there is not an error: the answer is the same profile
    a second press would produce, so a double press cannot leave the screen saying
    something different from the database.
    """
    row = db.get(ProfilePhoto, student_id)
    if row is not None:
        db.delete(row)
        db.commit()
    return _profile_out(db, student_id)
