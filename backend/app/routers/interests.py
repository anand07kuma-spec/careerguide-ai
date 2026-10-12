"""Interest discovery: everyday prompts, not an aptitude test."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import InterestObservation, JourneyEvent
from ..schemas import InterestAnswerIn, InterestSummaryOut, ObservationOut, ThemeSummary
from ..security import require_student
from ..services.language import detect as detect_language
from ..services.themes import THEMES, detect_themes, expresses_uncertainty

router = APIRouter(prefix="/api/interests", tags=["interests"])

# Prompts are deliberately open and repeatable. Nothing here scores a child.
# Each one exists in the three registers the app speaks, because this screen is
# the guide talking, and it should talk in the language the student is using.
PROMPTS: list[dict] = [
    {
        "id": "free-time",
        "question": "What do you enjoy doing when you get free time?",
        "hint": "Anything counts, even watching or listening.",
        "hinglish_question": "Jab free time milta hai toh tumhe kya karna pasand hai?",
        "hinglish_hint": "Kuch bhi chalega - dekhna, sunna, sab counts karta hai.",
        "hi_question": "जब आपको फ्री टाइम मिलता है तो आपको क्या करना पसंद है?",
        "hi_hint": "कोई भी जवाब चलेगा — देखना या सुनना भी।",
    },
    {
        "id": "school-curiosity",
        "question": "What kind of school activity makes you curious?",
        "hint": "A subject, a project, or even a particular teacher's class.",
        "hinglish_question": "School mein kaisi activity tumhe curious banati hai?",
        "hinglish_hint": "Koi subject, project, ya kisi teacher ka class bhi.",
        "hi_question": "स्कूल में कैसी गतिविधि आपको सबसे ज़्यादा उत्सुक बनाती है?",
        "hi_hint": "कोई विषय, कोई प्रोजेक्ट, या किसी टीचर का क्लास भी।",
    },
    {
        "id": "either-or",
        "question": "Do you like building things, solving puzzles, helping people, creating art, exploring nature, or playing sports?",
        "hint": "Pick as many as feel right.",
        "hinglish_question": "Tumhe kya achcha lagta hai - cheezein banana, puzzle solve karna, madad karna, art banana, nature dekhna, ya sports?",
        "hinglish_hint": "Jitne chahe utne pick karo.",
        "hi_question": "आपको क्या अच्छा लगता है — चीज़ें बनाना, पहेली हल करना, मदद करना, कला बनाना, प्रकृति देखना, या खेलना?",
        "hi_hint": "जितने चाहें उतने चुनिए।",
    },
    {
        "id": "want-to-learn",
        "question": "What is something you would like to learn if you had the chance?",
        "hint": "It can be big or small.",
        "hinglish_question": "Agar mauka mile toh tum kya seekhna chahoge?",
        "hinglish_hint": "Badi cheez ho ya chhoti, koi baat nahi.",
        "hi_question": "अगर मौका मिले तो आप क्या सीखना चाहेंगे?",
        "hi_hint": "बड़ी हो या छोटी, कोई बात नहीं।",
    },
    {
        "id": "best-project",
        "question": "Which school project did you enjoy most, and why?",
        "hint": "The why matters more than the project.",
        "hinglish_question": "School ka kaunsa project tumhe sabse zyada pasand aaya, aur kyun?",
        "hinglish_hint": "Project se zyada 'kyun' important hai.",
        "hi_question": "स्कूल का कौन सा प्रोजेक्ट आपको सबसे ज़्यादा अच्छा लगा, और क्यों?",
        "hi_hint": "प्रोजेक्ट से ज़्यादा 'क्यों' ज़रूरी है।",
    },
    {
        "id": "rather-do",
        "question": "Would you rather make something, investigate something, organise something, perform something, or help someone?",
        "hint": "There is no best answer.",
        "hinglish_question": "Tum ye karna chahoge - banana, investigate karna, organise karna, perform karna, ya kisi ki help karna?",
        "hinglish_hint": "Iska koi best answer nahi hai.",
        "hi_question": "आप यह करना चाहेंगे — कुछ बनाना, कुछ जाँचना, कुछ आयोजित करना, कुछ प्रस्तुत करना, या किसी की मदद करना?",
        "hi_hint": "इसका कोई सबसे अच्छा जवाब नहीं है।",
    },
    {
        "id": "world-problem",
        "question": "Is there a problem in the world you would love to solve?",
        "hint": "Any problem, near or far.",
        "hinglish_question": "Kya duniya mein koi aisi problem hai jise tum solve karna chahoge?",
        "hinglish_hint": "Koi bhi problem - paas ki ya door ki.",
        "hi_question": "क्या दुनिया में कोई ऐसी समस्या है जिसे आप हल करना चाहेंगे?",
        "hi_hint": "कोई भी समस्या — पास की या दूर की।",
    },
]

NOTES = {
    "en": (
        "These are conversation starters, not a test. You can answer in any language, "
        "skip anything, and change your mind later."
    ),
    "hinglish": (
        "Yeh baat shuru karne ke liye hain, koi test nahi. Tum kisi bhi bhasha mein "
        "jawab de sakte ho, kuch bhi chhod sakte ho, aur baad mein mann badal sakte ho."
    ),
    "hi": (
        "ये बात शुरू करने के लिए हैं, कोई परीक्षा नहीं। आप किसी भी भाषा में जवाब दे सकते "
        "हैं, कुछ भी छोड़ सकते हैं, और बाद में मन बदल सकते हैं।"
    ),
}


def _in_language(prompt: dict, language: str) -> dict:
    """Flatten one prompt to `question`/`hint` in the requested language."""
    if language in ("en", "hi", "hinglish") and language != "en":
        return {
            "id": prompt["id"],
            "question": prompt[f"{language}_question"],
            "hint": prompt[f"{language}_hint"],
        }
    return {"id": prompt["id"], "question": prompt["question"], "hint": prompt["hint"]}


@router.get("/prompts")
def prompts(language: str = "hinglish") -> dict:
    chosen = language if language in ("en", "hi", "hinglish") else "en"
    return {
        "prompts": [_in_language(item, chosen) for item in PROMPTS],
        "note": NOTES[chosen],
        "language": chosen,
    }


def _acknowledgement(answer: str, saved_any: bool) -> str:
    spoken = detect_language(answer)
    if spoken == "hi":
        return (
            "दरज किया गया। आप कभी भी मन बदल सकते हैं; रुचियाँ काफ़ी घूमती हैं।"
            if saved_any
            else "जवाब देने के लिए धन्यवाद। यह भी उपयोगी है, हम दूसरा रुख़ आज़मा सकते हैं।"
        )
    if spoken == "hinglish":
        return (
            "Noted. Tum kabhi bhi mann badal sakte ho, interests kaafi ghoomte rehte hain."
            if saved_any
            else "Thanks for answering. Yeh bhi kaam ka hai, hum dusra angle try kar sakte hain."
        )
    return (
        "Noted. You can change your mind any time, interests move around a lot."
        if saved_any
        else "Thanks for answering. That is useful too, and we can try another angle."
    )


@router.post("/answers")
def record_answer(
    payload: InterestAnswerIn,
    student_id: int = Depends(require_student),
    db: Session = Depends(get_db),
) -> dict:
    themes = detect_themes(payload.answer)
    saved: list[dict] = []
    quote = payload.answer.strip()[:280]

    if themes:
        for theme in themes:
            db.add(
                InterestObservation(
                    student_id=student_id,
                    session_id=payload.session_id,
                    theme=theme,
                    evidence=quote,
                    source="interest_activity",
                )
            )
            saved.append({"theme": theme, "label": THEMES[theme]["label"]})
        db.add(
            JourneyEvent(
                student_id=student_id,
                kind="interest_activity",
                title="Completed an interest exploration",
                detail=", ".join(item["label"] for item in saved),
            )
        )
    db.commit()

    return {
        "saved_themes": saved,
        "uncertainty_noted": expresses_uncertainty(payload.answer) and not themes,
        "message": _acknowledgement(payload.answer, bool(saved)),
    }


@router.get("/observations", response_model=list[ObservationOut])
def observations(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> list[ObservationOut]:
    rows = list(
        db.scalars(
            select(InterestObservation)
            .where(InterestObservation.student_id == student_id)
            .order_by(InterestObservation.id.desc())
            .limit(60)
        )
    )
    return [ObservationOut.model_validate(r) for r in rows]


@router.get("/summary", response_model=InterestSummaryOut)
def summary(
    student_id: int = Depends(require_student), db: Session = Depends(get_db)
) -> InterestSummaryOut:
    rows = list(
        db.scalars(
            select(InterestObservation)
            .where(InterestObservation.student_id == student_id)
            .order_by(InterestObservation.id.desc())
        )
    )
    grouped: dict[str, list[str]] = {}
    for row in rows:
        grouped.setdefault(row.theme, []).append(row.evidence)

    themes = [
        ThemeSummary(
            theme=theme,
            label=THEMES[theme]["label"],
            blurb=THEMES[theme]["blurb"],
            evidence=evidence[:3],
            suggested_categories=THEMES[theme]["categories"],
        )
        for theme, evidence in grouped.items()
        if theme in THEMES
    ]

    if not themes:
        note = (
            "Nothing has been explored yet, which is a perfectly fine place to start. "
            "Answer a few prompts or have one conversation and themes will appear here."
        )
    else:
        note = (
            "These are exploratory observations from things you chose to share. They are not "
            "a psychological assessment or an aptitude result, and they can change over time."
        )

    return InterestSummaryOut(themes=themes, note=note)
