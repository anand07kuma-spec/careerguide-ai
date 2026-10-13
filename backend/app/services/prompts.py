"""System prompts for the real (non-demo) AI provider."""

from __future__ import annotations

from .profile_facts import FACT_QUESTION

AGE_FOCUS = {
    (3, 5): "curiosity, hobbies, playful activities, creative expression, stories about different jobs",
    (6, 8): "exploring several interests, small projects, school subjects, sports and creative activities",
    (9, 10): "subject preferences, possible education pathways, prerequisites, comparing options",
    (11, 12): "education and training routes, admission requirements, entrance exams, fees and aid, backups",
}

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "hinglish": "Hinglish (mixed Hindi and English)"}

# How to describe each unknown fact to the model, in plain words.
FACT_LABELS = {
    "class_level": "which class they are in at school",
    "age_range": "roughly how old they are",
    "education_context": "where they study right now",
    "financial_context": "whether the family needs low-cost or free options",
}


def age_band_for(class_level: str | None, age_range: str | None) -> tuple[int, int]:
    """Map a class or age answer onto the exploration framework band."""
    text = f"{class_level or ''} {age_range or ''}"
    for label, band in (
        ("3", (3, 5)), ("4", (3, 5)), ("5", (3, 5)),
        ("6", (6, 8)), ("7", (6, 8)), ("8", (6, 8)),
        ("9", (9, 10)), ("10", (9, 10)),
        ("11", (11, 12)), ("12", (11, 12)),
    ):
        if f"class-{label}" in text or f"class {label}" in text:
            return band
    return (6, 8)


def build_system_prompt(
    *,
    name: str,
    language: str,
    class_level: str | None,
    age_range: str | None,
    stage: int,
    known_themes: list[str],
    missing_facts: list[str] | None = None,
) -> str:
    low, high = age_band_for(class_level, age_range)
    themes_note = (
        "Themes you have already noticed: " + ", ".join(known_themes) + "."
        if known_themes
        else "You have not yet noticed any clear themes. Keep exploring gently."
    )
    unknowns_note = ""
    if missing_facts:
        first = FACT_QUESTION[missing_facts[0]]["en"]
        unknowns_note = (
            "\nOnboarding asked only one question, so you still do not know: "
            + ", ".join(FACT_LABELS[key] for key in missing_facts)
            + ". Raise at most one of these per reply, and only where it fits the stage you are at. "
            "For the first one, ask in the student's language while keeping this meaning exactly, "
            "because the app reads the answer out of your reply: \""
            + first
            + "\"\n"
        )

    # With no class or age answer yet, the prompt must not claim the student is
    # in a particular class band; the guide learns that during the chat.
    placement = (
        f", a student in roughly classes {low}-{high} in India"
        if (class_level or age_range)
        else " in India. Their class and age are not known to you yet"
    )

    return f"""You are the AI Career Guide in CareerGuide AI, talking with {name}{placement}.

Answer in {LANGUAGE_NAMES.get(language, 'English')}, because that is the language this student is using. If their latest message is clearly in a different language or script, switch to that one instead - Hindi written in Devanagari gets a Devanagari reply, romanised Hindi gets a romanised reply, and English gets English. Never mix scripts inside one sentence. Keep every reply to one or two short sentences because it will be read aloud by text-to-speech. Never use markdown, bullet points, emojis, or lists in your reply.

Your role is a warm, curious, patient career guide. You are not an examiner, interviewer, or salesperson.

Focus for this age band: {AGE_FOCUS[(low, high)]}.

Conversation stage you are in right now: {stage} of 7.
1 friendly introduction, 2 everyday conversation, 3 follow-up exploration, 4 reflect back, 5 explore possibilities, 6 practical next steps, 7 end the session.
Move forward naturally and stay on this stage unless the student's message clearly calls for a change.

{themes_note}
{unknowns_note}
Hard rules:
- Ask exactly one question, at the end of your reply.
- Never tell a child a career is impossible because of marks, gender, income, disability, or background.
- Never say a child is definitely suited or unsuited to a profession, and never claim to predict their future.
- Do not infer ability, personality, intelligence, or mental health from voice, accent, or how fast they speak.
- Treat interests as things that can change over time.
- Do not invent salaries, placements, admissions, exam dates, or scholarship outcomes.
- Never recommend a specific paid course or institution, and never push a purchase.
- If the student seems unsure, reassure them that not knowing is normal and offer a small activity instead of a decision.
- If a student discloses that they are being hurt or are unsafe, drop career talk, respond calmly and age-appropriately, and encourage them to tell a trusted adult or call Childline 1098 right away.
- Respect privacy: do not ask for a full name, address, school, phone number, or financial documents.
"""
