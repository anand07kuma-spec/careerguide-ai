"""What a result means as a plan: the gap, and four weeks that close a little of it.

Two sources, and — as in `services/resume_suggest.py` — a reader can always tell
which one wrote the sentence in front of them:

* **`rules`** — arithmetic on the scores this app already has, plus the career
  profile it matched them to. No model is consulted, so this is what every result
  opens with, whether or not a provider is configured.
* **A configured provider** — asked once, by a button the student presses, to turn
  the same facts into steps aimed at their own target career.

What the rules refuse to say matters more than what they say. A dimension with too
few answers is reported as *not measured*, never as weak, because "you left three
questions blank" and "you are poor at this" are different facts and only one of
them is true. A career's own skill list is shown as what the work asks for, never as
what this child lacks — the questionnaire measured interests and aptitude, not a
job's skill list. And no step names a course to buy, an institution to join or an
outcome to expect, because the catalogue this plan is built from is sample data.

The stored shape is language-neutral: dimension codes, theme keys, and `{"en", "hi"}`
pairs for the sentences this file writes. `render` picks the language at read time,
which is how every other part of a result already works. A model's answer is the
exception — its text is stored as written, in the language it was asked for, and
passed through untouched rather than pretending to be translated.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Career, Result
from . import assessment_bank, prompts, scoring
from .themes import THEMES

log = logging.getLogger(__name__)

VERSION = 1

_MAX_STRENGTHS = 2
_MAX_GAPS = 3
_WEEKS = 4
_MAX_STEPS = 3
_STEP_CHARS = 240

STRONG_BANDS = ("strong", "very_strong")

# The two ways a provider fails, said apart, for the reason `resume_suggest.py`
# gives: a request that never arrived and a reply that made no sense are not the
# same story about the machine. Both are keys in `frontend/src/lib/hi/roadmap.ts`.
#
# Neither one says which plan is standing in its place, and that is deliberate. On a
# first click the plan left on the page is the rules version; after a successful ✨ it
# is the model's, and a second click that then fails used to be described as "still
# the plan the app's own rules wrote" beside a badge reading `groq`. The badge already
# says who wrote what is on screen; the note's job is only to say that nothing changed.
UNREACHABLE = (
    "The AI provider could not be reached, so the plan on this page did not change."
)
UNUSABLE = (
    "The AI provider did not return a usable plan, so the plan on this page did not change."
)


def _bi(en: str, hi: str) -> dict[str, str]:
    return {"en": en.strip(), "hi": hi.strip()}


# ------------------------------------------------------------------ the rules plan


def top_career(db: Session, themes: list[str], class_number: int | None) -> Career | None:
    """The career the plan is written for: the first one the result page lists.

    The same rule as `_career_suggestions` in `routers/assessments.py` — most
    matched themes wins, ties broken on the title, and a career above the student's
    class is not offered. If that ordering ever changes, this one has to change with
    it, or a student reads a plan aimed at a career the list above it does not put
    first.
    """
    if not themes:
        return None
    ranked: list[tuple[int, str, Career]] = []
    for career in db.scalars(select(Career)):
        if class_number and career.min_class > class_number:
            continue
        hits = [theme for theme in (career.interest_themes or []) if theme in themes]
        if hits:
            ranked.append((len(hits), career.title.lower(), career))
    ranked.sort(key=lambda entry: (-entry[0], entry[1]))
    return ranked[0][2] if ranked else None


def plan_for(
    db: Session,
    *,
    assessment_type: str,
    scored: dict,
    themes: list[str],
    class_number: int | None,
) -> dict[str, Any] | None:
    """The plan this app can write without asking anybody.

    None when no career profile matched: a plan with nothing to aim at is a list of
    chores, and the screen says that plainly instead of printing one.
    """
    career = top_career(db, themes, class_number)
    if career is None:
        return None

    traits = scoring.traits(assessment_type, "en", scored)
    answered = [entry for entry in traits if entry["score"] is not None]
    strengths = [entry for entry in answered if entry["band"] in STRONG_BANDS][:_MAX_STRENGTHS]

    # The themes this student's strong areas already cover, and the ones the career
    # leans on that they do not. An area with too few answers never appears as a
    # gap at all — it is listed under `unmeasured` and rendered as unknown.
    covered = {
        theme
        for entry in strengths
        for theme in scoring.DIMENSION_THEMES.get(assessment_type, {}).get(entry["dimension"], [])
    }
    gaps: list[dict[str, Any]] = []
    for theme in [item for item in (career.interest_themes or []) if item in THEMES]:
        if len(gaps) >= _MAX_GAPS:
            break
        if theme in covered:
            continue
        source = next(
            (
                entry
                for entry in answered
                if theme
                in scoring.DIMENSION_THEMES.get(assessment_type, {}).get(entry["dimension"], [])
            ),
            None,
        )
        if source is None:
            gaps.append({"theme": theme, "reason": "unmeasured", "score": None, "band": None, "kind": None})
        elif source["score"] < 50:
            gaps.append(
                {
                    "theme": theme,
                    "reason": "low",
                    "score": source["score"],
                    "band": source["band"],
                    "kind": source["kind"],
                }
            )
        else:
            gaps.append(
                {
                    "theme": theme,
                    "reason": "middle",
                    "score": source["score"],
                    "band": source["band"],
                    "kind": source["kind"],
                }
            )

    unmeasured = [entry["dimension"] for entry in traits if entry["score"] is None][:_MAX_GAPS]

    activities = [str(item).strip() for item in (career.explore_activities or []) if str(item).strip()]
    pathways = [str(item).strip() for item in (career.education_pathways or []) if str(item).strip()]
    subjects = [str(item).strip() for item in (career.school_subjects or []) if str(item).strip()]
    skills = [str(item).strip() for item in (career.useful_skills or []) if str(item).strip()]

    weeks = [
        {
            "week": 1,
            "focus": "look",
            "steps": [
                _bi(
                    f"About 20 minutes: open the profile for {career.title} and read what an "
                    "ordinary day is like. Write one line on the part you would enjoy and one on "
                    "the part you would not.",
                    f"करीब 20 मिनट: {career.title} का प्रोफ़ाइल खोलें और पढ़ें कि एक आम दिन कैसा "
                    "होता है। जिस हिस्से में मज़ा आएगा और जिसमें नहीं, दोनों पर एक-एक लाइन लिखें।",
                )
            ]
            + ([_activity_step(activities[0])] if activities else []),
        },
        {
            "week": 2,
            "focus": "try",
            "steps": (
                [_activity_step(activities[1] if len(activities) > 1 else activities[0])]
                if activities
                else [
                    _bi(
                        "Pick one small thing this week and finish it properly, then write down "
                        "which part of it held your attention.",
                        "इस हफ़्ते कोई एक छोटा काम चुनें और उसे पूरा करें, फिर लिखें कि उसका कौन सा "
                        "हिस्सा आपको बाँचे रखे।",
                    )
                ]
            )
            + ([_gap_step(gaps[0])] if gaps else []),
        },
        {
            "week": 3,
            "focus": "school",
            "steps": [
                _bi(
                    "Write down the school subjects this work leans on — "
                    f"{', '.join(subjects[:4]) if subjects else 'check the profile'} — and mark "
                    "which of them you actually enjoy studying right now.",
                    "लिखें कि यह काम किन स्कूल विषयों पर टिका है — "
                    f"{', '.join(subjects[:4]) if subjects else 'प्रोफ़ाइल देखें'} — और उनमें से "
                    "किसमें आप अभी मज़ा लेते हैं, निशान लगाएँ।",
                )
            ]
            + (
                [
                    _bi(
                        f"One route into this starts with: {pathways[0]} — confirm the current "
                        "rules for it yourself, because this app's notes are sample data.",
                        f"इसमें प्रवेश का एक रास्ता यह है: {pathways[0]} — इसके मौजूदा नियम खुद "
                        "पुष्टि करें, क्योंकि इस ऐप के नोट जाँचे हुए नमूने हैं।",
                    )
                ]
                if pathways
                else []
            ),
        },
        {
            "week": 4,
            "focus": "talk",
            "steps": [
                _bi(
                    "Ask one person who does work like this what their morning looks like. Five "
                    "questions, ten minutes, and no advice taken as fact.",
                    "किसी एक व्यक्ति से जो ऐसा काम करते हैं, पूछें कि उनका सुबह का दिन कैसा होता "
                    "है। पाँच सवाल, दस मिनट, और किसी भी सलाह को बिना जाँचे सच न मानें।",
                ),
                _bi(
                    "Read these four weeks back and write the one thing you would do again and "
                    "the one you would drop. That is next month's plan.",
                    "इन चारों हफ़्तों को पढ़ें और लिखें कि एक काम दोबारा करेंगे और कौन सा छोड़ "
                    "देंगे। यही अगले महीने की योजना है।",
                ),
            ],
        },
    ]

    return {
        "version": VERSION,
        "source": "rules",
        "demo_generated": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assessment_type": assessment_type,
        "career": {
            "slug": career.slug,
            "title": career.title,
            "category": career.category,
            "needs_verification": career.needs_verification,
        },
        "strengths": [
            {
                "dimension": entry["dimension"],
                "score": entry["score"],
                "band": entry["band"],
                "kind": entry["kind"],
            }
            for entry in strengths
        ],
        "gaps": gaps,
        "unmeasured": unmeasured,
        "career_skills": skills[:4],
        "weeks": weeks,
    }


def _activity_step(activity: str) -> dict[str, str]:
    """A catalogue activity, framed as something to do this week rather than to read."""
    trimmed = _sentence(activity)
    return _bi(
        f"Try the activity this app's own notes suggest: {trimmed}",
        f"इस ऐप के नोट जो काम सुझाते हैं, वह आज़माएँ: {trimmed}",
    )


def _gap_step(gap: dict[str, Any]) -> dict[str, str]:
    # Names the area by where it is on the page rather than by its label, for the
    # reason `_GAP_DETAIL` gives: the label's Hindi lives in the interface
    # dictionary, and a sentence written around it here would be a sentence that
    # cannot switch languages.
    return _bi(
        "Twenty minutes this week on the first area named in the gap above — the one this "
        "work leans on and your answers did not reach as far.",
        "इस हफ़्ते ऊपर लिखी कमी में पहले बताए गए क्षेत्र पर बीस मिनट दें — जिस पर यह काम टिका है और "
        "आपके जवाब उसे पूरी तरह नहीं पहुँचे।",
    )


def _sentence(text: str) -> str:
    """One catalogue line, shortened to a step a week can hold."""
    clean = re.sub(r"\s+", " ", str(text)).strip()
    if len(clean) <= 180:
        return clean
    cut = clean[:180]
    return (cut[: cut.rfind(" ")].rstrip(" ,;:") if " " in cut else cut) + "."


# ---------------------------------------------------------------- the AI version


def facts(result: Result, plan: dict[str, Any]) -> str:
    """The only thing about a student that reaches the provider.

    Dimension names, numbers and bands — never a name, a school, an answer string or
    a free-text field from the profile. `roadmap_test.py` keeps a sentinel in this
    account's own rows and asserts none of it appears in the request.
    """
    meta = assessment_bank.instrument(result.assessment_type)
    lines = []
    for entry in scoring.traits(result.assessment_type, "en", result.score_json or {}):
        if entry["score"] is None:
            lines.append(f"- {entry['name']}: too few answers to score")
        else:
            lines.append(
                f"- {entry['name']}: {entry['score']} out of 100 ({entry['band']}, from "
                f"{entry['answered']} of {entry['total']} questions)"
            )
    career = plan.get("career") or {}
    skills = ", ".join(plan.get("career_skills") or []) or "none listed"
    return (
        f"Questionnaire: {scoring.pick(meta['name'], 'en')}.\n"
        f"Areas, as this app scored them:\n" + "\n".join(lines) + "\n"
        f"The career their answers point at, from this app's own notes: "
        f"{career.get('title', 'none')}.\n"
        f"Skills those notes list for it: {skills}."
    )


def _clean(raw: object) -> dict[str, Any] | None:
    """Bound whatever came back to four weeks of short steps, or nothing at all."""
    payload = raw if isinstance(raw, dict) else {}
    source = payload.get("weeks") or []
    if not isinstance(source, list) or len(source) != _WEEKS:
        return None

    weeks: list[dict[str, Any]] = []
    for index, entry in enumerate(source):
        if not isinstance(entry, dict):
            return None
        title = _flat(entry.get("title"))
        steps = [step for step in (_flat(item) for item in (entry.get("steps") or [])) if step][
            :_MAX_STEPS
        ]
        if not title or not steps:
            return None
        weeks.append({"week": index + 1, "title": title[:80], "steps": steps})

    summary = _flat(payload.get("summary"))
    gaps = [item for item in (_flat(entry) for entry in (payload.get("gaps") or [])) if item][
        :_MAX_GAPS
    ]
    strengths = [
        item for item in (_flat(entry) for entry in (payload.get("strengths") or [])) if item
    ][:_MAX_STRENGTHS]
    if not summary or not gaps or not strengths:
        return None
    return {
        "summary": summary[:400],
        "strengths": strengths,
        "gaps": gaps,
        "weeks": weeks,
    }


def _flat(value: object) -> str:
    return re.sub(r"\s+", " ", str(value if value is not None else "")).strip()[:_STEP_CHARS]


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


async def plan_with_ai(result: Result, language: str) -> tuple[dict[str, Any] | None, str | None]:
    """Ask the model for the same plan. Never let its silence look like the rules'.

    Returns the plan to store and, when the provider failed, the one true sentence
    about that — the caller still has to answer the student who pressed a button, and
    a plan that quietly stayed the rules version is the lie this file exists to
    prevent.
    """
    settings = get_settings()
    base = result.roadmap_json or {}
    if not base:
        return None, None
    if not settings.ai_configured:
        return base, None

    system = prompts.build_roadmap_prompt(facts=facts(result, base), language=language)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                settings.ai_base_url.rstrip("/") + "/chat/completions",
                headers={"Authorization": f"Bearer {settings.ai_api_key}"},
                json={
                    "model": settings.ai_model,
                    "messages": [{"role": "system", "content": system}],
                    "temperature": 0.5,
                    # A third again larger than `resume_suggest`, and the reason is a
                    # measurement rather than a hunch: asked for this plan in English the
                    # configured model spent 1670 tokens thinking and 311 writing, and
                    # asked for the same plan in Hindi it spent 2358 thinking and 615
                    # writing. At the resume's 3000 the Hindi reply ran out of budget
                    # inside the JSON and the page correctly fell back to the rules plan —
                    # a fallback that works is not a reason to keep causing it.
                    "max_tokens": 4000,
                },
            )
            response.raise_for_status()
            text = (response.json()["choices"][0]["message"].get("content") or "").strip()
        if not text:
            raise ValueError("the configured provider returned an empty reply")
        cleaned = _clean(_parse(text))
        if cleaned is None:
            raise ValueError("the provider did not return four weeks of steps")
    except httpx.RequestError as exc:
        # The name of the failure goes to the log; the student's own words and the
        # model's reply never do.
        log.warning("roadmap: the provider could not be reached (%s)", type(exc).__name__)
        return base, UNREACHABLE
    except (httpx.HTTPStatusError, KeyError, IndexError, ValueError, TypeError) as exc:
        log.warning(
            "roadmap: the reply was not usable (%s: %s)", type(exc).__name__, str(exc)[:120]
        )
        return base, UNUSABLE

    plan = dict(base)
    plan.update(cleaned)
    plan["source"] = settings.ai_provider
    plan["demo_generated"] = False
    plan["text_language"] = language
    plan["generated_at"] = datetime.now(timezone.utc).isoformat()
    return plan, None


# ------------------------------------------------------------------- rendering


def render(plan: dict[str, Any] | None, language: str) -> dict[str, Any] | None:
    """The stored plan, as the sentences a student reads."""
    if not plan:
        return None
    if plan.get("source") == "rules":
        return _render_rules(plan, language)
    return {
        "source": plan.get("source"),
        "demo_generated": bool(plan.get("demo_generated")),
        "generated_at": plan.get("generated_at"),
        # Which language the model was answering in, so the page can say so rather
        # than letting an English interface imply a translation that never happened.
        "text_language": plan.get("text_language") or language,
        "career": plan.get("career") or {},
        "summary": plan.get("summary") or "",
        "strengths": [{"label": item, "score": None} for item in plan.get("strengths") or []],
        "gaps": [{"label": item, "reason": "ai", "detail": ""} for item in plan.get("gaps") or []],
        "unmeasured": [],
        "career_skills": plan.get("career_skills") or [],
        "weeks": [
            {
                "week": entry.get("week"),
                "title": entry.get("title") or "",
                "steps": [{"text": step} for step in entry.get("steps") or []],
            }
            for entry in plan.get("weeks") or []
        ],
        "note": _AI_NOTE[language] if language in _AI_NOTE else _AI_NOTE["en"],
    }


def _dimension_name(plan: dict[str, Any], dimension: str, language: str) -> str:
    meta = assessment_bank.instrument(str(plan.get("assessment_type") or "interest"))
    return scoring.pick((meta["dimensions"].get(dimension) or {}).get("name"), language)


def _render_rules(plan: dict[str, Any], language: str) -> dict[str, Any]:
    career = plan.get("career") or {}
    strengths = [
        {
            "label": _dimension_name(plan, entry["dimension"], language),
            "score": entry.get("score"),
            "band_label": scoring.band_label(
                str(entry.get("kind") or "likert"), str(entry.get("band") or ""), language
            ),
        }
        for entry in plan.get("strengths") or []
    ]
    return {
        "source": "rules",
        "demo_generated": True,
        "generated_at": plan.get("generated_at"),
        "text_language": None,
        "career": career,
        "summary": _summary(plan, str(career.get("title") or ""), strengths, language),
        "strengths": strengths,
        "gaps": [_gap(entry, language) for entry in plan.get("gaps") or []],
        "unmeasured": [
            {"label": _dimension_name(plan, dimension, language)}
            for dimension in plan.get("unmeasured") or []
        ],
        "career_skills": plan.get("career_skills") or [],
        "weeks": [
            {
                "week": entry["week"],
                "title": _pick(WEEK_TITLES[entry["focus"]], language),
                "steps": [{"text": _pick(step, language)} for step in entry["steps"]],
            }
            for entry in plan.get("weeks") or []
        ],
        "note": _pick(_RULES_NOTE, language),
    }


def _pick(field: dict[str, str], language: str) -> str:
    return field.get(language) or field["en"]


def guide_note(rendered: dict[str, Any]) -> str:
    """The plan, as one block of text the guide can be told about.

    Built from what `render` already produced, in the same language, so the guide
    repeats the weeks the student is actually looking at rather than a second
    paraphrase of their scores. Nothing here reaches the provider that is not on the
    student's own result page.
    """
    career = (rendered.get("career") or {}).get("title") or "the career their answers pointed at"
    lines = [f"This is the plan on their result page, aimed at {career}:"]
    summary = _flat(rendered.get("summary"))
    if summary:
        lines.append(summary)

    strong = ", ".join(
        _flat(entry.get("label")) for entry in rendered.get("strengths") or [] if entry.get("label")
    )
    if strong:
        lines.append(f"Where their answers came back strong: {strong}.")
    gaps = ", ".join(
        _flat(entry.get("label")) for entry in rendered.get("gaps") or [] if entry.get("label")
    )
    if gaps:
        lines.append(f"Where this work asks for more: {gaps}.")
    unknown = ", ".join(
        _flat(entry.get("label"))
        for entry in rendered.get("unmeasured") or []
        if entry.get("label")
    )
    if unknown:
        lines.append(f"Not measured at all, so not a weakness: {unknown}.")

    for entry in rendered.get("weeks") or []:
        steps = " / ".join(
            _flat(step.get("text"))[:120] for step in entry.get("steps") or [] if step.get("text")
        )
        title = _flat(entry.get("title"))
        if title or steps:
            # The number goes back in here, because the page shows it in its own rail and
            # the guide is being handed plain text where "Week 2" is the only way to say
            # which week it means.
            lines.append(f"Week {entry.get('week')}. {title}: {steps}")
    return "\n".join(lines)


WEEK_TITLES = {
    # No "Week 1 —" inside the title: the timeline on the result page prints the number
    # in its own rail, so a title that repeated it read as "1 · Week 1 — …". The number
    # lives in `week`, which is what `guide_note` below puts back into the sentence the
    # model is given.
    "look": _bi("See the work up close", "काम को पास से देखें"),
    "try": _bi("Try one small thing yourself", "खुद एक छोटा काम आज़माएँ"),
    "school": _bi("Check what school asks for", "देखें स्कूल क्या माँगता है"),
    "talk": _bi("Talk to someone, then decide", "किसी से बात करें, फिर तय करें"),
}

_RULES_NOTE = _bi(
    "This plan was written by the app's own rules, from your answers and its career notes. "
    "No model was asked. The career notes are sample data — verify fees, subjects and dates "
    "yourself.",
    "यह योजना इस ऐप के अपने नियमों ने आपके जवाबों और उसके करियर-नोट से लिखी है। किसी मॉडल से कुछ "
    "नहीं पूछा गया। करियर-नोट जाँचे हुए नमूने हैं — फ़ीस, विषय और तारीख़ें खुद पुष्टि करें।",
)

_AI_NOTE = _bi(
    "These steps were written by the configured AI model from a summary of your answers. It "
    "guarantees nothing, and every fact in it is worth checking yourself.",
    "ये क़दम चुने हुए AI मॉडल ने आपके जवाबों के सार से लिखे हैं। यह किसी की गारंटी नहीं है, और इसका "
    "हर तथ्य खुद जाँचने लायक है।",
)

_GAP_DETAIL = {
    # None of these three names the area inside the sentence. The theme label has a
    # Hindi version already — in `frontend/src/lib/hi/common.ts`, beside the seven
    # others — and a second copy here would be a second thing to keep in step. So the
    # label travels in its own field and the page writes the line.
    "unmeasured": _bi(
        "This work leans on the area above, and nothing you answered points this way yet — "
        "which is not the same as being weak at it. It is unknown.",
        "यह काम ऊपर लिखे क्षेत्र पर टिका है, और आपके जवाबों में अभी इस ओर कुछ नहीं है — इसका मतलब "
        "कमज़ोरी नहीं, इसका मतलब अज्ञात है।",
    ),
    "low": _bi(
        "This work leans on the area above, and your answers there came back lower than your "
        "strongest ones.",
        "यह काम ऊपर लिखे क्षेत्र पर टिका है, और वहाँ आपके जवाब आपके सबसे मज़बूत जवाबों से कम रहे।",
    ),
    "middle": _bi(
        "This work leans on the area above. You answered it, and it came back in the middle "
        "rather than at the top.",
        "यह काम ऊपर लिखे क्षेत्र पर टिका है। आपने इस पर जवाब दिए और वे सबसे ऊपर के बजाय बीच में रहे।",
    ),
}


def _gap(gap: dict[str, Any], language: str) -> dict[str, str]:
    theme = str(gap.get("theme") or "")
    reason = str(gap.get("reason") or "middle")
    frame = _GAP_DETAIL.get(reason, _GAP_DETAIL["middle"])
    return {
        # The catalogue's own English words for the theme, which is also the key the
        # page looks its Hindi label up with.
        "label": THEMES.get(theme, {}).get("label", theme),
        "reason": reason,
        "detail": _pick(frame, language),
    }


def _summary(
    plan: dict[str, Any], career_title: str, strengths: list[dict[str, Any]], language: str
) -> str:
    """The one line the brief asks for: strong here, thinner there.

    Built from the same facts the lists below are built from, so it cannot claim a
    strength the card does not show or a gap it does not name. It names the strong
    areas, whose labels this file can write in either language from the question
    bank, and points at the rest rather than naming them — a theme label's Hindi
    lives in the interface dictionary, so the areas are the card's to spell out.
    """
    gaps = plan.get("gaps") or []
    strong_text = _join([entry["label"] for entry in strengths], language)
    has_gaps = bool(gaps)

    if strong_text and has_gaps:
        frame = _bi(
            "Your answers came back strongest in {strong}. {career} also leans on areas yours "
            "did not reach as far — they are named below, and these four weeks spend time on "
            "the first of them.",
            "आपके जवाब सबसे ज़्यादा {strong} में आए। {career} इन क्षेत्रों पर भी टिका है जहाँ आपके "
            "जवाब उतने नहीं पहुँचे — वे नीचे लिखे हैं, और इन चार हफ़्तों में वक़्त पहले वाले पर जाता है।",
        )
    elif strong_text:
        frame = _bi(
            "Your answers came back strongest in {strong}, and that is where {career} leans "
            "too. These four weeks go deeper rather than fixing a gap.",
            "आपके जवाब सबसे ज़्यादा {strong} में आए, और {career} भी इसी पर टिका है। ये चार हफ़्ते कोई "
            "कमज़ोरी भरने के बजाय उसी काम को गहरा करते हैं।",
        )
    elif has_gaps:
        frame = _bi(
            "Nothing you answered came back strong yet, so this plan starts by giving you a "
            "look at {career} rather than judging you. The areas it would help to begin with "
            "are named below.",
            "अभी कोई भी जवाब प्रबल नहीं आया, इसलिए यह योजना फ़ैसला सुनाने से पहले आपको {career} की "
            "झलक देने से शुरू होती है। जिन क्षेत्रों से शुरू करना फ़ायदेमंद होगा, वे नीचे लिखे हैं।",
        )
    else:
        frame = _bi(
            "Too few answers came back to name a strong area, so this plan only goes as far as "
            "showing you what {career} involves. Answering a few more questions would let it "
            "say something about you.",
            "इतने जवाब नहीं आए कि कोई प्रबल क्षेत्र बताया जा सके, इसलिए यह योजना केवल इतना दिखाती है "
            "कि {career} में क्या शामिल है। कुछ और जवाब देने पर यह आपके बारे में कुछ कह सकेगी।",
        )
    text = _pick(frame, language).replace("{strong}", strong_text).replace(
        "{career}", career_title or "this work"
    )
    if plan.get("unmeasured"):
        text += " " + _pick(_UNMEASURED_TAIL, language)
    return text


_UNMEASURED_TAIL = _bi(
    "Areas with too few answers to score are listed separately as unknown, never as weak.",
    "जिन क्षेत्रों में जवाब कम रहे ताकि उन्हें आँका जा सके, वे अलग से अज्ञात लिखे गए हैं, कमज़ोर नहीं।",
)


def _join(labels: list[str], language: str) -> str:
    if not labels:
        return ""
    if len(labels) == 1:
        return labels[0]
    joiner = " और " if language == "hi" else " and "
    return joiner.join(labels[:2])
