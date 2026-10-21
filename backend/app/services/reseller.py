"""Which organisations get how many places, and what a tier is allowed to change.

A school portal and a counsellor portal are the same piece of software wearing a
different name, so the difference between them has to be a number somewhere rather than
a fork in the code. This is that number: a short catalogue of tiers, each with a seat
ceiling, read by `routers/organizations.py` when it is asked to invite somebody.

**Nothing here is purchasable, and that is the current state of the product rather than
a placeholder.** A tier's price is `None`, which means "arranged with a person" — the
same convention `services/plans.py` uses for the school plan on the pricing page, where
a missing price must never be able to read as a free order. The payment routes refuse a
plan whose code is not sellable, so a school cannot be charged for seats by a form, and
no family's card is touched until the payment side has been configured and tested for
this kind of order. What a deployment does today is set a tier by hand, the way it sets
`users.is_admin`: from the database, deliberately.

Two rules hold whatever the tier:

* **A tier changes what an organisation can see about its own roster, never what a
  student is told.** `services/recommender.py` does not import this file, and a paid
  seat cannot make a career recommendation, a stream choice or an exam list come out
  differently. That is the same firewall that keeps a sponsored university out of the
  guidance.
* **A seat ceiling stops an invite, not a child.** When a school runs out of seats, the
  person who is turned away is somebody who has not joined yet, and their own free
  account is untouched. The school's dashboard says how many places it holds and how
  many are used, so the ceiling is a number on screen rather than a silent refusal.

`free` is the default for every new organisation, including one a counsellor starts from
their own account, so nothing has to be bought before the portals can be tried with a
real class.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

OrgKind = Literal["school", "counsellor"]
TierKind = Literal["any", "school", "counsellor"]


@dataclass(frozen=True)
class Tier:
    code: str
    name: str
    kind: TierKind
    tagline: str
    # None means "priced with a person", never zero. No tier in this build can be
    # ordered from a form, so every price here is None.
    price_paise: int | None
    # How many memberships the organisation may hold, invited ones included. Counting
    # an invite against a seat is the honest option: a school that has invited a class
    # has used the places it asked for.
    seats: int
    # Staff seats are the same ceiling in a school's eyes: a counsellor assigned to a
    # school is a member of it, and the numbers must add up without a second limit.
    includes: tuple[str, ...]
    # The thing a buyer would assume is in the box and is not.
    not_included: tuple[str, ...] = ()
    # Read by the payment routes. Always False today, and stated as a field rather than
    # inferred from `price_paise is None` so that a future self-serve tier has to say so
    # in two places instead of one.
    purchasable: bool = False

    @property
    def price_rupees(self) -> int | None:
        return None if self.price_paise is None else self.price_paise // 100


FREE = Tier(
    code="free",
    name="Starter",
    kind="any",
    tagline="A real class or a real client list, without anything being bought.",
    price_paise=None,
    seats=25,
    includes=(
        "The full roster and analytics screens",
        "Branded portal title, welcome note, logo link and accent colour",
        "Every student keeps their own free account and all of their own settings",
    ),
    not_included=("Invoicing, purchase orders, or a price of any kind"),
)

SCHOOL_STARTER = Tier(
    code="school_starter",
    name="One school",
    kind="school",
    tagline="A single school, up to about eight classes.",
    price_paise=None,
    seats=150,
    includes=(*FREE.includes, "Bulk invite by pasting a list of addresses"),
    not_included=FREE.not_included,
)

SCHOOL_DISTRICT = Tier(
    code="school_district",
    name="Group of schools",
    kind="school",
    tagline="Several schools under one administrator, arranged with us.",
    price_paise=None,
    seats=1000,
    includes=(*SCHOOL_STARTER.includes, "One administrator across every school in the group"),
    not_included=FREE.not_included,
)

COUNSELLOR_SOLO = Tier(
    code="counsellor_solo",
    name="Solo practice",
    kind="counsellor",
    tagline="An independent counsellor and the clients they actually see.",
    price_paise=None,
    seats=30,
    includes=(
        "Client list and session notes",
        "Branded portal title, welcome note, logo link and accent colour",
        "Notes stay private to the practice unless the counsellor shares one with a family",
    ),
    not_included=("Any retail price the practice charges a client — that is not stored here"),
)

COUNSELLOR_TEAM = Tier(
    code="counsellor_team",
    name="Practice with a team",
    kind="counsellor",
    tagline="Several counsellors sharing one practice name.",
    price_paise=None,
    seats=120,
    includes=(*COUNSELLOR_SOLO.includes, "More than one counsellor as a member of the practice"),
    not_included=COUNSELLOR_SOLO.not_included,
)

TIERS: tuple[Tier, ...] = (FREE, SCHOOL_STARTER, SCHOOL_DISTRICT, COUNSELLOR_SOLO, COUNSELLOR_TEAM)

_BY_CODE = {tier.code: tier for tier in TIERS}


def get(code: str) -> Tier | None:
    return _BY_CODE.get(code)


def default_for(kind: OrgKind) -> Tier:
    return FREE


def for_kind(kind: OrgKind) -> tuple[Tier, ...]:
    """The tiers an organisation of this kind may be given, `free` first.

    `FREE` is listed for both kinds rather than duplicated into two codes, so a school
    and a practice on the starter tier are demonstrably on the same terms.
    """
    return tuple(
        tier for tier in (FREE, *[t for t in TIERS if t.kind == kind])
        if tier.kind in ("any", kind)
    )
