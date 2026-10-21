"""The assessment item bank: authored as JSON, mirrored into the database.

`data/assessment_questions.json` is the single authored source, because 75
questions in two languages is content, not code. The same rows are loaded into
the `assessment_questions` table so a sitting keeps the exact wording and scoring
metadata it was answered against, even after the file is edited.

`correct_value` is the answer key of the puzzle set. Nothing in this module hands
it to a client — see `app/routers/assessments.py`, which builds question payloads
field by field.
"""

from __future__ import annotations

import json
import pathlib
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Question

DATA_PATH = pathlib.Path(__file__).resolve().parents[2] / "data" / "assessment_questions.json"

TYPES = ("interest", "personality", "aptitude")

# The bank ships two registers. Hinglish is a register for conversation, where the
# model can write freely in it; a fixed questionnaire needs a reviewed translation,
# so a Hinglish session reads the English items inside Hindi chrome.
ITEM_LANGUAGES = ("en", "hi")


@lru_cache
def bank() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def version() -> str:
    return str(bank()["version"])


def instruments() -> dict[str, dict]:
    return {item["type"]: item for item in bank()["instruments"]}


def instrument(assessment_type: str) -> dict:
    return instruments()[assessment_type]


def note() -> dict:
    return bank()["note"]


def scale() -> list[dict]:
    return bank()["scale"]["likert"]


def items(assessment_type: str) -> list[dict]:
    return sorted(
        (item for item in bank()["items"] if item["type"] == assessment_type),
        key=lambda item: item["order"],
    )


def ensure_bank(db: Session) -> int:
    """Insert any bank item that is not in the table yet. Safe to call on every request."""
    existing = {
        (assessment_type, code)
        for assessment_type, code in db.execute(
            select(Question.assessment_type, Question.code)
        ).all()
    }
    added = 0
    for item in bank()["items"]:
        if (item["type"], item["code"]) in existing:
            continue
        db.add(
            Question(
                assessment_type=item["type"],
                code=item["code"],
                dimension=item["dimension"],
                order=item["order"],
                response_type=item.get("response_type") or instrument(item["type"])["response"],
                keyed=item.get("keyed", "+"),
                text_en=item["text"]["en"],
                text_hi=item["text"]["hi"],
                options_json=item.get("options", []),
                correct_value=item.get("answer"),
            )
        )
        added += 1
    if added:
        db.commit()
    return added


def questions_for(db: Session, assessment_type: str) -> list[Question]:
    """The bank for one instrument, in presentation order, straight from the table."""
    return list(
        db.scalars(
            select(Question)
            .where(Question.assessment_type == assessment_type)
            .order_by(Question.order)
        )
    )
