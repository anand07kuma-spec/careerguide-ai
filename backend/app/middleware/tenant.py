"""Which portal a browser is standing in, worked out from the address it used.

A school asks for `green-school.careerguide.ai` and the app should look like that
school. That is the whole job of this file: turn a hostname into an organisation slug, or
into nothing.

**Nothing here authorises anything, and the ordering of those two sentences is the
point.** The path a request takes already names the organisation it is about
(`/api/organizations/{slug}/...`), and every route re-reads the caller's membership row
against that slug. The host is used for one thing: deciding what to *render* for a
browser that has not asked — the logo and title of the portal the address bar is showing,
and a refusal when a page on one school's address tries to open another school's screen.
If this file ever returned a role, a permission or a default grant, it would be a way to
walk into a school's data by typing its name into a Host header.

Fail-closed rules, in the order they are applied:

* The host must end in the configured base domain **and leave exactly one label** before
  it. `careerguide.example.com` and `a.b.careerguide.example.com` are not tenant portals,
  whatever else is true of them.
* A label in `RESERVED_LABELS` is never a tenant, so `api`, `admin`, `join`, `status` and
  `www` cannot be taken by an organisation, and cannot be mistaken for one.
* The base domain comes from configuration. It is not derived from the request: an app
  that worked out its own domain from the headers it was handed would accept any domain
  somebody pointed at it, and every one of those would be a portal.
* `X-Forwarded-Host` is ignored unless `TENANT_TRUST_FORWARDED_HOST=true`, because a
  header any client can write is a header any client can use to be somewhere else. On a
  hosted deployment the platform's own proxy sets it, which is when the switch is right;
  on a bare server it is a lie waiting to happen.

Locally this is testable without DNS: `*.careerguide.localhost` resolves to the machine
on every browser we support, so `green-school.careerguide.localhost:3000` reaches the
same code path a real wildcard subdomain would.
"""

from __future__ import annotations

import logging
import re

from fastapi import HTTPException, Request

from ..config import get_settings

log = logging.getLogger(__name__)

# 3-40 characters: a lowercase letter or digit at each end, single hyphens only inside.
# Consecutive hyphens are out because `green--school` is a hostname a parent will mistype,
# and a two-character label is too short to be anybody's school. This is the same rule the
# model documents on `organizations.slug` and the same one `schemas.OrgSlug` enforces on
# the way in, restated rather than imported so neither side can drift without noticing.
SLUG_PATTERN = re.compile(r"^[a-z0-9](?:-?[a-z0-9]){2,39}$")

# Labels that are the platform's own, never an organisation's. A school called "Ai School"
# does not get to be `api.careerguide.ai`, and a counsellor cannot register `login` and
# then mail families a link that looks like the sign-in page.
RESERVED_LABELS = frozenset(
    {
        "about",
        "admin",
        "api",
        "app",
        "assets",
        "auth",
        "billing",
        "blog",
        "careerguide",
        "cdn",
        "contact",
        "counsellor",
        "counsellors",
        "dashboard",
        "dev",
        "docs",
        "download",
        "email",
        "faq",
        "guide",
        "help",
        "in",
        "internal",
        "join",
        "login",
        "mail",
        "manage",
        "media",
        # The four static paths under `/api/organizations/` that a portal's own address
        # could otherwise shadow: `/api/organizations/mine` would answer for the school
        # called `mine` with somebody's membership list.
        "mine",
        "newsletter",
        "organizations",
        "privacy",
        "portal",
        "refund",
        "school",
        "schools",
        "secure",
        "settings",
        "signin",
        "signup",
        "static",
        "status",
        "staging",
        "summary",
        "support",
        "swagger",
        "tc",
        "terms",
        "test",
        "tiers",
        "update",
        "upload",
        "webhook",
        "www",
    }
)


def valid_slug(value: str) -> bool:
    """Shape plus the reserved list — the check a route does before it writes a row."""
    return bool(SLUG_PATTERN.match(value)) and value not in RESERVED_LABELS


def normalize_slug(value: str | None) -> str | None:
    """Lower-case and validate a slug somebody typed, or return None.

    Called before `valid_slug` at the boundary that stores one, so a school entering
    `Green School` is offered `green-school` rather than a database row no host can ever
    produce.
    """
    candidate = (value or "").strip().lower()
    return candidate if valid_slug(candidate) else None


def _hostname(raw: str | None) -> str:
    """A bare lower-case host from a Host, an Origin or a Referer.

    `Origin` and `Referer` carry a scheme and sometimes a path, and `Host` carries a
    port, so all three are reduced the same way before they are compared with the base
    domain. An IPv6 literal is never a tenant and returns nothing.
    """
    value = (raw or "").strip().lower()
    if not value:
        return ""
    if "://" in value:
        value = value.split("://", 1)[1]
    value = value.split("/", 1)[0]
    if value.startswith("["):
        return ""
    return value.split(":", 1)[0]


def slug_from_hostname(hostname: str) -> str | None:
    base = (get_settings().tenant_base_domain or "").strip().lower().lstrip(".")
    host = _hostname(hostname)
    if not base or not host:
        return None
    suffix = f".{base}"
    if not host.endswith(suffix):
        return None
    label = host[: -len(suffix)]
    # One label, and only one: `green-school` is a portal, `www.green-school` and
    # `a.b.green-school` are somebody else's idea of a hostname.
    if not label or "." in label:
        return None
    return None if label in RESERVED_LABELS else label


def request_tenant_slug(request: Request) -> str | None:
    """The organisation the caller's *address* names, or None. Never an authorisation.

    The API is usually reached on its own single origin, so the tenant usually arrives
    as `Origin` — the browser's own record of which portal page it is standing on — not
    as `Host`. Both are read here for the same narrow purpose: choosing the branding to
    show. `Host` is preferred when the API itself is served from the wildcard, because
    then it is the more reliable of the two.
    """
    settings = get_settings()
    if settings.tenant_trust_forwarded_host:
        forwarded = (request.headers.get("x-forwarded-host") or "").split(",")[0]
        slug = slug_from_hostname(forwarded)
        if slug:
            return slug
    for header in ("host", "origin", "referer"):
        slug = slug_from_hostname(request.headers.get(header) or "")
        if slug:
            return slug
    return None


def same_portal(request: Request, slug: str) -> None:
    """Refuse to render one school's screen inside another school's address.

    A fast, visible failure beats a page that quietly shows the wrong logo next to the
    right data: the moment those disagree, a school cannot tell which half to trust.
    With no tenant host in the request at all — the normal API case — nothing is checked,
    because the path and the membership row already decided everything worth deciding.
    """
    host_slug = request_tenant_slug(request)
    if host_slug and host_slug != slug:
        raise HTTPException(
            status_code=404,
            detail=(
                "That screen belongs to a different portal than the address you used. "
                "Open the link you were given, or sign in to the account that holds this "
                "membership."
            ),
        )
