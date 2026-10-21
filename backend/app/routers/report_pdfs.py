"""The downloadable PDF of a student's questionnaires.

Three things are decided here rather than in the renderer.

The document is stored, not streamed. A family who loses the download should get
the same file back without paying for a second render, and the only place to keep
it that the rest of this app already deletes correctly is the database — the
deployed backend has no disk that survives a request, and a folder of PDFs beside
the answers would be a copy of a child's data that no delete path knows about.

The cache is checked against what the student has finished, not against a
timestamp. A stored report is only reused while it holds exactly the results that
exist now; finish a second questionnaire and the next request renders a document
that includes it.

And the download is behind the same bearer token as everything else. `download_path`
in the response is therefore not a URL that works in an address bar — the browser
fetches the bytes and shows itself a temporary object URL. A report left open in a
shared laptop's browser history would be a leak this app has promised not to have.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Assessment, PdfReport, Result, User
from ..schemas import PdfGenerateIn, PdfReportOut
from ..security import get_current_user, require_student
from ..services import entitlements, pdf_report

router = APIRouter(prefix="/api/reports", tags=["pdf reports"])

NO_RESULT = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="This questionnaire has no result to print yet. Submit it first.",
)

NOT_OWNED = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="That report does not belong to this account, or it is no longer here.",
)

RENDER_FAILED = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail=(
        "The PDF could not be built on this server right now. The result on screen "
        "is unaffected — nothing here needs the file to be read."
    ),
)


def _chrome(language: str | None) -> str:
    """Which language the page is printed in. Hinglish prints Hindi, as it does on screen."""
    return "hi" if language in ("hi", "hinglish") else "en"


def _anchor(db: Session, student_id: int, assessment_id: int) -> Result:
    """The sitting named in the request, resolved to its result and checked for ownership."""
    sitting = db.get(Assessment, assessment_id)
    if sitting is None or sitting.user_id != student_id:
        raise NOT_OWNED
    result = db.scalars(select(Result).where(Result.assessment_id == sitting.id)).first()
    if result is None:
        raise NO_RESULT
    return result


def _finished_ids(db: Session, student_id: int) -> set[int]:
    return set(db.scalars(select(Result.id).where(Result.user_id == student_id)))


def _out(row: PdfReport, generated: bool) -> PdfReportOut:
    return PdfReportOut(
        id=row.id,
        result_id=row.anchor_result_id,
        filename=row.filename,
        language=row.language,
        size_bytes=row.size_bytes,
        generated_at=row.generated_at,
        result_ids=list(row.result_ids or []),
        download_path=f"/api/reports/pdf/{row.id}",
        generated=generated,
    )


@router.post("/generate", response_model=PdfReportOut)
def generate(
    payload: PdfGenerateIn,
    response: Response,
    user: User = Depends(get_current_user),
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> PdfReportOut:
    """201 when a document was rendered, 200 when the stored one is still correct.

    A cached answer is not a creation, and reporting it as one would tell the caller
    the file is fresher than it is.
    """
    language = _chrome(payload.language)
    anchor = _anchor(db, student_id, payload.assessment_id)
    current = _finished_ids(db, student_id)

    stored = db.scalars(
        select(PdfReport).where(
            PdfReport.student_id == student_id,
            PdfReport.language == language,
            PdfReport.is_deleted.is_(False),
        )
    ).first()
    if stored is not None and set(stored.result_ids or []) == current:
        return _out(stored, generated=False)

    # Gated here, after the cache above has had its chance, on purpose. A document that
    # already exists holds this student's own finished answers, so it stays theirs to
    # fetch whatever their plan is — see the download and delete routes, which are not
    # gated at all. What a free plan does not get is a *new* render, which is the thing
    # the paid plan was sold as.
    entitlements.guard_feature(
        db, user, "pdf_reports", "Making a printable report of your finished assessments"
    )

    try:
        pdf, meta = pdf_report.generate(db, student_id, anchor, language)
    except Exception:  # noqa: BLE001 — the render must never leak its internals
        raise RENDER_FAILED from None

    # One row per language, rewritten in place: a second copy of the same answers
    # would be a second thing to delete, and the delete path only knows about one.
    row = stored or PdfReport(student_id=student_id, anchor_result_id=anchor.id, language=language)
    row.anchor_result_id = anchor.id
    row.filename = meta["filename"]
    row.result_ids = meta["result_ids"]
    row.pdf_bytes = pdf
    row.size_bytes = len(pdf)
    row.generated_at = meta["generated_at"]
    row.is_deleted = False
    db.add(row)
    db.commit()
    db.refresh(row)
    response.status_code = status.HTTP_201_CREATED
    return _out(row, generated=True)


@router.get("/pdf", response_model=list[PdfReportOut])
def list_reports(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> list[PdfReportOut]:
    rows = db.scalars(
        select(PdfReport)
        .where(PdfReport.student_id == student_id, PdfReport.is_deleted.is_(False))
        .order_by(PdfReport.id.desc())
    )
    return [_out(row, generated=False) for row in rows]


def _own(db: Session, report_id: int, student_id: int) -> PdfReport:
    row = db.get(PdfReport, report_id)
    if row is None or row.student_id != student_id or row.is_deleted:
        raise NOT_OWNED
    return row


@router.get("/pdf/{report_id}")
def download(
    report_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> Response:
    row = _own(db, report_id, student_id)
    return Response(
        content=row.pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{row.filename}"'},
    )


@router.delete("/pdf/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    report_id: int,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> None:
    """Gone from the list and gone from the database, not merely hidden."""
    row = _own(db, report_id, student_id)
    db.delete(row)
    db.commit()
