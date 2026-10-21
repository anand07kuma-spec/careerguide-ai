"""What each message says, and which row it got that from.

Three services split the job, and the split is the point:

* `email.py` — how to put bytes in front of a mailbox.
* `email_consent.py` — whether this account may be written to at all.
* this file — the content, read out of the database at the moment of sending.

Nothing here stores a message. A queued digest or a queued result copy is a pointer
(`ref_id`, `ref_key`) resolved again when it is drained, so a student who deletes the
sitting in the meantime gets nothing, rather than getting a saved copy of answers they
removed. The same rule is why no template receives a raw answer: a mail carries the
shaped summary the app already shows on screen, and a link to the account that holds
the rest.

Money is formatted here rather than in a template, because a rupee amount is the one
value in this feature that a float would corrupt — paise in, `"₹1,499"` out, Indian
grouping, with a fraction only when there really is one.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urlencode

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import (
    ConversationSession,
    Guardianship,
    Membership,
    Message,
    Organization,
    OrganizationBranding,
    Payment,
    Result,
    SavedCareer,
    StudentProfile,
    Subscription,
    StudyCountry,
    StudyLead,
    StudyService,
    User,
)
from . import assessment_bank, plans, scoring
from . import email as transport
from . import email_consent as consent

# Where a link in a message goes. `/email/confirm` is the one page the frontend has
# to carry for this feature to work at all: the token in a confirmation link is not
# readable by a person, and a JSON answer shown on a blank page is not a confirmation.
PATHS = {
    "dashboard": "/app",
    "settings": "/app/settings",
    "billing": "/app/billing",
    "assessments": "/app/assessments",
    "contact": "/contact",
    "confirm": "/email/confirm",
    "parent": "/parent",
    "join": "/join",
    "study_abroad": "/study-abroad",
    "admin_study_abroad": "/app/admin/study-abroad",
}

_MONTHS = {
    "en": (
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ),
    "hi": (
        "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
        "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
    ),
}

# One sentence per reason a message did not go, in the API's own English — the same
# convention `ShareCodeOut.note` already uses, so a screen can show it directly and a
# translation belongs in the interface dictionary rather than in a service.
NOTES = {
    "sent": "The message was handed to the email service.",
    "invalid-address": "That is not an email address, so nothing was sent.",
    "disabled": (
        "Email is not enabled on this deployment, so nothing was sent and nothing is "
        "on its way."
    ),
    "no-address": "No confirmed email address is attached to this account yet.",
    "not-agreed": "This account has not agreed to that kind of message.",
    "closed": "This account is closed, so no message was sent.",
    "nothing-to-say": "There was nothing to report, so no message was sent.",
    "rejected": "The email service refused the message; nothing was delivered.",
    "failed": "The email service could not be reached; nothing was delivered.",
    "no-code": "This account has no sharing code yet, so there is nothing to invite with.",
    "no-operator-address": (
        "The site has no mailbox set up to receive enquiries, so nobody was notified. "
        "The enquiry itself is stored."
    ),
}


@dataclass
class Draft:
    """One rendered intention: a template, a subject line, the values it needs."""

    template: str
    subject: str
    context: dict[str, Any]


@dataclass
class Answer:
    """What a send attempt ended as, in one word the route can put on screen."""

    reason: str
    detail: str | None = None

    @property
    def delivered(self) -> bool:
        return self.reason == "sent"

    @property
    def note(self) -> str:
        return NOTES.get(self.reason, NOTES["failed"])


def _language(user: User) -> str:
    return "hi" if (user.preferred_language or "en") == "hi" else "en"


def _url(key: str, **query: str) -> str:
    base = get_settings().public_site_url.rstrip("/")
    path = base + PATHS[key]
    if query:
        path += "?" + urlencode(query)
    return path


def _day(value: datetime | None, language: str) -> str:
    if value is None:
        return ""
    return f"{value.day} {_MONTHS[language][value.month - 1]} {value.year}"


def _week_label(monday: date, language: str) -> str:
    sunday = monday + timedelta(days=6)
    names = _MONTHS[language]
    if monday.month == sunday.month:
        return f"{monday.day}–{sunday.day} {names[monday.month - 1]}"
    if monday.year != sunday.year:
        return f"{monday.day} {names[monday.month - 1]} {monday.year} – {sunday.day} {names[sunday.month - 1]} {sunday.year}"
    return f"{monday.day} {names[monday.month - 1]} – {sunday.day} {names[sunday.month - 1]}"


def _rupees(paise: int) -> str:
    """Paise in, a rupee string out, grouped the way Indian money is read.

    No float appears anywhere between the provider's number and this one, because the
    first rounding error on an amount is the one a parent has to trust on an invoice.
    """
    rupees, fraction = divmod(int(paise), 100)

    def group(number: int) -> str:
        digits = str(number)
        if len(digits) <= 3:
            return digits
        head, tail = digits[:-3], digits[-3:]
        chunks: list[str] = []
        while len(head) > 2:
            chunks.insert(0, head[-2:])
            head = head[:-2]
        if head:
            chunks.insert(0, head)
        return ",".join(chunks) + "," + tail

    text = f"₹{group(rupees)}"
    return text if not fraction else f"{text}.{fraction:02d}"


def _instrument_name(assessment_type: str, language: str) -> str:
    instrument = assessment_bank.instrument(assessment_type) or {}
    return scoring.pick(instrument.get("name"), language) or assessment_type


def _welcome(db: Session, user: User, ref_id: int | None, ref_key: str | None) -> Draft | None:
    language = _language(user)
    return Draft(
        template="welcome.html",
        subject=transport.copy(
            language,
            f"{transport.SITE_NAME} is ready",
            f"{transport.SITE_NAME} तैयार है",
        ),
        context={"lang": language, "name": user.display_name},
    )


def _confirmation(db: Session, user: User, token: str) -> Draft:
    language = _language(user)
    return Draft(
        template="email_confirm.html",
        subject=transport.copy(
            language,
            "Confirm this email address",
            "इस ईमेल पते की पुष्टि करें",
        ),
        context={
            "lang": language,
            "name": user.display_name,
            "confirm_url": _url("confirm", token=token),
            "valid_hours": consent.valid_hours(),
        },
    )


def _result(db: Session, user: User, ref_id: int | None, ref_key: str | None) -> Draft | None:
    if ref_id is None:
        return None
    result = db.get(Result, ref_id)
    if result is None or result.user_id != user.id:
        # Never a stranger's result because a caller passed an id it should not have.
        return None
    language = _language(user)
    ranked = scoring.traits(result.assessment_type, language, result.score_json or {})
    traits = [
        {"label": entry["name"], "percent": entry["score"]}
        for entry in ranked
        if entry["score"] is not None
    ][:3]
    name = _instrument_name(result.assessment_type, language)
    return Draft(
        template="assessment_result.html",
        subject=transport.copy(
            language,
            f"Your {name} result",
            f"{name} का आपका परिणाम",
        ),
        context={
            "lang": language,
            "name": user.display_name,
            "instrument": result.assessment_type,
            "instrument_label": name,
            "completed_on": _day(result.completed_at, language),
            "traits": traits,
            "result_url": _url("assessments"),
        },
    )


def week_bounds(monday: date) -> tuple[datetime, datetime]:
    """A digest week is a Monday to Monday in the same local day the free plan's
    quota rolls on, so the two features cannot disagree about when a day starts."""
    offset = timezone(timedelta(minutes=get_settings().quota_utc_offset_minutes))
    local_start = datetime.combine(monday, time.min, tzinfo=offset)
    start = local_start.astimezone(timezone.utc)
    return start, start + timedelta(days=7)


def _digest(db: Session, user: User, ref_id: int | None, ref_key: str | None) -> Draft | None:
    if not ref_key:
        return None
    try:
        monday = date.fromisoformat(ref_key)
    except ValueError:
        return None
    start, end = week_bounds(monday)

    conversations = db.scalar(
        select(func.count(ConversationSession.id)).where(
            ConversationSession.student_id == user.id,
            ConversationSession.created_at >= start,
            ConversationSession.created_at < end,
        )
    )
    messages = db.scalar(
        select(func.count(Message.id))
        .join(ConversationSession, Message.session_id == ConversationSession.id)
        .where(
            ConversationSession.student_id == user.id,
            Message.role == "user",
            Message.created_at >= start,
            Message.created_at < end,
        )
    )
    careers_saved = db.scalar(
        select(func.count(SavedCareer.id)).where(
            SavedCareer.student_id == user.id,
            SavedCareer.created_at >= start,
            SavedCareer.created_at < end,
        )
    )
    assessments_finished = db.scalar(
        select(func.count(Result.id)).where(
            Result.user_id == user.id,
            Result.completed_at >= start,
            Result.completed_at < end,
        )
    )
    counts = (conversations, messages, careers_saved, assessments_finished)
    if not any(counts):
        # A quiet week sends nothing. "You did none of this" is a report about a
        # child's absence, and nobody asked for it.
        return None

    language = _language(user)
    return Draft(
        template="weekly_digest.html",
        subject=transport.copy(
            language,
            f"Your week in {transport.SITE_NAME}",
            f"{transport.SITE_NAME} में आपका सप्ताह",
        ),
        context={
            "lang": language,
            "name": user.display_name,
            "week_label": _week_label(monday, language),
            "conversations": int(conversations or 0),
            "messages": int(messages or 0),
            "careers_saved": int(careers_saved or 0),
            "assessments_finished": int(assessments_finished or 0),
            "dashboard_url": _url("dashboard"),
        },
    )


def _receipt(db: Session, user: User, ref_id: int | None, ref_key: str | None) -> Draft | None:
    if ref_id is None:
        return None
    payment = db.get(Payment, ref_id)
    if payment is None or payment.user_id != user.id:
        return None
    language = _language(user)
    plan = plans.get(payment.plan_code)
    subscription = db.get(Subscription, user.id)
    period = {"monthly": ("month", "महीना"), "yearly": ("year", "साल")}.get(
        payment.interval, (payment.interval or "", payment.interval or "")
    )
    return Draft(
        template="payment_receipt.html",
        subject=transport.copy(
            language,
            "Your payment receipt" if not payment.test_mode else "Test payment recorded",
            "आपकी भुगतान रसीद" if not payment.test_mode else "परीक्षण भुगतान दर्ज हुआ",
        ),
        context={
            "lang": language,
            "name": user.display_name,
            "plan_name": plan.name if plan else payment.plan_code,
            "interval_label": transport.copy(language, period[0], period[1]),
            "amount_label": _rupees(payment.amount_paise),
            "receipt_ref": payment.receipt,
            "paid_on": _day(payment.captured_at or payment.created_at, language),
            "expires_label": _day(subscription.expires_at if subscription else None, language)
            or transport.copy(language, "until you cancel", "जब तक आप रद्द नहीं करतीं"),
            "test_mode": bool(payment.test_mode),
            "billing_url": _url("billing"),
        },
    )


BUILDERS: dict[str, Callable[[Session, User, int | None, str | None], Draft | None]] = {
    "welcome": _welcome,
    "result": _result,
    "digest": _digest,
    "receipt": _receipt,
}


def send(
    db: Session,
    user: User,
    kind: str,
    *,
    ref_id: int | None = None,
    ref_key: str | None = None,
) -> Answer:
    """The only way anything reaches a confirmed address.

    Consent first, then content, then transport — in that order, so a message that
    was never agreed to is never even rendered, and a message about a row that no
    longer exists is never sent to an address that is still valid.
    """
    allowed, reason = consent.may_send(db, user, kind)
    if not allowed:
        return Answer(reason)
    builder = BUILDERS.get(kind)
    if builder is None:
        raise ValueError(f"No message builder for {kind}")
    message = builder(db, user, ref_id, ref_key)
    if message is None:
        return Answer("nothing-to-say")
    address = consent.confirmed_address(user)
    dispatch = transport.send(address or "", message.template, message.subject, message.context)
    return Answer("sent" if dispatch.ok else dispatch.status, dispatch.detail)


def send_confirmation(db: Session, user: User, token: str) -> Answer:
    """The one message sent to an address that is not yet usable.

    It bypasses `consent.may_send` by necessity — the address is unconfirmed, which
    is exactly what this mail exists to fix — and that is also its whole limit: it
    carries a link and no data about the account, so a mistyped address receives one
    incomprehensible token and nothing else.
    """
    if not transport.enabled():
        return Answer("disabled")
    address = user.contact_email
    if not transport.valid_address(address):
        return Answer("invalid-address")
    message = _confirmation(db, user, token)
    dispatch = transport.send(address or "", message.template, message.subject, message.context)
    return Answer("sent" if dispatch.ok else dispatch.status, dispatch.detail)


def send_welcome(db: Session, user: User) -> Answer:
    return send(db, user, "welcome")


def send_parent_invite(db: Session, student: User, address: str) -> Answer:
    """Invite a guardian to a student's account, to an address that is never stored.

    The recipient has no account and no consent record yet, so `may_send` cannot
    apply and nothing here pretends otherwise: what stands in its place is the
    sharing code, which only the student's own account can produce and revoke, and
    the rate limit on the route that calls this. The address itself goes out in one
    request and is not written down anywhere — which is why no delete path has to
    remember it later.
    """
    if not transport.enabled():
        return Answer("disabled")
    value = transport.normalize_address(address)
    if not transport.valid_address(value):
        return Answer("invalid-address")
    profile = db.get(StudentProfile, student.id)
    if profile is None or not profile.share_code:
        return Answer("no-code")

    language = _language(student)
    existing = db.scalars(
        select(Guardianship)
        .where(Guardianship.student_id == student.id)
        .order_by(Guardianship.id.desc())
        .limit(1)
    ).first()
    message = Draft(
        template="parent_invite.html",
        subject=transport.copy(
            language,
            f"{student.display_name} invited you on {transport.SITE_NAME}",
            f"{student.display_name} ने आपको {transport.SITE_NAME} पर आमंत्रित किया",
        ),
        context={
            "lang": language,
            # No parent name exists yet — an address is not a name, and inventing one
            # from a mailbox is how a stranger ends up addressed as somebody's mother.
            "parent_name": "",
            "student_name": student.display_name,
            "share_code": profile.share_code,
            "sees_transcripts": bool(existing and existing.share_conversation_transcripts),
            "accept_url": _url("parent"),
        },
    )
    dispatch = transport.send(value, message.template, message.subject, message.context)
    return Answer("sent" if dispatch.ok else dispatch.status, dispatch.detail)


# The two sentences an invitation has to carry, per kind of member. They are the promise
# this feature makes and the routes keep, so they live here where a reviewer can read them
# against `security.client_is_visible` rather than being retyped inside a template.
_JOIN_PROMISE = {
    "child": (
        (
            "Nothing you write or answer is visible to the school or the practice that "
            "invited you, until you open this link and choose to join.",
            "जब तक आप यह लिंक खोलकर शामिल नहीं होते, आपको आमंत्रित करने वाला स्कूल या "
            "सलाहकार आपके बारे में कुछ भी नहीं देख सकता।",
        ),
        (
            "Even after you join, your answers and your report stay yours. They are shown "
            "only if you turn sharing on, and you can turn it off again.",
            "शामिल होने के बाद भी आपके उत्तर और आपकी रिपोर्ट सिर्फ़ आपकी हैं। वे तभी दिखेंगी "
            "जब आप खुद साझा करना चुनें, और आप इसे कभी भी बंद कर सकते हैं।",
        ),
    ),
    "staff": (
        (
            "This portal shows you your own organisation's roster and notes. It never "
            "shows a student's answers unless that student chose to share them.",
            "यह पोर्टल आपको आपके संगठन की सूची और नोट दिखाता है। किसी विद्यार्थी के उत्तर "
            "तभी दिखेंगे जब उसने खुद साझा करना चुना हो।",
        ),
        (
            "Nothing here changes the guidance a student is given, and no licence or "
            "payment can do that.",
            "यहाँ का कुछ भी किसी विद्यार्थी को दी गई सलाह नहीं बदलता, और कोई शुल्क या "
            "लाइसेंस ऐसा नहीं कर सकता।",
        ),
    ),
}

# The role word, as it appears in the sentence "a place has been kept for you as …".
_ROLE_WORDS = {
    "student": ("a student", "विद्यार्थी"),
    "parent": ("a parent or guardian", "अभिभावक"),
    "counsellor": ("a counsellor", "सलाहकार"),
    "school_admin": ("an administrator", "स्कूल प्रशासक"),
}


def send_org_invite(
    db: Session,
    sender: User,
    org: Organization,
    membership: Membership,
    token: str,
) -> Answer:
    """Hold a place for somebody at an address the school typed, and tell them about it.

    The shape of `send_parent_invite`, for the same reasons: the recipient has no account
    and no consent record yet, so `consent.may_send` cannot apply, and what stands in its
    place is a single-use token and the rate limit on the route that calls this. The
    address is written on one waiting roster row — a place reserved for this person, not a
    record about them — and the join route deletes it the moment the account itself
    arrives.

    Nothing about a child is in this mail. It names who is asking, what joining would
    allow, and how long the link stays open, because a message that gets forwarded around
    a staffroom should carry no report with it.
    """
    if not transport.enabled():
        return Answer("disabled")
    value = transport.normalize_address(membership.invited_email or "")
    if not transport.valid_address(value):
        return Answer("invalid-address")

    language = _language(sender)
    role = membership.org_role
    staff = role in ("counsellor", "school_admin")
    promise = _JOIN_PROMISE["staff" if staff else "child"]
    role_en, role_hi = _ROLE_WORDS.get(role, _ROLE_WORDS["student"])
    branding = db.get(OrganizationBranding, org.id)
    portal_title = (branding.portal_title if branding else None) or org.name
    # The label the inviter typed, shown only where there is one. It is the school's own
    # word for its student, and a person addressed as "Roll no. 14" in a letter is a
    # reminder that a roster is not a name.
    label = membership.display_label or ""

    message = Draft(
        template="org_invite.html",
        subject=transport.copy(
            language,
            f"{sender.display_name} invited you to {org.name} on {transport.SITE_NAME}",
            f"{sender.display_name} ने {org.name} के लिए {transport.SITE_NAME} पर आपको "
            "आमंत्रित किया",
        ),
        context={
            "lang": language,
            "inviter": sender.display_name,
            "org_name": org.name,
            "portal_title": portal_title,
            "label": label,
            "role_line": transport.copy(
                language,
                f"A place has been kept for you at {org.name} as {role_en}.",
                f"{org.name} ने आपके लिए {role_hi} के रूप में एक स्थान रखा है।",
            ),
            "sees": transport.copy(language, *promise[0]),
            "not_yet": transport.copy(language, *promise[1]),
            "expires": _day(membership.invite_expires_at, language),
            "accept_url": _url("join", token=token),
        },
    )
    dispatch = transport.send(value, message.template, message.subject, message.context)
    return Answer("sent" if dispatch.ok else dispatch.status, dispatch.detail)


# The stage a person picks off the enquiry form, written out. English only, because
# these two mails have no language to choose from: the sender has no account, no
# profile and no settings screen, and guessing a language from an email address is
# exactly the kind of inference this app has decided not to make anywhere.
_LEAD_STAGES = {
    "class-9": "in class 9",
    "class-10": "in class 10",
    "class-11": "in class 11",
    "class-12": "in class 12",
    "in-college": "already in college",
    "other": "somewhere else in the journey",
}


def _page(path: str | None) -> str:
    """A site URL from a path the client sent.

    The schema already refused anything that is not a leading-slash path of ordinary
    characters, so this is joining, not sanitising.
    """
    if not path:
        return ""
    base = get_settings().public_site_url.rstrip("/")
    return base + (path if path.startswith("/") else "/" + path)


def _lead_context(db: Session, lead: StudyLead) -> dict[str, Any]:
    """The four labels a lead row cannot say for itself.

    Resolved from the ids at send time rather than copied into the row when it was
    written: a country renamed next month should not still be called by its old name
    in a mail, and a country deleted should simply stop appearing.
    """
    country = db.get(StudyCountry, lead.country_id) if lead.country_id else None
    service = db.get(StudyService, lead.service_id) if lead.service_id else None
    return {
        "country_name": country.name if country else "",
        "service_name": service.title if service else "",
        "stage_label": _LEAD_STAGES.get(lead.stage or "", ""),
        "received_at": _day(lead.created_at, "en"),
    }


def send_lead_notification(db: Session, lead: StudyLead) -> Answer:
    """Tell the operator that somebody asked to talk.

    The address mailed is a server setting, never a form field and never editable from
    a screen, for the reason in `config.py`: a public form that could choose where its
    own notifications go is a forwarding service for any mailbox in the world. When the
    setting is blank the answer is a sentence, not a silence — the enquiry is in the
    table either way, and the admin list is where it is read.
    """
    if not transport.enabled():
        return Answer("disabled")
    operator = get_settings().lead_notify_email.strip()
    if not transport.valid_address(operator):
        return Answer("no-operator-address")
    context = {
        "lang": "en",
        "lead_name": lead.name,
        "lead_email": lead.email,
        "lead_phone": lead.phone or "",
        "message": lead.message or "",
        "source_url": _page(lead.source_page),
        "admin_url": _url("admin_study_abroad"),
        **_lead_context(db, lead),
    }
    subject = f"New study abroad enquiry from {lead.name}"
    dispatch = transport.send(operator, "study_lead_operator.html", subject, context)
    return Answer("sent" if dispatch.ok else dispatch.status, dispatch.detail)


def send_lead_acknowledgement(db: Session, lead: StudyLead) -> Answer:
    """Tell the person who typed the form that it arrived, and what it did not do.

    Like `send_parent_invite`, this writes to an address nobody confirmed, so
    `consent.may_send` cannot apply and is not pretended to: what stands in its place
    is the ticked checkbox on the form, whose timestamp is on the row, plus the rate
    limit on the route. The mail's own job is to be honest about the word "book" —
    nothing is scheduled by it, and it says so.
    """
    if not transport.enabled():
        return Answer("disabled")
    address = transport.normalize_address(lead.email)
    if not transport.valid_address(address):
        return Answer("invalid-address")
    context = {
        "lang": "en",
        "name": lead.name,
        "study_abroad_url": _url("study_abroad"),
        "contact_url": _url("contact"),
        **_lead_context(db, lead),
    }
    subject = f"We received your enquiry on {transport.SITE_NAME}"
    dispatch = transport.send(address, "study_lead_ack.html", subject, context)
    return Answer("sent" if dispatch.ok else dispatch.status, dispatch.detail)
