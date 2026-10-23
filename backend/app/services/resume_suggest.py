"""Skills and project ideas for a resume, from the career catalogue or the model.

Two sources, and the whole point of this module is that a caller can always tell
them apart:

* **The catalogue** — the skills and explore-activities already verified for one
  career profile in `models.Career`. This is what answers when no AI provider is
  configured, when the provider is unreachable, and when a model hands back
  something unreadable. It is flagged `demo_generated=True`, because no model was
  consulted and a student is entitled to know that.
* **The configured provider** — the same OpenAI-compatible HTTP path
  `services/ai_provider.py` uses, asked for one JSON object.

A model that invents a project a twelve-year-old cannot start, or names a paid
bootcamp as the next step, is the failure this file is written against; the rules
in `prompts.build_resume_suggest_prompt` say it out loud, and the bounds in
`_clean` enforce it whatever the model actually returned.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Career
from . import prompts

log = logging.getLogger(__name__)

# The catalogue answers are shown beside the career they came from, so a student who
# typed "cricket commentator" and got "Professional Sport" can see that, rather than
# being told a fact about their own future by a string match.
_MAX_SKILLS = 8
_MAX_PROJECTS = 5

_STOPWORDS = {"and", "the", "a", "an", "of", "for", "to", "or", "in", "on", "with", "my", "me"}

# The two ways the provider can fail, said differently, because a student who is told
# "could not be reached" about a reply that arrived and made no sense is being told a
# story about the machine that this app cannot support. Both sentences are returned to
# the browser as `Suggestion.error` and are keys in `frontend/src/lib/hi/resume.ts`.
UNREACHABLE = (
    "The AI provider could not be reached, so these suggestions came from "
    "the career profiles in this app instead."
)
UNUSABLE = (
    "The AI provider did not return usable suggestions, so these came from "
    "the career profiles in this app instead."
)


@dataclass
class Suggestion:
    skills: list[dict] = field(default_factory=list)
    projects: list[dict] = field(default_factory=list)
    matched_career: str | None = None
    provider: str = "catalogue"
    demo_generated: bool = True
    error: str | None = None


def _tokens(text: str) -> set[str]:
    """Meaningful words, folded to their first seven characters.

    The fold is what lets "engineer" match "engineering" without a stemming library.
    Seven is long enough that a shared prefix means a shared word: "learning" and
    "leather" part company at the fifth letter. A trailing plural is then dropped,
    because "sports" and "sport" are the same thing to a student even though seven
    characters cannot see that.
    """
    found = set()
    for word in re.split(r"[^a-z0-9]+", text.lower()):
        stem = word[:7]
        if len(stem) < 3 or stem in _STOPWORDS:
            continue
        found.add(stem[:-1] if len(stem) > 4 and stem.endswith("s") and not stem.endswith("ss") else stem)
    return found


def match_career(db: Session, target_role: str) -> Career | None:
    """The catalogue profile the student's own words fully cover, or None.

    Deliberately not a vector search and deliberately not a shared-word count: this
    app has 55 careers with plain titles, and a rule the reader can second-guess beats a
    similarity score they cannot. One shared word is not a match — that rule is how
    "Software Engineer" came back with the *Civil Engineering* profile's skills, which
    is a worse answer than the general list and one nobody could audit. So a title only
    wins when every word of it appears in what the student typed, and the most specific
    of the titles that qualify is the one chosen.
    """
    wanted = _tokens(target_role)
    if not wanted:
        return None
    lowered = target_role.strip().lower()
    best: Career | None = None
    for career in db.scalars(select(Career)):
        title = career.title.lower()
        if title == lowered or title in lowered:
            return career
        covering = _tokens(title)
        if covering and covering <= wanted and (best is None or len(covering) > len(_tokens(best.title))):
            best = career
    return best


# General, career-neutral, and true for every class this app serves. Used when the
# student's words match no profile in the catalogue — which is the normal case for
# "Software Engineer", since this catalogue has no software career in it.
GENERAL_SKILLS = [
    "Explaining a thing you understand to somebody who does not",
    "Writing clearly and briefly",
    "Spreadsheet or document basics",
    "Finding a reliable source and checking its date",
    "Breaking a task into steps you can finish",
    "Asking for help when stuck",
]

GENERAL_PROJECTS = [
    (
        "Teach one classmate one difficult topic",
        "Plan it, teach it in fifteen minutes, and write down the part they found hardest — that is the part you did not understand either.",
    ),
    (
        "Keep a one-week record of how you spend your time",
        "A spreadsheet with a row for each day and a chart at the end. Note what surprised you in one sentence.",
    ),
    (
        "Interview somebody whose work you are curious about",
        "Ten minutes, five questions, and a short write-up of what the job is actually like on an ordinary Tuesday.",
    ),
    (
        "Fix one small thing at home or in school",
        "Pick something that mildly annoys you, change it, and say what you would do differently next time.",
    ),
]


def from_catalogue(db: Session, target_role: str) -> Suggestion:
    """Suggestions built only from rows this project has already verified.

    The catalogue's own text goes through the same `_clean` a model's answer goes
    through. Its skills measure 56 characters and its activities 142 today, both inside
    the form's limits — but a seed file edited next month is not covered by that, and a
    suggestion the save route would refuse is a suggestion that should never have been
    offered.
    """
    career = match_career(db, target_role)
    if career is None:
        raw = {
            "skills": GENERAL_SKILLS,
            "projects": [{"title": title, "detail": detail} for title, detail in GENERAL_PROJECTS],
        }
    else:
        raw = {"skills": career.useful_skills or [], "projects": career.explore_activities or []}
    skills, projects = _clean(raw)
    return Suggestion(
        skills=skills,
        projects=projects,
        matched_career=career.title if career else None,
    )


def _catalogue_answer(db: Session, target_role: str, reason: str) -> Suggestion:
    """The catalogue, plus the one true sentence about why the catalogue answered."""
    answer = from_catalogue(db, target_role)
    answer.error = reason
    return answer


def _clean(raw: object) -> tuple[list[dict], list[dict]]:
    """Bound whatever the model returned to what the resume columns can hold.

    A provider can answer with forty skills, a five-thousand-word project, or an
    array instead of an object. None of those reach a student's saved resume: the
    limits here are the schema's limits, applied before the caller sees anything.
    """
    payload = raw if isinstance(raw, dict) else {}

    skills: list[dict] = []
    for item in payload.get("skills") or []:
        if isinstance(item, str):
            item = {"name": item}
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        # No suggestion ever arrives with a level, whatever the model wrote next to the
        # skill. How far along a student is is the one fact in this document only they
        # can state; a model filling in "learning" beside a child's name is the app
        # inferring an ability it has no way to know. The catalogue list has no levels
        # for the same reason, so both sources answer in the same shape.
        skills.append({"name": name[:80], "level": ""})
        if len(skills) >= _MAX_SKILLS:
            break

    projects: list[dict] = []
    for item in payload.get("projects") or []:
        if isinstance(item, str):
            item = {"title": item}
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        detail = str(item.get("detail") or "").strip()
        projects.append(
            {
                "title": title[:200],
                "detail": detail[:600] or None,
                "year": "",
            }
        )
        if len(projects) >= _MAX_PROJECTS:
            break

    return skills, projects


def _parse(text: str) -> object:
    """Read one JSON object out of a reply that may be fenced or padded."""
    body = text.strip()
    if body.startswith("```"):
        body = re.sub(r"^```[a-zA-Z]*\s*", "", body)
        body = re.sub(r"\s*```$", "", body)
    start, end = body.find("{"), body.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("the provider did not return a JSON object")
    return json.loads(body[start : end + 1])


async def suggest(db: Session, target_role: str, language: str) -> Suggestion:
    """Ask for skills and projects, and never pretend the catalogue was a model."""
    settings = get_settings()
    if not settings.ai_configured:
        return from_catalogue(db, target_role)

    system = prompts.build_resume_suggest_prompt(target_role=target_role, language=language)
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                settings.ai_base_url.rstrip("/") + "/chat/completions",
                headers={"Authorization": f"Bearer {settings.ai_api_key}"},
                json={
                    "model": settings.ai_model,
                    "messages": [{"role": "system", "content": system}],
                    "temperature": 0.5,
                    # 900 was the obvious number for six skills and four projects, and
                    # it never worked: the reasoning model this app is configured with
                    # spent all 900 tokens thinking, answered with an empty `content`,
                    # and every ✨ click fell back to the catalogue. The budget has to
                    # hold the thinking as well as the answer, so it is sized for both —
                    # measured at 1249 tokens for this prompt, with room kept for a
                    # longer reply.
                    "max_tokens": 3000,
                },
            )
            response.raise_for_status()
            text = (response.json()["choices"][0]["message"].get("content") or "").strip()
        if not text:
            raise ValueError("the configured provider returned an empty reply")
        skills, projects = _clean(_parse(text))
        if not skills and not projects:
            raise ValueError("the provider returned nothing usable")
    except httpx.RequestError as exc:
        # The same judgement as `ai_provider.respond`: a provider that is down is a
        # worse answer, not no answer, and the student must be told which they got.
        # Which is also why this sentence and the next one are different — a request
        # that never arrived and a reply that made no sense are not the same failure.
        #
        # What goes to the log is the name of the failure, never the student's own
        # words and never the reply: an operator reading the log is diagnosing the
        # connection, not reading a child's resume.
        log.warning("resume-suggest: the provider could not be reached (%s)", type(exc).__name__)
        return _catalogue_answer(db, target_role, UNREACHABLE)
    except (httpx.HTTPStatusError, KeyError, IndexError, ValueError, TypeError) as exc:
        # The messages on this path are written by this file or by httpx, so naming
        # the exception is safe; the model's text, which is not, is not included.
        log.warning("resume-suggest: the reply was not usable (%s: %s)", type(exc).__name__, str(exc)[:120])
        return _catalogue_answer(db, target_role, UNUSABLE)

    return Suggestion(
        skills=skills,
        projects=projects,
        matched_career=None,
        provider=settings.ai_provider,
        demo_generated=False,
    )
