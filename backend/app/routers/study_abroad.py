"""The study abroad directory, the enquiry form, and the operator's screen.

Three kinds of route live here and the line between them is the whole design:

* **Public reads answer with what is known and name what is not.** Every list and
  detail below hands back the `verified` flag, the `source_url` and the `verified_at`
  date with the rest of the row, because the honest state of this directory is that
  every seeded institution is listed by name, city and official domain and almost nothing
  else has been checked. A page that dropped those three fields would render the same
  rows as a completed reference.
* **The enquiry form stores almost nothing, and only after a tick.** `POST /leads`
  refuses when `consent_contact` is false — before writing a row, not after — because
  a form that saves an address nobody agreed to be written to is the one thing this
  table must never become. There is no school name, no city, no marks and no document
  here; a first conversation does not need them, and a sales table full of a minor's
  records is not something any delete path can undo.
* **Admin is a flag, not a signup, and it is checked on every route.** `get_admin_user`
  re-reads `users.is_admin` per request; there is no admin token, no admin role in a
  client body, and no route here that can grant the flag to anybody. That is also why
  a non-admin gets one readable sentence rather than a 404: the screen exists, and
  whose it is needs no hiding.

Two rules are enforced here rather than trusted from a form:

* A row cannot call itself verified. `verified: true` requires a `source_url` on the
  row (given now or already there) and the date is stamped by this file, so "verified"
  means *somebody opened something on this day* and never *somebody ticked a box*.
* A story cannot be published without the named person's consent date. `published:
  true` requires `consent_confirmed_at`, for the reason in the model: an invented
  success story is the most persuasive and least verifiable content a site aimed at
  seventeen-year-olds can carry.

The third thing this file does is write the operator log. Every mutation below records
one row through `app/services/audit.py` in the same transaction as the change — the
action, the row it touched, and which fields moved. An enquiry's own text is never copied
into the log: a lead already holds what a person typed, and a second copy of it in a table
that is read more widely than the first would only widen how far it can travel.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.exceptions import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..middleware.rate_limit import lead_limit
from ..models import StudyCountry, StudyLead, StudyService, StudyStory, University, User
from ..schemas import (
    LeadAdminOut,
    LeadHandleIn,
    LeadIn,
    LeadOut,
    StudyCountryCardOut,
    StudyCountryOut,
    StudyServiceOut,
    StudyStoryOut,
    StoryAdminOut,
    StoryCreateIn,
    UniversityAdminOut,
    UniversityCreateIn,
    UniversityOut,
    UniversitySummaryOut,
    UniversityUpdateIn,
)
from ..security import get_admin_user, get_current_user
from ..seed.study_abroad import slugify
from ..services import audit
from ..services import email as transport
from ..services import email_messages as messages

router = APIRouter(prefix="/api/study-abroad", tags=["study-abroad"])

log = logging.getLogger(__name__)

NO_CONSENT = (
    "Nothing was stored. The box agreeing that we may contact you at this address had "
    "not been ticked, and without it there is no permission to keep your details."
)
BAD_ADDRESS = "That is not an email address, so nothing was stored. Check it and send again."
UNKNOWN_COUNTRY = (
    "We could not find that country in our directory, so nothing was stored. Reload the "
    "page and choose from the countries it lists."
)
UNKNOWN_SERVICE = (
    "We could not find that service in our directory, so nothing was stored. Reload the "
    "page and choose from the services it lists."
)
NO_SOURCE = (
    "A row cannot be marked verified without saying where the figure came from. Give a "
    "source_url — the university's own page — and the date will be recorded for you."
)
NO_STORY_CONSENT = (
    "This story cannot be published until the person named in it has agreed to it being "
    "published. Set consent_confirmed_at to the day they said so."
)
NOT_FOUND = {
    "country": "That country is not in our directory.",
    "university": "That university is not in our directory.",
    "service": "That service is not in our directory.",
    "story": "That story does not exist.",
    "lead": "That enquiry is not in the list — it may already have been deleted.",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _missing(kind: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND[kind])


def _refused(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=detail)


def _valid_url(value: str | None) -> bool:
    """A scheme and a host, which is all a URL in this directory can be required to be.

    Every unverified field on a university page tells the reader to go and check the
    institution's own site, so the two address columns have to be addresses. Whether the
    page says what the row claims is a question for a human, and it is the reason the
    row also carries `verified_at`.
    """
    value = (value or "").strip()
    return bool(value) and value.startswith(("https://", "http://")) and "." in value


def _country_by_slug(db: Session, slug: str) -> StudyCountry:
    row = db.scalars(select(StudyCountry).where(StudyCountry.slug == slug)).first()
    if row is None:
        raise _missing("country")
    return row


def _university_by_slug(db: Session, slug: str) -> University:
    row = db.scalars(select(University).where(University.slug == slug)).first()
    if row is None:
        raise _missing("university")
    return row


# ------------------------------------------------------------------ public reads


@router.get("/countries", response_model=list[StudyCountryCardOut])
def list_countries(db: Session = Depends(get_db)) -> list[StudyCountryCardOut]:
    """The six destinations, each with how many institutions we can actually name.

    The count is of *listed* rows, not of good universities in a country, and the page
    labels it that way. It is here so a card can be honest about how thin its own
    section is rather than looking equally finished in all six languages of the copy.
    """
    rows = list(
        db.scalars(
            select(StudyCountry)
            .where(StudyCountry.is_active.is_(True))
            .order_by(StudyCountry.sort_order, StudyCountry.name)
        )
    )
    counts = dict(
        db.execute(
            select(University.country_id, func.count(University.id))
            .where(University.is_active.is_(True))
            .group_by(University.country_id)
        ).all()
    )
    return [
        StudyCountryCardOut.model_validate(
            {
                **StudyCountryOut.model_validate(row).model_dump(),
                "universities": counts.get(row.id, 0),
            }
        )
        for row in rows
    ]


@router.get("/countries/{slug}", response_model=StudyCountryOut)
def get_country(slug: str, db: Session = Depends(get_db)) -> StudyCountryOut:
    return StudyCountryOut.model_validate(_country_by_slug(db, slug))


@router.get("/countries/{slug}/universities", response_model=list[UniversitySummaryOut])
def list_country_universities(
    slug: str,
    search: str | None = Query(default=None, max_length=80),
    db: Session = Depends(get_db),
) -> list[UniversitySummaryOut]:
    """The institutions listed for one destination, in the order the file put them.

    Sorted by `sort_order` then name — which the seed assigns alphabetically. Nothing
    here ranks anything, and a sponsored row cannot move up the list because
    `sponsored` is only ever printed as a label.
    """
    country = _country_by_slug(db, slug)
    stmt = (
        select(University)
        .where(University.country_id == country.id, University.is_active.is_(True))
        .order_by(University.sort_order, University.name)
    )
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(University.name).like(pattern),
                func.lower(University.city).like(pattern),
            )
        )
    return [UniversitySummaryOut.model_validate(r) for r in db.scalars(stmt)]


@router.get("/universities", response_model=list[UniversitySummaryOut])
def list_universities(
    country: str | None = Query(default=None, max_length=40),
    search: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[UniversitySummaryOut]:
    """The whole directory, or one country's slice of it.

    `country` is a slug, and an unknown slug gives an empty list rather than an error:
    this is a browse endpoint with a filter a person typed, and "no rows match" is the
    truthful answer to a filter that names nothing.

    `limit` truncates, so a page that means to show one destination in full should call
    `/countries/{slug}/universities` instead — that route has no ceiling and returns the
    list the file was written with.
    """
    stmt = (
        select(University)
        .join(StudyCountry, StudyCountry.id == University.country_id)
        .where(University.is_active.is_(True), StudyCountry.is_active.is_(True))
        .order_by(StudyCountry.sort_order, University.sort_order, University.name)
    )
    if country:
        stmt = stmt.where(StudyCountry.slug == country)
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(University.name).like(pattern),
                func.lower(University.city).like(pattern),
            )
        )
    return [UniversitySummaryOut.model_validate(r) for r in db.scalars(stmt.limit(limit))]


@router.get("/universities/{slug}", response_model=UniversityOut)
def get_university(slug: str, db: Session = Depends(get_db)) -> UniversityOut:
    """One institution, with every unverified field still empty.

    The point of this response is the shape of its holes: `tuition_note`, `intakes`,
    `application_urls`, `english_test_note` and `deadline_note` arrive as null or `[]`
    for a seeded row, and the page prints "Not verified yet — check the university's own
    site" beside each. A default number would be the lie.
    """
    return UniversityOut.model_validate(_university_by_slug(db, slug))


@router.get("/services", response_model=list[StudyServiceOut])
def list_services(db: Session = Depends(get_db)) -> list[StudyServiceOut]:
    return [
        StudyServiceOut.model_validate(r)
        for r in db.scalars(
            select(StudyService).order_by(StudyService.sort_order, StudyService.title)
        )
    ]


@router.get("/services/{slug}", response_model=StudyServiceOut)
def get_service(slug: str, db: Session = Depends(get_db)) -> StudyServiceOut:
    row = db.scalars(select(StudyService).where(StudyService.slug == slug)).first()
    if row is None:
        raise _missing("service")
    return StudyServiceOut.model_validate(row)


@router.get("/stories", response_model=list[StudyStoryOut])
def list_stories(db: Session = Depends(get_db)) -> list[StudyStoryOut]:
    """Published accounts, newest first — and empty until the owner publishes one.

    `published` is the only filter, and it is a hard one: a draft in this table must
    not be readable by a route that has no session behind it. The section on the page
    is written to say "nothing published yet" rather than to disappear, because an
    absent section reads as a broken page and a false one reads as a promise.
    """
    rows = db.scalars(
        select(StudyStory)
        .where(StudyStory.published.is_(True))
        .order_by(StudyStory.published_at.desc(), StudyStory.id.desc())
    )
    return [StudyStoryOut.model_validate(r) for r in rows]


# ------------------------------------------------------------------ lead capture


@router.post("/leads", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
@lead_limit
def create_lead(
    request: Request,
    payload: LeadIn,
    db: Session = Depends(get_db),
) -> LeadOut:
    """Take an enquiry: consent, then the row, then the two mails.

    The order is the point. Nothing is written until the tick is read, so a refused
    request leaves no address in the database to be deleted later; the row is committed
    before any mail is attempted, so a deployment with no email service still keeps the
    enquiry (and says so in the answer) rather than losing it; and both sends are
    reported back in words, because a green tick after a refused send is how a family
    ends up waiting for a reply that was never going to come.

    No session is required and none is assumed. This route is the one place in the app
    where the caller may legitimately be a stranger, which is why the rate limit keys on
    the network and the row carries no `user_id` even when the sender does have an
    account — a marketing enquiry is not part of a child's career record.
    """
    # The honeypot, read before anything else. A bot that fills the field no person can
    # see gets the shape of an accepted enquiry and stores nothing — which is why the
    # answer below is a real combination ("mail disabled") rather than a claim only this
    # path produces: a caller that could tell the difference could stop filling it.
    # `company` is not a browser autofill name, so a human form cannot send it by
    # accident; the field that holds it is never rendered to one.
    if payload.company and payload.company.strip():
        return LeadOut(stored=True, reason="disabled", note="", notified_operator=False)

    if not payload.consent_contact:
        raise _refused(NO_CONSENT)
    address = transport.normalize_address(payload.email)
    if not transport.valid_address(address):
        raise _refused(BAD_ADDRESS)

    country_id = None
    if payload.country_slug:
        country = db.scalars(
            select(StudyCountry).where(StudyCountry.slug == payload.country_slug)
        ).first()
        if country is None:
            raise _refused(UNKNOWN_COUNTRY)
        country_id = country.id

    service_id = None
    if payload.service_slug:
        service = db.scalars(
            select(StudyService).where(StudyService.slug == payload.service_slug)
        ).first()
        if service is None:
            raise _refused(UNKNOWN_SERVICE)
        service_id = service.id

    lead = StudyLead(
        name=payload.name.strip(),
        email=address,
        phone=(payload.phone or "").strip() or None,
        stage=payload.stage,
        country_id=country_id,
        service_id=service_id,
        message=(payload.message or "").strip() or None,
        source_page=payload.source_page,
        consent_contact=True,
        consent_contact_at=_now(),
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    # The address is the enquiry's contact details, not a log line.
    log.info("Study abroad enquiry stored as lead %d", lead.id)

    operator = messages.send_lead_notification(db, lead)
    ack = messages.send_lead_acknowledgement(db, lead)
    return LeadOut(
        stored=True,
        reason=ack.reason,
        note=ack.note,
        notified_operator=operator.delivered,
    )


# ------------------------------------------------------------------------- admin
#
# Everything below is the operator's own screen. The guard is a dependency rather than a
# check inside each function so a route added next month cannot forget it, and it re-reads
# the flag from the account on every request: there is nothing in a client body, token or
# cookie that makes any of these routes answer.


@router.get("/admin/leads", response_model=list[LeadAdminOut], dependencies=[Depends(get_admin_user)])
def admin_leads(
    status_filter: str | None = Query(default=None, alias="status", max_length=16),
    search: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
) -> list[LeadAdminOut]:
    """Newest enquiries first, with the consent timestamp beside each.

    `consent_contact_at` is in this response on purpose. An operator who is about to
    mail somebody should be able to see, in the same row, that they asked — that is the
    only record of permission there is for an address nobody confirmed with a link.
    """
    stmt = select(StudyLead).order_by(StudyLead.created_at.desc(), StudyLead.id.desc())
    if status_filter:
        stmt = stmt.where(StudyLead.status == status_filter)
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(StudyLead.name).like(pattern),
                func.lower(StudyLead.email).like(pattern),
            )
        )
    return [LeadAdminOut.model_validate(r) for r in db.scalars(stmt.limit(limit))]


@router.patch("/admin/leads/{lead_id}", response_model=LeadAdminOut, dependencies=[Depends(get_admin_user)])
def admin_handle_lead(
    lead_id: int,
    payload: LeadHandleIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> LeadAdminOut:
    """Mark an enquiry and leave the operator a note. Only those two things change.

    The enquiry itself is not editable: name, address and message are what a person
    typed to us, and rewriting them would make the record of what was agreed untrustworthy.
    """
    lead = db.get(StudyLead, lead_id)
    if lead is None:
        raise _missing("lead")
    previous = lead.status
    lead.status = payload.status
    lead.admin_note = (payload.admin_note or "").strip() or None
    lead.handled_at = _now()
    # The note the operator wrote is on the row, not in the log. What the log carries is
    # that the enquiry moved from one state to another, and when — which is the question a
    # later reader of a family's complaint actually asks.
    audit.record(
        db,
        actor,
        "lead.reply",
        subject_type="lead",
        subject_id=lead.id,
        detail=f"status {previous} -> {lead.status}",
    )
    db.commit()
    db.refresh(lead)
    return LeadAdminOut.model_validate(lead)


@router.delete("/admin/leads/{lead_id}", status_code=204, dependencies=[Depends(get_admin_user)])
def admin_delete_lead(
    lead_id: int,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> None:
    """Forget an enquiry. This is the delete path a family's request runs into.

    There is nothing else to clean up, and that is the design: the lead has no account,
    no outbox row, and no derived data attached to it, so removing the row removes the
    record entirely rather than leaving a trail through other tables.

    What does remain is one log row holding the id of a row that no longer exists. That is
    the balance this file strikes: the deletion itself has to be provable to whoever asks
    about it later, and the log is the only place left that can say it happened, by whom
    and on what day. It names no name and no address, because the row it describes is gone
    and copying its contents forward would have kept the very data the request was for.
    """
    lead = db.get(StudyLead, lead_id)
    if lead is None:
        raise _missing("lead")
    audit.record(
        db,
        actor,
        "lead.delete",
        subject_type="lead",
        subject_id=lead.id,
        detail="row and its enquiry removed",
    )
    db.delete(lead)
    db.commit()


@router.get("/admin/universities", response_model=list[UniversityAdminOut], dependencies=[Depends(get_admin_user)])
def admin_universities(
    country: str | None = Query(default=None, max_length=40),
    unverified_only: bool = False,
    search: str | None = Query(default=None, max_length=80),
    include_inactive: bool = False,
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> list[UniversityAdminOut]:
    """The rows to be checked, which is nearly all of them.

    `unverified_only` is the working view of this feature: the directory was seeded from a
    list of names and domains, so the useful question is not "find a row" but "which rows
    still have nothing behind them".

    `limit` is a real ceiling and the operator's screen says so when a view fills it. It is
    set above the size of the seeded file rather than below it, because a working list that
    quietly stops at 200 teaches a person to believe they have seen the directory.
    """
    stmt = (
        select(University, StudyCountry)
        .join(StudyCountry, StudyCountry.id == University.country_id)
        .order_by(StudyCountry.sort_order, University.sort_order, University.name)
        .limit(limit)
    )
    if not include_inactive:
        stmt = stmt.where(University.is_active.is_(True), StudyCountry.is_active.is_(True))
    if unverified_only:
        stmt = stmt.where(University.verified.is_(False))
    if country:
        stmt = stmt.where(StudyCountry.slug == country)
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(University.name).like(pattern),
                func.lower(University.city).like(pattern),
            )
        )
    out: list[UniversityAdminOut] = []
    for row, destination in db.execute(stmt).unique():
        out.append(_admin_university(row, destination.slug))
    return out


def _admin_university(row: University, country_slug: str) -> UniversityAdminOut:
    return UniversityAdminOut.model_validate(
        {**UniversityOut.model_validate(row).model_dump(),
         "country_id": row.country_id,
         "country_slug": country_slug,
         "is_active": row.is_active,
         "created_at": row.created_at}
    )


@router.post("/admin/universities", response_model=UniversityAdminOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(get_admin_user)])
def admin_create_university(
    payload: UniversityCreateIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> UniversityAdminOut:
    """Add an institution. It starts unverified because nothing has been read yet.

    `UniversityCreateIn` has no `verified`, `tuition_note` or deadline field at all: a
    new row is a name, a place and a domain, and the figures have to arrive through the
    update route with a source beside them. That is the same rule the seed follows for
    its own rows.
    """
    country = _country_by_slug(db, payload.country_slug)
    if not _valid_url(payload.official_url):
        raise _refused(
            "The official URL has to be a full address starting with https:// — it is "
            "the link every unverified field on this page points the reader to."
        )
    base = slugify(payload.name)
    if not base:
        raise _refused("That name has no letters or digits to make an address from.")
    existing = db.scalars(select(University).where(University.slug == base)).first()
    if existing is not None:
        raise _refused(
            f"{existing.name} is already in the directory. Fill that row in instead of "
            "adding a second one with the same name."
        )
    # After the seeded ones rather than among them: a hand-added row has no alphabetical
    # position in the file's ordering, and guessing one would move institutions somebody
    # has already checked.
    listed = db.scalar(
        select(func.count(University.id)).where(University.country_id == country.id)
    )
    row = University(
        country_id=country.id,
        slug=base,
        name=payload.name.strip(),
        city=payload.city.strip(),
        kind=payload.kind,
        official_url=payload.official_url.strip(),
        summary=(payload.summary or "").strip() or None,
        areas=list(payload.areas),
        sort_order=int(listed or 0) + 1,
    )
    db.add(row)
    audit.record(
        db,
        actor,
        "university.create",
        subject_type="university",
        subject_id=row.slug,
        detail="row added, unverified until a source is set",
    )
    db.commit()
    db.refresh(row)
    log.info("University %s added", row.slug)
    return _admin_university(row, country.slug)


@router.patch("/admin/universities/{slug}", response_model=UniversityAdminOut, dependencies=[Depends(get_admin_user)])
def admin_update_university(
    slug: str,
    payload: UniversityUpdateIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> UniversityAdminOut:
    """Fill a row in. Verification is the one thing this cannot be told.

    `verified: true` is refused without a `source_url` on the row — given now or already
    there — and the date is stamped here rather than accepted from the body. Clearing a
    `source_url` while a row is verified is refused for the same reason: a fee with no
    source is a claim, not a fact, and it should not be able to keep the badge.
    """
    row = _university_by_slug(db, slug)
    changes = payload.model_dump(exclude_unset=True)

    if "source_url" in changes and changes["source_url"]:
        if not _valid_url(changes["source_url"]):
            raise _refused("The source URL has to start with https:// or http://.")
    if payload.official_url is not None and not _valid_url(payload.official_url):
        raise _refused("The official URL has to start with https:// or http://.")

    wants_verified = bool(changes.get("verified"))
    source_after = changes.get("source_url", row.source_url)
    if wants_verified and not source_after:
        raise _refused(NO_SOURCE)
    clearing_source = (
        "source_url" in changes
        and not changes["source_url"]
        and (row.verified or bool(changes.get("verified")))
    )
    if clearing_source:
        raise _refused(NO_SOURCE)

    for name in (
        "city",
        "kind",
        "official_url",
        "founded_year",
        "summary",
        "areas",
        "tuition_note",
        "intakes",
        "application_urls",
        "english_test_note",
        "deadline_note",
        "source_url",
        "sponsored",
        "sponsorship_disclosure",
        "is_active",
        "sort_order",
    ):
        if name in changes:
            setattr(row, name, changes[name])

    if "verified" in changes:
        row.verified = wants_verified
        row.verified_at = _now() if wants_verified else None

    # The claim that matters here is the verification, and it gets its own sentence
    # because "the fee was filled in on this day" and "somebody read a source on this day"
    # are different answers to a later question about a family's decision. The row's name
    # is not copied into the log; the slug identifies it, and the directory is public.
    audit.record(
        db,
        actor,
        "university.verify" if wants_verified else "university.update",
        subject_type="university",
        subject_id=row.slug,
        detail=(
            f"verified -> true from source; changed: {', '.join(sorted(changes))}"
            if wants_verified
            else f"changed: {', '.join(sorted(changes))}"
        ),
    )
    db.commit()
    db.refresh(row)
    return _admin_university(row, row.country.slug)


def _admin_story(row: StudyStory) -> StoryAdminOut:
    """A story with its links named the way the write routes ask for them: by slug.

    Both write routes take a destination and an institution by slug, and the admin PATCH
    replaces the whole row. So whatever the read route does not return is what the next
    save will send as empty — which is how editing a headline would have quietly unlinked
    the country the story is about.
    """
    return StoryAdminOut.model_validate(
        {
            **StudyStoryOut.model_validate(row).model_dump(),
            "country_id": row.country_id,
            "country_slug": row.country.slug if row.country else None,
            "university_id": row.university_id,
            "university_slug": row.university.slug if row.university else None,
            "consent_confirmed_at": row.consent_confirmed_at,
            "published": row.published,
        }
    )


@router.get("/admin/stories", response_model=list[StoryAdminOut], dependencies=[Depends(get_admin_user)])
def admin_stories(
    include_unpublished: bool = True,
    db: Session = Depends(get_db),
) -> list[StoryAdminOut]:
    """Every story, draft or published — which is how a draft is found to be finished."""
    stmt = select(StudyStory).order_by(StudyStory.id.desc())
    if not include_unpublished:
        stmt = stmt.where(StudyStory.published.is_(True))
    return [_admin_story(r) for r in db.scalars(stmt)]


@router.post("/admin/stories", response_model=StoryAdminOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(get_admin_user)])
def admin_create_story(
    payload: StoryCreateIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> StoryAdminOut:
    """Write a story down. Published only if the consent date came with it.

    A draft is allowed — the owner may want to sit on a piece of writing — but the
    public route cannot see it, and it cannot become visible without the date on which
    the named person agreed.
    """
    if payload.published and payload.consent_confirmed_at is None:
        raise _refused(NO_STORY_CONSENT)
    country = None
    if payload.country_slug:
        country = db.scalars(
            select(StudyCountry).where(StudyCountry.slug == payload.country_slug)
        ).first()
        if country is None:
            raise _refused(UNKNOWN_COUNTRY)
    university = None
    if payload.university_slug:
        university = db.scalars(
            select(University).where(University.slug == payload.university_slug)
        ).first()
        if university is None:
            raise _refused(
                "We could not find that university in our directory, so the story was "
                "not stored with it. Check the spelling or leave the field empty."
            )
    row = StudyStory(
        headline=payload.headline.strip(),
        body=payload.body.strip(),
        attribution=payload.attribution.strip(),
        country_id=country.id if country else None,
        university_id=university.id if university else None,
        year=payload.year,
        consent_confirmed_at=payload.consent_confirmed_at,
        published=bool(payload.published),
        published_at=_now() if payload.published else None,
    )
    db.add(row)
    # Neither the headline nor the attribution goes into the log. A story names a real
    # person who agreed to be quoted on one date; the log's job is to say that this row was
    # published, by whom, and whether consent was on it at the time — not to be a second
    # copy of the thing they agreed to once, in a table read more widely.
    audit.record(
        db,
        actor,
        "story.create",
        subject_type="story",
        subject_id=row.id,
        detail=(
            "published with a consent date"
            if row.published
            else "draft; consent date " + ("present" if row.consent_confirmed_at else "absent")
        ),
    )
    db.commit()
    db.refresh(row)
    return _admin_story(row)


@router.patch("/admin/stories/{story_id}", response_model=StoryAdminOut, dependencies=[Depends(get_admin_user)])
def admin_publish_story(
    story_id: int,
    payload: StoryCreateIn,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> StoryAdminOut:
    """Replace a story's text, or publish it, or stop publishing it.

    The consent rule is checked on the state the row would end in, not only on the body:
    publishing a row whose consent date is already stored is fine, and publishing one
    that has none is not, whoever sent what.
    """
    row = db.get(StudyStory, story_id)
    if row is None:
        raise _missing("story")
    consent_at = payload.consent_confirmed_at or row.consent_confirmed_at
    if payload.published and consent_at is None:
        raise _refused(NO_STORY_CONSENT)

    country = None
    if payload.country_slug:
        country = db.scalars(
            select(StudyCountry).where(StudyCountry.slug == payload.country_slug)
        ).first()
        if country is None:
            raise _refused(UNKNOWN_COUNTRY)
    university = None
    if payload.university_slug:
        university = db.scalars(
            select(University).where(University.slug == payload.university_slug)
        ).first()
        if university is None:
            raise _refused(
                "We could not find that university in our directory. Check the spelling "
                "or leave the field empty."
            )

    row.headline = payload.headline.strip()
    row.body = payload.body.strip()
    row.attribution = payload.attribution.strip()
    row.country_id = country.id if country else None
    row.university_id = university.id if university else None
    row.year = payload.year
    row.consent_confirmed_at = consent_at
    row.published = bool(payload.published)
    row.published_at = (row.published_at or _now()) if payload.published else None

    # `unpublish` is the row a person's withdrawal of agreement leaves behind, so it is the
    # one action here a later reader may need to date precisely. The text is not copied.
    audit.record(
        db,
        actor,
        "story.publish" if row.published else "story.unpublish",
        subject_type="story",
        subject_id=row.id,
        detail="consent date " + ("present" if consent_at else "absent"),
    )
    db.commit()
    db.refresh(row)
    return _admin_story(row)


@router.delete("/admin/stories/{story_id}", status_code=204, dependencies=[Depends(get_admin_user)])
def admin_delete_story(
    story_id: int,
    actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> None:
    """Take a story out. A person withdrawing agreement uses this, not a rewrite."""
    row = db.get(StudyStory, story_id)
    if row is None:
        raise _missing("story")
    audit.record(
        db,
        actor,
        "story.delete",
        subject_type="story",
        subject_id=row.id,
        detail="row removed",
    )
    db.delete(row)
    db.commit()


@router.get("/admin/me", dependencies=[Depends(get_admin_user)])
def admin_self(user: User = Depends(get_admin_user)) -> dict[str, bool]:
    """Is this account the operator? The admin screen asks before it renders anything.

    It returns one boolean and nothing else about the account: the screen already knows
    who it is signed in as, and an endpoint that also handed back their email, plan and
    usage would be a second place that data can leak from for no benefit.
    """
    return {"is_admin": bool(user.is_admin)}
