"""What each plan costs and what each plan allows — one place, read by both sides.

A pricing page that hardcodes "3 chats a day" and a limiter that hardcodes its own
number are two facts that will drift, and the drift is always paid for by the family
who was promised one and got the other. So the prices, the periods and the limits all
live here, `GET /api/payments/plans` serves them to the browser, and the enforcement
in `entitlements.py` reads the same objects. `payments_test.py` asserts that the
numbers on screen are the numbers in force.

Two things are deliberately absent from the paid tiers:

*Nothing about careers is for sale.* Every career, stream, exam, resource,
scholarship and institution in the catalogue is readable on the free plan. A paid tier
sells conversation, questionnaires, a printed document and a parent's view — never
access to information about a path a child might take. If the catalogue itself were
gated, the amount a family could pay would decide what a child is allowed to learn
about their own future, which is the same failure as a sponsored listing ranking
higher.

*No auto-renewal.* A payment buys a period with an end date. Nothing charges again by
itself, because doing that honestly needs Razorpay Subscription plans, a real account,
and a card-on-file mandate flow — none of which exists in this build and none of which
could be tested without taking someone's money. The billing screen therefore offers to
renew, and never offers to cancel something that was never going to repeat.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Literal

from ..config import get_settings

FeatureKey = Literal[
    "conversation",
    "assessments",
    "catalogue",
    "voice",
    "pdf_report",
    "parent_dashboard",
    "devices",
    "languages",
    "data_control",
]

Interval = Literal["none", "monthly", "yearly"]


@dataclass(frozen=True)
class Plan:
    code: str
    name: str
    tagline: str
    # None is "custom / talk to us", not zero. A missing price must never be able to
    # read as a free order, so create_order refuses it before Razorpay is called.
    price_paise: int | None
    # What the same year would cost paid monthly, so "saves ₹1,089" is computed from
    # the two real prices rather than asserted.
    compare_at_paise: int | None
    interval: Interval
    # How long a paid period lasts. A month is 30 days and a year is 365 — fewer than
    # a calendar month would be shortchanging, more would be a promise the screen does
    # not make, so the exact end date is always shown to the family.
    period_days: int | None
    cta: Literal["choose", "current", "contact", "start"]
    # The limits themselves. None means "not capped".
    daily_chats: int | None
    total_assessments: int | None
    pdf_reports: bool
    parent_dashboard: bool
    # Feature rows for the comparison table, keyed by FeatureKey. A string is the
    # plan's own wording for that row; True/False are "included"/"not included".
    features: dict[FeatureKey, str | bool] = field(default_factory=dict)

    @property
    def is_paid(self) -> bool:
        return self.price_paise is not None

    @property
    def purchasable(self) -> bool:
        """Whether a family can pay for this plan online, today.

        A plan has to cost something to be buyable. `free` carries a price of zero
        rather than no price — it is what every account is on — and treating that zero
        as an orderable amount would let a checkout open for ₹0. The school licence is
        a conversation with a person: there is no per-student count to put in a
        checkout form, and a button that charged ₹1 as a placeholder for "custom
        pricing" would take money for the wrong plan.
        """
        return self.price_paise is not None and self.price_paise > 0


FREE = Plan(
    code="free",
    name="Free",
    tagline="Everything about careers, with a limited number of conversations.",
    price_paise=0,
    compare_at_paise=None,
    interval="none",
    period_days=None,
    cta="start",
    daily_chats=3,
    total_assessments=1,
    pdf_reports=False,
    parent_dashboard=False,
    features={
        "conversation": "3 chats a day",
        "assessments": "1 questionnaire, once",
        "catalogue": True,
        "voice": "3 a day",
        "pdf_report": False,
        "parent_dashboard": False,
        "devices": "One device",
        "languages": True,
        "data_control": True,
    },
)

PRO_MONTHLY = Plan(
    code="pro_monthly",
    name="Pro",
    tagline="Unlimited conversation, every questionnaire, a printed report.",
    price_paise=29_900,
    compare_at_paise=None,
    interval="monthly",
    period_days=30,
    cta="choose",
    daily_chats=None,
    total_assessments=None,
    pdf_reports=True,
    parent_dashboard=True,
    features={
        "conversation": "Unlimited",
        "assessments": "Every type, repeatable",
        "catalogue": True,
        "voice": "Unlimited",
        "pdf_report": True,
        "parent_dashboard": True,
        "devices": "Any number, with a come-back code",
        "languages": True,
        "data_control": True,
    },
)

PRO_YEARLY = Plan(
    code="pro_yearly",
    name="Pro Yearly",
    tagline="The same Pro, paid for a year at about 30% less.",
    price_paise=249_900,
    compare_at_paise=PRO_MONTHLY.price_paise * 12,
    interval="yearly",
    period_days=365,
    cta="choose",
    daily_chats=None,
    total_assessments=None,
    pdf_reports=True,
    parent_dashboard=True,
    # Identical to Pro in every row. The only difference is the period, and the table
    # must not imply that a yearly member gets a better product.
    features=dict(PRO_MONTHLY.features),
)

SCHOOL = Plan(
    code="school",
    name="School Plan",
    tagline="Bulk licences for a class or a whole school, priced with a person.",
    price_paise=None,
    compare_at_paise=None,
    interval="none",
    period_days=None,
    cta="contact",
    daily_chats=None,
    total_assessments=None,
    pdf_reports=True,
    parent_dashboard=True,
    features={
        **PRO_MONTHLY.features,
        "conversation": "Unlimited for every student",
        "devices": "Managed seats",
    },
)

PLANS: tuple[Plan, ...] = (FREE, PRO_MONTHLY, PRO_YEARLY, SCHOOL)

FEATURE_ROWS: tuple[tuple[FeatureKey, str, str], ...] = (
    (
        "conversation",
        "Talk with the guide",
        "The chat and the spoken call use the same conversation, so the guide keeps "
        "what it already learned about you.",
    ),
    (
        "assessments",
        "Assessments",
        "Interest, aptitude and stream-readiness questionnaires, each with a scored "
        "result page.",
    ),
    (
        "catalogue",
        "Careers, streams, exams, resources, scholarships, institutes",
        "Free on every plan, and stays free. Selling access to this is selling what a "
        "child is allowed to find out.",
    ),
    (
        "voice",
        "Spoken replies and read-aloud",
        "The server voice, with your own browser's voice as the fallback.",
    ),
    (
        "pdf_report",
        "Printable PDF report",
        "One document with every finished questionnaire, in English or Hindi.",
    ),
    (
        "parent_dashboard",
        "Parent dashboard",
        "A guardian's view of progress, opened only by a code the student chooses to "
        "share. Transcripts stay private unless the student says otherwise.",
    ),
    (
        "devices",
        "Coming back on another device",
        "A come-back code, plus optional email sign-in where it is configured.",
    ),
    (
        "languages",
        "English, Hindi and Hinglish",
        "The guide answers in the language you used, in the same conversation.",
    ),
    (
        "data_control",
        "See, export and delete your own data",
        "On every plan. Deleting an account is never something a paid plan has to "
        "unlock, and a free account that stopped paying keeps its deletion path.",
    ),
)


def all_plans() -> list[Plan]:
    return [effective_free() if plan.code == "free" else plan for plan in PLANS]


def get(code: str) -> Plan | None:
    for plan in PLANS:
        if plan.code == code:
            # The free plan's numbers come from settings, so an operator who loosens
            # them for a school's shared network changes the price list and the
            # limiter in the same move. There is no second copy to forget.
            return effective_free() if plan.code == "free" else plan
    return None


def effective_free() -> Plan:
    """The free plan as this deployment has configured it.

    Read per call rather than at import, because a test that sets `FREE_DAILY_CHATS`
    in its own environment would otherwise be measured against numbers frozen when the
    module was first imported — the same reason every other limit here is re-read.
    """
    settings = get_settings()
    chats = max(0, settings.free_daily_chats)
    assessments = max(0, settings.free_assessment_total)
    return replace(
        FREE,
        daily_chats=chats,
        total_assessments=assessments,
        features={
            **FREE.features,
            "conversation": f"{chats} chats a day",
            "assessments": f"{assessments} questionnaire, once",
        },
    )


def purchasable_codes() -> list[str]:
    return [plan.code for plan in PLANS if plan.purchasable]


def rupees(paise: int) -> str:
    """₹299, not ₹299.00 — nothing here takes a fraction of a rupee."""
    if paise % 100:
        return f"₹{paise / 100:,.2f}"
    return f"₹{paise // 100:,}"


def savings_paise(plan: Plan) -> int:
    if plan.compare_at_paise is None or plan.price_paise is None:
        return 0
    return max(0, plan.compare_at_paise - plan.price_paise)


def savings_percent(plan: Plan) -> int:
    if not plan.compare_at_paise:
        return 0
    return round(savings_paise(plan) * 100 / plan.compare_at_paise)


def plan_for(user_plan_code: str | None) -> Plan:
    """The plan an account is on, with the free plan as the only default.

    An unrecognised code falls back to Free rather than to Pro, and the reason is the
    same as refusing a malformed limit rule at startup: a bug in one column should
    never hand out a paid feature for nothing, and it should never take away the free
    plan from a child who has one. A `school` code keeps its own entitlements — a
    licence granted to a student is a plan they hold, and treating it as free would
    lock a paid child out of the tools the school paid for.
    """
    return get(user_plan_code or "") or effective_free()
