"""One turn of a practice interview, from the configured model or from this app's own list.

Three decisions in this file are the whole feature, and all three exist because the
reader is a child:

* **Nothing is stored.** A practice interview holds whatever a student says about
  themselves — family income they mentioned by accident, a project they were proud of,
  a subject they are behind in. So the transcript lives in the browser, is sent again
  with each turn, and this module writes no row. There is nothing here for the erasure
  route to find, because there was never anything to forget.
* **The five-question limit is counted here, not asked for politely.** `TOTAL_QUESTIONS`
  is compared against the number of *candidate* turns the student sent, so a sixth
  question cannot happen by a model losing count, by a tab left open and refreshed, or by
  somebody editing the request body. What arrives past the fifth answer is a closing, and
  the closing cannot ask a question even if the model puts one in its JSON.
* **No model, no judgement.** When no provider is configured — or the one configured did
  not answer usefully — the student gets this app's own questions, `demo_generated=True`,
  and *no feedback and no score*. A scripted sentence that says "good answer" about an
  answer nobody read is the exact fabrication this project refuses everywhere else, and a
  number invented about a child's five answers is worse. The screen has to repeat that
  back, which is what the flag is for.

A disclosure of danger is checked before the model is called and before anything is
scored, and it stops the interview with the one helpline sentence this project has
reviewed word for word — the same text the guide uses, not a second version of it.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

import httpx

from ..config import get_settings
from . import prompts
from .ai_provider import SAFETY
from .language import detect
from .themes import possible_distress

log = logging.getLogger(__name__)

# The brief's "limit to 5 questions", as a number the code enforces.
TOTAL_QUESTIONS = 5

# How much of a reply is allowed to reach a screen. A model can answer with four
# paragraphs of feedback to a twelve-year-old; none of that gets through.
_MAX_FEEDBACK = 240
_MAX_QUESTION = 300
_MAX_TIPS = 4
_MAX_TIP = 180

# A transcript longer than this is not a practice interview, and the older lines are
# not needed to ask the next question. Also the ceiling on what leaves the server.
_MAX_TURNS_SENT = 12

# The three ways the app answers without a model, said differently, because "no AI is
# set up here" and "the AI was set up and did not answer" are different things for a
# student to be told. All three are keys in `frontend/src/lib/hi/interview.ts`.
NO_PROVIDER = (
    "No AI provider is configured on this deployment, so this is a question list rather "
    "than an interview. Nobody is reading your answers, so there is no feedback and no score."
)
UNREACHABLE = (
    "The AI provider could not be reached, so these are this app's own practice questions. "
    "Nobody has read your answers, so there is no feedback and no score."
)
UNUSABLE = (
    "The AI provider did not return a usable reply, so these are this app's own practice "
    "questions. Nobody has read your answers, so there is no feedback and no score."
)

# This app's own questions: role-neutral, answerable by a student with no work
# experience at all, and never asking for anything the privacy rules keep out.
PRACTICE_QUESTIONS = [
    "Tell me about yourself — what do you enjoy doing, at school or outside it?",
    "Describe one project or assignment you worked on, and what your own part in it was.",
    "Tell me about a time something did not go as planned. What did you do next?",
    "What is one thing you taught yourself, and how did you go about learning it?",
    "Why does this work interest you, and what would you like to be doing a year from now?",
]

# General advice, true of any interview, used only when nobody read this student's
# answers. The screen labels it as general because these lines are about interviews,
# not about anything this particular student said.
PRACTICE_TIPS = [
    "Give one real example for every answer — a specific thing you did beats a general quality.",
    "Say what your own part was, not only what the group did.",
    "If you do not know, say so and then say what you would try first.",
    "Keep an answer to about a minute: one point, one example, what happened.",
]

SCRIPTED_CLOSING = (
    "That is five answers — enough for one sitting. Nothing above was judged, because no "
    "model read them."
)


@dataclass
class TranscriptTurn:
    """One line of the conversation, as the browser holds it."""

    role: str
    text: str


@dataclass
class InterviewReply:
    question: str | None = None
    feedback: str | None = None
    question_number: int = 1
    finished: bool = False
    score: int | None = None
    tips: list[str] = field(default_factory=list)
    provider: str = "scripted"
    demo_generated: bool = True
    needs_support: bool = False
    error: str | None = None
    language: str = "en"


def _spoken(value: object, cap: int) -> str | None:
    """One clean line, or None.

    Newlines and runs of spaces are folded away because the reply is spoken and printed
    inside a bubble; the cap is applied to the folded text, so a model that pads with
    tabs cannot spend the limit on whitespace.
    """
    if not isinstance(value, str):
        return None
    text = re.sub(r"\s+", " ", value).strip()
    return text[:cap] or None


def _score_of(value: object) -> int | None:
    """A number the app is willing to print, or None.

    Tolerant of the three ways a model writes a score — `78`, `78.0`, "78/100" — and
    strict about the range, because a score outside 0..100 is a model answering a
    different question and printing it would be inventing a fact about a child.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = int(value)
    elif isinstance(value, str):
        found = re.search(r"\d+", value)
        if not found:
            return None
        number = int(found.group())
    else:
        return None
    return number if 0 <= number <= 100 else None


def _tips_of(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    tips: list[str] = []
    for item in value:
        line = _spoken(item, _MAX_TIP)
        if line:
            tips.append(line)
        if len(tips) >= _MAX_TIPS:
            break
    return tips


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


def _scripted(*, closing: bool, number: int, language: str, reason: str) -> InterviewReply:
    """This app's own questions, and no judgement of anybody's answers."""
    if closing:
        return InterviewReply(
            question=None,
            feedback=SCRIPTED_CLOSING,
            question_number=TOTAL_QUESTIONS,
            finished=True,
            score=None,
            tips=list(PRACTICE_TIPS),
            provider="scripted",
            demo_generated=True,
            error=reason,
            language=language,
        )
    return InterviewReply(
        question=PRACTICE_QUESTIONS[number - 1],
        feedback=None,
        question_number=number,
        finished=False,
        score=None,
        provider="scripted",
        demo_generated=True,
        error=reason,
        language=language,
    )


def _support(language: str) -> str:
    """The reviewed helpline sentence, the same one the guide uses."""
    bucket = SAFETY.get(language) or SAFETY["en"]
    return " ".join(part.strip() for part in bucket if part and part.strip())


async def _ask(
    *,
    role: str,
    transcript: list[TranscriptTurn],
    language: str,
    number: int,
    closing: bool,
) -> dict:
    settings = get_settings()
    system = prompts.build_mock_interview_prompt(
        role=role, language=language, question_number=number, closing=closing
    )
    turns: list[dict] = [{"role": "system", "content": system}]
    for line in transcript[-_MAX_TURNS_SENT:]:
        turns.append(
            {"role": "assistant" if line.role == "interviewer" else "user", "content": line.text}
        )

    url = settings.ai_base_url.rstrip("/") + "/chat/completions"
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {settings.ai_api_key}"},
            json={
                "model": settings.ai_model,
                "messages": turns,
                "temperature": 0.6,
                # Sized for a reasoning model, not for the reply. `resume_suggest` learned
                # this the hard way: a budget that fits the answer alone leaves a thinking
                # model spending all of it on reasoning and returning an empty `content`,
                # which would read to a student as the interviewer going silent.
                "max_tokens": 2500,
            },
        )
        response.raise_for_status()
        text = (response.json()["choices"][0]["message"].get("content") or "").strip()
    if not text:
        raise ValueError("the configured provider returned an empty reply")
    parsed = _parse(text)
    if not isinstance(parsed, dict):
        raise ValueError("the provider returned JSON that was not an object")
    return parsed


async def run(
    *,
    role: str,
    transcript: list[TranscriptTurn],
    default_language: str = "en",
) -> InterviewReply:
    """Ask for the next turn of one practice interview, and never fake a judgement.

    `transcript` is the whole conversation as the student's browser holds it, oldest
    first. The turn is counted out of it — specifically out of the *candidate* lines,
    because those are the answers the interviewer has to respond to — and never taken
    from a number the caller supplied.
    """
    answers = [line for line in transcript if line.role == "candidate"]
    asked = [line for line in transcript if line.role == "interviewer"]
    last_answer = answers[-1].text if answers else None

    # The guide answers in the language it is asked in, and so does this. Before the
    # first answer there is nothing to detect, so the caller's session language stands.
    language = detect(last_answer) if last_answer else default_language

    if last_answer and possible_distress(last_answer):
        return InterviewReply(
            question=None,
            feedback=_support(language),
            # The interview ends here, but not because the five questions were used up,
            # so nothing is scored: a number invented about a child who has just said
            # they are unsafe is not a thing this app prints.
            question_number=min(len(asked), TOTAL_QUESTIONS),
            finished=True,
            score=None,
            tips=[],
            provider="scripted",
            demo_generated=True,
            needs_support=True,
            language=language,
        )

    closing = len(answers) >= TOTAL_QUESTIONS
    number = TOTAL_QUESTIONS if closing else len(answers) + 1

    settings = get_settings()
    if not settings.ai_configured:
        return _scripted(closing=closing, number=number, language=language, reason=NO_PROVIDER)

    try:
        raw = await _ask(
            role=role, transcript=transcript, language=language, number=number, closing=closing
        )
    except httpx.RequestError as exc:
        # The name of the failure only: a student's answers are not logged, and neither
        # is whatever the provider managed to send back.
        log.warning("mock-interview: the provider could not be reached (%s)", type(exc).__name__)
        return _scripted(closing=closing, number=number, language=language, reason=UNREACHABLE)
    except (httpx.HTTPStatusError, KeyError, IndexError, ValueError, TypeError) as exc:
        log.warning(
            "mock-interview: the reply was not usable (%s: %s)", type(exc).__name__, str(exc)[:120]
        )
        return _scripted(closing=closing, number=number, language=language, reason=UNUSABLE)

    feedback = _spoken(raw.get("feedback"), _MAX_FEEDBACK)
    tips = _tips_of(raw.get("tips")) if closing else []
    score = _score_of(raw.get("score")) if closing else None

    if closing:
        # The cap holds even against a model that ignored the instruction: no sixth
        # question leaves this function, and a closing with neither a score nor any tips
        # has not answered the question, so the honest fallback says so instead.
        if score is None and not tips:
            return _scripted(closing=True, number=number, language=language, reason=UNUSABLE)
        return InterviewReply(
            question=None,
            feedback=feedback,
            question_number=TOTAL_QUESTIONS,
            finished=True,
            score=score,
            tips=tips,
            provider=settings.ai_provider,
            demo_generated=False,
            language=language,
        )

    question = _spoken(raw.get("question"), _MAX_QUESTION)
    if not question:
        return _scripted(closing=False, number=number, language=language, reason=UNUSABLE)
    if len(asked) >= TOTAL_QUESTIONS:
        # The student answered a fifth question that this app never asked, so the
        # interview is over however the request body arrived.
        return InterviewReply(
            question=None,
            feedback=feedback,
            question_number=TOTAL_QUESTIONS,
            finished=True,
            score=None,
            tips=list(PRACTICE_TIPS),
            provider=settings.ai_provider,
            demo_generated=False,
            error=(
                "This interview had already used its five questions, so it is closed here "
                "without a score."
            ),
            language=language,
        )
    return InterviewReply(
        question=question,
        feedback=feedback,
        question_number=number,
        finished=False,
        score=None,
        provider=settings.ai_provider,
        demo_generated=False,
        language=language,
    )
