"""Resend: the only place in this backend that can put anything into a mailbox.

Six messages exist here — a welcome, an address confirmation, a questionnaire
result, a weekly summary, a payment receipt and a parent's invitation — and all six
are built to one rule: **an address is not a fact about a person, it is a
permission**. The app was designed to ask for no email at all, so an address can
only arrive by somebody typing it in and then opening a link sent to it. Nothing in
this module decides whether it may send; every caller checks that address, that
purpose's own consent, and `settings.email_enabled` first (see
`app/services/email_consent.py`). Three consequences follow, and each one is a
choice rather than a limitation:

* **Silence is not success.** With no key, `send` returns a `Dispatch` saying
  `not-configured`, naming the environment variables that are missing. A caller that
  ignored it would show a family "we've emailed you" about a message that never
  existed. The frontend's `/api/contact` answers `503` in exactly this situation and
  puts that answer on screen; this service is shaped the same way on purpose.
* **An address is never logged.** Not in an info line, not in an error, not in a
  stack trace echoed back from the provider. The log names the template and the
  outcome, because "a welcome mail failed" is an operationally useful sentence and
  "a welcome mail failed for anand.sharma@school.org" is a child's contact detail
  sitting in whoever's log aggregator we never promised.
* **The sender is not a parameter.** One address, from `FROM_EMAIL`, a domain that
  has to be verified in Resend. If a route could choose its own sender, a bug or a
  forged request could put a child's career report into an inbox that appears to
  have come from us.

Templates are Jinja2 under `backend/templates/emails`, autoescape on: they
interpolate a name, a result and a rupee amount into markup, and an unescaped `<` in
a display name would otherwise break the layout or let somebody write markup into
their own family's inbox. Each one carries its English and Hindi copy inline,
because a parent who reads Hindi should not get an English receipt just because the
interface language happened to be English on the day they paid.

The plain-text alternative is derived from the rendered HTML rather than written a
second time. Two copies of six emails is two chances for the wording to disagree,
and a receipt whose text part quotes a different amount than its HTML part is an
invoice dispute. The tradeoff is that the text version has no formatting; links keep
their targets, which is the one thing a text part must not lose.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Mapping

import httpx
import jinja2
from fastapi import HTTPException, status

from ..config import get_settings

SITE_NAME = "CareerGuide AI"

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates" / "emails"

# Outcomes, as strings a route can pass through to a browser. A caller branches on
# these instead of on an exception, because "this deployment cannot mail" is a
# normal state of the world, not an error to be reported upward.
SENT = "sent"
NOT_CONFIGURED = "not-configured"
INVALID_ADDRESS = "invalid-address"
REJECTED = "rejected"
FAILED = "failed"

# Deliberately short and deliberately not RFC 5322. A regex that accepts every
# legal address also accepts everything a bot can type; the job here is to refuse
# the obvious junk before a paid API call, and Resend's own validation is the
# answer to everything subtler. Length ceiling is what RFC does insist on.
_ADDRESS_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
MAX_ADDRESS_LENGTH = 254

_BLOCK_TAGS = {
    "p", "div", "h1", "h2", "h3", "h4", "ul", "ol", "li",
    "table", "tr", "br", "hr", "footer", "header",
}


@dataclass(frozen=True)
class Dispatch:
    """What happened to one attempt at one message."""

    ok: bool
    status: str
    provider_id: str | None = None
    detail: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "delivered": self.ok,
            "status": self.status,
            "detail": None if self.ok else self.detail,
        }


def missing_settings() -> list[str]:
    """The names a deployment has to set. Blank on both halves is a supported state."""
    settings = get_settings()
    names = []
    if not settings.resend_api_key.strip():
        names.append("RESEND_API_KEY")
    if not settings.from_email.strip():
        names.append("FROM_EMAIL")
    return names


def enabled() -> bool:
    return get_settings().email_enabled


def disabled_error() -> HTTPException:
    """The 503 a route raises when it was asked to mail but nobody configured mail.

    Built per call rather than frozen at import: settings can be loaded after this
    module is first touched, and a message naming the wrong variable is worse than
    no message.
    """
    missing = ", ".join(missing_settings())
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            f"Email is not enabled on this deployment (set {missing}). "
            "Nothing was sent, and no message is on its way."
        ),
    )


def normalize_address(address: str | None) -> str:
    return str(address or "").strip().lower()


def valid_address(address: str | None) -> bool:
    value = normalize_address(address)
    return bool(value) and len(value) <= MAX_ADDRESS_LENGTH and bool(_ADDRESS_RE.match(value))


def copy(language: str | None, english: str, hindi: str = "") -> str:
    """Choose a string's language. Only `hi` gets Hindi — Hinglish and English
    recipients, and a template whose Hindi line nobody has written yet, all fall
    back to English rather than showing an empty paragraph."""
    if language == "hi" and hindi:
        return hindi
    return english


@lru_cache
def _environment() -> jinja2.Environment:
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=jinja2.select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )

    # A template writes `{{ txt("Payment received", "भुगतान मिल गया") }}` and the
    # reader is chosen by the recipient's language. English and Hindi sit on
    # adjacent lines of the same file because a receipt a Hindi reader cannot read
    # is not a receipt — and because the alternative, two copies of six emails, is
    # six chances for the wording to drift apart from the money it describes.
    @jinja2.pass_context
    def txt(ctx: Mapping[str, Any], english: str, hindi: str = "") -> str:
        return copy(ctx.get("lang"), english, hindi)

    env.globals["txt"] = txt
    return env


def render(template_name: str, context: Mapping[str, Any]) -> str:
    """Fill one template. `lang`, the site name and the site address are always
    available, so a template never has to be told where it is running."""
    settings = get_settings()
    merged: dict[str, Any] = {
        "site_name": SITE_NAME,
        "site_url": settings.public_site_url.rstrip("/"),
        "lang": str(context.get("lang") or "en"),
    }
    merged.update(context)
    return _environment().get_template(template_name).render(merged)


class _TextFromHtml(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._parts: list[str] = []
        self._href: str | None = None

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in ("style", "script"):
            self._skip_depth += 1
        elif tag == "a":
            self._href = dict(attrs).get("href")
        elif tag in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("style", "script"):
            self._skip_depth = max(0, self._skip_depth - 1)
        elif tag == "a":
            if self._href:
                self._parts.append(f" ({self._href})")
            self._href = None
        elif tag in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip_depth:
            self._parts.append(data)

    def text(self) -> str:
        lines = [" ".join(line.split()) for line in "".join(self._parts).splitlines()]
        out: list[str] = []
        for line in lines:
            if line or (out and out[-1]):
                out.append(line)
        return "\n".join(out).strip()


def plain_text(html: str) -> str:
    parser = _TextFromHtml()
    parser.feed(html)
    return parser.text()


def send(
    to: str,
    template_name: str,
    subject: str,
    context: Mapping[str, Any] | None = None,
) -> Dispatch:
    """Render one template and hand it to Resend.

    Synchronous and blocking on purpose: the callers that need a guarantee (a
    receipt, an invitation, a confirmation) are the ones that must know the answer
    before they answer a browser. Everything else goes through the outbox in
    `app/services/email_jobs.py`, which calls this same function and retries later.
    """
    address = normalize_address(to)
    if not valid_address(address):
        return Dispatch(False, INVALID_ADDRESS, detail="That is not an email address.")

    settings = get_settings()
    if not settings.email_enabled:
        return Dispatch(False, NOT_CONFIGURED, detail=", ".join(missing_settings()))

    body = render(template_name, context or {})
    payload: dict[str, Any] = {
        "from": settings.from_email.strip(),
        "to": [address],
        "subject": subject,
        "html": body,
        "text": plain_text(body),
    }
    reply_to = settings.email_reply_to.strip()
    if reply_to:
        payload["reply_to"] = reply_to

    url = f"{settings.resend_api_base.rstrip('/')}/emails"
    try:
        response = httpx.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key.strip()}",
                "Content-Type": "application/json",
            },
            timeout=settings.email_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        # The exception's own text can carry the request, and the request carries an
        # address — so the class name is all that goes into the log.
        log_line(f"{template_name} {FAILED} ({type(exc).__name__})")
        return Dispatch(False, FAILED, detail="The email service could not be reached.")

    if response.status_code in (200, 201):
        provider_id = None
        try:
            provider_id = str(response.json().get("id") or "") or None
        except ValueError:
            pass
        log_line(f"{template_name} {SENT}")
        return Dispatch(True, SENT, provider_id=provider_id)

    # A provider's error message quotes the address it was given, and it is written
    # by somebody else about a request we just sent. Keep the shape of the answer,
    # never its text, and let the log carry only the status code.
    log_line(f"{template_name} {REJECTED} ({response.status_code})")
    return Dispatch(False, REJECTED, detail=f"The email service refused the message ({response.status_code}).")


def log_line(summary: str) -> None:
    """One line, no address, no subject, no body.

    `print` rather than a logger because this backend has no logging configuration
    to write into: an unconfigured `logging` call at INFO is dropped on a serverless
    host, and a send that silently vanished is the one failure mode nobody would
    ever see.
    """
    print(f"[email] {summary}")
