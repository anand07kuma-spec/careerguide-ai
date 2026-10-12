"""Which language a student just wrote or spoke in.

The guide is meant to answer in the language it is asked in, so this is judged
per message rather than read from the profile setting. Switching between English
and Hindi in the middle of a conversation is normal for Indian students and
should not require touching Settings.

Three outcomes, matching the app's `Language` values:

* ``en``       — English.
* ``hi``       — Hindi written in Devanagari, so replies use Devanagari too.
* ``hinglish`` — Hindi words typed with an English keyboard, the common register
  for chat and voice on a phone.
"""

from __future__ import annotations

import re

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
_WORD = re.compile(r"[a-z']+")

# Roman-script Hindi words. Chosen so none of them is an English word: short
# forms that collide ("the", "to", "do", "i", "mat", "no") are deliberately out,
# otherwise ordinary English sentences would be misread as Hinglish.
HINDI_WORDS = {
    "aap", "aapka", "aapki", "aapko", "aapne", "aapni", "abhi", "acha", "accha",
    "acche", "agla", "ahaan", "aisa", "aise", "aaram", "aaspaas", "aakhir",
    "aakhri", "adhoora", "adhik", "agar", "anjana", "apna", "apne", "apni",
    "aur", "baad", "baat", "bata", "bataao", "batana", "batane", "batao",
    "bataye", "batayi", "behtar", "bhar", "bhi", "bilkul", "bohat", "bol",
    "bola", "boli", "bolna", "darr", "darwaza", "dekh", "dekha", "dekhi",
    "dekhna", "dekho", "dekhta", "dene", "dena", "dheere", "dhyan", "dhanyavaad",
    "dost", "dosti", "duniya", "dukh", "dusra", "dusri", "faaltu", "fayda",
    "fir", "ghar", "haalaat", "haan", "haath", "haathon", "hain", "hai", "hamesha",
    "ham", "hamara", "hamari", "hamare", "hamein", "hamen", "hoga", "hogi",
    "hota", "hoti", "bahut",
    "jaan", "jaata", "jaati", "jab", "jaldi", "jawaab", "jawab", "jaisa",
    "jaise", "ji", "jyada", "jyadatar", "kaam", "kab", "kabhi", "kahani",
    "kahaani", "kahin", "karni", "karna", "karne", "karoga", "karogi", "karoon",
    "karta", "karti", "karun", "kas", "kash", "kathin", "kaise", "kis", "kise",
    "kisi", "kitna", "kitni", "kitne", "kon", "kaun", "kaunsa", "kaunsi",
    "koyi", "kripya", "kuch", "kuchh", "kya", "kyon", "kyunki", "kyu", "kyun",
    "ladaka", "ladke", "ladki", "lage", "lagta", "lagti", "liye", "madad",
    "main", "majedaar", "majja", "mana", "maano", "mandir", "mar", "marna",
    "matlab", "mera", "meri", "mere", "mujhe", "muje", "mujhse", "mushkil",
    "naam", "nahi", "nahin", "namaste", "paas", "par", "parivaar", "pasand",
    "pehla", "pehle", "poora", "poori", "pranam", "pucha", "puchna", "pyaara",
    "raat", "raha", "rahi", "rahe", "rahenge", "saath", "sab", "sabak", "sabse",
    "sachcha", "sahi", "saal", "samajh", "samajhna", "samay", "samjha", "samjhi",
    "saral", "satya", "sau", "seekh", "seekhna", "seva", "shabd", "shauk",
    "shehar", "shuru", "shuruaat", "shukriya", "sokal", "soch",
    "socha", "sochna", "tab", "tajuba", "tajurba", "tak", "tamanna", "thik",
    "thoda", "thodi", "toh", "tum", "tumaara", "tumhare", "tumhari", "tumhe",
    "tumhein", "uttar", "vajah", "vaise", "varna", "vyavasaay", "yahaan",
    "yahi", "yeh", "zindagi", "zyaada", "zyada", "zyadatar",
    # Daily-life words students actually use, added last so the list above stays
    # grouped by theme.
    "achchi", "achi", "khaas", "likhna", "likhte", "padhai", "padhna", "padhte",
    "sapna", "sapne",
}


def detect(text: str) -> str:
    """Return "en", "hi" or "hinglish" for what the student actually typed."""
    if not text or not text.strip():
        return "en"

    letters = [char for char in text if char.isalpha()]
    if not letters:
        return "en"
    devanagari = sum(1 for char in letters if DEVANAGARI.match(char))
    share = devanagari / len(letters)
    if share >= 0.2:
        return "hi"

    words = set(_WORD.findall(text.lower()))
    if devanagari:
        # Mostly English with a Hindi word or two: that mix is Hinglish.
        return "hinglish"
    if words & HINDI_WORDS:
        return "hinglish"
    return "en"
