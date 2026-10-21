"""Learning the student's situation from the conversation instead of a form.

The onboarding screen asks a single question — student or parent. Everything the
guide used to demand up front (class, age, where they study, what the family can
spend) is now asked inside the conversation, one fact per turn.

Two rules keep this honest:

* Detection is deliberately narrow. A number only becomes a class or an age when
  it sits next to a word that means class or age, in any of the three languages
  the guide speaks. A wrong guess would silently shape a child's recommendations,
  so an uncertain answer is simply left unknown and asked again as normal chat.
* Nothing stores the student's own sentence in the situation fields. What gets
  saved is a short, fixed description, so the profile holds less personal text
  than the old form did.
"""

from __future__ import annotations

import re

# Stored as "class-6" … "class-12", matching the vocabulary in app/routers/auth.py
# and the frontend's CLASS_OPTIONS. The app serves classes 6 to 12; a younger answer
# is not a class this product has content for, so it is left unknown rather than stored.
CLASS_MIN, CLASS_MAX = 6, 12

_AGE_BANDS = (
    (5, "3-5"),
    (8, "6-8"),
    (10, "9-10"),
    (12, "11-12"),
    (120, "adult"),
)

# The ages a stated number is kept for. Deliberately wide: typing one's own age is
# a fact, not a choice of product tier, and the class floor above is what gates the
# content. Outside this range the number is ignored rather than stored — a profile
# holding "age 200" is a worse outcome than one holding nothing.
AGE_MIN, AGE_MAX = 3, 99


def band_for_age(years: int) -> str:
    """The band an exact age sits in.

    `age_range` is derived from `age` wherever a student states a number, so the
    five labels the guide's framework works in never have to be chosen by hand.
    """
    for ceiling, band in _AGE_BANDS:
        if years <= ceiling:
            return band
    return _AGE_BANDS[-1][1]

_NUM_WORDS = {
    "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}

# Hindi/Devanagari class words, because many students answer "आठवीं" not "8".
_HINDI_CLASS_WORDS = {
    "तीन": 3, "चौथ": 4, "पाँच": 5, "पांच": 5, "छह": 6, "सात": 7, "आठ": 8,
    "नौ": 9, "दस": 10, "ग्यारह": 11, "बारह": 12,
    "तीसरी": 3, "चौथी": 4, "पाँचवीं": 5, "पांचवीं": 5, "छठी": 6, "सातवीं": 7,
    "आठवीं": 8, "नवीं": 9, "नवमीं": 9, "दसवीं": 10, "ग्यारहवीं": 11, "बारहवीं": 12,
}
_DEV_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

_CLASS_PATTERNS = (
    re.compile(r"\b(?:class|kl|cl)\.?\s*(?:no\.?\s*)?(\d{1,2})\b", re.I),
    re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)\s+(?:class|standard)\b", re.I),
    re.compile(r"\b(?:class|standard)\s+(" + "|".join(_NUM_WORDS) + r")\b", re.I),
    re.compile(r"\b(?:class|कक्षा)\s+(?:is|है)\s*(\d{1,2})\b", re.I),
    re.compile(r"कक्षा\s*[-:]?\s*(\d{1,2}|[०-९]{1,2})"),
    re.compile(r"(" + "|".join(_HINDI_CLASS_WORDS) + r")(?:वीं|थी)?\s*(?:कक्षा|class)"),
    re.compile(r"\b(\d{1,2}|[०-९]{1,2})\s*(?:वीं|वां|वाँ)\s*(?:class|कक्षा)\b"),
)

# "class 3 hours of study" states a duration, not a grade. A number followed by a
# unit of time is never a class, whichever turn it arrives in.
_CLASS_MEASURE = re.compile(
    r"\s*(?:and|for)?\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?|"
    r"ghante?|ghanTe| minute|din| hafta|mahine?|baar|baar|times?)\b",
    re.I,
)

_AGE_PATTERNS = (
    re.compile(r"\b(?:i(?:'?m| am)|meri umr|umr|age|varsh)\s*(?:is|hai|of)?\s*(\d{1,2})\b", re.I),
    re.compile(r"\b(\d{1,2})\s*(?:years?\s*old|year\s*old|saal|saal\s*ka|varsh|साल|वर्ष)\b", re.I),
    re.compile(r"उम्र\s*(?:की|का|है|हूँ)?\s*(\d{1,2}|[०-९]{1,2})"),
)

# Fixed descriptions: the student's words are never stored here.
_EDUCATION_CUES = (
    ("government school", "Studies at a government school."),
    ("govt school", "Studies at a government school."),
    ("govt. school", "Studies at a government school."),
    ("sarkari school", "Studies at a government school."),
    ("सरकारी स्कूल", "Studies at a government school."),
    ("private school", "Studies at a private school."),
    ("प्राइवेट स्कूल", "Studies at a private school."),
    ("homeschool", "Home schooled."),
    ("home school", "Home schooled."),
    ("government college", "Studies at a government college."),
    ("private college", "Studies at a private college."),
    ("not studying", "Currently not studying."),
    ("left school", "Currently not studying."),
    ("dropped out", "Currently not studying."),
    ("padhai chhodi", "Currently not studying."),
    ("padhai chhod", "Currently not studying."),
)

_FINANCIAL_CUES = (
    "can't afford",
    "cannot afford",
    "afford nahi",
    "no money",
    "paise nahi",
    "पैसे नहीं",
    "पैसा नहीं",
    "bahut mehnga",
    "बहुत महंगा",
    "बहुत महँगा",
    "tight budget",
    "low cost only",
    "free options only",
    "sasta hi",
)


def detect_class_level(text: str) -> str | None:
    for pattern in _CLASS_PATTERNS:
        for match in pattern.finditer(text):
            if _CLASS_MEASURE.match(text[match.end() : match.end() + 16]):
                continue
            word = match.group(1).lower().strip()
            number = _NUM_WORDS.get(word) or _HINDI_CLASS_WORDS.get(word)
            if number is None:
                raw = word.translate(_DEV_DIGITS)
                number = int(raw) if raw.isdigit() else None
            if number is None or not (CLASS_MIN <= number <= CLASS_MAX):
                continue
            return f"class-{number}"
    return None


def detect_age_years(text: str) -> int | None:
    """The exact age in years this message states about the student themselves.

    Kept as a number, because that is what was said: "main 14 saal ka hoon" states 14,
    not "the 11-to-12 band". The band is derived from it at `band_for_age`.
    """
    for pattern in _AGE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        raw = match.group(1).translate(_DEV_DIGITS)
        if not raw.isdigit():
            continue
        years = int(raw)
        if not (AGE_MIN <= years <= AGE_MAX):
            continue
        return years
    return None


def detect_age_range(text: str) -> str | None:
    years = detect_age_years(text)
    return band_for_age(years) if years is not None else None


def detect_education(text: str) -> str | None:
    lowered = text.lower()
    for cue, description in _EDUCATION_CUES:
        if cue in text or cue.lower() in lowered:
            return description
    return None


def detect_financial(text: str) -> str | None:
    lowered = text.lower()
    if any(cue in lowered or cue in text for cue in _FINANCIAL_CUES):
        return "The family said cost is a constraint, so low-cost and free paths come first."
    return None


def detect_facts(text: str) -> dict[str, object]:
    """Everything this message states clearly, keyed by StudentProfile column."""
    found: dict[str, object] = {}
    if cls := detect_class_level(text):
        found["class_level"] = cls
    if years := detect_age_years(text):
        found["age"] = years
        found["age_range"] = band_for_age(years)
    if edu := detect_education(text):
        found["education_context"] = edu
    if money := detect_financial(text):
        found["financial_context"] = money
    return found


# A class or age number sitting next to the word "class" is easy to misread in
# free text, so it becomes a stored fact on one of two paths: the whole message is
# short enough to read as an answer, or a sentence inside a longer message clearly
# states it about the student.
_SHORT_ANSWER_WORDS = 7
_CONTEXTUAL_KEYS = ("class_level", "age", "age_range")

# The third path needs the number to sit in a sentence that also says who it is
# about, so "mere papa class 12 mein the" cannot become the student's class.
_SELF_SUBJECT = re.compile(
    r"\b(?:i'?m|i am|i study|my|main|mai|mujhe|mera|meri|hamara|hamari)\b|मैं|मेरा|मेरी|मुझे",
    re.I,
)
_SELF_COPULA = re.compile(
    r"\b(?:is|are|am|in|study|studies|studying|study|hoon|hun|hai|hain|jaata|jaati|rehata|rehati|"
    r"karta|karti|khaata|khaati|padhta|padhti)\b|हूँ|हुं|है|पढ़",
    re.I,
)


def self_stated(key: str, text: str) -> str | int | None:
    """The class or age this message states about the student themselves.

    `age` and `age_range` are the same statement read two ways, so they get here through
    the same sentence and the same care: whichever number this finds, the caller stores
    the years and derives the band from them.
    """
    detectors = {"class_level": detect_class_level, "age": detect_age_years}
    detect = detectors.get(key, detect_age_range)
    for sentence in re.split(r"[.!?\n;,]+", text):
        if not _SELF_SUBJECT.search(sentence) or not _SELF_COPULA.search(sentence):
            continue
        if found := detect(sentence):
            return found
    return None


def applicable_facts(text: str, current: dict[str, object]) -> dict[str, object]:
    """What this message proves, given what is already known.

    A class or age is trusted when the message is short enough to read as an
    answer to the guide's question, or when a sentence inside a longer message
    states it about the student. Being asked is not enough: an answer of any
    length can carry somebody else's class, and a wrong one would steer the
    recommendations quietly.
    """
    selected: dict[str, object] = {}
    for key, value in detect_facts(text).items():
        if current.get(key):
            # Never overwrite something the student already told us.
            continue
        if key in _CONTEXTUAL_KEYS and len(text.split()) > _SHORT_ANSWER_WORDS:
            value = self_stated(key, text)
            if value is None:
                continue
        selected[key] = value
    return selected


# What the guide still needs, in the order it should ask. `interests` is absent
# on purpose: the guide already learns those from every reply through
# InterestObservation rows, and the stage-2 question covers it.
FACT_ORDER = ("class_level", "age_range", "education_context", "financial_context")

# A fact is only raised once the conversation has reached this stage, so the
# guide does not interrogate a child before it has said anything useful.
FACT_MIN_STAGE = {
    "class_level": 1,
    "age_range": 1,
    "education_context": 3,
    "financial_context": 5,
}

FACT_QUESTION: dict[str, dict[str, str]] = {
    "class_level": {
        "en": "Before we go on, which class are you in at school right now?",
        "hi": "आगे बढ़ने से पहले बताइए, आप अभी स्कूल में कौन-सी कक्षा में हैं?",
        "hinglish": "Aage badhne se pehle batao, tum abhi school mein kaunsi class mein ho?",
    },
    "age_range": {
        "en": "Roughly how old are you? That only changes how simply I explain things.",
        "hi": "आपकी उम्र लगभग कितनी है? इससे बस मेरी समझाने का तरीका बदलता है।",
        "hinglish": "Tumhari age roughly kitni hai? Isse bas meri samjhane ka style change hota hai.",
    },
    "education_context": {
        "en": "Where are you studying now, a government school, a private one, or something else?",
        "hi": "अभी आप कहाँ पढ़ रहे हैं — सरकारी स्कूल, प्राइवेट स्कूल, या कुछ और?",
        "hinglish": "Abhi tum kahan padh rahe ho, government school, private school, ya kuch aur?",
    },
    "financial_context": {
        "en": "So that I only suggest paths that fit: does your family need low-cost or free options?",
        "hi": "ताकि मैं वही रास्ते बताऊँ जो आपके बस में हों: क्या आपको कम खर्चे या मुफ़्त विकल्प चाहिए?",
        "hinglish": "Taaki main wahi options bataun jo fit ho: tumhare family ko low-cost ya free options chahiye?",
    },
}


def missing_facts(
    class_level: str | None,
    age_range: str | None,
    education_context: str | None,
    financial_context: str | None,
) -> list[str]:
    known = {
        "class_level": class_level,
        "age_range": age_range,
        "education_context": education_context,
        "financial_context": financial_context,
    }
    missing = [key for key in FACT_ORDER if not known[key]]
    # A known class already places the student in an age band, which is what the
    # guide actually needs. Asking the age as well would be a wasted question.
    if "age_range" in missing and (class_level or known["age_range"]):
        missing.remove("age_range")
    return missing


def asked_keys(messages) -> list[str]:
    """Which fact questions this guide has already put in this conversation.

    Derived from the stored transcript rather than a new database column, so
    asking once per fact needs no migration.
    """
    transcript = " ".join(message.content for message in messages if message.role == "assistant")
    asked: list[str] = []
    for key, per_language in FACT_QUESTION.items():
        if any(question in transcript for question in per_language.values()):
            asked.append(key)
    return asked
