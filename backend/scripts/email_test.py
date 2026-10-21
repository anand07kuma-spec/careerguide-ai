"""Email service checks: the gate, the renderer, the transport, and the log.

Run it with the backend's own interpreter:

    .venv/Scripts/python.exe scripts/email_test.py

Nothing here talks to Resend. The HTTP layer is replaced with a stub the same way
`payments_test.py` replaces Razorpay's, which is the only way to prove two things
this feature has to get right: that a deployment with no key answers "not
configured" instead of pretending, and that an address never reaches a log line —
neither fact is observable against a real provider.
"""

from __future__ import annotations

import io
import os
import sys
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Set before app.config is imported: pydantic-settings reads the environment when
# the Settings object is built, and get_settings() is cached.
os.environ["RESEND_API_KEY"] = ""
os.environ["FROM_EMAIL"] = ""
os.environ["RATE_LIMIT_ENABLED"] = "false"

from app.config import get_settings  # noqa: E402
from app.services import email  # noqa: E402

PASS: list[str] = []
FAIL: list[str] = []


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        PASS.append(label)
        print(f"  [PASS] {label}")
    else:
        FAIL.append(label)
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


def configure(key: str = "re_test_123", sender: str = "CareerGuide AI <hello@example.invalid>") -> None:
    """Point the settings at a mailbox without ever naming one that exists."""
    os.environ["RESEND_API_KEY"] = key
    os.environ["FROM_EMAIL"] = sender
    get_settings.cache_clear()


def unconfigured() -> None:
    os.environ["RESEND_API_KEY"] = ""
    os.environ["FROM_EMAIL"] = ""
    get_settings.cache_clear()


class _Response:
    def __init__(self, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {}

    def json(self) -> dict:
        return self._payload


class _StubHttpx:
    """Stands in for the httpx module: records the call, then answers how told."""

    class HTTPError(Exception):
        pass

    def __init__(self, response: _Response | None = None, raises: bool = False) -> None:
        self.calls: list[dict] = []
        self.response = response or _Response(200, {"id": "email_abc"})
        self.raises = raises

    def post(self, url: str, **kwargs) -> _Response:
        self.calls.append({"url": url, **kwargs})
        if self.raises:
            raise _StubHttpx.HTTPError("connection reset")
        return self.response


WELCOME = {"name": "Ananya", "lang": "en"}
CONFIRM = {
    "name": "Ananya",
    "confirm_url": "https://careerguide.example.invalid/api/auth/email/confirm?token=abc123",
    "valid_hours": 24,
    "lang": "en",
}
RESULT = {
    "name": "Ananya",
    "instrument": "interest",
    "instrument_label": "interest questionnaire",
    "completed_on": "12 October 2026",
    "traits": [{"label": "Investigating", "percent": 78}, {"label": "Social", "percent": 41}],
    "result_url": "https://careerguide.example.invalid/assessments",
    "lang": "en",
}
DIGEST = {
    "name": "Ananya",
    "week_label": "11–17 October",
    "conversations": 3,
    "messages": 26,
    "careers_saved": 5,
    "assessments_finished": 1,
    "dashboard_url": "https://careerguide.example.invalid/dashboard",
    "lang": "en",
}
RECEIPT = {
    "name": "Rakesh",
    "plan_name": "Pro",
    "interval_label": "monthly",
    "amount_label": "₹499",
    "receipt_ref": "CG-7Q2F9K",
    "paid_on": "14 October 2026",
    "expires_label": "14 November 2026",
    "test_mode": False,
    "billing_url": "https://careerguide.example.invalid/settings/billing",
    "lang": "en",
}
INVITE = {
    "parent_name": "Sunita",
    "student_name": "Ananya",
    "share_code": "K7P2Q",
    "sees_transcripts": False,
    "accept_url": "https://careerguide.example.invalid/link-child",
    "lang": "en",
}

OPERATOR = {
    "lead_name": "Reena Sharma",
    "lead_email": "reena@example.com",
    "lead_phone": "+91 90000 00000",
    "stage_label": "in class 12",
    "country_name": "United States",
    "service_name": "University shortlisting",
    "message": "We would like to talk about applications next year.",
    "source_url": "https://careerguide.example.invalid/study-abroad/united-states",
    "received_at": "18 October 2026",
    "admin_url": "https://careerguide.example.invalid/app/admin/study-abroad",
    "lang": "en",
}
ACK = {
    "name": "Reena Sharma",
    "country_name": "United States",
    "service_name": "University shortlisting",
    "stage_label": "in class 12",
    "received_at": "18 October 2026",
    "study_abroad_url": "https://careerguide.example.invalid/study-abroad",
    "contact_url": "https://careerguide.example.invalid/contact",
    "lang": "en",
}

# The two sentences a school's invitation carries are written in `email_messages.py`
# rather than in the template, so this fixture repeats them from there: a test that
# invented its own wording would pass while the real mail said something else.
ORG_INVITE = {
    "inviter": "Ms. Fernandes",
    "org_name": "Green Valley Public School",
    "portal_title": "Green Valley career desk",
    "label": "Aarav, roll 14",
    "role_line": "A place has been kept for you at Green Valley Public School as a student.",
    "sees": (
        "Nothing you write or answer is visible to the school or the practice that "
        "invited you, until you open this link and choose to join."
    ),
    "not_yet": (
        "Even after you join, your answers and your report stay yours. They are shown "
        "only if you turn sharing on, and you can turn it off again."
    ),
    "expires": "9 November 2026",
    "accept_url": "https://careerguide.example.invalid/join?token=abcdefghIJ012345",
    "lang": "en",
}

ALL = {
    "welcome.html": WELCOME,
    "email_confirm.html": CONFIRM,
    "assessment_result.html": RESULT,
    "weekly_digest.html": DIGEST,
    "payment_receipt.html": RECEIPT,
    "parent_invite.html": INVITE,
    "study_lead_operator.html": OPERATOR,
    "study_lead_ack.html": ACK,
    "org_invite.html": ORG_INVITE,
}

# Three of these ten go to somebody with no account: the family who typed an enquiry
# form, the operator whose mailbox is a server setting, and the person a school has
# invited before they have any place here. Neither of them may say
# "an account you control asked for this", and the suite below refuses it.
NO_ACCOUNT = {"study_lead_operator.html", "study_lead_ack.html", "org_invite.html"}


def main() -> int:
    section("The gate: no key, no mail, and no lie about it")
    unconfigured()
    check("a blank key and sender means email is off", email.enabled() is False)
    check(
        "the answer names both variables that are missing",
        email.missing_settings() == ["RESEND_API_KEY", "FROM_EMAIL"],
        str(email.missing_settings()),
    )
    stub = _StubHttpx()
    email.httpx = stub
    with redirect_stdout(io.StringIO()):
        off = email.send("someone@example.invalid", "welcome.html", "Welcome", {"name": "X"})
    check("a send with no key returns not-configured", off.status == email.NOT_CONFIGURED, off.status)
    check("and says it did not deliver", off.ok is False and off.as_dict()["delivered"] is False)
    check("and no HTTP call was made", stub.calls == [], str(len(stub.calls)))
    err = email.disabled_error()
    check(
        "a route can answer 503 rather than a fake success",
        err.status_code == 503 and "RESEND_API_KEY" in str(err.detail) and "no message is on its way" in str(err.detail),
    )

    section("An address is checked before it is paid for")
    for junk in ["", "   ", "not-an-address", "a@b", "a b@c.in", "a@b@c.in", "@x.com", "x@y .com"]:
        check(f"refuses {junk!r}", email.valid_address(junk) is False)
    check("accepts an ordinary address", email.valid_address("ananya.sharma@example.in"))
    check("accepts a plus-addressed one", email.valid_address("parent+ananya@example.in"))
    check(
        "refuses one longer than the RFC ceiling",
        email.valid_address("a" * 250 + "@example.in") is False,
    )
    check("normalises case and spaces", email.normalize_address("  Ananya@Example.IN ") == "ananya@example.in")
    with redirect_stdout(io.StringIO()):
        junked = email.send("definitely not an address", "welcome.html", "Welcome", {})
    check("and a junk address is refused before the transport", junked.status == email.INVALID_ADDRESS)

    section("Rendering: every template, in both languages")
    check(
        "the templates directory is where the service says it is",
        email.TEMPLATES_DIR.is_dir() and len(list(email.TEMPLATES_DIR.glob("*.html"))) == len(ALL) + 1,
        f"{email.TEMPLATES_DIR} holds {len(list(email.TEMPLATES_DIR.glob('*.html')))} files, "
        f"the suite renders {len(ALL)} plus the shared frame",
    )
    for name, context in ALL.items():
        english = email.render(name, context)
        hindi_context = {**context, "lang": "hi"}
        hindi = email.render(name, hindi_context)
        check(f"{name} renders as HTML", english.startswith("<!doctype html>") and "</html>" in english)
        check(f"{name} carries the site name", "CareerGuide AI" in english)
        if name in NO_ACCOUNT:
            check(
                f"{name} says why this address got it without claiming an account",
                "You are getting this because" in english and "/app/settings" not in english,
            )
        else:
            check(f"{name} carries the settings link", "/app/settings" in english)
        check(f"{name} carries the disclaimer", "not an aptitude test" in english)
        check(f"{name} differs in Hindi", hindi != english)
        check(f"{name} has no untranslated placeholder braces", "{{" not in hindi and "{%" not in hindi)
    check(
        "a Hindi reader of the result mail gets the Hindi sentence",
        "पूरी की" in email.render("assessment_result.html", {**RESULT, "lang": "hi"}),
    )
    check(
        "a test payment says no money moved",
        "No money left any account" in email.render("payment_receipt.html", {**RECEIPT, "test_mode": True}),
    )
    check(
        "a real payment does not say that",
        "No money left any account" not in email.render("payment_receipt.html", RECEIPT),
    )
    check(
        "the invite states what a parent will not see",
        "You will not see the conversations" in email.render("parent_invite.html", INVITE),
    )
    operator_mail = email.render("study_lead_operator.html", OPERATOR)
    check(
        "the operator's copy carries the enquiry in the sender's own words",
        "applications next year" in operator_mail,
    )
    check(
        "and how to answer it",
        "mailto:reena@example.com" in operator_mail,
    )
    check(
        "it names no other student",
        "Ananya" not in operator_mail,
    )
    ack_mail = email.render("study_lead_ack.html", ACK)
    check(
        "the acknowledgement says nothing was booked, because nothing was",
        "Nothing is booked" in ack_mail,
    )
    check(
        "and promises no place, no visa and no outcome",
        "no visa and no outcome has been promised" in ack_mail,
    )
    check(
        "a Hindi reader of the acknowledgement gets the Hindi sentence",
        "कुछ भी बुक नहीं हुआ" in email.render("study_lead_ack.html", {**ACK, "lang": "hi"}),
    )
    org_mail = email.render("org_invite.html", ORG_INVITE)
    check(
        "a school's invitation promises exactly what its roster routes keep",
        "Nothing you write or answer is visible to the school" in org_mail,
    )
    check(
        "and says the answers stay the student's own after joining",
        "your answers and your report stay yours" in org_mail,
    )
    check(
        "it states the day the held place is given back",
        "9 November 2026" in org_mail,
    )
    check(
        "and says plainly that no account is behind this address yet",
        "There is no account behind this address yet" in org_mail,
    )
    check(
        "a Hindi invitee reads that same sentence in Hindi",
        "इस पते से अभी कोई खाता जुड़ा नहीं है"
        in email.render("org_invite.html", {**ORG_INVITE, "lang": "hi"}),
    )
    check(
        "and drops that sentence when transcripts are shared",
        "the words of the conversations themselves"
        in email.render("parent_invite.html", {**INVITE, "sees_transcripts": True}),
    )
    hostile = email.render("welcome.html", {"name": "<script>steal()</script>", "lang": "en"})
    check(
        "a name containing markup is escaped, not executed",
        "<script>steal()" not in hostile and "&lt;script&gt;" in hostile,
    )

    section("The plain-text part is derived, not rewritten")
    html = email.render("email_confirm.html", CONFIRM)
    text = email.plain_text(html)
    check("carries no tags", "<" not in text and "style=" not in text, text[:80])
    check("keeps the heading", "Is this address yours?" in text)
    check(
        "keeps the link target a text reader needs",
        "api/auth/email/confirm?token=abc123" in text,
    )
    check("keeps the Hindi out of an English mail", "पुष्टि" not in text)
    check("and keeps it in a Hindi one", "पुष्टि" in email.plain_text(email.render("email_confirm.html", {**CONFIRM, "lang": "hi"})))

    section("The transport call")
    configure()
    stub = _StubHttpx()
    email.httpx = stub
    with redirect_stdout(io.StringIO()):
        sent = email.send("ananya@example.invalid", "welcome.html", "Welcome, Ananya", WELCOME)
    check("one call, to the documented endpoint", len(stub.calls) == 1 and stub.calls[0]["url"].endswith("/emails"))
    call = stub.calls[0]
    check("authenticated with the key", call["headers"]["Authorization"] == "Bearer re_test_123")
    check("from the configured sender alone", call["json"]["from"] == "CareerGuide AI <hello@example.invalid>")
    check("to exactly one recipient", call["json"]["to"] == ["ananya@example.invalid"])
    check("with subject, html and text", {"subject", "html", "text"} <= set(call["json"]))
    check("and no reply-to until one is configured", "reply_to" not in call["json"])
    check("reports the provider's id", sent.ok and sent.provider_id == "email_abc")
    check("timeout comes from settings", call["timeout"] == get_settings().email_timeout_seconds)

    os.environ["EMAIL_REPLY_TO"] = "family@example.invalid"
    get_settings.cache_clear()
    stub = _StubHttpx()
    email.httpx = stub
    with redirect_stdout(io.StringIO()):
        email.send("ananya@example.invalid", "welcome.html", "Welcome", WELCOME)
    check(
        "a configured reply-to is passed through",
        stub.calls[0]["json"].get("reply_to") == "family@example.invalid",
    )
    os.environ.pop("EMAIL_REPLY_TO")
    get_settings.cache_clear()

    section("Failure answers")
    stub = _StubHttpx(response=_Response(422, {"name": "validation_error", "message": "an@example.invalid is not valid"}))
    email.httpx = stub
    log = io.StringIO()
    with redirect_stdout(log):
        refused = email.send("ananya@example.invalid", "welcome.html", "Welcome", WELCOME)
    check("a 4xx is a rejection, not a success", refused.ok is False and refused.status == email.REJECTED)
    check("and quotes the status code, not the provider's message", "422" in refused.detail or "422" in log.getvalue())
    check(
        "no log line carries an address",
        "example.invalid" not in log.getvalue() and "anand" not in log.getvalue().lower(),
        log.getvalue(),
    )

    stub = _StubHttpx(raises=True)
    email.httpx = stub
    with redirect_stdout(io.StringIO()):
        broken = email.send("ananya@example.invalid", "welcome.html", "Welcome", WELCOME)
    check("a transport error is reported as a failure", broken.ok is False and broken.status == email.FAILED)

    section("A subject line follows the reader")
    check("English by default", email.copy("en", "Payment received", "भुगतान मिल गया") == "Payment received")
    check("Hindi when that is the language", email.copy("hi", "Payment received", "भुगतान मिल गया") == "भुगतान मिल गया")
    check("Hinglish gets the English string, not an empty one", email.copy("hinglish", "Receipt", "रसीद") == "Receipt")
    check("and a missing Hindi line falls back rather than vanishing", email.copy("hi", "Receipt") == "Receipt")

    unconfigured()
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    for label in FAIL:
        print(f"  failed: {label}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
