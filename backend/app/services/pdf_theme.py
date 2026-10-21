"""Type, colour and text-shaping for the generated PDF reports.

Everything the report needs to look like the app rather than like a library
default: the brand palette from `globals.css`, the Mukta family (which carries
both Latin and Devanagari in one file, so a mixed line never changes font), and
the one paragraph style set every page uses.

The shaping block below is the reason this module exists. ReportLab has no text
shaper of its own, so Hindi arrives as codepoints and each one is looked up in
the font's character map — which draws a visible halant where the font has a
conjunct, and leaves a left-side matra on the wrong side of its consonant.
ReportLab 5 can shape, but only when a paragraph style opts in with `shaping=1`,
and only with the feature set it hard-codes. See `_configure_shaping`.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont, shapeFragWord

FONT_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"

# Mirrors the @theme tokens in frontend/src/app/globals.css.
NAVY = HexColor("#0b1730")
BRAND = HexColor("#2563eb")
BRAND_DARK = HexColor("#1d4ed8")
BRAND_LIGHT = HexColor("#60a5fa")
BRAND_MIST = HexColor("#dbeafe")
TEAL = HexColor("#14b8a6")
TEAL_MIST = HexColor("#ccfbf1")
CANVAS = HexColor("#f5f8ff")
INK = HexColor("#172033")
MUTED = HexColor("#64748b")
LINE = HexColor("#e2e8f5")
SUCCESS = HexColor("#16a34a")
WARNING = HexColor("#f59e0b")
DANGER = HexColor("#dc2626")

REGULAR = "CareerGuideMukta"
SEMIBOLD = "CareerGuideMuktaSemi"
BOLD = "CareerGuideMuktaBold"

WEIGHTS = {
    REGULAR: "Mukta-Regular.ttf",
    SEMIBOLD: "Mukta-SemiBold.ttf",
    BOLD: "Mukta-Bold.ttf",
}

_configured = False


def _configure_shaping() -> None:
    """Ask the shaper for kerning but no ligatures, and refuse to run without it.

    `shapable` is false when uharfbuzz cannot be imported, and ReportLab would then
    draw Hindi unshaped without saying anything — a page of broken text that still
    reads as a successful response. Better to fail the one request that needs it.

    The feature dict is a mutable default argument on `shapeFragWord`, which makes
    editing it the only lever the paragraph path gives. Two things follow from how
    HarfBuzz reads that dict, and both were measured rather than assumed:

    * Devanagari conjuncts come from the script's own always-on features, so they
      survive whatever is passed here. `प्रश्नावली` leaves as 6 glyphs from 10 letters.
    * A feature named here is switched; one left out keeps HarfBuzz's own default.
      `liga` is on by default, so asking only for `kern` still turned "office" into
      one `ﬃ` glyph. Latin has to be turned off by name, not simply not asked for.

    Ligature glyphs are also what a family searches and copy-pastes from the printed
    page, so a word stored as `ﬃ` is a word their phone cannot find.
    """
    global _configured
    if _configured:
        return

    from reportlab.pdfbase import ttfonts

    if ttfonts.uharfbuzz is None:
        raise RuntimeError(
            "PDF reports need the 'uharfbuzz' package to shape Hindi. Install it "
            "with: pip install -r requirements.txt"
        )

    defaults = shapeFragWord.__defaults__ or ()
    if defaults and isinstance(defaults[0], dict):
        defaults[0].clear()
        defaults[0].update({"kern": True, "liga": False, "dlig": False})
    _configured = True


def register_fonts() -> None:
    """Register the three Mukta weights once per process."""
    _configure_shaping()
    for name, filename in WEIGHTS.items():
        if name not in pdfmetrics._fonts:
            pdfmetrics.registerFont(TTFont(name, FONT_DIR / filename))


# Devanagari stacks a matra above and below the same consonant, so a line needs
# more room than Latin does. One generous leading serves both languages rather
# than a per-language style set.
#
# `shaping=1` is on every style, including the headings, because ReportLab only
# shapes a string that is drawn through a paragraph style which asked for it. A
# heading left off would print a Hindi page title with broken conjuncts.
BASE = dict(shaping=1, fontName=REGULAR, fontSize=10.5, leading=16, textColor=INK)

H1 = ParagraphStyle("cg-h1", parent=None, shaping=1, fontName=BOLD, fontSize=26, leading=36, textColor=NAVY)
H2 = ParagraphStyle(
    "cg-h2",
    shaping=1,
    fontName=SEMIBOLD,
    fontSize=15,
    leading=21,
    textColor=NAVY,
    spaceBefore=6,
    spaceAfter=6,
)
H3 = ParagraphStyle("cg-h3", shaping=1, fontName=SEMIBOLD, fontSize=11.5, leading=17, textColor=NAVY)
BODY = ParagraphStyle("cg-body", **BASE)
LEDE = ParagraphStyle("cg-lede", parent=BODY, fontSize=12, leading=19, textColor=BRAND_DARK)
SMALL = ParagraphStyle("cg-small", parent=BODY, fontSize=9, leading=14, textColor=MUTED)
TINY = ParagraphStyle("cg-tiny", parent=BODY, fontSize=7.8, leading=11.5, textColor=MUTED)
CELL = ParagraphStyle("cg-cell", parent=BODY, fontSize=9.5, leading=14)
# Sits on the navy header band, so it has to be the band's own light colour.
CELL_HEAD = ParagraphStyle("cg-cell-head", parent=CELL, fontName=SEMIBOLD, textColor=BRAND_LIGHT)
LABEL = ParagraphStyle("cg-label", parent=BODY, fontName=SEMIBOLD, fontSize=9, leading=13)
