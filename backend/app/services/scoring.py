"""Assessment scoring: the arithmetic, the bands, and the words that travel with them.

Pure functions over the item bank — no database and no request objects — so the
maths can be tested directly and the same code scores a SQLite and a Postgres
sitting.

Two rules hold the whole module together. A dimension with too few answers gets
no number at all rather than a number invented from one reply. And every score
leaves here attached to a band label and the instrument's caveat, because a bare
0-100 next to a child's name is exactly the thing this app promises not to do.
"""

from __future__ import annotations

from . import assessment_bank

LIKERT_MIN = 1
LIKERT_MAX = 5

# Five items per interest area and four per trait: one reply says nothing about the
# other four, so below this the dimension is reported as unanswered, not scored.
MIN_ANSWERED = 2

BANDS = {
    "likert": {
        "light": {"en": "Not much at the moment", "hi": "अभी बहुत नहीं"},
        "some": {"en": "Some", "hi": "कुछ है"},
        "strong": {"en": "Strong", "hi": "मज़बूत"},
        "very_strong": {"en": "Very strong", "hi": "बहुत मज़बूत"},
    },
    "choice": {
        "light": {"en": "Few of these were right", "hi": "इनमें से कम सही थे"},
        "some": {"en": "Some were right", "hi": "कुछ सही थे"},
        "strong": {"en": "Most were right", "hi": "ज़्यादातर सही थे"},
        "very_strong": {"en": "Almost all were right", "hi": "लगभग सब सही थे"},
    },
    "unknown": {
        "en": "Not enough answered yet",
        "hi": "अभी पर्याप्त जवाब नहीं",
    },
}

THRESHOLDS = ((25, "light"), (50, "some"), (75, "strong"), (101, "very_strong"))

# Which exploratory theme each dimension is allowed to point at, using the same
# theme keys the career catalogue already carries. Personality is mapped almost not
# at all on purpose: how a student works describes the shape of a day, not which
# jobs are open to them.
DIMENSION_THEMES: dict[str, dict[str, list[str]]] = {
    "interest": {
        "R": ["practical_building", "physical_activity_sports"],
        "I": ["analytical_problem_solving", "nature_scientific_curiosity"],
        "A": ["creative_exploration"],
        "S": ["helping_others", "communication_collaboration"],
        "E": ["organization_leadership", "communication_collaboration"],
        "C": ["organization_leadership", "analytical_problem_solving"],
    },
    "personality": {
        "O": ["creative_exploration", "nature_scientific_curiosity"],
        "C": ["organization_leadership"],
        "E": ["communication_collaboration"],
        "A": ["helping_others"],
        "N": [],
    },
    "aptitude": {
        "numerical": ["analytical_problem_solving"],
        "verbal": ["communication_collaboration"],
        "logical": ["analytical_problem_solving"],
        "spatial": ["practical_building", "creative_exploration"],
    },
}


def _flip(value: int, keyed: str) -> int:
    """A reverse-worded item scores the other way up on the same scale."""
    return LIKERT_MIN + LIKERT_MAX - value if keyed == "-" else value


def _band(score: int, kind: str) -> str:
    for ceiling, label in THRESHOLDS:
        if score < ceiling:
            return label
    return "very_strong"


def band_label(kind: str, band: str, language: str) -> str:
    entry = BANDS["unknown"] if band == "unknown" else BANDS[kind][band]
    return entry["en"] if language != "hi" else entry["hi"]


def score_items(items: list[dict], answers: dict[str, str]) -> dict:
    """Score every dimension of one instrument from one student's answers.

    `items` are bank entries (`code`, `dimension`, `keyed`, `response_type`,
    `correct_value`); `answers` maps an item code to the stored answer string.
    """
    totals: dict[str, int] = {}
    kinds: dict[str, str] = {}
    values: dict[str, list[int]] = {}
    ignored = 0

    for item in items:
        dimension = item["dimension"]
        totals[dimension] = totals.get(dimension, 0) + 1
        kinds[dimension] = "choice" if item["response_type"] == "choice" else "likert"
        raw = answers.get(item["code"])
        if raw is None or raw == "":
            continue

        if item["response_type"] == "choice":
            # One point for the right option, none for a wrong one, none for
            # something that is not even an option on this item.
            options = {str(option.get("value")) for option in item.get("options_json", [])}
            if raw not in options:
                ignored += 1
                continue
            values.setdefault(dimension, []).append(1 if raw == item.get("correct_value") else 0)
            continue

        try:
            number = int(raw)
        except ValueError:
            ignored += 1
            continue
        if not LIKERT_MIN <= number <= LIKERT_MAX:
            ignored += 1
            continue
        values.setdefault(dimension, []).append(_flip(number, item.get("keyed", "+")))

    dimensions: dict[str, dict] = {}
    for dimension, total in totals.items():
        kind = kinds[dimension]
        answered = values.get(dimension, [])

        if len(answered) < MIN_ANSWERED:
            dimensions[dimension] = {
                "kind": kind,
                "answered": len(answered),
                "total": total,
                "correct": sum(answered) if kind == "choice" else None,
                "score": None,
                "band": "unknown",
            }
            continue

        if kind == "choice":
            score = round(sum(answered) / len(answered) * 100)
        else:
            lowest = len(answered) * LIKERT_MIN
            highest = len(answered) * LIKERT_MAX
            score = round((sum(answered) - lowest) / (highest - lowest) * 100)

        dimensions[dimension] = {
            "kind": kind,
            "answered": len(answered),
            "total": total,
            "correct": sum(answered) if kind == "choice" else None,
            "score": score,
            "band": _band(score, kind),
        }

    answered_items = sum(entry["answered"] for entry in dimensions.values())
    return {
        "dimensions": dimensions,
        "totals": {
            "items": len(items),
            "answered": answered_items,
            "ignored": ignored,
            "completeness": round(answered_items / len(items) * 100) if items else 0,
        },
    }


def traits(assessment_type: str, language: str, scored: dict) -> list[dict]:
    """Every dimension, ranked, with the label and description to show beside it."""
    meta = assessment_bank.instrument(assessment_type)
    out: list[dict] = []
    for dimension, entry in scored["dimensions"].items():
        info = meta["dimensions"].get(dimension, {})
        out.append(
            {
                "dimension": dimension,
                "name": pick(info.get("name"), language),
                "blurb": pick(info.get("blurb"), language),
                "kind": entry["kind"],
                "score": entry["score"],
                "band": entry["band"],
                "band_label": band_label(entry["kind"], entry["band"], language),
                "answered": entry["answered"],
                "total": entry["total"],
                "correct": entry["correct"],
            }
        )
    out.sort(key=lambda item: (item["score"] is None, -(item["score"] or 0), item["dimension"]))
    return out


def caveats(assessment_type: str, language: str) -> list[str]:
    """The sentences the result screen has to print next to the numbers."""
    return [
        pick(assessment_bank.note(), language),
        pick(assessment_bank.instrument(assessment_type)["caveat"], language),
    ]


def career_themes(assessment_type: str, scored: dict, limit: int = 3) -> list[str]:
    """Themes for the catalogue query, from the strongest answered dimensions only."""
    ranked = sorted(
        (
            entry
            for entry in scored["dimensions"].items()
            if entry[1]["score"] is not None
        ),
        key=lambda pair: -pair[1]["score"],
    )[:limit]
    themes: list[str] = []
    for dimension, _ in ranked:
        for theme in DIMENSION_THEMES.get(assessment_type, {}).get(dimension, []):
            if theme not in themes:
                themes.append(theme)
    return themes


def pick(field: dict | None, language: str) -> str:
    """One of the bank's {"en", "hi"} text fields in the asked-for language."""
    if not field:
        return ""
    if language == "hi":
        return field.get("hi") or field["en"]
    return field["en"]
