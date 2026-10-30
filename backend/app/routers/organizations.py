"""The school and counsellor portals: one organisation's own pages, and nothing else.

Three rules decide where every line of this file goes, and they are the rules the brief
for the feature had to be read against:

* **An invitation is not access.** Every write that could reveal a student's work is
  refused while the membership row is still `invited`, and the only route that can make
  a membership `active` is the one the invited person's own browser calls with the token
  from their mail. There is no route here — none — by which a school activates a place on
  a student's behalf, so the answer to "can a school add a child and read their report?"
  is a schema fact rather than a code review finding.
* **A membership role is read from the database on every request.** `users.role` still
  says only `student` or `parent`; `counsellor` and `school_admin` exist inside one
  organisation and are checked through `app/security.py` against the `slug` in the path.
  The organisation named in the URL is therefore never taken on trust from the address
  bar, and `same_portal` refuses a request that arrived on somebody else's subdomain.
* **An organisation sees a cohort, not a child.** The roster shows the label the school
  typed; analytics drop any breakdown under five and say which ones it dropped; session
  notes start private to their author and reach a family only through the counsellor's
  own switch. Nothing in this file can read an answer sheet, a transcript or a score —
  the only student-side flag an organisation may touch is `share_results`, and even that
  it may only read, because the switch belongs to the account that set it.

Self-serve creation is deliberately narrow: an account can start a *practice*, because a
counsellor is one person making one claim about themselves. A *school* is opened by the
platform operator (`kind` and `verified` are on the admin-only schemas), because a
stranger cannot be allowed to declare an institution and borrow its credibility.

No tier can be bought from these routes. `app/services/reseller.py` states why: the
ceiling is a limit on invitations, and the price is a conversation.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.exceptions import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..middleware.rate_limit import org_invite_limit, org_limit
from ..middleware.tenant import (
    RESERVED_LABELS,
    normalize_slug,
    request_tenant_slug,
    same_portal,
    valid_slug,
)
from ..models import (
    Assessment,
    Membership,
    Organization,
    OrganizationBranding,
    SessionNote,
    StudentProfile,
    User,
)
from ..schemas import (
    AcceptIn,
    AcceptOut,
    AdminOrganizationCreateIn,
    AdminOrganizationUpdateIn,
    AnalyticsBucketOut,
    AnalyticsOut,
    BrandingIn,
    BrandingOut,
    BulkInviteIn,
    CounsellorAssignIn,
    InviteIn,
    InviteResultOut,
    MemberAdminOut,
    MemberOut,
    MIN_REPORTABLE_COHORT,
    MyMembershipOut,
    NoteIn,
    NoteOut,
    NoteShareIn,
    OrganizationCreateIn,
    OrganizationOut,
    OrganizationUpdateIn,
    PortalBrandingOut,
    PortalSummaryOut,
    ShareIn,
    TierOut,
)
from ..security import (
    STAFF_ROLES,
    active_membership,
    client_is_visible,
    get_admin_user,
    get_current_user,
    invite_digest,
    memberships_of,
    require_admin,
    require_membership,
    require_staff,
)
from ..seed.study_abroad import slugify
from ..services import audit
from ..services import email as transport
from ..services import email_messages as messages
from ..services import reseller

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

log = logging.getLogger(__name__)

SETTINGS = get_settings()

# Every message a refusal can put on screen, in one place, because a portal's error is
# read by a teacher or a counsellor who is not thinking about databases. None of them
# blames the person who was turned away, and none of them reveals more about a child
# than the reader was already entitled to.
NAME_TAKEN = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail=(
        "That name is already in use by another portal. Add a word or two that makes it "
        "yours — the town, or the full name of the school."
    ),
)
RESERVED = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail=(
        "That address is one the platform keeps for itself. Choose something that names "
        "your school or your practice rather than a page like `help` or `api`."
    ),
)
BAD_SLUG = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail=(
        "That address cannot be used. It needs 3-40 lowercase letters, digits or single "
        "hyphens, and it cannot start or end with one."
    ),
)
NOT_STUDENT_ACCOUNT = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail=(
        "A portal is started by the adult who runs it. This account is registered as a "
        "student's, so it can join a school or a practice when one invites it, but it "
        "cannot open one."
    ),
)
SEATS_FULL = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
    detail=(
        "This portal has used every place its tier allows, so nothing was invited. A "
        "school that needs more places asks us in writing; nobody with a student account "
        "is affected by this limit, and an existing member is never removed to make room."
    ),
)
BAD_ADDRESS = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail=(
        "That is not an email address, so no place was held. Nothing else in your list "
        "was touched."
    ),
)
UNKNOWN_MEMBER = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail=(
        "No place in this portal has that number. The roster above lists the ones this "
        "organisation holds, invited and joined alike."
    ),
)
NOT_VISIBLE = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail=(
        "That client is not one of yours. A counsellor in a school sees the students the "
        "school has assigned to them; an administrator sees the whole roster."
    ),
)
STAFF_FOR_CHILD = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail=(
        "This invitation was written for a counsellor or an administrator, and the "
        "account opening it is registered as a student's. Nothing was joined, and the "
        "invitation is still waiting — the person who sent it can change who it is for."
    ),
)
BAD_INVITE = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail=(
        "That link does not match an invitation that is still waiting. It may have been "
        "used already, or the portal may have closed it. Nothing has been joined, and no "
        "account has been attached to anything."
    ),
)
ALREADY_MEMBER = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail=(
        "This account already holds a place in that portal, so the invitation was left "
        "as it was. Two places for one person would be two rows for a school to wonder "
        "about."
    ),
)
UNKNOWN_NOTE = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail=(
        "No note with that number is one you can reach from this account. Notes are "
        "listed on the client's own row."
    ),
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _claimed_slug(typed: str | None, name: str) -> str:
    """The address a new portal is about to hold, or a refusal that says why not.

    An address somebody typed is answered with that address or with a refusal, never with
    a different address handed back quietly: a school that asks for `help` and is silently
    given `help-desk` is a school that will print the first one on a letter to parents and
    find it goes nowhere. With nothing typed, the name is reduced to an address, which is
    the ordinary case and the one that keeps the two kinds of portal spelled alike.
    """
    value = (typed or "").strip()
    if value:
        if value.lower() in RESERVED_LABELS:
            raise RESERVED
        slug = normalize_slug(value)
        if slug is None:
            raise BAD_SLUG
        return slug
    slug = slugify(name)[:40]
    if not valid_slug(slug):
        raise BAD_SLUG
    return slug


def _tier_for(org: Organization) -> reseller.Tier:
    """The tier row behind an organisation's code, with the starter tier as the answer.

    A code that is not in the catalogue falls back rather than raising, because the
    fallback is the conservative one: `free` has the smallest ceiling in the file, so a
    typo in a database cannot hand an organisation a larger set of seats than it was
    given. The platform operator fixes the code; the portal keeps refusing invites beyond
    twenty-five places until then.
    """
    return reseller.get(org.tier_code) or reseller.FREE


def _seats_used(db: Session, org_id: int) -> int:
    """Places taken, counting the ones still waiting to be accepted.

    Counting an invite against a seat is the honest reading of a ceiling: a school that
    has mailed a class has used those places whether or not twelve of the families open
    the link, and the alternative is a limit that only bites after the fact.
    """
    return db.scalar(
        select(func.count(Membership.id)).where(
            Membership.organization_id == org_id,
            Membership.status.in_(("invited", "active")),
        )
    ) or 0


def _tier_out(tier: reseller.Tier) -> TierOut:
    return TierOut(
        code=tier.code,
        name=tier.name,
        kind=tier.kind,
        tagline=tier.tagline,
        seats=tier.seats,
        price_rupees=tier.price_rupees,
        includes=list(tier.includes),
        not_included=list(tier.not_included),
        purchasable=tier.purchasable,
    )


def _branding(db: Session, org_id: int) -> OrganizationBranding | None:
    return db.get(OrganizationBranding, org_id)


def _member_out(db: Session, row: Membership) -> MemberOut:
    """One roster row, with the assigned counsellor resolved to the school's own label.

    The counsellor is named by `display_label` — what the school typed for them — rather
    than by their account's display name, so a roster reads the same before and after a
    person joins and no account's own name becomes information a school can collect.
    """
    label: str | None = None
    if row.assigned_counsellor_id is not None:
        other = db.get(Membership, row.assigned_counsellor_id)
        label = other.display_label if other else None
    return MemberOut(
        id=row.id,
        org_role=row.org_role,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        display_label=row.display_label,
        joined_at=row.joined_at,
        share_results=bool(row.share_results),
        assigned_counsellor_label=label,
    )


def _my_membership(db: Session, row: Membership) -> MyMembershipOut:
    org = row.organization
    branding = _branding(db, org.id) if org else None
    return MyMembershipOut(
        slug=org.slug,
        kind=org.kind,
        name=org.name,
        org_role=row.org_role,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        portal_title=branding.portal_title if branding else None,
        share_results=bool(row.share_results),
    )


def _note_out(row: SessionNote) -> NoteOut:
    return NoteOut(
        id=row.id,
        client_membership_id=row.client_membership_id,
        body=row.body,
        shared_with_family=bool(row.shared_with_family),
        shared_at=row.shared_at,
        created_at=row.created_at,
        edited_at=row.edited_at,
    )


# ---------------------------------------------------------------- public reads


@router.get("/tiers", response_model=list[TierOut])
def list_tiers(kind: str | None = Query(default=None, max_length=16)) -> list[TierOut]:
    """What a portal costs nobody, and how many places it holds.

    Public because the number a school needs before it signs up for anything is its seat
    ceiling, and because `purchasable: false` on every row is a statement the platform
    should be able to show rather than one it hides behind a sales contact. `kind`
    filters the list; an unknown kind answers with the whole catalogue rather than an
    error, since this is a read of a static file.
    """
    tiers = reseller.TIERS if kind not in ("school", "counsellor") else reseller.for_kind(kind)
    return [_tier_out(tier) for tier in tiers]


@router.get("/portal", response_model=PortalBrandingOut)
def public_portal(
    request: Request,
    slug: str | None = Query(default=None, max_length=40),
    db: Session = Depends(get_db),
) -> PortalBrandingOut:
    """The look of one portal, for a page that has not signed anybody in.

    Two things decide which portal this answers for, and they are not equally trusted.
    The `slug` the caller typed is the answer; the subdomain the request arrived on is
    only a cross-check, and a mismatch is a 404 rather than a redirect — a page that
    followed a Host header to a school's branding would be a page that let any DNS record
    put its own name above a child's results.

    Everything in the response is a school's own choice about its appearance plus the
    platform's `verified` flag. No count of any kind is here: a portal that has not
    opened its door would otherwise announce how many students it has.
    """
    value = normalize_slug(slug)
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No portal was named. This route answers for one school or one practice, "
                "and it needs its address."
            ),
        )
    same_portal(request, value)
    org = db.scalars(
        select(Organization).where(
            Organization.slug == value, Organization.is_active.is_(True)
        ).limit(1)
    ).first()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No portal by that name is open here. A school's address is spelled in "
                "lower case with hyphens, and a portal the platform has closed answers "
                "the same way."
            ),
        )
    branding = _branding(db, org.id)
    return PortalBrandingOut(
        slug=org.slug,
        kind=org.kind,
        name=org.name,
        verified=bool(org.verified),
        portal_title=branding.portal_title if branding else None,
        logo_url=branding.logo_url if branding else None,
        accent_color=branding.accent_color if branding else None,
    )


# ---------------------------------------------------------------- memberships


@router.get("/mine", response_model=list[MyMembershipOut])
def my_memberships(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MyMembershipOut]:
    """Which portals this account has joined, for the app shell to offer.

    Joined only, never invited: a waiting invitation is not a place, and a sidebar that
    listed one would be a reminder of something a person may not want to accept.
    """
    return [_my_membership(db, row) for row in memberships_of(db, user.id)]


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
@org_limit
def create_organization(
    request: Request,
    body: OrganizationCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrganizationOut:
    """Start a counsellor's practice, and take its one administrator seat.

    `kind` is not in the body, which is the whole point of this route's shape: a person
    can declare a practice, because that is one adult making one claim about themselves,
    and cannot declare a school, because an institution's credibility is something the
    platform grants after looking at it. Schools are opened by an operator on the admin
    route below, where `verified` can also be set.

    The creator's role is checked rather than assumed. A student account is refused — not
    because a child cannot run something, but because the only age signal this app holds
    is the role on the account, and a portal that a twelve-year-old opened for their
    classmates would be a way to build a roster of their own friends.
    """
    if user.role == "student":
        raise NOT_STUDENT_ACCOUNT

    name = body.name.strip()
    slug = _claimed_slug(body.slug, name)
    if db.scalars(select(Organization.id).where(Organization.slug == slug).limit(1)).first():
        raise NAME_TAKEN

    org = Organization(slug=slug, kind="counsellor", name=name, tier_code=reseller.FREE.code)
    db.add(org)
    db.flush()
    db.add(
        Membership(
            organization_id=org.id,
            user_id=user.id,
            org_role="counsellor",
            status="active",
            display_label=user.display_name,
            joined_at=_now(),
        )
    )
    db.commit()
    db.refresh(org)
    return OrganizationOut.model_validate(org)


@router.get("/summary", response_model=list[PortalSummaryOut])
def my_portals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PortalSummaryOut]:
    """Every portal this account administers, with its seats.

    Staff-only rows are returned rather than every membership: this is the screen from
    which a person manages a roster, and a student who is on three schools' lists has no
    roster to manage on any of them. A counsellor is included — a practice's client list
    is theirs to look at — so the filter here is `STAFF_ROLES`, not `school_admin`.
    """
    rows = db.scalars(
        select(Membership)
        .join(Organization, Organization.id == Membership.organization_id)
        .where(
            Membership.user_id == user.id,
            Membership.status == "active",
            Membership.org_role.in_(STAFF_ROLES),
            Organization.is_active.is_(True),
        )
        .order_by(Organization.name)
    ).all()
    return [_summary(db, row.organization) for row in rows]


def _summary(db: Session, org: Organization) -> PortalSummaryOut:
    """A portal header: what it is, how many places it holds and how many are used.

    The three counts are deliberately not the same number. `joined` is what a school has
    actually reached; `invited` is what is waiting on somebody else's click; `staff` is
    the adults. A dashboard that showed one total would let a school read "300" as "300
    students have agreed to this", which is the opposite of what an invitation is.

    Only the counts of rows in this one organisation are computed here — no name, no
    address, no activity — which is why every joined member may read them, a student
    included. Reading them says the school has forty places and has used eleven.
    """
    tier = _tier_for(org)
    used = _seats_used(db, org.id)
    joined = db.scalar(
        select(func.count(Membership.id)).where(
            Membership.organization_id == org.id, Membership.status == "active"
        )
    ) or 0
    invited = db.scalar(
        select(func.count(Membership.id)).where(
            Membership.organization_id == org.id, Membership.status == "invited"
        )
    ) or 0
    staff = db.scalar(
        select(func.count(Membership.id)).where(
            Membership.organization_id == org.id,
            Membership.status == "active",
            Membership.org_role.in_(STAFF_ROLES),
        )
    ) or 0
    return PortalSummaryOut(
        organization=OrganizationOut.model_validate(org),
        seats=tier.seats,
        seats_used=used,
        seats_left=max(tier.seats - used, 0),
        joined=joined,
        invited=invited,
        staff=staff,
    )


# ---------------------------------------------------------------- one portal


@router.get("/{slug}", response_model=PortalSummaryOut)
def read_portal(
    request: Request,
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortalSummaryOut:
    """This portal's own header, for anybody who has joined it.

    A student is allowed to know that their school has a portal and how many places it
    holds. Those are the school's facts about itself, not the child's facts, and the
    numbers are aggregate on the way in — this route cannot name anybody.
    """
    resolved = normalize_slug(slug)
    if resolved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No portal by that name is open here.",
        )
    same_portal(request, resolved)
    org, _ = require_membership(db, user, resolved)
    return _summary(db, org)


@router.patch("/{slug}", response_model=OrganizationOut)
@org_limit
def rename_portal(
    request: Request,
    slug: str,
    body: OrganizationUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> OrganizationOut:
    """Change a portal's name. Nothing else on this row is changeable by its owner.

    The schema for this route has one field, and the fields it does not have are the
    security property: no `tier_code` (a school cannot give itself seats), no `verified`
    (that word is the platform's to grant), no `is_active` (a portal the platform closed
    does not reopen itself), and no `slug` (an address that can be renamed is an address
    somebody else can take once the first one's invitations are in the wild).
    """
    org, _ = require_admin(db, user, slug)
    same_portal(request, org.slug)
    if body.name is not None:
        org.name = body.name.strip()
    db.commit()
    db.refresh(org)
    return OrganizationOut.model_validate(org)


@router.get("/{slug}/branding", response_model=BrandingOut)
def read_branding(
    request: Request,
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BrandingOut:
    """The full branding row, including the note only a member should read.

    `/portal` above hands out the appearance to strangers; this one adds `welcome_note`,
    which is free text a school wrote for its own families. Splitting the two is why a
    portal can be painted before it is joined without its noticeboard being readable by
    anybody who can type a hostname.
    """
    resolved = normalize_slug(slug)
    if resolved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No portal by that name is open here.",
        )
    same_portal(request, resolved)
    org, _ = require_membership(db, user, resolved)
    branding = _branding(db, org.id)
    if branding is None:
        return BrandingOut(
            portal_title=None,
            welcome_note=None,
            logo_url=None,
            accent_color=None,
            changed_at=org.created_at,
        )
    return BrandingOut.model_validate(branding)


@router.put("/{slug}/branding", response_model=BrandingOut)
@org_limit
def write_branding(
    request: Request,
    slug: str,
    body: BrandingIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BrandingOut:
    """Paint the portal. A heading, a note, a logo link and one colour from a short list.

    The colour is chosen from seven values defined in the schema rather than typed, and
    that is not fussiness: an accent colour is how a screen says "this is the button", so
    a tenant that could pick any hex could also make a warning look like a call to action
    on a page a child reads. The logo is a link and not an upload, because a platform
    that stores a school's logo has taken on its identity, its backups and its deletion
    requests in one action.
    """
    org, _ = require_admin(db, user, slug)
    same_portal(request, org.slug)
    branding = _branding(db, org.id)
    if branding is None:
        branding = OrganizationBranding(organization_id=org.id)
        db.add(branding)
    values = body.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(branding, field, value)
    branding.changed_at = _now()
    db.commit()
    db.refresh(branding)
    return BrandingOut.model_validate(branding)


# ---------------------------------------------------------------- the roster


@router.get("/{slug}/members", response_model=list[MemberAdminOut])
def list_members(
    request: Request,
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MemberAdminOut]:
    """The roster, as this account is entitled to read it.

    Three separate filters run before a single row leaves this route, and they are not
    redundant with each other:

    * membership status — an `invited` row is a place reserved for an address, and it is
      listed because the school needs to know it has used a seat, with no name attached.
    * `client_is_visible` — a counsellor at a school gets the students assigned to them
      and themselves, not the school's whole list.
    * the contact address, which only the person who is entitled to hold it gets back.
      An administrator of a school sees the addresses the school typed, because the
      school typed them and has to be able to audit its own list. A counsellor employed
      by that school does not: a hire who can read the class's addresses can leave with
      them, and the assignment of a student to a counsellor was never a transfer of the
      family's contact details. In an independent practice the staff *is* the owner, so
      there the address comes back — the same column, a different relationship.
    """
    org, viewer = require_staff(db, user, slug)
    same_portal(request, org.slug)
    rows = db.scalars(
        select(Membership)
        .where(Membership.organization_id == org.id)
        .order_by(Membership.status, Membership.display_label, Membership.id)
    ).all()
    holds_contacts = viewer.org_role == "school_admin" or org.kind == "counsellor"
    out: list[MemberAdminOut] = []
    for row in rows:
        if row.id != viewer.id:
            # A waiting place is not a member, so `client_is_visible` answers "no" to it —
            # and the roster is exactly the screen where that answer is unhelpful, because
            # the one thing a school needs to see about an address it has invited is that
            # the seat is gone. So the place is listed for the person who typed it, and for
            # nobody else: `client_is_visible` still keeps it out of the client list, the
            # notes and the chart, where it would be a record of a child who has not agreed.
            if row.status != "active":
                if not holds_contacts:
                    continue
            elif not client_is_visible(org, viewer, row):
                continue
        item = MemberAdminOut(
            id=row.id,
            org_role=row.org_role,  # type: ignore[arg-type]
            status=row.status,  # type: ignore[arg-type]
            display_label=row.display_label,
            joined_at=row.joined_at,
            share_results=bool(row.share_results),
            assigned_counsellor_label=None,
            invited_email=row.invited_email if holds_contacts else None,
            invite_expires_at=row.invite_expires_at if holds_contacts else None,
        )
        if row.assigned_counsellor_id is not None:
            other = db.get(Membership, row.assigned_counsellor_id)
            item.assigned_counsellor_label = other.display_label if other else None
        out.append(item)
    return out


@router.get("/{slug}/clients", response_model=list[MemberOut])
def list_clients(
    request: Request,
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MemberOut]:
    """The list a note is written against: joined students and guardians, and nobody else.

    `invited` rows are excluded here rather than filtered by a caller who might forget,
    because a note attached to an unaccepted invitation is a record written about a child
    who has not agreed to the arrangement — and the table's own check would refuse the
    insert anyway. Showing the option only where the insert would succeed is the kinder
    version of the same rule.
    """
    org, viewer = require_staff(db, user, slug)
    same_portal(request, org.slug)
    rows = db.scalars(
        select(Membership)
        .where(
            Membership.organization_id == org.id,
            Membership.status == "active",
            Membership.org_role.in_(("student", "parent")),
        )
        .order_by(Membership.display_label, Membership.id)
    ).all()
    return [_member_out(db, row) for row in rows if client_is_visible(org, viewer, row)]


@router.post("/{slug}/invites", response_model=InviteResultOut)
@org_invite_limit
def invite_one(
    request: Request,
    slug: str,
    body: InviteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InviteResultOut:
    """Hold a place for one address and write to it.

    Nothing about the invited person is stored except the address and a digest of a
    single-use token. The row that results is not a membership in the sense a school
    means: it has no `user_id`, it grants no read access to anything, and it can be
    deleted by the same person who made it.
    """
    org, admin = require_admin(db, user, slug)
    same_portal(request, org.slug)
    return _invite(db, org, admin, [body])


@router.post("/{slug}/invites/bulk", response_model=InviteResultOut)
@org_invite_limit
def invite_bulk(
    request: Request,
    slug: str,
    body: BulkInviteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InviteResultOut:
    """A class list in one request — and one seat check, not one per row.

    Fifty is the schema's ceiling and the reason it is there is that this route sends
    mail. The list is de-duplicated by address before anything is written, so a paste
    with the same student twice holds one place rather than two; addresses that fail the
    transport's own check go to `refused` and the rest still go out, because a teacher
    who has pasted forty names should not lose thirty-nine of them to a mistyped comma.
    """
    org, admin = require_admin(db, user, slug)
    same_portal(request, org.slug)
    return _invite(db, org, admin, body.members)


def _invite(
    db: Session,
    org: Organization,
    admin: Membership,
    items: list[InviteIn],
) -> InviteResultOut:
    """The one implementation of inviting, shared by the single and bulk routes.

    Ordering matters and is the whole function: the seat ceiling is checked against the
    number of rows that would actually be new, so a school two places short of its
    ceiling that pastes ten addresses is refused the whole paste rather than given two
    invitations and a mystery. Refusing the batch is kinder than sending two — every
    family in the list hears from the platform or none of them does, and the school can
    see the number on screen and choose.

    `already_there` counts a waiting row for the same address, so the route is safe to
    press twice. The token of a row that already exists is never re-sent from here, which
    means a second click cannot invalidate a link a family is already holding.
    """
    tier = _tier_for(org)
    used = _seats_used(db, org.id)

    seen: set[str] = set()
    wanted: list[tuple[str, InviteIn]] = []
    refused: list[str] = []
    for item in items:
        value = transport.normalize_address(item.email)
        if not value or not transport.valid_address(value):
            refused.append(item.email)
            continue
        if value in seen:
            continue
        seen.add(value)
        wanted.append((value, item))

    already: list[str] = []
    for value, _ in wanted:
        waiting = db.scalars(
            select(Membership.id).where(
                Membership.organization_id == org.id,
                Membership.invited_email == value,
                Membership.status.in_(("invited", "active")),
            ).limit(1)
        ).first()
        if waiting is not None:
            already.append(value)
    new_count = len(wanted) - len(already)

    if used + new_count > tier.seats:
        raise SEATS_FULL

    admin_user = db.get(User, admin.user_id) if admin.user_id else None
    mailed = 0
    detail: str | None = None
    created: list[str] = []
    expires_at = _now() + timedelta(days=max(SETTINGS.org_invite_valid_days, 1))

    for value, item in wanted:
        if value in already:
            continue
        token = secrets.token_urlsafe(32)
        row = Membership(
            organization_id=org.id,
            org_role=item.org_role,
            status="invited",
            invited_email=value,
            invite_hash=invite_digest(token),
            invite_expires_at=expires_at,
            display_label=(item.display_label or "").strip() or None,
            share_results=False,
        )
        db.add(row)
        db.flush()
        created.append(value)
        if admin_user is None:
            # An administrator seat with no account behind it cannot send anything, so
            # the place is still held and the school is told the link has to come from
            # its own noticeboard instead.
            detail = "the invitation was held but nobody is signed in to send it"
            continue
        answer = messages.send_org_invite(db, admin_user, org, row, token)
        if answer.delivered:
            mailed += 1
        elif detail is None:
            detail = answer.note

    db.commit()
    return InviteResultOut(
        invited=created,
        already_there=already,
        refused=refused,
        seats_left=max(tier.seats - (used + len(created)), 0),
        mailed=mailed == len(created) and bool(created),
        mail_detail=detail,
    )


@router.post("/join", response_model=AcceptOut)
@org_limit
def accept_invitation(
    request: Request,
    body: AcceptIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AcceptOut:
    """The only route in this file that can turn an invitation into a membership.

    It presents the token from the mail, and it is called by the browser of the person
    the mail reached. That is the entire proof, and it is enough: this is the moment a
    child's account chooses to attach itself to a school, so it happens where the child is
    looking, and nowhere else.

    Four things happen here that no other route may do, and one that none of them may:

    * `user_id` is written, from the account making the call.
    * `status` becomes `active`, and `joined_at` is stamped.
    * `invited_email` and `invite_hash` are cleared. The address was the school's way of
      reaching a person who had no account in the system; the account exists now, so the
      address has no further job and holding both would be a copy of a person nobody
      asked to keep.
    * `share_results` is set to whatever this person chose, including the default of
      `False`. This is the only place in the portal feature where a student's sharing
      decision is written by anybody other than the student, and it is written by the
      student.
    * Nothing is read. The response names the portal and echoes the switch back; it
      carries no roster, no other member, and no answer sheet.
    """
    digest = invite_digest(body.token)
    row = db.scalars(
        select(Membership)
        .where(Membership.invite_hash == digest, Membership.status == "invited")
        .limit(1)
    ).first()
    if row is None:
        raise BAD_INVITE
    if row.invite_expires_at is not None and row.invite_expires_at < _now():
        raise BAD_INVITE

    org = db.get(Organization, row.organization_id)
    if org is None or not org.is_active:
        raise BAD_INVITE

    # The staff guard, before any column is touched. A school that invited a counsellor
    # and had the link opened by a student's account has to be told, in one sentence,
    # rather than have its portal quietly populated by a child who is now its staff.
    if row.org_role in STAFF_ROLES and user.role == "student":
        raise STAFF_FOR_CHILD

    if active_membership(db, org.id, user.id) is not None:
        raise ALREADY_MEMBER

    row.user_id = user.id
    row.status = "active"
    row.joined_at = _now()
    row.invited_email = None
    row.invite_hash = None
    row.invite_expires_at = None
    row.share_results = bool(body.share_results)
    db.commit()

    branding = _branding(db, org.id)
    return AcceptOut(
        slug=org.slug,
        kind=org.kind,
        name=org.name,
        org_role=row.org_role,  # type: ignore[arg-type]
        portal_title=branding.portal_title if branding else None,
        share_results=bool(row.share_results),
    )


@router.patch("/{slug}/me", response_model=MemberOut)
@org_limit
def change_my_sharing(
    request: Request,
    slug: str,
    body: ShareIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MemberOut:
    """Turn this account's own sharing switch on or off.

    A member may set this for themselves and for nobody else. There is no route in this
    file that writes `share_results` for another membership — not for a school
    administrator, not for a counsellor, not for the platform operator's portal routes —
    and the absence is the feature: a school cannot decide that its students' reports are
    visible to the school, and a change of mind costs one call and no explanation.
    """
    org, mine = require_membership(db, user, slug)
    same_portal(request, org.slug)
    mine.share_results = bool(body.share_results)
    db.commit()
    db.refresh(mine)
    return _member_out(db, mine)


@router.delete("/{slug}/me", response_model=MyMembershipOut)
@org_limit
def leave_portal(
    request: Request,
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MyMembershipOut:
    """Leave a portal. The row is revoked rather than deleted, and the account keeps
    everything it wrote.

    Revoking rather than deleting is what makes the counsellor's notes survivable: a
    family's record of a session does not vanish because a person stopped being on a
    roster, and the note's own access path — through the membership — closes with it.
    `user_id` stays on the row so a school can see that a place was once taken and is now
    empty; the address that opened it is already gone.
    """
    org, mine = require_membership(db, user, slug)
    same_portal(request, org.slug)
    mine.status = "revoked"
    mine.revoked_at = _now()
    mine.share_results = False
    db.commit()
    return _my_membership(db, mine)


@router.post("/{slug}/members/{member_id}/counsellor", response_model=MemberOut)
@org_limit
def assign_counsellor(
    request: Request,
    slug: str,
    member_id: int,
    body: CounsellorAssignIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MemberOut:
    """Say which of this school's counsellors a student should be talking to.

    An assignment of contact, not of data. It names one membership inside the same
    organisation, refuses anything outside it, and grants nothing: what that counsellor
    may read is still decided by `client_is_visible` and by the student's own
    `share_results`, so the school that assigns a child to a counsellor has given them a
    person to sit with rather than a file to open.

    `None` clears it, which is the answer to a counsellor leaving; the route does not
    require the school to name a replacement.
    """
    org, _ = require_admin(db, user, slug)
    same_portal(request, org.slug)
    client = db.get(Membership, member_id)
    if client is None or client.organization_id != org.id:
        raise UNKNOWN_MEMBER
    if client.org_role not in ("student", "parent"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "A counsellor is assigned to a student or a guardian, not to a member of "
                "staff. The adults on this roster are already in the portal."
            ),
        )
    target = body.counsellor_membership_id
    if target is not None:
        counsellor = db.get(Membership, target)
        if (
            counsellor is None
            or counsellor.organization_id != org.id
            or counsellor.org_role != "counsellor"
            or counsellor.status != "active"
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    "That counsellor is not an accepted member of this portal. Invite "
                    "them first, and assign the students once their own account has "
                    "opened the link."
                ),
            )
        if counsellor.id == client.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="A member cannot be assigned as their own counsellor.",
            )
        client.assigned_counsellor_id = counsellor.id
    else:
        client.assigned_counsellor_id = None
    db.commit()
    db.refresh(client)
    return _member_out(db, client)


@router.delete("/{slug}/members/{member_id}", response_model=MemberOut)
@org_limit
def remove_member(
    request: Request,
    slug: str,
    member_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MemberOut:
    """Take a place back. One click, and it needs nothing from the person removed.

    The invited and the joined are removed by the same route, because a school needs to
    be able to withdraw a link it has already mailed; what changes is only which columns
    say why. Nothing the removed person wrote anywhere else is touched — their account,
    their conversations and their reports are theirs, and a roster row was never the place
    they lived.
    """
    org, _ = require_admin(db, user, slug)
    same_portal(request, org.slug)
    row = db.get(Membership, member_id)
    if row is None or row.organization_id != org.id:
        raise UNKNOWN_MEMBER
    if row.user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "You cannot remove your own place from inside the portal you are using to "
                "do it. Leaving is a different button, and it is on your own account."
            ),
        )
    row.status = "revoked"
    row.revoked_at = _now()
    row.invite_hash = None
    row.invite_expires_at = None
    # The switch belongs to the person who set it, and it only means anything inside this
    # portal. With the membership gone there is nobody to read through it, so it goes too
    # rather than waiting to be re-granted by accident.
    row.share_results = False
    db.commit()
    db.refresh(row)
    return _member_out(db, row)


# ---------------------------------------------------------------- session notes


@router.get("/{slug}/notes", response_model=list[NoteOut])
def list_notes(
    request: Request,
    slug: str,
    client_membership_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[NoteOut]:
    """The counsellor's own notes, newest first, optionally for one client.

    Scoped to `author_user_id` before anything else, and that scope is not an oversight
    about colleagues: a note is one adult's working text about a child, and a practice
    where every counsellor reads every note becomes a place where a judgement somebody
    made in haste is permanent and shared. An administrator of a school is not given the
    counsellors' notes either — they get the roster, the analytics and the client's own
    shared rows, which is what a school runs on.
    """
    org, viewer = require_staff(db, user, slug)
    same_portal(request, org.slug)
    where = [
        SessionNote.organization_id == org.id,
        SessionNote.author_user_id == viewer.user_id,
    ]
    if client_membership_id is not None:
        where.append(SessionNote.client_membership_id == client_membership_id)
    rows = db.scalars(
        select(SessionNote).where(*where).order_by(SessionNote.created_at.desc(), SessionNote.id.desc())
    ).all()
    return [_note_out(row) for row in rows]


@router.post("/{slug}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
@org_limit
def write_note(
    request: Request,
    slug: str,
    body: NoteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NoteOut:
    """Record a session. It starts private, and it stays that way until switched.

    `shared_with_family` is not a field of this request. The insert sets it false, the
    share route below is the only thing that can set it true, and the reason the two are
    separate calls is that a note is written in the same breath as the meeting and read
    by a family some weeks later; making the decision twice, at the two times, is what
    keeps a first sentence typed in confidence out of a parent's inbox.

    The client has to be an accepted member who is visible to this counsellor. A note
    cannot be attached to a waiting invitation — writing about a child who has not agreed
    to the arrangement is something this table is built not to be able to represent.
    """
    org, viewer = require_staff(db, user, slug)
    same_portal(request, org.slug)
    client = db.get(Membership, body.client_membership_id)
    if client is None or client.organization_id != org.id:
        raise UNKNOWN_MEMBER
    if not client_is_visible(org, viewer, client):
        raise NOT_VISIBLE
    row = SessionNote(
        organization_id=org.id,
        client_membership_id=client.id,
        author_user_id=user.id,
        body=body.body.strip(),
        shared_with_family=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _note_out(row)


@router.patch("/{slug}/notes/{note_id}/share", response_model=NoteOut)
@org_limit
def share_note(
    request: Request,
    slug: str,
    note_id: int,
    body: NoteShareIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NoteOut:
    """Show one note to a family, or stop showing it.

    Only its author reaches this route, and the timestamp records which way it went:
    `shared_at` is stamped on the way in and left alone on the way out, so a family who
    saw a note and no longer can is a fact the row still tells. Unsharing is immediate
    and needs nobody's agreement, which is the only sensible arrangement when the thing
    being unsaid is a sentence about somebody's child.
    """
    org, viewer = require_staff(db, user, slug)
    same_portal(request, org.slug)
    row = db.get(SessionNote, note_id)
    if row is None or row.organization_id != org.id or row.author_user_id != user.id:
        raise UNKNOWN_NOTE
    want = bool(body.shared_with_family)
    if want != bool(row.shared_with_family):
        row.shared_with_family = want
        row.edited_at = _now()
        if want:
            row.shared_at = _now()
    db.commit()
    db.refresh(row)
    return _note_out(row)


@router.delete("/{slug}/notes/{note_id}", response_model=NoteOut)
@org_limit
def delete_note(
    request: Request,
    slug: str,
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NoteOut:
    """Delete a note of yours, outright.

    Deletion is offered next to unsharing because they are different promises. Unsharing
    says "a family cannot read this today"; deletion says "this was wrong and it is
    gone", and a counsellor who realises they wrote a judgement they should not have is
    entitled to the second one without asking an administrator to perform it. The row is
    removed with its organisation and with its client, which is what the foreign keys were
    set to CASCADE for.
    """
    org, _ = require_staff(db, user, slug)
    same_portal(request, org.slug)
    row = db.get(SessionNote, note_id)
    if row is None or row.organization_id != org.id or row.author_user_id != user.id:
        raise UNKNOWN_NOTE
    out = _note_out(row)
    db.delete(row)
    db.commit()
    return out


@router.get("/{slug}/my-notes", response_model=list[NoteOut])
def family_notes(
    request: Request,
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[NoteOut]:
    """What this account may read about itself: shared notes, and only shared notes.

    The filter is one boolean on the row, applied before the ordering, so there is no
    path by which a family's screen can be talked into showing an unsent draft. A student
    sees notes written about them; a guardian sees notes about their own membership, and
    a parent who wants their child's needs a link the child chose — this route reads the
    caller's membership and nothing else, which is why it cannot be pointed at somebody
    else's child by changing an id.
    """
    org, mine = require_membership(db, user, slug)
    same_portal(request, org.slug)
    rows = db.scalars(
        select(SessionNote)
        .where(
            SessionNote.organization_id == org.id,
            SessionNote.client_membership_id == mine.id,
            SessionNote.shared_with_family.is_(True),
        )
        .order_by(SessionNote.shared_at.desc(), SessionNote.id.desc())
    ).all()
    return [_note_out(row) for row in rows]


# ---------------------------------------------------------------- analytics


def _stage_label(profile: StudentProfile | None) -> str:
    """A class level written the way a head teacher says it, or the honest blank.

    `class-9` becomes "Class 9"; a student who never told the app their class is
    reported as "Not stated" rather than guessed at from an age or dropped silently,
    because a school that has thirty children with no class level needs to know that, and
    it is the sort of number that disappears from a chart if the chart is built to show
    only the answered rows.
    """
    value = (profile.class_level or "") if profile else ""
    if not value:
        return "Not stated"
    parts = value.replace("_", "-").split("-")
    if parts and parts[0].lower() == "class" and len(parts) > 1:
        return f"Class {parts[1]}"
    return value.replace("-", " ").title()


@router.get("/{slug}/analytics", response_model=AnalyticsOut)
def portal_analytics(
    request: Request,
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalyticsOut:
    """How far through the questionnaire this portal's students got, in fives.

    The five-person floor is the reason this route can exist. Thirty students who started
    a questionnaire is a fact about a cohort; three is a fact about three children a
    teacher could name from the corridor, and a breakdown of three by class or by language
    is a way of publishing them. So a bucket under five is dropped, the drop is named in
    `hidden`, and the headline counts stay — a school is entitled to know that eleven of
    its forty finished something, and is not entitled to know which eleven spoke Hindi.

    What is read here is only the shape of activity: which sittings started, which
    finished, the class level and the language. No answer, no score, no transcript and no
    report is reachable from this route, whatever a member's `share_results` says — that
    switch governs a family's own views, not a chart, and it is counted here only as a
    number of people who turned it on.
    """
    org, viewer = require_staff(db, user, slug)
    same_portal(request, org.slug)

    members = [
        row
        for row in db.scalars(
            select(Membership).where(
                Membership.organization_id == org.id,
                Membership.status == "active",
                Membership.org_role.in_(("student", "parent")),
            )
        ).all()
        # A counsellor employed by a school gets their own caseload, not the school's
        # whole intake. The same `client_is_visible` rule that limits the roster limits the
        # chart, because an aggregate a person cannot otherwise reach is still a reach: a
        # single number like "eleven of this school's students finished something" tells a
        # counsellor who was assigned four children something about the other seven
        # hundred, and no floor of five fixes a count that is already a total.
        if client_is_visible(org, viewer, row)
    ]
    user_ids = [row.user_id for row in members if row.user_id is not None]
    cohort = len(user_ids)
    shared = sum(1 for row in members if row.share_results)

    if cohort == 0:
        return AnalyticsOut(
            cohort_size=0,
            sittings_started=0,
            sittings_completed=0,
            shared_results=0,
            hidden=[
                "no member of this portal has joined yet, so there is nothing to count"
            ],
            min_reportable=MIN_REPORTABLE_COHORT,
        )

    started = db.scalar(
        select(func.count(Assessment.id)).where(Assessment.user_id.in_(user_ids))
    ) or 0
    completed = db.scalar(
        select(func.count(Assessment.id)).where(
            Assessment.user_id.in_(user_ids),
            Assessment.status == "completed",
            Assessment.completed_at.is_not(None),
        )
    ) or 0

    profiles = {
        profile.user_id: profile
        for profile in db.scalars(
            select(StudentProfile).where(StudentProfile.user_id.in_(user_ids))
        ).all()
    }
    by_stage: dict[str, int] = {}
    for value in user_ids:
        label = _stage_label(profiles.get(value))
        by_stage[label] = by_stage.get(label, 0) + 1

    languages = db.scalars(
        select(User.preferred_language).where(User.id.in_(user_ids))
    ).all()
    by_language: dict[str, int] = {}
    for value in languages:
        label = "Hindi" if (value or "en") == "hi" else "English"
        by_language[label] = by_language.get(label, 0) + 1

    hidden: list[str] = []
    if cohort < MIN_REPORTABLE_COHORT:
        hidden.append(
            f"every breakdown is withheld: the cohort is {cohort}, below the floor of "
            f"{MIN_REPORTABLE_COHORT}"
        )
        stage_buckets, language_buckets = [], []
    else:
        stage_buckets, language_buckets = [], []
        for label, count in sorted(by_stage.items(), key=lambda item: (-item[1], item[0])):
            if count < MIN_REPORTABLE_COHORT:
                hidden.append(f"stage “{label}” has {count}, below the floor of {MIN_REPORTABLE_COHORT}")
                continue
            stage_buckets.append(AnalyticsBucketOut(label=label, count=count))
        for label, count in sorted(by_language.items(), key=lambda item: (-item[1], item[0])):
            if count < MIN_REPORTABLE_COHORT:
                hidden.append(
                    f"language “{label}” has {count}, below the floor of {MIN_REPORTABLE_COHORT}"
                )
                continue
            language_buckets.append(AnalyticsBucketOut(label=label, count=count))

    return AnalyticsOut(
        cohort_size=cohort,
        sittings_started=started,
        sittings_completed=completed,
        shared_results=shared,
        by_stage=stage_buckets,
        by_language=language_buckets,
        hidden=hidden,
        min_reportable=MIN_REPORTABLE_COHORT,
    )


# ---------------------------------------------------------------- the platform's own


@router.get("", response_model=list[OrganizationOut])
def list_organizations(
    kind: str | None = Query(default=None, max_length=16),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> list[OrganizationOut]:
    """Every portal on the platform, for the operator.

    `admin` here is `users.is_admin`, the flag `scripts/admin_grant.py` sets and no route
    can. It is not a school administrator — the distinction is the reason the two lists
    live in different files of the same request, and a head teacher's membership row
    reaches none of the routes below this comment.
    """
    where = []
    if kind in ("school", "counsellor"):
        where.append(Organization.kind == kind)
    return [
        OrganizationOut.model_validate(row)
        for row in db.scalars(
            select(Organization).where(*where).order_by(Organization.name)
        ).all()
    ]


@router.post("/admin", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_organization_as_admin(
    body: AdminOrganizationCreateIn,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> OrganizationOut:
    """Open a portal on somebody's behalf, including a school.

    This is the route a real school is onboarded through, and the shape is deliberate
    rather than bureaucratic: a self-serve `kind` would let any account declare itself an
    institution, and the one word on this row that a family cannot check for itself —
    `verified` — is only ever written by a person who looked. `admin` is the operator's
    own account, which becomes the portal's first administrator until the school's staff
    are invited.

    That last fact is the one worth having on record later, so it goes into `audit_events`
    in the same transaction as the rows themselves: which account opened which portal, and
    on what tier, is a decision somebody made, not a thing the database grew.
    """
    name = body.name.strip()
    slug = _claimed_slug(body.slug, name)
    if db.scalars(select(Organization.id).where(Organization.slug == slug).limit(1)).first():
        raise NAME_TAKEN
    tier = reseller.get(body.tier_code or "") or reseller.default_for(body.kind)
    if body.tier_code and tier.code != body.tier_code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                f"“{body.tier_code}” is not a tier of this catalogue. The tiers for a "
                f"{body.kind} are: {', '.join(t.code for t in reseller.for_kind(body.kind))}."
            ),
        )
    now = _now()
    org = Organization(
        slug=slug,
        kind=body.kind,
        name=name,
        tier_code=tier.code,
        verified=True,
        verified_at=now,
    )
    db.add(org)
    db.flush()
    db.add(
        Membership(
            organization_id=org.id,
            user_id=admin.id,
            org_role="school_admin" if body.kind == "school" else "counsellor",
            status="active",
            display_label=admin.display_name,
            joined_at=now,
        )
    )
    audit.record(
        db,
        admin,
        "org.create",
        subject_type="organization",
        subject_id=org.slug,
        detail=f"{body.kind} opened on tier {tier.code}",
    )
    db.commit()
    db.refresh(org)
    return OrganizationOut.model_validate(org)


@router.patch("/{slug}/admin", response_model=OrganizationOut)
def update_organization_as_admin(
    slug: str,
    body: AdminOrganizationUpdateIn,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> OrganizationOut:
    """Change a portal's tier, its verified label, or whether it is open at all.

    Closing a portal is the one action here with consequences the row cannot show: every
    member stops being able to reach it, and the children's own accounts carry on exactly
    as they did, because they were never stored inside the organisation. Nothing here
    deletes a single thing a student wrote — a closed school is a closed portal, not an
    erased term.

    The log carries the names of the fields that moved and the state they moved to, which
    is the whole of what a later reader needs to know. A portal's tier and its verified
    label are decisions about the platform, not somebody's private data.
    """
    org = db.scalars(
        select(Organization).where(Organization.slug == slug).limit(1)
    ).first()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No portal by that name exists on this platform.",
        )
    values = body.model_dump(exclude_unset=True)
    if "tier_code" in values and values["tier_code"]:
        tier = reseller.get(values["tier_code"])
        if tier is None or tier.kind not in ("any", org.kind):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=(
                    f"“{values['tier_code']}” is not a tier a {org.kind} can be given. "
                    f"Choose from: {', '.join(t.code for t in reseller.for_kind(org.kind))}."
                ),
            )
        org.tier_code = tier.code
    if "verified" in values:
        org.verified = bool(values["verified"])
        org.verified_at = _now() if org.verified else None
    if "is_active" in values:
        org.is_active = bool(values["is_active"])
    if values:
        audit.record(
            db,
            admin,
            "org.update",
            subject_type="organization",
            subject_id=org.slug,
            detail="changed: " + ", ".join(
                f"{key} -> {'true' if value is True else 'false' if value is False else value}"
                for key, value in values.items()
            ),
        )
    db.commit()
    db.refresh(org)
    return OrganizationOut.model_validate(org)
