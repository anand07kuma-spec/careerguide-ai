"""Provider-independent AI conversation layer.

Two implementations live behind `respond()`:

* an OpenAI-compatible HTTP provider used when credentials are configured, and
* a clearly labelled scripted guide used in demo mode.

Demo replies are always flagged with `demo_generated=True` so no part of the
product can present them as real model output.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Message
from . import profile_facts, prompts
from .themes import THEMES, detect_themes, expresses_uncertainty, possible_distress


@dataclass
class GuideReply:
    text: str
    stage: int
    themes: list[str]
    provider: str
    demo_generated: bool
    error: str | None = None
    safety_flag: bool = False
    # Which language the reply came back in, so the caller can pick a matching
    # voice instead of assuming the session never changed.
    language: str = "en"


@dataclass
class GuideContext:
    name: str
    language: str
    class_level: str | None
    age_range: str | None
    stage: int
    known_themes: list[str] = field(default_factory=list)
    career_suggestions: list[str] = field(default_factory=list)
    next_activity: str | None = None
    # Profile facts the conversation should still learn, and the ones already
    # asked about in this session. Onboarding now asks a single question, so the
    # guide picks these up one at a time as the student talks.
    missing_facts: list[str] = field(default_factory=list)
    asked_facts: list[str] = field(default_factory=list)


def _lang(language: str) -> str:
    return language if language in ("en", "hi", "hinglish") else "en"


def _sent(parts: list[str]) -> str:
    """Join sentence choices without leaving stray double spaces."""
    return " ".join(part.strip() for part in parts if part and part.strip())


def _pick(bucket: dict[str, list[str]] | dict[str, str], language: str) -> str:
    value = bucket.get(language) or bucket["en"]
    return random.choice(value) if isinstance(value, list) else value


SAFETY = {
    "en": [
        "Thank you for telling me, that took courage. Your safety matters more than anything we could talk about today.",
        "Please tell a trusted adult right away, or call Childline at 1098. They are there to help you, any time.",
    ],
    "hi": [
        "मुझे यह बताने के लिए धन्यवाद। यह बात करना हिम्मत की बात थी।",
        "कृपया अभी किसी भरोसेमंद बड़े को बताइए, या चाइल्डलाइन 1098 पर कॉल कीजिए। वे हर समय आपकी मदद के लिए हैं।",
    ],
    "hinglish": [
        "Yeh batana bahut brave tha. Career se pehle aapki safety zaroori hai.",
        "Please kisi trusted adult ko abhi batao, ya Childline 1098 par call karo. Ve har time help karte hain.",
    ],
}

OPEN_ACK = {
    "en": [
        "That sounds interesting.",
        "Thanks for sharing that.",
        "I like hearing about that.",
        "Oh, tell me more about that.",
    ],
    "hi": [
        "यह तो अच्छा लगा।",
        "बताने के लिए धन्यवाद।",
        "मुझे यह सुनकर अच्छा लगा।",
        "अच्छा! इसके बारे में थोड़ा और बताइए।",
    ],
    "hinglish": [
        "Yeh toh badhiya hai.",
        "Share karne ke liye thanks.",
        "Achcha laga sun kar.",
    ],
}

STAGE2_QUESTION = {
    "en": [
        "What do you usually enjoy doing when you get free time?",
        "Which school activity makes you the most curious?",
        "If you had a whole afternoon with nothing planned, what would you do?",
    ],
    "hi": [
        "जब आपको फ्री टाइम मिलता है तो आप क्या करना पसंद करते हैं?",
        "स्कूल में कौन-सा काम आपको सबसे ज़्यादा उत्सुक बनाता है?",
        "अगर पूरा दोपहर का समय खाली मिले तो आप क्या करेंगे?",
    ],
    "hinglish": [
        "Jab free time milta hai toh tumhe kya karna achcha lagta hai?",
        "School mein kaunsa activity sabse interesting lagta hai?",
        "Agar poora afternoon khali mile toh kya karoge?",
    ],
}

# One follow-up question per theme: what the student enjoyed about it, never a
# verdict about ability.
THEME_FOLLOW_UP = {
    "creative_exploration": {
        "en": "When you are creating something, what part do you like most, the first idea or the finishing touches?",
        "hi": "जब आप कुछ बनाते हैं, तो सबसे अच्छा कौन सा हिस्सा लगता है — पहला आइडिया या उसे पूरा करना?",
        "hinglish": "Jab tum kuch create karte ho, toh sabse achcha kaunsa part lagta hai, idea sochna ya final touch dena?",
    },
    "analytical_problem_solving": {
        "en": "When you solve a tricky problem, do you enjoy finding the answer or explaining it to someone else?",
        "hi": "जब आप कोई मुश्किल समस्या हल करते हैं, तो जवाब खोजना अच्छा लगता है या किसी और को समझाना?",
        "hinglish": "Jab tum koi mushkil problem solve karte ho, toh answer nikalna achcha lagta hai ya kisi ko samjhana?",
    },
    "practical_building": {
        "en": "What is the best thing you have ever made or fixed with your hands, and what made it work?",
        "hi": "आपने हाथों से सबसे अच्छी क्या चीज़ बनाई या ठीक की, और उसे ख़ास क्या बनाया?",
        "hinglish": "Tumne haath se sabse achhi cheez kya banayi ya fix ki, aur usme kya khaas tha?",
    },
    "communication_collaboration": {
        "en": "When you are with a group, do you like starting the conversation or making sure everyone is heard?",
        "hi": "जब आप ग्रुप में होते हैं, तो बात शुरू करना अच्छा लगता है या सबकी बात सुनिश्चित करना?",
        "hinglish": "Jab tum group mein hote ho, toh baat shuru karna achcha lagta hai ya sabki baat ensure karna?",
    },
    "helping_others": {
        "en": "What kind of helping feels best to you, one person at a time or a whole group at once?",
        "hi": "मदद करके सबसे अच्छा कैसा लगता है — एक इंसान की या पूरी क्लास की?",
        "hinglish": "Help karke sabse achcha kaisa lagta hai, ek person ki ya saari class ki?",
    },
    "physical_activity_sports": {
        "en": "In a game, what do you love most, practising a skill, the match itself, or planning with the team?",
        "hi": "खेल में सबसे ज्यादा क्या अच्छा लगता है — प्रैक्टिस, मैच, या टीम के साथ प्लान बनाना?",
        "hinglish": "Sports mein sabse zyada kya achcha lagta hai, practice, match, ya team ke saath plan banana?",
    },
    "nature_scientific_curiosity": {
        "en": "What is the last thing about the world around you that made you ask why?",
        "hi": "आपके आसपास की दुनिया में आखिरी कौन सी चीज़ देखकर आपको 'क्यों' पूछने का मन किया?",
        "hinglish": "Aas paas ki duniya mein aakhri kaunsi cheez dekhi jisne tumhe 'kyun' puchne par majboor kiya?",
    },
    "organization_leadership": {
        "en": "When something is being organised, do you like deciding the plan or making sure it actually happens?",
        "hi": "जब कोई आयोजन हो रहा होता है, तो प्लान बनाना अच्छा लगता है या उसे पूरा कराना?",
        "hinglish": "Jab koi event organize hota hai, toh plan banana achcha lagta hai ya use execute karna?",
    },
}

REFLECT = {
    "en": "It sounds like you enjoy {themes}. Did I understand you correctly?",
    "hi": "ऐसा लगता है आपको {themes} पसंद हैं। मैंने सही समझा ना?",
    "hinglish": "Lagta hai tumhe {themes} pasand hain. Main sahi samjha na?",
}

POSSIBILITIES = {
    "en": "Based on what you said, {careers} could be fun to explore. Which one shall we look at first?",
    "hi": "आपकी बातों से लगता है कि {careers} के बारे में जानना अच्छा रहेगा। पहले कौन-सा देखें?",
    "hinglish": "Tumhari baaton se lagta hai {careers} explore karne mein maza aayega. Pehle kaun sa dekhein?",
}

NEXT_STEP = {
    "en": "A small next step: {activity}. Would you like me to save that in your plan?",
    "hi": "एक छोटा अगला कदम: {activity}। क्या मैं इसे आपके प्लान में जोड़ दूं?",
    "hinglish": "Ek chhota next step: {activity}. Main ise tumhare plan mein add kar doon?",
}

CLOSING = {
    "en": "We covered some good things today. Should I save this summary so you can look at it with your family later?",
    "hi": "आज हमने अच्छी बातें कीं। क्या मैं यह सारांश सहेज दूं ताकि आप परिवार के साथ बाद में देख सकें?",
    "hinglish": "Aaj humne achhi baatein ki. Main yeh summary save kar doon taaki tum family ke saath dekh sako?",
}

NO_IDEA = {
    "en": [
        "Not knowing yet is completely normal, most people keep exploring for years.",
        "Would it help to try one small thing? We could look at a puzzle, a drawing, a sport, or how something works.",
    ],
    "hi": [
        "अभी न जानना बिल्कुल सामान्य है; ज़्यादातर लोग सालों तक खोजते रहते हैं।",
        "क्या एक छोटी चीज़ आज़माएं? हम कोई पहेली, चित्र, खेल, या कोई चीज़ कैसे काम करती है — इसे देख सकते हैं।",
    ],
    "hinglish": [
        "Abhi na pata hona bilkul normal hai, zyadatar log saalon tak explore karte rehte hain.",
        "Ek chhoti cheez try karein? Hum puzzle, drawing, sport, ya koi cheez kaise kaam karti hai dekh sakte hain.",
    ],
}

SHORT_CLARIFY = {
    "en": [
        "Tell me a little more, what was it about that?",
        "I would love one more detail. What did you enjoy about it?",
        "No problem at all. You can say a lot or a little, or skip this one.",
    ],
    "hi": [
        "थोड़ा और बताइए, उसमें आपको क्या अच्छा लगा?",
        "बस एक और बात बताइए — उसमें मज़ा किस चीज़ में आया?",
        "कोई बात नहीं। आप कम या ज़्यादा कह सकते हैं, या इसे छोड़ भी सकते हैं।",
    ],
    "hinglish": [
        "Thoda aur batao, usme kya achcha laga?",
        "Ek aur detail batao, usme kya maza aaya?",
        "Koi baat nahi. Kam ya zyada bolo, ya skip kar do.",
    ],
}

CONTINUE = {
    "en": "We can keep exploring whenever you like. What would you like to talk about now?",
    "hi": "जब आप चाहें तब खोज जारी रख सकते हैं। आज आप किस बारे में बात करना चाहेंगे?",
    "hinglish": "Jab tum chahein explore kar sakte hain. Ab kis baare mein baat karna chahoge?",
}

THEME_WORDS_HI = {
    "creative_exploration": "banana aur kalpana",
    "analytical_problem_solving": "problem solve karna",
    "practical_building": "haathon se cheezein banana",
    "communication_collaboration": "baat karna aur milkar kaam karna",
    "helping_others": "dusron ki madad",
    "physical_activity_sports": "khel aur activity",
    "nature_scientific_curiosity": "nature aur science",
    "organization_leadership": "plan banana aur aage badhana",
}

# Devanagari theme words, used when the student themselves wrote in Devanagari.
THEME_WORDS_DEV = {
    "creative_exploration": "बनाना और कल्पना",
    "analytical_problem_solving": "समस्या हल करना",
    "practical_building": "हाथों से चीज़ें बनाना",
    "communication_collaboration": "बात करना और मिलकर काम करना",
    "helping_others": "दूसरों की मदद",
    "physical_activity_sports": "खेल और गतिविधि",
    "nature_scientific_curiosity": "प्रकृति और विज्ञान",
    "organization_leadership": "प्लान बनाना और आगे बढ़ाना",
}


def _theme_phrase(themes: list[str], language: str) -> str:
    phrases = (
        THEME_WORDS_DEV
        if language == "hi"
        else THEME_WORDS_HI
        if language == "hinglish"
        else {}
    )
    labels = [phrases.get(t, THEMES[t]["label"].lower()) for t in themes[:3]]
    if not labels:
        return ""
    if len(labels) == 1:
        return labels[0]
    joiner = {"hi": " और ", "hinglish": " aur "}.get(language, " and ")
    return ", ".join(labels[:-1]) + joiner + labels[-1]


def _advance(stage: int, new_themes: list[str], text: str) -> int:
    """Move the conversation forward without ever trapping the student."""
    if expresses_uncertainty(text) and not new_themes:
        return max(stage, 2)
    if new_themes:
        return 3 if stage < 3 else stage
    if stage == 1:
        return 2
    if stage == 2:
        return 3 if new_themes else 2
    return min(stage + 1, 7)


def _due_fact_question(ctx: GuideContext) -> str | None:
    """The one profile fact worth asking about right now, or None."""
    for key in ctx.missing_facts:
        if key in ctx.asked_facts:
            continue
        if ctx.stage >= profile_facts.FACT_MIN_STAGE[key]:
            return key
    return None


def demo_respond(user_text: str, ctx: GuideContext) -> GuideReply:
    """Scripted guide used when no AI credentials are configured."""
    language = _lang(ctx.language)
    hits = detect_themes(user_text)
    combined = list(dict.fromkeys([*ctx.known_themes, *hits]))
    safety = possible_distress(user_text)

    if safety:
        return GuideReply(
            text=_sent(list(SAFETY.get(language) or SAFETY["en"])),
            stage=ctx.stage,
            themes=combined,
            provider="demo",
            demo_generated=True,
            safety_flag=True,
        )

    stage = ctx.stage

    # Onboarding deliberately leaves the student's situation unknown, so the
    # guide asks for one missing fact at a time, only once the conversation has
    # reached the stage where it matters, and never twice in a session. It comes
    # before the clarifications below so that a short "hi" still moves the
    # student somewhere useful, and each fact is answered in a turn of its own.
    due = _due_fact_question(ctx)
    if due:
        bucket = profile_facts.FACT_QUESTION[due]
        question = bucket.get(language) or bucket["en"]
        ack = _pick(OPEN_ACK, language) if hits or stage == 1 else ""
        greeting = name_greeting(ctx.name, language) if stage <= 1 else ""
        return GuideReply(
            text=_sent([ack, greeting, question]),
            stage=stage,
            themes=combined,
            provider="demo",
            demo_generated=True,
        )

    # A short or unclear answer gets one gentle clarification, not a verdict. An
    # answer that supplies a profile fact ("class 8") counts as content, not as
    # something unclear.
    if len(user_text.split()) <= 2 and not hits and not profile_facts.detect_facts(user_text):
        return GuideReply(
            text=_pick(SHORT_CLARIFY, language),
            stage=ctx.stage,
            themes=combined,
            provider="demo",
            demo_generated=True,
        )

    # A student with no idea yet should be reassured, never scored.
    if expresses_uncertainty(user_text) and not combined:
        return GuideReply(
            text=_pick(NO_IDEA, language),
            stage=2,
            themes=combined,
            provider="demo",
            demo_generated=True,
        )

    if hits or stage == 1:
        ack = _pick(OPEN_ACK, language)
    else:
        ack = ""

    if stage <= 1:
        text = _sent([ack, name_greeting(ctx.name, language), pick_stage2(language)])
        stage = 2
    elif stage == 2 or (hits and stage == 3 and len(user_text.split()) > 6):
        theme = hits[0] if hits else (combined[0] if combined else None)
        if theme:
            text = _sent([ack, THEME_FOLLOW_UP[theme][language]])
            stage = 3
        else:
            text = _sent([ack, pick_stage2(language)])
    elif stage == 3:
        theme = combined[0] if combined else None
        if theme:
            text = _pick(REFLECT, language).format(themes=_theme_phrase(combined, language))
            stage = 4
        else:
            text = _sent([ack, pick_stage2(language)])
    elif stage == 4:
        if ctx.career_suggestions:
            careers = _career_phrase(ctx.career_suggestions[:2], language)
            text = _pick(POSSIBILITIES, language).format(careers=careers)
        else:
            text = _pick(REFLECT, language).format(themes=_theme_phrase(combined, language))
        stage = 5
    elif stage == 5:
        if ctx.career_suggestions:
            careers = _career_phrase(ctx.career_suggestions[:2], language)
            text = _pick(POSSIBILITIES, language).format(careers=careers)
            stage = 6
        else:
            activity = ctx.next_activity or "spend twenty minutes finding out how one thing you liked actually works"
            text = _pick(NEXT_STEP, language).format(activity=activity)
            stage = 6
    elif stage == 6:
        activity = ctx.next_activity or "try one small project this week and notice which part held your attention"
        text = _pick(NEXT_STEP, language).format(activity=activity)
        stage = 7
    else:
        text = _pick(CLOSING, language)

    return GuideReply(
        text=" ".join(part for part in text.split() if part).strip(),
        stage=stage,
        themes=combined,
        provider="demo",
        demo_generated=True,
    )


def _career_phrase(titles: list[str], language: str) -> str:
    joiner = {"hi": " और ", "hinglish": " aur "}.get(language, " and ")
    if len(titles) < 2:
        return titles[0] if titles else ""
    return joiner.join(titles[:2])


def name_greeting(name: str, language: str) -> str:
    if language == "hi":
        return f"{name} जी,"
    return f"{name},"


def pick_stage2(language: str) -> str:
    return _pick(STAGE2_QUESTION, language)


async def _openai_compatible_respond(user_text: str, ctx: GuideContext, history: list[Message]) -> GuideReply:
    settings = get_settings()
    system = prompts.build_system_prompt(
        name=ctx.name,
        language=ctx.language,
        class_level=ctx.class_level,
        age_range=ctx.age_range,
        stage=ctx.stage,
        known_themes=ctx.known_themes,
        missing_facts=ctx.missing_facts,
    )
    turns = [{"role": "system", "content": system}]
    for message in history[-12:]:
        role = "assistant" if message.role == "assistant" else "user"
        turns.append({"role": role, "content": message.content})
    turns.append({"role": "user", "content": user_text})

    url = settings.ai_base_url.rstrip("/") + "/chat/completions"
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {settings.ai_api_key}"},
            json={
                "model": settings.ai_model,
                "messages": turns,
                "temperature": 0.6,
                "max_tokens": 220,
            },
        )
        response.raise_for_status()
        payload = response.json()
        text = payload["choices"][0]["message"]["content"].strip()

    hits = detect_themes(user_text)
    return GuideReply(
        text=text,
        stage=_advance(ctx.stage, hits, user_text),
        themes=list(dict.fromkeys([*ctx.known_themes, *hits])),
        provider=settings.ai_provider,
        demo_generated=False,
    )


async def respond(
    user_text: str,
    ctx: GuideContext,
    history: list[Message],
    db: Session | None = None,
) -> GuideReply:
    """Generate one age-appropriate guide reply, falling back to demo mode."""
    settings = get_settings()
    reply: GuideReply
    # A disclosure of harm gets the one answer this project has reviewed word for
    # word, whichever provider is configured. Leaving it to a model would let an
    # unvetted sentence be the only thing a frightened child reads back, and would
    # quietly skip the `safety_flag` the router records a support note against.
    if not settings.ai_configured or possible_distress(user_text):
        reply = demo_respond(user_text, ctx)
    else:
        try:
            reply = await _openai_compatible_respond(user_text, ctx, history)
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            reply = demo_respond(user_text, ctx)
            reply.error = (
                "The configured AI provider could not be reached, so this reply came "
                "from the built-in guide instead."
            )
    # Whatever produced the reply, the caller needs to know which language it came
    # back in so text-to-speech picks a voice that can actually pronounce it.
    reply.language = _lang(ctx.language)
    return reply
