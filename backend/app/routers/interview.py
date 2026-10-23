"""A practice interview, one turn per request.

The route is deliberately stateless. The student's browser holds the transcript and
posts it again each turn (`{role, history}`), so the interview exists in exactly one
place and disappears when the tab does. That is not laziness: a mock interview collects
the most personal things a student says about themselves, and the alternative — a table
of transcripts — would need a migration, a retention clock, an owner check on every read
and a place in the erasure route, all to keep something nobody was going to look at
again. `scripts/interview_test.py` proves the claim by counting rows before and after a
whole sitting, and there is no `db` dependency here to write one with.

One router, on the `/api/ai` prefix, because every turn spends an outside call and there
is nothing else here to own: `resume.py` set the precedent of a feature module
registering its own `ai_router` next to its document routes.

The five-question limit is enforced in `services/mock_interview.py`, not here and not in
the prompt, so the answer does not depend on a model keeping count.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..middleware.rate_limit import interview_limit
from ..models import User
from ..schemas import MockInterviewIn, MockInterviewOut
from ..security import get_current_user, require_student
from ..services import mock_interview

ai_router = APIRouter(prefix="/api/ai", tags=["ai"])


@ai_router.post("/mock-interview", response_model=MockInterviewOut)
@interview_limit
async def mock_interview_turn(
    request: Request,
    payload: MockInterviewIn,
    user: User = Depends(get_current_user),
) -> MockInterviewOut:
    """Ask the interviewer for its next question, or for the closing.

    The reply says which of the two it is, and it never hides where it came from:
    `demo_generated` is true whenever no model answered, and in that case `feedback` and
    `score` are null as well, because a scripted "good answer" about an answer nobody
    read is a judgement this project will not print. The screen has to repeat both facts
    back to the student rather than showing a green tick it was handed.

    `language` is optional. Left out, the service reads it off the student's own last
    answer, so a child who switches to Hindi mid-interview is followed rather than
    corrected — and before their first answer there is nothing to read, so the account's
    own language stands.
    """
    # Checked for the 403 it raises: this is a student practising with their own future,
    # and a parent running an interview *at* a child is a different feature with a
    # different consent story.
    require_student(user)
    reply = await mock_interview.run(
        role=payload.role,
        transcript=[
            mock_interview.TranscriptTurn(role=line.role, text=line.text)
            for line in payload.history
        ],
        default_language=payload.language or user.preferred_language or "en",
    )
    return MockInterviewOut(
        question=reply.question,
        feedback=reply.feedback,
        question_number=reply.question_number,
        finished=reply.finished,
        score=reply.score,
        tips=reply.tips,
        provider=reply.provider,
        demo_generated=reply.demo_generated,
        needs_support=reply.needs_support,
        error=reply.error,
        language=reply.language,
    )
