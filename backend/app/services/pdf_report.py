"""The PDF a student downloads after finishing a questionnaire.

Pages: cover, summary, one chart page per questionnaire the student has actually
completed, careers, next steps. `assessment_id` in the request only chooses which
sitting the report is about — the document then carries every other finished
questionnaire too, because a report with one shape in it is a weaker report, and
because the alternative was three PDFs for one student.

Two things are deliberately *not* here. Nothing is read from disk at render time
(the bytes go straight from the database to the response), and no raw answer is
copied into the document: the PDF carries the same scored summary the screen
shows, produced by the same `result_payload()` the screen calls, so the two can
never disagree about what a child said.

Hindi is the reason `pdf_theme` exists. Drawing a Devanagari string without a
shaper leaves every conjunct split with a visible halant, which is legible to no
one; the styles in `pdf_theme` all set `shaping=1`, and every piece of text in
this module goes through a `Paragraph`, never `drawString`, so that holds.
"""

from __future__ import annotations

import io
import json
import math
import pathlib
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen import canvas as rl_canvas
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Result, StudentProfile, User
from . import assessment_bank, pdf_theme, scoring

PAGE_W, PAGE_H = A4
MARGIN = 44
FOOTER_H = 46
BAND_H = 90
CONTENT_W = PAGE_W - 2 * MARGIN
# A label drawn beside a chart vertex gets a box this wide; the text inside it is
# aligned to whichever side of the vertex the label sits on.
LABEL_BOX_W = 96.0

LOGO_PATH = pathlib.Path(__file__).resolve().parents[2] / "assets" / "brand-logo.png"
COPY_PATH = pathlib.Path(__file__).resolve().parents[2] / "data" / "report_copy.json"

# The instrument names come from the bank; these are the short labels used when a
# report lists which questionnaires it holds.
INSTRUMENT_ORDER = ("interest", "personality", "aptitude")


@lru_cache
def _copy() -> dict[str, dict[str, str]]:
    return json.loads(COPY_PATH.read_text(encoding="utf-8"))["strings"]


def copy(key: str, language: str, **fields: Any) -> str:
    """One of the report's own strings, in the language the student reads in.

    A missing translation falls back to English rather than failing the download —
    the same rule the interface dictionary follows, where `HI[en] ?? en`.
    """
    entry = _copy().get(key)
    if entry is None:
        text = key
    elif language == "hi":
        text = entry.get("hi") or entry["en"]
    else:
        text = entry["en"]
    return text.format(**fields) if fields else text


def safe(value: Any) -> str:
    """Escape a value before it is interpolated into a paragraph.

    Every string in this module reaches ReportLab as paragraph markup, because that
    is the only path that shapes Hindi. A student name containing `&`, or a career
    title containing `<`, would otherwise be read as markup and either fail the
    render or move text off the page.
    """
    return escape(str(value))


def date_text(value: datetime | None) -> str:
    if value is None:
        return "—"
    return value.strftime("%d %b %Y")


# --------------------------------------------------------------- the data pass


def _student_line(db: Session, student_id: int) -> tuple[str, str]:
    """The two facts a cover carries: who it is for, and the class they said they are in.

    `class_level` is stored as an interface token (`class-9`) and the row it lands in
    is already labelled "Class" / "कक्षा", so the paper wants the bare number — a
    printed page is kept by a family, not parsed by the app.
    """
    student = db.get(User, student_id)
    profile = db.get(StudentProfile, student_id)
    name = (student.display_name if student else "") or "(anonymous)"
    raw = (profile.class_level if profile else None) or ""
    number = raw.replace("class-", "")
    return name, number if number.isdigit() else "—"


def collect(db: Session, student_id: int, anchor: Result, language: str) -> dict:
    """Everything the page needs, gathered once, in the reading language."""
    from ..routers.assessments import result_payload

    rows = list(
        db.scalars(
            select(Result)
            .where(Result.user_id == student_id)
            .order_by(Result.completed_at.desc(), Result.id.desc())
        )
    )
    # The anchored sitting leads, then whatever else this student has finished.
    ordered = [anchor] + [row for row in rows if row.id != anchor.id]
    payloads = [result_payload(db, row, language) for row in ordered]

    taken = {payload.assessment_type for payload in payloads}
    not_taken = [
        scoring.pick(assessment_bank.instrument(kind)["name"], language)
        for kind in INSTRUMENT_ORDER
        if kind not in taken
    ]

    # Merge the per-instrument suggestions by slug, keeping the best-ranked first
    # occurrence, so a career the interest result pointed at outranks one the
    # aptitude puzzles happened to touch.
    merged: dict[str, dict] = {}
    for payload in payloads:
        for career in payload.careers:
            merged.setdefault(career["slug"], {**career, "from": payload.name})
    careers = list(merged.values())[:6]

    name, klass = _student_line(db, student_id)
    return {
        "language": language,
        "student_name": name,
        "class_level": klass,
        "anchor_result_id": anchor.id,
        "result_ids": [payload.result_id for payload in payloads],
        "generated_at": datetime.now(timezone.utc),
        "title": payloads[0].name,
        "item_language": payloads[0].item_language,
        "completed_at": payloads[0].completed_at,
        "payloads": payloads,
        "careers": careers,
        "career_note": payloads[0].career_note,
        "not_taken": not_taken,
    }


def _next_steps(data: dict) -> list[str]:
    language = data["language"]
    steps: list[str] = []

    for payload in data["payloads"]:
        for entry in payload.traits:
            if entry["score"] is not None:
                continue
            need = max(1, scoring.MIN_ANSWERED - entry["answered"])
            steps.append(
                copy(
                    "{area} has no number yet — {count} more answers there would change that.",
                    language,
                    area=entry["name"],
                    count=need,
                )
            )
            break  # one nudge per questionnaire, not one per empty area

    if data["careers"]:
        steps.append(
            copy(
                "Read what one of these careers is actually like: {career}.",
                language,
                career=data["careers"][0]["title"],
            )
        )

    steps.append(copy("Talk to your AI Guide about anything on these pages.", language))
    steps.append(
        copy(
            "Check fees, entry requirements and dates on an official website before "
            "planning around anything here.",
            language,
        )
    )
    if data["not_taken"]:
        steps.append(
            copy("Not taken yet: {names}.", language, names=", ".join(data["not_taken"]))
        )
        steps.append(
            copy(
                "Take the other questionnaires when you feel like it. Three shapes say "
                "more than one.",
                language,
            )
        )
    steps.append(
        copy(
            "Re-read this in a month. Interests move, and a page that no longer fits is "
            "useful information.",
            language,
        )
    )
    return steps[:7]


# ---------------------------------------------------------------- the radar


class Radar:
    """The scored areas as a polygon. A plain object, wrapped in a Flowable below.

    Axes with no score are not drawn. A missing answer is not a zero, and a shape
    that dropped a vertex to the centre would read as "this student is weak here".
    """

    def __init__(self, axes: list[tuple[str, int]], size: float = 240.0):
        self.axes = axes
        self.size = size

    def vertices(self, cx: float, cy: float, radius: float, scale: float = 1.0):
        out = []
        n = len(self.axes)
        for index, (_, score) in enumerate(self.axes):
            angle = -math.pi / 2 + 2 * math.pi * index / n
            r = radius * (score / 100.0) * scale
            out.append((cx + r * math.cos(angle), cy + r * math.sin(angle), angle))
        return out

    def ring(self, cx: float, cy: float, radius: float, fraction: float):
        n = len(self.axes)
        return [
            (
                cx + radius * fraction * math.cos(-math.pi / 2 + 2 * math.pi * i / n),
                cy + radius * fraction * math.sin(-math.pi / 2 + 2 * math.pi * i / n),
            )
            for i in range(n)
        ]


_ALIGNMENTS = {"start": TA_LEFT, "middle": TA_CENTER, "end": TA_RIGHT}


def _anchored(name: str, parent: ParagraphStyle) -> dict[str, ParagraphStyle]:
    """One style per horizontal anchor, so a box can be aligned to a point."""
    return {
        key: ParagraphStyle(f"cg-{name}-{key}", parent=parent, alignment=alignment)
        for key, alignment in _ALIGNMENTS.items()
    }


# The chart's labels are drawn beside a vertex, so the only honest way to place
# them is a paragraph in a fixed box, aligned to whichever side of the point the
# text belongs on. `drawString` cannot shape Hindi, and a Devanagari area name is
# exactly one of these labels.
_ALIGNED = _anchored("label", pdf_theme.LABEL)
_TINY_ALIGNED = _anchored("tiny", pdf_theme.TINY)


def _align_for(cos: float) -> str:
    if cos > 0.25:
        return "start"
    if cos < -0.25:
        return "end"
    return "middle"


def _para(
    canv: rl_canvas.Canvas,
    x: float,
    y: float,
    text: str,
    style: ParagraphStyle,
    anchor: str,
    width: float = LABEL_BOX_W,
) -> None:
    """Draw `text` in a box whose left / centre / right edge sits at (x, y)."""
    box = Paragraph(safe(text), style)
    _, height = box.wrap(width, None)
    left = {"start": 0.0, "end": -width, "middle": -width / 2}[anchor]
    box.drawOn(canv, x + left, y - height / 2)


class RadarFlowable(Flowable):
    """ReportLab's flowable half: it asks for room and paints itself when told.

    The geometry lives in `Radar`; this class only reserves the box and draws it.
    """

    def __init__(self, axes: list[tuple[str, int]], width: float = CONTENT_W, height: float = 300.0):
        super().__init__()
        self.shape = Radar(axes, size=min(width, height))
        self.width = width
        self.height = height

    def wrap(self, avail_width: float, avail_height: float):
        self.width = min(self.width, avail_width)
        return self.width, self.height

    def draw(self):
        c = self.canv
        cx = self.width / 2
        cy = self.height / 2 + 4
        radius = min(self.width / 2 - LABEL_BOX_W, self.height / 2 - 30)

        for fraction in (0.25, 0.5, 0.75, 1.0):
            points = self.shape.ring(cx, cy, radius, fraction)
            path = c.beginPath()
            path.moveTo(*points[0])
            for point in points[1:]:
                path.lineTo(*point)
            path.close()
            c.setStrokeColor(pdf_theme.LINE)
            c.setLineWidth(0.7)
            c.setFillColor(colors.white)
            c.drawPath(path, stroke=1, fill=fraction == 0.25)

        for index in range(len(self.shape.axes)):
            angle = -math.pi / 2 + 2 * math.pi * index / len(self.shape.axes)
            c.setStrokeColor(pdf_theme.LINE)
            c.setLineWidth(0.7)
            c.line(cx, cy, cx + radius * math.cos(angle), cy + radius * math.sin(angle))

        points = self.shape.vertices(cx, cy, radius)
        poly = c.beginPath()
        poly.moveTo(*points[0][:2])
        for point in points[1:]:
            poly.lineTo(*point[:2])
        poly.close()
        c.setFillColor(pdf_theme.BRAND_MIST)
        c.setFillAlpha(0.72)
        c.setStrokeColor(pdf_theme.BRAND)
        c.setLineWidth(1.8)
        c.drawPath(poly, stroke=1, fill=1)
        c.setFillAlpha(1.0)

        for (x, y, _angle), (_label, score) in zip(points, self.shape.axes):
            c.setFillColor(pdf_theme.BRAND_DARK)
            c.circle(x, y, 2.6, stroke=0, fill=1)

        for index, (label, score) in enumerate(self.shape.axes):
            angle = -math.pi / 2 + 2 * math.pi * index / len(self.shape.axes)
            cos, sin = math.cos(angle), math.sin(angle)
            anchor = _align_for(cos)
            x = cx + (radius + 16) * cos
            y = cy + (radius + 16) * sin
            _para(c, x, y + 6, label, _ALIGNED[anchor], anchor)
            _para(c, x, y - 12, f"{score}/100", _TINY_ALIGNED[anchor], anchor)


# ---------------------------------------------------------------- the pages


def _p(text: Any, style: ParagraphStyle) -> Paragraph:
    """A paragraph of plain text — escaped, because ReportLab reads markup."""
    return Paragraph(safe(text), style)


def _instrument_names(data: dict) -> str:
    return " · ".join(payload.name for payload in data["payloads"])


def _cover_table(data: dict) -> Table:
    language = data["language"]
    asked_in = copy("Hindi" if data["item_language"] == "hi" else "English", language)
    rows = [
        (copy("Prepared for", language), data["student_name"]),
        (copy("Class", language), data["class_level"]),
        (copy("Date of the questionnaire", language), date_text(data["completed_at"])),
        (copy("Date this PDF was made", language), date_text(data["generated_at"])),
        (copy("Questionnaires in this report", language), _instrument_names(data)),
        (copy("What this is", language), copy("A self-questionnaire, not a diagnosis", language)),
        (copy("Questions were asked in", language), asked_in),
    ]
    table = Table(
        [[_p(a, pdf_theme.LABEL), _p(b, pdf_theme.BODY)] for a, b in rows],
        colWidths=[160, CONTENT_W - 160],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("LINEBELOW", (0, 0), (-1, -2), 0.6, pdf_theme.LINE),
            ]
        )
    )
    return table


def _contents(data: dict) -> Table:
    language = data["language"]
    items = [
        (copy("Summary", language), copy("How much you answered", language)),
        (copy("The shape of each answer set", language), _instrument_names(data)),
        (copy("Careers worth a look", language), str(len(data["careers"]))),
        (copy("Next steps", language), str(len(_next_steps(data)))),
    ]
    table = Table(
        [
            [
                _p(f"{index + 1}.", pdf_theme.LABEL),
                _p(name, pdf_theme.LABEL),
                _p(detail, pdf_theme.SMALL),
            ]
            for index, (name, detail) in enumerate(items)
        ],
        colWidths=[18, 190, CONTENT_W - 208],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def _area_table(payloads: list, language: str) -> Table:
    """One row per scored area, grouped by the questionnaire it belongs to.

    Used twice: the summary page holds every questionnaire, a chart page holds the
    one it is drawing, so the number beside a shape and the number inside it are
    the same number.
    """
    header = [
        copy("Area", language),
        copy("Score", language),
        copy("How it reads", language),
        copy("Answered", language),
    ]
    rows: list[list] = [[_p(cell, pdf_theme.CELL_HEAD) for cell in header]]
    group_rows: list[int] = []
    for payload in payloads:
        group_rows.append(len(rows))
        rows.append([_p(payload.name, pdf_theme.LABEL), "", "", ""])
        for entry in payload.traits:
            score = (
                copy("No number yet", language)
                if entry["score"] is None
                else f"{entry['score']}/100"
            )
            rows.append(
                [
                    _p(entry["name"], pdf_theme.CELL),
                    _p(score, pdf_theme.CELL),
                    _p(entry["band_label"], pdf_theme.CELL),
                    _p(f"{entry['answered']}/{entry['total']}", pdf_theme.CELL),
                ]
            )

    commands: list[tuple] = [
        ("BACKGROUND", (0, 0), (-1, 0), pdf_theme.NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, pdf_theme.LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for row in group_rows:
        commands.append(("SPAN", (0, row), (-1, row)))
        commands.append(("BACKGROUND", (0, row), (-1, row), pdf_theme.CANVAS))

    table = Table(rows, colWidths=[190, 85, 150, 62], repeatRows=1)
    table.setStyle(TableStyle(commands))
    return table


def _chart_block(payload, language: str) -> list:
    scored = [
        (entry["name"], entry["score"])
        for entry in payload.traits
        if entry["score"] is not None
    ]
    out: list = [
        _p(copy("{name}: your shape", language, name=payload.name), pdf_theme.H2),
        Spacer(1, 2),
    ]
    if len(scored) >= 3:
        out.append(
            _p(
                copy(
                    "One line per area. Longer means more of your strongest answers fell in "
                    "that area.",
                    language,
                ),
                pdf_theme.BODY,
            )
        )
        out.append(Spacer(1, 6))
        out.append(RadarFlowable(scored))
        out.append(Spacer(1, 4))
        out.append(
            _p(
                copy(
                    "Areas with no number are left out of the shape rather than drawn as zero.",
                    language,
                ),
                pdf_theme.SMALL,
            )
        )
        out.append(Spacer(1, 10))
        out.append(_p(copy("Every area, with its number", language), pdf_theme.H3))
        out.append(Spacer(1, 4))
        out.append(_area_table([payload], language))
    else:
        out.append(
            _p(
                copy(
                    "Not enough areas are scored yet for a shape, so each area is listed on its "
                    "own.",
                    language,
                ),
                pdf_theme.BODY,
            )
        )
        out.append(Spacer(1, 8))
        out.append(_area_table([payload], language))
    out.append(Spacer(1, 10))
    out.append(_p(copy("What these numbers are not", language), pdf_theme.H3))
    out.append(Spacer(1, 2))
    for caveat in payload.caveats:
        out.append(_p(f"• {caveat}", pdf_theme.SMALL))
    return out


def _career_table(data: dict) -> Table:
    language = data["language"]
    rows: list[list] = [
        [
            _p(copy("Career", language), pdf_theme.CELL_HEAD),
            _p(copy("It came from", language), pdf_theme.CELL_HEAD),
            _p(copy("Status", language), pdf_theme.CELL_HEAD),
        ]
    ]
    for career in data["careers"]:
        rows.append(
            [
                Paragraph(
                    f"<b>{safe(career['title'])}</b>"
                    f"<br/><font size=8 color='#64748b'>{safe(career['category'])}</font>",
                    pdf_theme.CELL,
                ),
                _p(career["from"], pdf_theme.CELL),
                _p(
                    copy(
                        "Sample data — verify"
                        if career["needs_verification"]
                        else "Verified source",
                        language,
                    ),
                    pdf_theme.CELL,
                ),
            ]
        )
    table = Table(rows, colWidths=[247, 130, 130], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), pdf_theme.NAVY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.5, pdf_theme.LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, pdf_theme.LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, pdf_theme.CANVAS]),
            ]
        )
    )
    return table


def story(data: dict) -> list:
    language = data["language"]
    pages: list = [
        Spacer(1, 62),
        _p(data["title"], pdf_theme.H1),
        Spacer(1, 6),
        _p(copy("Career report", language), pdf_theme.LEDE),
        Spacer(1, 16),
        _cover_table(data),
        Spacer(1, 16),
        _p(copy("Inside this report", language), pdf_theme.H3),
        Spacer(1, 4),
        _contents(data),
        Spacer(1, 16),
        _p(
            copy(
                "This report holds one student's own answers to a questionnaire they chose "
                "to take. It is not a diagnosis, an IQ score, a rank or a prediction about "
                "a future. Only the practice puzzles were marked right or wrong, and those "
                "say more about practice than about ability.",
                language,
            ),
            pdf_theme.SMALL,
        ),
        PageBreak(),
    ]

    # ---------------------------------------------------------------- summary
    pages += [_p(copy("Summary", language), pdf_theme.H2), Spacer(1, 4)]
    for payload in data["payloads"]:
        totals = payload.totals
        line = copy(
            "{answered} of {total} questions answered ({percent}%)",
            language,
            answered=totals.get("answered", 0),
            total=totals.get("items", 0),
            percent=totals.get("completeness", 0),
        )
        pages.append(
            KeepTogether([_p(payload.name, pdf_theme.H3), _p(line, pdf_theme.BODY)])
        )
        if totals.get("ignored"):
            pages.append(
                _p(
                    copy(
                        "{count} answers could not be scored and were left out.",
                        language,
                        count=totals["ignored"],
                    ),
                    pdf_theme.SMALL,
                )
            )
        pages.append(Spacer(1, 8))

    if data["not_taken"]:
        pages.append(
            KeepTogether(
                [
                    _p(copy("Not in this report", language), pdf_theme.H3),
                    _p(
                        copy("Not taken yet: {names}.", language, names=", ".join(data["not_taken"])),
                        pdf_theme.BODY,
                    ),
                ]
            )
        )
        pages.append(Spacer(1, 8))

    pages.append(_p(copy("What each area came back as", language), pdf_theme.H3))
    pages.append(Spacer(1, 4))
    pages.append(_area_table(data["payloads"], language))
    pages.append(PageBreak())

    # ---------------------------------------------------------------- charts
    for index, payload in enumerate(data["payloads"]):
        pages += _chart_block(payload, language)
        if index < len(data["payloads"]) - 1:
            pages.append(PageBreak())
    pages.append(PageBreak())

    # --------------------------------------------------------------- careers
    pages.append(_p(copy("Careers worth a look", language), pdf_theme.H2))
    pages.append(Spacer(1, 4))
    if data["careers"]:
        pages.append(_p(data["career_note"], pdf_theme.BODY))
        pages.append(Spacer(1, 8))
        pages.append(_career_table(data))
        pages.append(Spacer(1, 8))
        pages.append(
            _p(
                copy(
                    "These are starting points to read about, not admissions advice. Nothing "
                    "here predicts that you will get in, or that you will like it.",
                    language,
                ),
                pdf_theme.SMALL,
            )
        )
        if language == "hi":
            pages.append(Spacer(1, 4))
            pages.append(
                _p(
                    copy(
                        "Career names are printed in English: the catalogue has no Hindi "
                        "titles, and the app translates them on screen.",
                        language,
                    ),
                    pdf_theme.SMALL,
                )
            )
    else:
        pages.append(
            _p(
                copy(
                    "No careers are listed because no area had enough answers to point at "
                    "one. That is a normal result of doing only a few questions.",
                    language,
                ),
                pdf_theme.BODY,
            )
        )
    pages.append(PageBreak())

    # ------------------------------------------------------------ next steps
    pages.append(_p(copy("Next steps", language), pdf_theme.H2))
    pages.append(Spacer(1, 6))
    for step in _next_steps(data):
        pages.append(_p(f"• {step}", pdf_theme.BODY))
        pages.append(Spacer(1, 3))
    pages.append(Spacer(1, 18))
    pages.append(_p(copy("Where this file lives", language), pdf_theme.H3))
    pages.append(Spacer(1, 3))
    pages.append(
        _p(
            copy(
                "This PDF is stored on the server so you can download it again. It belongs "
                "to the account that answered the questionnaire, and deleting that result "
                "deletes this file. Nothing in it is sent to a school, an institute or an "
                "advertiser.",
                language,
            ),
            pdf_theme.SMALL,
        )
    )
    pages.append(Spacer(1, 4))
    pages.append(
        _p(
            copy(
                "No support email or postal address is set up for this build yet — the "
                "contact page says so plainly.",
                language,
            ),
            pdf_theme.SMALL,
        )
    )
    return pages


# ------------------------------------------------------------- page furniture


def _numbered_canvas(data: dict):
    """A canvas class that paints the furniture once it knows the page count.

    "Page 2 of 6" needs the total, which nobody has until the last page is drawn, so
    the pages are held and their footers added on the way out. The brand band is
    drawn only on the first page: it would sit on top of the summary otherwise, and
    the story reserves room for it there and nowhere else.
    """
    settings = get_settings()
    language = data["language"]

    class Numbered(rl_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.held: list[dict] = []

        def showPage(self):  # noqa: N802 — ReportLab's method name
            self.held.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self.held)
            for index, state in enumerate(self.held):
                self.__dict__.update(state)
                self._furniture(total, first=index == 0)
                super().showPage()
            super().save()

        def _furniture(self, total: int, first: bool):
            if first:
                self.setFillColor(pdf_theme.NAVY)
                self.rect(0, PAGE_H - BAND_H, PAGE_W, BAND_H, stroke=0, fill=1)
                self.drawImage(
                    str(LOGO_PATH),
                    MARGIN,
                    PAGE_H - 68,
                    width=34,
                    height=34,
                    mask="auto",
                    preserveAspectRatio=True,
                )
                self.setFillColor(colors.white)
                self.setFont(pdf_theme.BOLD, 13)
                self.drawString(MARGIN + 44, PAGE_H - 52, "CareerGuide AI")
                self.setFillColor(pdf_theme.BRAND_LIGHT)
                self.setFont(pdf_theme.REGULAR, 8.5)
                self.drawString(
                    MARGIN + 44, PAGE_H - 64, settings.public_site_url.replace("https://", "")
                )

            self.setStrokeColor(pdf_theme.LINE)
            self.setLineWidth(0.6)
            self.line(MARGIN, 34, PAGE_W - MARGIN, 34)

            _para(
                self,
                MARGIN,
                26,
                copy("Corrections and questions: {repo}", language, repo=settings.public_repo_url),
                _TINY_ALIGNED["start"],
                "start",
                width=CONTENT_W - 120,
            )
            _para(
                self,
                PAGE_W - MARGIN,
                26,
                copy("Page {page} of {total}", language, page=self.getPageNumber(), total=total),
                _TINY_ALIGNED["end"],
                "end",
                width=110,
            )

    return Numbered


def build_pdf(data: dict) -> bytes:
    buffer = io.BytesIO()
    pdf_theme.register_fonts()

    document = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=FOOTER_H,
        # The file itself is the student's; the account name is not metadata, since
        # a PDF picked up from a shared laptop travels further than the app does.
        title="CareerGuide AI — career report",
        author="CareerGuide AI",
        subject="A self-questionnaire summary, not a diagnosis",
        creator="CareerGuide AI",
    )
    document.addPageTemplates(
        [
            PageTemplate(
                id="page",
                frames=[
                    Frame(
                        MARGIN,
                        FOOTER_H,
                        CONTENT_W,
                        PAGE_H - MARGIN - FOOTER_H,
                        leftPadding=0,
                        rightPadding=0,
                        topPadding=0,
                        bottomPadding=0,
                    )
                ],
            )
        ]
    )
    document.build(story(data), canvasmaker=_numbered_canvas(data))
    return buffer.getvalue()


def filename_for(data: dict) -> str:
    """Named for what it is, not for the sitting the button was pressed on.

    The document holds every finished questionnaire, so naming it after one of them
    would be a claim about its contents that is usually false — and a family keeping
    two languages of it needs the two files to read differently.
    """
    return f"careerguide-report-{data['language']}.pdf"


def generate(db: Session, student_id: int, anchor: Result, language: str) -> tuple[bytes, dict]:
    """One call, one PDF, plus the metadata worth storing beside it."""
    data = collect(db, student_id, anchor, language)
    return build_pdf(data), {
        "result_ids": data["result_ids"],
        "language": language,
        "filename": filename_for(data),
        "generated_at": data["generated_at"],
    }
