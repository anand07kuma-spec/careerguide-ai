"""Exploratory interest themes shared by the AI layer, recommender and reports.

These are observations about what a student said they enjoyed. They are not
aptitudes, psychometric scores, or predictions about a child's future.
"""

from __future__ import annotations

import re

THEMES: dict[str, dict] = {
    "creative_exploration": {
        "label": "Creative exploration",
        "blurb": "You enjoy making things up, drawing, storytelling or designing how something looks and feels.",
        "categories": ["Art, Design, and Media", "Other emerging careers", "Business and Entrepreneurship"],
        "keywords": [
            "draw", "drawing", "paint", "sketch", "art", "design", "animate", "animation",
            "story", "stories", "write", "writing", "poem", "music", "dance", "sing",
            "photo", "video edit", "craft", "color", "colour", "kala", "chitra",
            "rachna", "creative", "comic", "illustrat", "fashion", "interior",
            "चित्र", "कला", "रंग", "रंगोली", "कहानी", "कविता", "संगीत", "नृत्य",
            "गाना", "फोटो", "वीडियो", "कल्पना", "रचना", "अभिनय", "ड्रॉइंग",
        ],
    },
    "analytical_problem_solving": {
        "label": "Analytical problem-solving",
        "blurb": "You like puzzles, working out why something happens, and getting to a correct answer step by step.",
        "categories": ["AI and Data", "Engineering and Technology", "Finance and Banking"],
        "keywords": [
            "puzzle", "solve", "problem", "maths", "math", "logic", "code", "coding",
            "program", "algorithm", "reason", "analyse", "analyz", "data", "statistics",
            "chess", "riddle", "question", "compute", "calculat", "hack",
            "पहेल", "सवाल", "जवाब", "हल", "गणित", "तर्क", "कोड", "डेटा",
            "आंकड़ा", "विश्लेषण", "कंप्यूटर", "सूत्र", "गिनती",

        ],
    },
    "practical_building": {
        "label": "Practical building and making",
        "blurb": "You enjoy using your hands to build, fix or assemble real things and see them work.",
        "categories": ["Skilled Trades and Vocational Careers", "Engineering and Technology"],
        "keywords": [
            "build", "making", "construct", "fix", "repair", "woodwork", "model",
            "robot", "electronics", "circuit", "assemble", "workshop", "tool",
            "engine", "mechanic", "invent", "hand", "craftsman", "fabricat",
            "उपकरण", "औज़ार", "मरम्मत", "रोबोट", "सर्किट", "इंजन",
            "मशीन", "निर्माण", "जोड़ना", "हाथों",

        ],
    },
    "communication_collaboration": {
        "label": "Communication and collaboration",
        "blurb": "You like explaining ideas, talking with people, performing, or working in a team.",
        "categories": ["Law and Social Sciences", "Hospitality and Tourism", "Business and Entrepreneurship"],
        "keywords": [
            "talk", "speak", "explain", "debate", "discuss", "present", "perform",
            "act", "drama", "anchor", "teach", "share", "team", "group", "friend",
            "lead", "organise", "organize", "event", "host", "interview", "journal",
            "news", "media", "baat", "bol",
            "बात", "बोल", "समझाना", "वाद-विवाद", "प्रस्तुति", "नाटक",
            "टीचर", "सिखाना", "टोली", "समूह", "दोस्तों", "मीडिया",

        ],
    },
    "helping_others": {
        "label": "Helping and supporting others",
        "blurb": "You feel good when you support, care for, or stand up for other people.",
        "categories": ["Science and Healthcare", "Education and Research", "Law and Social Sciences"],
        "keywords": [
            "help", "care", "support", "nurse", "doctor", "teach", "volunteer",
            "kind", "serve", "community", "social", "protect", "listen", "counsel",
            "patient", "animal", "shelter", "madad", "seva",
            "मदद", "सेवा", "देखभाल", "समुदाय", "डॉक्टर", "नर्स", "बचाना",
            "सलाह", "दूसरों", "हौसला",

        ],
    },
    "physical_activity_sports": {
        "label": "Physical activity and sports",
        "blurb": "You enjoy moving, playing, competing, and being active with others.",
        "categories": ["Sports and Fitness", "Defence and Public Services", "Aviation"],
        "keywords": [
            "cricket", "football", "badminton", "kabaddi", "hockey", "tennis", "run",
            "swim", "game", "sports", "sport", "gym", "fitness", "yoga", "martial",
            "cycle", "outdoor", "play", "match", "khel", "exercise", "coach",
            "खेल", "दौड़", "कसरत", "व्यायाम", "मैच", "तैराकी", "योग",
            "क्रिकेट", "फुटबॉल", "बैडमिंटन", "टीम",

        ],
    },
    "nature_scientific_curiosity": {
        "label": "Nature and scientific curiosity",
        "blurb": "You like finding out how the natural world works, from plants and animals to space.",
        "categories": ["Environment and Agriculture", "Science and Healthcare", "Aviation"],
        "keywords": [
            "nature", "plant", "tree", "animal", "bird", "insect", "weather", "space",
            "star", "planet", "science", "experiment", "biology", "chemistry",
            "physics", "farm", "agriculture", "river", "mountain", "environment",
            "ocean", "sky", "fly", "microscope",
            "प्रकृति", "पेड़", "पौधे", "जानवर", "पक्षी", "मौसम", "अंतरिक्ष",
            "तारे", "ग्रह", "विज्ञान", "प्रयोग", "नदी", "पहाड़", "किसान",
            "समुद्र", "आसमान", "मिक्रोस्कोप",

        ],
    },
    "organization_leadership": {
        "label": "Organization and leadership",
        "blurb": "You like planning things, keeping track of details, and getting a group moving.",
        "categories": ["Business and Entrepreneurship", "Finance and Banking", "Hospitality and Tourism"],
        "keywords": [
            "plan", "manage", "organise", "organize", "schedule", "lead", "captain",
            "monitor", "prefect", "arrange", "shop", "sell", "money", "business",
            "startup", "entrepreneur", "budget", "store", "market", "decide",
            "योजना", "आयोजन", "प्रबंध", "नेतृत्व", "कप्तान", "अनुशासन",
            "बजट", "सूची", "फीसले", "समझौता", "दुकान", "व्यापार",

        ],
    },
}

ALL_THEME_NAMES = list(THEMES)

# Words that suggest a student is stuck or unsure, so the AI can reassure
# instead of pushing for an answer. Hindi forms matter: "पता नहीं" is the single
# most common thing a stuck student says.
UNCERTAINTY_MARKERS = [
    "don't know", "dont know", "no idea", "not sure", "nothing", "i dont",
    "pata nahi", "nahi pata", "kuch nahi", "some idea", "maybe", "idk",
    "samajh nahi", "socha nahi", "jwab nahi",
    "पता नहीं", "नहीं पता", "नही पता", "कुछ नहीं", "समझ नहीं", "जवाब नहीं",
    "मुश्किल है", "अभी नहीं", "क्या करूं", "क्या करूँ", "सोचा नहीं",
]

# Handled before anything else: a child disclosing danger needs a safety-first
# reply, not a career conversation. Kept deliberately phrase-shaped so ordinary
# nerves ("match mein dar lagta hai") do not trip it.
DISTRESS_MARKERS = [
    "hurt me", "hurts me", "beating", "beat me", "beats me", "hits me", "hit me",
    "abuse", "molest", "harass", "suicide", "end my life", "kill myself",
    "torture", "unsafe at home", "scared at home", "darwati", "dhamki", "marna",
    "mujhe maaro", "chot lagi", "chot lagti", "maarta hai", "maarti hai",
    "peetata", "peetati", "chhed", "chhedi", "atmahatya", "mar jaunga", "tang karta",
    "मुझे चोट", "चोट लगी", "चोट पहुँचा", "पीटता है", "पीटती है", "मारता है",
    "मारती है", "दुर्व्यवहार", "अत्याचार", "छेड़छाड़", "आत्महत्या", "मर जाऊँ",
    "मर जाना", "सुरक्षित नहीं", "तंग करता", "धमकी", "डरा हुआ हूँ",
]


def detect_themes(text: str) -> list[str]:
    """Return theme names whose everyday vocabulary appears in what was said."""
    lowered = f" {text.lower()} "
    hits: list[str] = []
    for name, meta in THEMES.items():
        for word in meta["keywords"]:
            if re.search(rf"(?<![a-z]){re.escape(word)}", lowered):
                hits.append(name)
                break
    return hits


def expresses_uncertainty(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in UNCERTAINTY_MARKERS)


def possible_distress(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in DISTRESS_MARKERS)
