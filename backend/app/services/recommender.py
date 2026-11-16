"""Explainable career recommendations built from the structured catalogue.

The language model never invents student traits. Every suggestion here traces
back to something the student actually said, and weak evidence produces a
broad set of options rather than a confident single answer.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    Assessment,
    Career,
    InterestObservation,
    Message,
    ConversationSession,
    Result,
    StudentProfile,
    User,
)
from . import assessment_bank, scoring
from .themes import THEMES

# A named ambition deserves respect and accurate pathways, not a redirect.
DIRECT_AMBITION = {
    "doctor": "Science and Healthcare",
    "mbbs": "Science and Healthcare",
    "engineer": "Engineering and Technology",
    "engineering": "Engineering and Technology",
    "pilot": "Aviation",
    "aviation": "Aviation",
    "lawyer": "Law and Social Sciences",
    "ias": "Defence and Public Services",
    "army": "Defence and Public Services",
    "police": "Defence and Public Services",
    "teacher": "Education and Research",
    "scientist": "Science and Healthcare",
    "cricketer": "Sports and Fitness",
    "athlete": "Sports and Fitness",
    "designer": "Art, Design, and Media",
    "artist": "Art, Design, and Media",
    "animation": "Art, Design, and Media",
    "business": "Business and Entrepreneurship",
    "entrepreneur": "Business and Entrepreneurship",
    "chartered": "Finance and Banking",
    "finance": "Finance and Banking",
    "farmer": "Environment and Agriculture",
    "agriculture": "Environment and Agriculture",
    "chef": "Hospitality and Tourism",
    "hotel": "Hospitality and Tourism",
    "data": "AI and Data",
    "ai": "AI and Data",
    "machine learning": "AI and Data",
    "computer": "AI and Data",
    "coding": "AI and Data",
}


# Only a dimension answered away from the middle counts as a direction. The bands
# come from `services/scoring.py`, so a completed questionnaire follows the same
# rules here as it does on its own result page.
ASSESSMENT_BANDS = {"strong", "very_strong"}

# How the finished instrument is named when explaining a recommendation. These are
# the app's own words for the three sets, not the poetic titles on the catalogue.
ASSESSMENT_SOURCES = {
    "interest": "interest questionnaire",
    "personality": "personality questionnaire",
    "aptitude": "aptitude puzzles",
}

# At most four themes from all questionnaires together, and at most a +4 nudge in
# `score_careers`: a questionnaire narrows a direction, it does not decide one.
ASSESSMENT_THEME_LIMIT = 4
ASSESSMENT_WEIGHT = 2
ASSESSMENT_WEIGHT_LIMIT = 4


@dataclass
class StudentSignals:
    themes: list[str] = field(default_factory=list)
    statements: list[str] = field(default_factory=list)
    named_ambitions: list[str] = field(default_factory=list)
    declared_interests: list[str] = field(default_factory=list)
    assessment_themes: list[str] = field(default_factory=list)
    # theme -> the sentences that explain where that theme came from, e.g.
    # "investigating and figuring out came out very strong in your interest questionnaire".
    assessment_labels: dict[str, list[str]] = field(default_factory=dict)

    @property
    def evidence_count(self) -> int:
        return (
            len(self.themes)
            + len(self.named_ambitions)
            + len(self.declared_interests)
            + len(self.assessment_themes)
        )


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", text.lower())


def collect_signals(db: Session, student_id: int) -> StudentSignals:
    signals = StudentSignals()

    profile = db.get(StudentProfile, student_id)
    if profile:
        signals.declared_interests = [i for i in (profile.interest_areas or []) if i]

    observations = list(
        db.scalars(
            select(InterestObservation)
            .where(InterestObservation.student_id == student_id)
            .order_by(InterestObservation.id.desc())
            .limit(60)
        )
    )
    seen: set[str] = set()
    for observation in observations:
        if observation.theme not in seen:
            signals.themes.append(observation.theme)
            seen.add(observation.theme)
        if len(signals.statements) < 20:
            signals.statements.append(observation.evidence)

    recent_messages = list(
        db.scalars(
            select(Message)
            .join(ConversationSession, Message.session_id == ConversationSession.id)
            .where(
                ConversationSession.student_id == student_id,
                Message.role == "user",
            )
            .order_by(Message.id.desc())
            .limit(40)
        )
    )
    for message in recent_messages:
        for theme, hits in _theme_hits(message.content).items():
            if hits and theme not in seen:
                signals.themes.append(theme)
                seen.add(theme)
        if len(signals.statements) < 20 and message.content.strip():
            signals.statements.append(message.content.strip())

    _add_assessment_signals(db, student_id, signals)
    haystack = " ".join(_normalise(s) for s in signals.statements + signals.declared_interests)
    for word, category in DIRECT_AMBITION.items():
        if re.search(rf"(?<![a-z]){re.escape(word)}(?![a-z])", haystack):
            if word not in signals.named_ambitions:
                signals.named_ambitions.append(word)
                if category not in signals.declared_interests:
                    signals.declared_interests.append(category)

    return signals


def _latest_results(db: Session, student_id: int) -> dict[str, Result]:
    """The newest finished sitting of each instrument, one per type.

    A `Result` row only exists after Submit, and the join repeats that condition
    against the sitting itself, so an assessment still in progress can never be
    read as a completed one. Older sittings of the same instrument are left out:
    the student's latest answers are the ones that describe them today.
    """
    rows = db.scalars(
        select(Result)
        .join(Assessment, Result.assessment_id == Assessment.id)
        .where(
            Result.user_id == student_id,
            Assessment.status == "submitted",
        )
        .order_by(Result.completed_at.desc(), Result.id.desc())
    )
    latest: dict[str, Result] = {}
    for row in rows:
        latest.setdefault(row.assessment_type, row)
    return latest


def _add_assessment_signals(db: Session, student_id: int, signals: StudentSignals) -> None:
    """Lift themes out of stored scores, never out of raw answers.

    `Result.score_json` was written by the scorer at Submit; reading it here is not
    a second scoring pass. A dimension below the "strong" band is left alone, and
    the strongest few dimensions across all finished instruments are kept, so a
    questionnaire supports a direction without drowning the conversation.
    """
    candidates: list[tuple[int, str, str, str]] = []
    for assessment_type, result in _latest_results(db, student_id).items():
        source = ASSESSMENT_SOURCES.get(assessment_type)
        if source is None:
            continue
        try:
            meta = assessment_bank.instrument(assessment_type)
        except KeyError:
            continue
        scored = result.score_json if isinstance(result.score_json, dict) else {}
        dimensions = scored.get("dimensions") or {}
        if not isinstance(dimensions, dict):
            continue
        for dimension, entry in dimensions.items():
            if not isinstance(entry, dict) or entry.get("score") is None:
                continue
            band = entry.get("band")
            if band not in ASSESSMENT_BANDS:
                continue
            name = scoring.pick(meta["dimensions"].get(dimension, {}).get("name"), "en")
            if not name:
                continue
            band_label = scoring.band_label(entry.get("kind", "likert"), band, "en").lower()
            label = (
                f"{name.lower()} scored {entry['score']} out of 100 "
                f"({band_label}) in your {source}"
            )
            for theme in scoring.DIMENSION_THEMES.get(assessment_type, {}).get(dimension, []):
                candidates.append((int(entry["score"]), theme, label, assessment_type))

    candidates.sort(key=lambda item: (-item[0], item[1], item[3]))
    for _, theme, label, _ in candidates:
        if theme in signals.assessment_themes:
            if label not in signals.assessment_labels[theme]:
                signals.assessment_labels[theme].append(label)
            continue
        if len(signals.assessment_themes) >= ASSESSMENT_THEME_LIMIT:
            continue
        signals.assessment_themes.append(theme)
        signals.assessment_labels.setdefault(theme, []).append(label)


def _theme_hits(text: str) -> dict[str, bool]:
    lowered = _normalise(text)
    result: dict[str, bool] = {}
    for theme, meta in THEMES.items():
        for keyword in meta["keywords"]:
            if re.search(rf"(?<![a-z]){re.escape(keyword)}", lowered):
                result[theme] = True
                break
    return result


def _career_text(career: Career) -> str:
    parts = [career.title, career.summary, career.category]
    for field_name in (
        "typical_activities",
        "useful_skills",
        "school_subjects",
        "interest_themes",
    ):
        value = getattr(career, field_name, None) or []
        parts.extend(str(item) for item in value)
    return _normalise(" ".join(parts))


@dataclass
class ScoredCareer:
    career: Career
    score: int
    matched_themes: list[str]
    matched_statements: list[str]
    named_ambition: bool
    # Plain sentences naming the questionnaire result that pointed here, if any.
    matched_assessment: list[str] = field(default_factory=list)


def score_careers(db: Session, signals: StudentSignals, limit: int = 6) -> list[ScoredCareer]:
    careers = list(db.scalars(select(Career)))
    scored: list[ScoredCareer] = []

    for career in careers:
        text = _career_text(career)
        score = 0
        matched_themes: list[str] = []
        for theme in signals.themes:
            if theme in (career.interest_themes or []):
                score += 3
                matched_themes.append(theme)

        assessment_hits = [
            theme
            for theme in signals.assessment_themes
            if theme in (career.interest_themes or [])
        ]
        matched_assessment: list[str] = []
        if assessment_hits:
            # A finished questionnaire is real evidence, but it adds on top of the
            # conversation rather than outvoting it: at most +4 per career.
            score += min(ASSESSMENT_WEIGHT_LIMIT, ASSESSMENT_WEIGHT * len(assessment_hits))
            for theme in assessment_hits:
                for label in signals.assessment_labels.get(theme, []):
                    if label not in matched_assessment:
                        matched_assessment.append(label)

        matched_statements: list[str] = []
        ambition = False
        for statement in signals.statements + signals.declared_interests:
            normalised = _normalise(statement)
            title_words = [w for w in _normalise(career.title).split() if len(w) > 3]
            if any(word in normalised for word in title_words):
                score += 2
                matched_statements.append(statement)
            if career.category in signals.declared_interests:
                score += 2
            for word in signals.named_ambitions:
                if word in normalised and (
                    DIRECT_AMBITION.get(word) == career.category or word in text
                ):
                    score += 5
                    ambition = True
                    if statement not in matched_statements:
                        matched_statements.append(statement)

        if score > 0:
            scored.append(
                ScoredCareer(
                    career=career,
                    score=score,
                    matched_themes=matched_themes,
                    matched_statements=list(dict.fromkeys(matched_statements))[:3],
                    named_ambition=ambition,
                    matched_assessment=matched_assessment[:2],
                )
            )

    scored.sort(key=lambda item: (-item.score, item.career.title))
    return scored[:limit]


def evidence_level(signals: StudentSignals, match: ScoredCareer) -> str:
    if match.named_ambition or signals.evidence_count >= 5 or len(match.matched_themes) >= 3:
        return "good"
    if signals.evidence_count >= 3 or len(match.matched_themes) >= 2:
        return "some"
    return "early"


def build_recommendations(db: Session, student_id: int, limit: int = 5) -> tuple[list[dict], StudentSignals]:
    """Return explainable suggestions plus the signals they were derived from."""
    signals = collect_signals(db, student_id)
    matches = score_careers(db, signals, limit=limit)

    if not matches:
        # Weak evidence: offer breadth and say so, rather than guessing.
        broad = list(
            db.scalars(
                select(Career).order_by(Career.category, Career.title).limit(limit * 4)
            )
        )
        picked: list[ScoredCareer] = []
        categories: set[str] = set()
        for career in broad:
            if career.category not in categories:
                categories.add(career.category)
                picked.append(
                    ScoredCareer(
                        career=career,
                        score=0,
                        matched_themes=[],
                        matched_statements=[],
                        named_ambition=False,
                    )
                )
            if len(picked) >= limit:
                break
        matches = picked

    payload: list[dict] = []
    for match in matches:
        career = match.career
        why = _why(career, match, signals)
        payload.append(
            {
                "career": career,
                "career_id": career.id,
                "why": why,
                "supporting_statements": match.matched_statements
                or [f"You mentioned an interest in {career.category.lower()}."],
                "open_questions": _open_questions(career, match),
                "skills_to_try": (career.useful_skills or [])[:3],
                "qualifications_to_check": (career.entry_requirements or [])[:3],
                "alternatives": (career.related_slugs or [])[:3],
                "evidence_level": evidence_level(signals, match),
                "next_activity": (career.explore_activities or [None])[0],
                # The same direction explained for a guardian. `_why` quotes the first
                # matched statement when there is one, and that sentence is the child's,
                # so parents get this one instead — see `parent_why`.
                "parent_why": parent_why(career, match, signals),
            }
        )
    return payload, signals


def _assessment_note(match: ScoredCareer) -> str:
    labels = list(dict.fromkeys(match.matched_assessment))[:2]
    return "Your questionnaire also points this way: " + "; ".join(labels) + "."


def _why(career: Career, match: ScoredCareer, signals: StudentSignals) -> str:
    if match.matched_statements:
        quoted = match.matched_statements[0]
        quoted = quoted if len(quoted) < 120 else quoted[:117] + "..."
        reason = (
            f"You may enjoy exploring {career.title} because you mentioned: “{quoted}”"
        )
    elif match.matched_themes:
        labels = " and ".join(THEMES[t]["label"].lower() for t in match.matched_themes[:2])
        reason = (
            f"{career.title} involves {labels}, which came up in what you told us you enjoy."
        )
    elif match.matched_assessment:
        labels = "; ".join(list(dict.fromkeys(match.matched_assessment))[:2])
        return f"This direction fits what your questionnaire showed: {labels}."
    else:
        return (
            f"We do not have much to go on yet, so {career.title} is offered as one of several "
            "fields worth a look rather than a match."
        )
    if match.matched_assessment:
        reason = f"{reason} {_assessment_note(match)}"
    return reason


def parent_why(career: Career, match: ScoredCareer, signals: StudentSignals) -> str:
    """The same explanation a parent may read: themes, never the child's sentence.

    `_why` above quotes the first matched statement, which is the child's own writing.
    A guardian is entitled to the direction and the theme behind it, not the quote, so
    this variant never includes one. The signals argument stays in the signature so the
    call site matches `_why`, even though the parent wording needs nothing from it.
    """
    if match.matched_themes:
        labels = " and ".join(THEMES[t]["label"].lower() for t in match.matched_themes[:2])
        return (
            f"{career.title} involves {labels}, which came up in what your child told us "
            "they enjoy."
        )
    return (
        f"We do not have much to go on yet, so {career.title} is offered as one of several "
        "fields worth a look rather than a match."
    )


def _open_questions(career: Career, match: ScoredCareer) -> list[str]:
    questions: list[str] = []
    if not match.matched_themes:
        questions.append("What kinds of activities make you lose track of time?")
    if not match.matched_statements:
        questions.append(f"Would you enjoy the day-to-day work of a {career.title.lower()}, or just the idea of it?")
    if career.entry_requirements:
        questions.append("Which school subjects would you need to choose for this path?")
    if career.costs_and_alternatives:
        questions.append("What would the family budget be for this kind of study?")
    questions.append("Has anyone you trust worked in this field, and what did they say about it?")
    return questions[:4]


def summary_note(signals: StudentSignals) -> str:
    if signals.evidence_count == 0:
        return (
            "There is not enough information yet to point anywhere specific. "
            "That is normal. Explore a few activities before drawing any conclusion."
        )
    if signals.assessment_themes and not (
        signals.themes or signals.named_ambitions or signals.declared_interests
    ):
        return (
            "These suggestions come from the questionnaires you have finished. They are "
            "starting points for discussion, not a verdict on what you should become."
        )
    if signals.evidence_count <= 2:
        return (
            "These are early observations from a short conversation. "
            "Interests usually change, and none of this is a prediction about the future."
        )
    return (
        "These suggestions come from things you chose to share. They are starting points "
        "for discussion, not a verdict on what you should become."
    )
