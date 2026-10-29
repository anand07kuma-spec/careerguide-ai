"""Test the PDF report: its own words, its renderer, its routes and its storage.

Three things here matter more than the page layout.

The bytes live in a database column, so every path that reads a student's data has
to keep working when the file is there — and deleting the answer must delete the
document with it, because a PDF of a child's questionnaire that outlives their
request to be forgotten is exactly the leak this app promises not to have.

The Hindi is not decoration. A Devanagari string drawn without a shaper arrives as
correct Unicode and renders as broken text, so the suite checks the shaper is
configured and would rather fail the request than print that page.

And the cache is checked against what the student has actually finished, so a
report generated before a second questionnaire is never served afterwards as though
it were current.

The page images themselves are looked at by `scripts/report_pdf_render.py`, which
needs a PDF rasteriser; this file stays inside the app's own dependencies.

Runs against a throwaway database, never `careerguide.db`.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/report_pdf_test.py
"""

from __future__ import annotations

import ast
import json
import os
import pathlib
import re
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import _console  # noqa: E402,F401 -- utf-8 stdout, see _console.py

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_report_pdf_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py

import logging  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

logging.disable(logging.INFO)

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Assessment, PdfReport, Result  # noqa: E402
from app.services import pdf_report, pdf_theme  # noqa: E402

PASS, FAIL = [], []


def check(label: str, condition, detail: str = "") -> None:
    (PASS if condition else FAIL).append(label)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {label}{(' — ' + str(detail)[:180]) if detail and not condition else ''}")


# Written with escapes, not with the characters themselves: a class like
# `[\u3400-\u4e00-\u9fff]` silently turns the middle hyphen into literal text,
# which then reports every English sentence containing a dash as foreign script.
DEVANAGARI = re.compile("[\u0900-\u097f]")
# Hiragana and katakana, CJK ideographs, Hangul, and full-width punctuation.
STRAY = re.compile("[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef]")
# A long-s ligature in ordinary English is what HarfBuzz's default `liga`/`dlig`
# features do to this font; the theme turns those two off and keeps kerning.
LONG_S = re.compile("[\ufb00-\ufb06]")

print("\n=== 1. the report's own words")

copy_path = ROOT / "data" / "report_copy.json"
strings = json.loads(copy_path.read_text(encoding="utf-8"))["strings"]
check("the copy file parses", bool(strings))
check("every entry has both languages", all({"en", "hi"} <= set(value) for value in strings.values()))
check("…and neither is empty",
      all(value["en"].strip() and value["hi"].strip() for value in strings.values()))
check("the English values are English",
      not any(DEVANAGARI.search(value["en"]) for value in strings.values()),
      [key for key, value in strings.items() if DEVANAGARI.search(value["en"])])
check("no text from a script this app never speaks",
      not any(STRAY.search(value["hi"]) or STRAY.search(value["en"]) for value in strings.values()),
      [key for key, value in strings.items() if STRAY.search(value["hi"] + value["en"])])
check("the keys are the English text, so a missing translation is visible in code",
      all(key == value["en"] or "{" in key for key, value in strings.items()),
      [key for key, value in strings.items() if key != value["en"] and "{" not in key])

source = (ROOT / "app" / "services" / "pdf_report.py").read_text(encoding="utf-8")


def copy_keys(node):
    """Every literal this file asks the copy table for, read from the syntax tree.

    A regex over the source cannot do this: several of the keys are long sentences
    written as adjacent literals over two lines, and a pattern sees only their
    first line — which then looks like an unauthored string.
    """
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return [node.value]
    if isinstance(node, ast.IfExp):
        return copy_keys(node.body) + copy_keys(node.orelse)
    return []


used = {
    key
    for node in ast.walk(ast.parse(source))
    if isinstance(node, ast.Call)
    and getattr(node.func, "id", None) == "copy"
    and node.args
    for key in copy_keys(node.args[0])
}
check("every string the renderer asks for is authored", used <= set(strings), sorted(used - set(strings)))
check("…and nothing authored is left unused", set(strings) <= used, sorted(set(strings) - used))

placeholders = {
    key: set(re.findall(r"\{(\w+)\}", value["en"])) != set(re.findall(r"\{(\w+)\}", value["hi"]))
    for key, value in strings.items()
}
check("a translation never gains or loses a placeholder",
      not any(placeholders.values()), [key for key, bad in placeholders.items() if bad])

check("copy() returns the asked-for language", pdf_report.copy("Summary", "hi") == "सारांश")
check("…and English by default", pdf_report.copy("Summary", "en") == "Summary")
check("…filling in its placeholders",
      pdf_report.copy("Page {page} of {total}", "en", page=2, total=6) == "Page 2 of 6")
check("an unauthored key reads as itself rather than crashing the download",
      pdf_report.copy("Nothing here", "en") == "Nothing here")
check("escaping reaches the page: an ampersand in a name stays an ampersand",
      pdf_report.safe("A & B <c>") == "A &amp; B &lt;c&gt;")

print("\n=== 2. the shaper is switched on, because Hindi has no other way")

from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.pdfbase import ttfonts  # noqa: E402
from reportlab.platypus.paraparser import ParaFrag  # noqa: E402

pdf_theme.register_fonts()
check("uharfbuzz is importable, which is what makes ReportLab shape at all",
      ttfonts.uharfbuzz is not None)
check("the three Mukta weights are registered",
      all(name in ttfonts.pdfmetrics._fonts for name in (pdf_theme.REGULAR, pdf_theme.SEMIBOLD, pdf_theme.BOLD)))
check("every style the report draws with asks for shaping",
      all(style.shaping for style in vars(pdf_theme).values() if isinstance(style, ParagraphStyle)),
      [style.name for style in vars(pdf_theme).values()
       if isinstance(style, ParagraphStyle) and not style.shaping])
check("…including the anchored styles built inside the renderer",
      all(style.shaping for style in pdf_report._ALIGNED.values()))
check("the font's own file carries Devanagari",
      pdf_theme.FONT_DIR.exists() and any(p.suffix == ".ttf" for p in pdf_theme.FONT_DIR.iterdir()))
check("…with the licence that allows shipping it", (pdf_theme.FONT_DIR / "OFL.txt").exists())
check("the brand logo travelled with the backend", pdf_report.LOGO_PATH.exists())

FRAG = ParaFrag(text="x", fontName=pdf_theme.REGULAR, fontSize=12_000, shape=1)


def shaped(text: str, **features) -> str:
    """The glyph string the shaper hands ReportLab for one word of the report font.

    With no features it uses the ones `pdf_theme` installed, so the checks below run
    down the real path rather than a set chosen here.
    """
    kwargs = {} if not features else {"features": features}
    word = ttfonts.shapeFragWord([None, (FRAG, text)], force=True, **kwargs)
    return "".join(str(item[1]) for item in word[1:])


# The theme edits `shapeFragWord`'s own default feature dict, because that mutable
# default is the only lever the paragraph path gives.
check("the shaper is set to kerning with both ligature features named off",
      (ttfonts.shapeFragWord.__defaults__ or (None,))[0]
      == {"kern": True, "liga": False, "dlig": False},
      ttfonts.shapeFragWord.__defaults__)

WORD = "प्रश्नावली"
collapse = shaped(WORD)
check("a Hindi word leaves as fewer glyphs than it has codepoints, so its conjuncts joined",
      0 < len(collapse) < len(WORD), (len(WORD), len(collapse), collapse))
check("…and English keeps its own letters on that same setting",
      shaped("installments") == "installments" and shaped("office") == "office",
      (shaped("installments"), shaped("office")))
check("…which is worth asking for: left to itself the shaper ligates",
      LONG_S.search(shaped("office", liga=True)) is not None, shaped("office", liga=True))

print("\n=== 3. the routes")


def student(client: TestClient, device: str, klass: str) -> dict:
    created = client.post(
        "/api/auth/onboarding",
        json={
            "role": "student",
            "display_name": "Aarav & Co <test>",
            "preferred_language": "en",
            "class_level": klass,
            "consent_profile": True,
            "consent_age": "11-12",
            "device_id": device,
        },
    )
    assert created.status_code == 200, created.text
    return {"Authorization": f"Bearer {created.json()['token']}"}


def sit(client: TestClient, headers: dict, kind: str, language: str, skip: int = 0) -> dict:
    started = client.post(f"/api/assessments/{kind}/start", headers=headers, json={"language": language})
    assert started.status_code == 200, started.text
    session_id = started.json()["assessment_id"]
    items = client.get(f"/api/assessments/session/{session_id}/questions", headers=headers).json()["items"]
    for index, item in enumerate(items[: len(items) - skip]):
        if item["response_type"] == "choice":
            options = item["options"]
            value = str(options[(index + 1) % len(options)]["value"])
        else:
            value = str([5, 4, 3, 2, 1][index % 5])
        answer = client.post(
            f"/api/assessments/session/{session_id}/answer",
            headers=headers,
            json={"code": item["code"], "value": value},
        )
        assert answer.status_code == 200, answer.text
    submitted = client.post(
        f"/api/assessments/session/{session_id}/submit", headers=headers, json={"language": language}
    )
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


with TestClient(app) as client:
    first = student(client, "aaaa1111bbbb2222cccc3333dddd4444", "class-9")
    other = student(client, "eeee5555ffff6666gggg7777hhhh8888", "class-9")
    guardian = client.post(
        "/api/auth/onboarding",
        json={
            "role": "parent",
            "display_name": "Ma",
            "preferred_language": "en",
            "consent_profile": True,
            "consent_age": "adult",
        },
    )
    assert guardian.status_code == 200, guardian.text
    parent = {"Authorization": f"Bearer {guardian.json()['token']}"}

    interest = sit(client, first, "interest", "en")
    assessment_id = interest["assessment_id"]

    # No header and no cookie. The client has been given a session cookie by the
    # onboarding above, so the jar has to be emptied or both of these are signed-in reads.
    client.cookies.clear()
    check("a request with no token is turned away",
          client.post("/api/reports/generate", json={"assessment_id": assessment_id}).status_code == 401)
    check("…and so is a download", client.get("/api/reports/pdf/1").status_code == 401)
    check("a parent account is not handed a child's report",
          client.post("/api/reports/generate", headers=parent,
                      json={"assessment_id": assessment_id}).status_code == 403)
    check("an assessment that is not this student's is a 404",
          client.post("/api/reports/generate", headers=other,
                      json={"assessment_id": assessment_id}).status_code == 404)

    unfinished = client.post("/api/assessments/personality/start", headers=first, json={"language": "en"}).json()
    not_submitted = client.post("/api/reports/generate", headers=first,
                                json={"assessment_id": unfinished["assessment_id"]})
    check("a sitting with no result cannot be printed, and says why",
          not_submitted.status_code == 409 and "Submit it first" in not_submitted.json()["detail"],
          not_submitted.text)

    made = client.post("/api/reports/generate", headers=first, json={"assessment_id": assessment_id})
    check("a student can have their report built", made.status_code == 201, made.text)
    body = made.json()
    report_id = body.get("id")
    check("…and is told it was generated just now", body.get("generated") is True, body)
    check("the file is named for what it holds, not for where the button was pressed",
          body.get("filename") == "careerguide-report-en.pdf", body.get("filename"))
    check("the size stored is the size of the file", body.get("size_bytes", 0) > 20_000, body.get("size_bytes"))
    check("the response carries no bytes", "pdf_bytes" not in json.dumps(body), body.keys())
    check("the download path is the documented one",
          body.get("download_path") == f"/api/reports/pdf/{report_id}", body.get("download_path"))
    check("the report holds every finished result", body.get("result_ids") == [interest["result_id"]], body)

    again = client.post("/api/reports/generate", headers=first, json={"assessment_id": assessment_id})
    second = again.json()
    check("asking twice does not render twice", again.status_code == 200 and second["generated"] is False, second)
    check("…and hands back the same document",
          second["id"] == report_id and second["size_bytes"] == body["size_bytes"], second)

    file_response = client.get(f"/api/reports/pdf/{report_id}", headers=first)
    check("the download is a PDF, not JSON",
          file_response.headers["content-type"].startswith("application/pdf"),
          file_response.headers.get("content-type"))
    raw = file_response.content
    check("…whose bytes are a real PDF", raw[:5] == b"%PDF-" and raw[-6:].startswith(b"%%EOF"), raw[:8])
    check("…the length the metadata promised", len(raw) == body["size_bytes"], (len(raw), body["size_bytes"]))
    check("…named for the student's own instrument",
          f'filename="{body["filename"]}"' in file_response.headers["content-disposition"],
          file_response.headers.get("content-disposition"))
    pages = max((int(m) for m in re.findall(rb"/Count (\d+)", raw)), default=0)
    check("…and runs to a multi-page document", 5 <= pages <= 9, pages)

    listed = client.get("/api/reports/pdf", headers=first).json()
    check("the student's own list holds it", len(listed) == 1 and listed[0]["id"] == report_id, listed)
    check("the list never carries the file", "pdf_bytes" not in json.dumps(listed))
    check("another student's list is empty", client.get("/api/reports/pdf", headers=other).json() == [])
    check("…and cannot read the file by guessing its id",
          client.get(f"/api/reports/pdf/{report_id}", headers=other).status_code == 404)
    missing = client.get("/api/reports/pdf/987654", headers=first)
    foreign = client.get(f"/api/reports/pdf/{report_id}", headers=other)
    check("a report that is not yours and a report that never existed answer the same",
          (missing.status_code, missing.json()["detail"]) == (foreign.status_code, foreign.json()["detail"]),
          (missing.status_code, missing.json(), foreign.json()))

    # A second questionnaire changes what the document should contain, so the cached
    # file stops being the right answer.
    personality = sit(client, first, "personality", "en")
    invalidated = client.post("/api/reports/generate", headers=first,
                             json={"assessment_id": assessment_id}).json()
    check("finishing another questionnaire invalidates the stored report",
          invalidated["generated"] is True and invalidated["id"] == report_id, invalidated)
    check("…in the same row rather than a second copy",
          client.get("/api/reports/pdf", headers=first).json().__len__() == 1)
    check("…and the document now names both results",
          set(invalidated["result_ids"]) == {interest["result_id"], personality["result_id"]},
          invalidated["result_ids"])

    # The button exists on every result page, and the document is the same one
    # whichever of them it was pressed on.
    from_elsewhere = client.post(
        "/api/reports/generate", headers=first, json={"assessment_id": personality["assessment_id"]}
    )
    check("asking from another questionnaire's result gives that same file back",
          from_elsewhere.status_code == 200
          and from_elsewhere.json()["id"] == report_id
          and from_elsewhere.json()["generated"] is False,
          from_elsewhere.text)
    check("…so three result pages do not store three copies of a child's answers",
          len(client.get("/api/reports/pdf", headers=first).json()) == 1)

    hindi = client.post("/api/reports/generate", headers=first,
                        json={"assessment_id": assessment_id, "language": "hi"})
    check("the same student can hold the same report in Hindi",
          hindi.status_code == 201 and hindi.json()["language"] == "hi", hindi.text)
    check("…as a separate document", hindi.json()["id"] != report_id)
    hinglish = client.post("/api/reports/generate", headers=first,
                          json={"assessment_id": assessment_id, "language": "hinglish"}).json()
    check("Hinglish prints in Hindi, as it does on screen", hinglish["language"] == "hi", hinglish)
    check("…and reuses that document rather than rendering a third",
          hinglish["generated"] is False and hinglish["id"] == hindi.json()["id"], hinglish)

    with SessionLocal() as db:
        row = db.get(PdfReport, report_id)
        # The row was rewritten when the second questionnaire invalidated it, so this
        # is a fresh download rather than the bytes from earlier in the run.
        current_bytes = client.get(f"/api/reports/pdf/{report_id}", headers=first).content
        check("the bytes live in the database", row is not None and bytes(row.pdf_bytes) == current_bytes,
              None if row is None else len(row.pdf_bytes))
        check("…with the result ids the document was built from",
              sorted(row.result_ids) == sorted(invalidated["result_ids"]), row.result_ids)
        check("…and no stray file was written beside them",
              not list(ROOT.glob("*.pdf")) and not (ROOT / "reports").exists())
        printed_name, printed_class = pdf_report._student_line(
            db, db.get(Assessment, assessment_id).user_id
        )
        check("the cover prints the class as a number, not as the interface's token",
              printed_class.isdigit(), printed_class)
        check("…and the name reaches the page as written, ampersand and angle brackets included",
              printed_name == "Aarav & Co <test>", printed_name)

    deleted = client.delete(f"/api/reports/pdf/{hindi.json()['id']}", headers=first)
    check("a student can delete their own report", deleted.status_code == 204, deleted.text)
    check("…and it is gone from the list",
          [item["id"] for item in client.get("/api/reports/pdf", headers=first).json()] == [report_id])
    check("…and gone from the download route, not just the list",
          client.get(f"/api/reports/pdf/{hindi.json()['id']}", headers=first).status_code == 404)
    check("deleting someone else's file is refused",
          client.delete(f"/api/reports/pdf/{report_id}", headers=other).status_code == 404)

    with SessionLocal() as db:
        # SQLite ignores ON DELETE until a connection is told to honour it; Postgres
        # never needs telling. This is the same switch `migration_test` uses, so the
        # check is about the DDL rather than about a database that was never asked.
        db.connection().exec_driver_sql("PRAGMA foreign_keys=ON")
        sitting = db.get(Assessment, assessment_id)
        db.delete(sitting)
        db.commit()
        check("deleting the questionnaire deletes the printed report built from it",
              db.scalars(select(PdfReport)).first() is None)
        left = list(db.scalars(select(Result)))
        check("…and its own answers, while a questionnaire still sitting stays",
              [row.assessment_id for row in left] == [personality["assessment_id"]],
              [row.assessment_id for row in left])

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
