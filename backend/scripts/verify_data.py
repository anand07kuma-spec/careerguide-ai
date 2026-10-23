"""Record that a person read a catalogue row against its official page.

    ./.venv/Scripts/python.exe scripts/verify_data.py report
    ./.venv/Scripts/python.exe scripts/verify_data.py worklist --kind career --limit 10
    ./.venv/Scripts/python.exe scripts/verify_data.py attest --kind career --id doctor-medicine \
        --source-url https://www.nmc.org.in/ --read "compared the entry list with the UG brochure"

There are three tables that tell a family what a career, a scholarship or a university
involves, and each has a flag meaning "somebody checked this" and two columns meaning
"against which page, on which day". This script is the only place those two columns are
written from a shell, and the only thing that decides whether the green date badge can
appear on a card.

What it will not do is produce a date by itself. It has no network access, so it cannot
know that you read anything — the flag is a signature, not a check, and the audit line it
writes names whoever signed it. That is also why there is no `--all`, no `--from-csv` and
no "stamp every row created before Tuesday" mode: a loop that set 55 dates in one run would
print the confidence of 55 people reading 55 pages, and the number of people who read
anything would be zero. The brief for this feature asked for exactly that loop, against
links typed in by hand; it is the one shape of this script that makes the badge worth less
than it costs, so it is not here.

What is here is `worklist`, which is the same request without the lie: it prints, for the
top N careers and every university, the sentences that row asks a person to believe, and
the official page they are worth opening. Then `attest` per row, once that has happened.

`report` is how you find out where you actually are. It also looks for the impossible
state — a row with a date and no page, or a page and no date — because a badge drawn from
one of those would be a claim with nothing under it.
"""

from __future__ import annotations

import argparse
import pathlib
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import sqlalchemy as sa  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app import models  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.services import audit  # noqa: E402

# Hosts whose whole job is to state these facts: a ministry, a regulator, an exam body, a
# university. Anything else needs a reason, because "Verified on 23 Oct" under a link to a
# coaching-blog repost is worse than no badge at all — it teaches the reader that the app's
# green means something when it does not.
OFFICIAL_HOST_SUFFIXES = (
    ".gov.in", ".nic.in", ".ac.in", ".edu.in", ".res.in", ".org.in",
    ".gov.uk", ".ac.uk", ".gov.au", ".edu.au", ".edu", ".gc.ca", ".gov.ca", ".gov.ie",
    ".edu.cn", ".gov.np", ".gov.bd",
)

def _career_claims(row) -> list[str]:
    """The sentences on this page that a student would plan their class choices around."""
    claims = [f"entry requirements: {item}" for item in row.entry_requirements[:2]]
    claims += [f"pathway: {item}" for item in row.education_pathways[:2]]
    if row.costs_and_alternatives:
        claims.append(f"costs: {row.costs_and_alternatives[:160]}")
    return claims


def _scholarship_claims(row) -> list[str]:
    return [
        f"benefit: {row.benefit_summary[:160]}",
        f"eligibility: {row.eligibility_summary[:160]}",
    ]


def _university_claims(row) -> list[str]:
    claims = [f"fees: {row.tuition_note[:160]}"] if row.tuition_note else []
    claims += [f"deadlines: {row.deadline_note[:160]}"] if row.deadline_note else []
    return claims


KINDS: dict[str, dict] = {
    "career": {
        "model": models.Career,
        "id_column": models.Career.slug,
        "source": "source_url",
        "date": "verified_at",
        # Careers carry the flag the other way round, from the first version of this table.
        "unverified_flag": "needs_verification",
        "name": lambda row: f"{row.title} ({row.slug})",
        "signposts": lambda row: [link.get("url", "") for link in row.official_links],
        "claims": _career_claims,
    },
    "scholarship": {
        "model": models.Scholarship,
        "id_column": models.Scholarship.id,
        "source": "source_url",
        "date": "last_verified_at",
        "verified_flag": "verified",
        "name": lambda row: f"{row.name} (id {row.id})",
        "signposts": lambda row: [row.official_url],
        "claims": _scholarship_claims,
    },
    "university": {
        "model": models.University,
        "id_column": models.University.slug,
        "source": "source_url",
        "date": "verified_at",
        "verified_flag": "verified",
        "name": lambda row: f"{row.name}, {row.city} ({row.slug})",
        "signposts": lambda row: [row.official_url],
        "claims": _university_claims,
    },
}


def _is_official_host(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == suffix.lstrip(".") or host.endswith(suffix) for suffix in OFFICIAL_HOST_SUFFIXES)


def _url_problem(url: str) -> str | None:
    """Why this cannot be the page a person opened, or None when it can."""
    if not url.lower().startswith("https://"):
        return "it is not an https address"
    host = urlparse(url).hostname or ""
    if "." not in host or host.endswith((".local", ".test")) or host in {"localhost"}:
        return "it has no public host name"
    if _is_official_host(url):
        return None
    return (
        f"'{host}' is not a domain this list recognises as a regulator, ministry, exam body "
        "or university"
    )


def _rows(db, kind: str, *, only_unverified: bool, limit: int | None):
    spec = KINDS[kind]
    stmt = select(spec["model"]).order_by(spec["id_column"])
    rows = list(db.scalars(stmt))
    if only_unverified:
        flag = spec.get("verified_flag")
        if flag:
            rows = [row for row in rows if not getattr(row, flag)]
        else:
            rows = [row for row in rows if getattr(row, spec["unverified_flag"])]
    return rows[:limit] if limit else rows


def _lookup(spec, identifier: str):
    """The value to match `--id` against, or a message about why there isn't one.

    A scholarship is addressed by its integer id and the other two by a slug, and a shell
    always hands over a string. SQLite converts that conversion silently; Postgres answers
    `invalid input syntax for type integer`, which on the deployed database would read as the
    script being broken rather than as the argument being wrong.
    """
    column = spec["id_column"]
    if not isinstance(column.type, sa.types.Integer):
        return identifier, None
    try:
        return int(identifier), None
    except ValueError:
        return None, (
            f"{column.table.name}'s id is a number, and {identifier!r} is not one. "
            "`report` and `worklist` print both."
        )


def _audit_detail(url: str, read: str) -> str:
    """The log line, with the page kept and the sentence shortened if it has to be.

    `audit_events.detail` is 400 characters, and on Postgres a longer string is an error at
    insert rather than a truncation. Losing the whole entry — the change committed, the proof
    of it gone — would be the worst outcome, and of the two halves the URL is the one that can
    be checked again years later.
    """
    detail = f"read against {url} — {read}"
    if len(detail) <= 400:
        return detail
    return f"read against {url} — {read}"[:397] + "…"


def cmd_report(db, kind: str | None) -> int:
    kinds = [kind] if kind else list(KINDS)
    for name in kinds:
        spec = KINDS[name]
        rows = list(db.scalars(select(spec["model"])))
        date_attr, source_attr = spec["date"], spec["source"]
        dated = [r for r in rows if getattr(r, date_attr)]
        sourced = [r for r in rows if getattr(r, source_attr)]
        half = [r for r in rows if bool(getattr(r, date_attr)) != bool(getattr(r, source_attr))]
        print(f"\n{name}: {len(rows)} rows")
        print(f"  with a page recorded  : {len(sourced)}")
        print(f"  with a date recorded  : {len(dated)}")
        if half:
            key = spec["id_column"].key
            listed = ", ".join(str(getattr(r, key)) for r in half[:5])
            print(f"  IMPOSSIBLE STATE      : {len(half)} rows carry one of the two — {listed}")
        else:
            print("  consistent            : no row has a date without a page, or a page without a date")
    return 0


def cmd_worklist(db, kind: str, limit: int | None) -> int:
    spec = KINDS[kind]
    rows = _rows(db, kind, only_unverified=True, limit=limit)
    if not rows:
        print(f"No {kind} row is waiting for a source.")
        return 0
    print(
        f"{len(rows)} {kind} row(s) nobody has read against a page. For each: open the link, "
        "find the sentence, compare it. Nothing here is written until you run `attest`.\n"
    )
    for row in rows:
        print(f"- {spec['name'](row)}")
        for claim in spec["claims"](row):
            if claim:
                print(f"    believes: {claim}")
        for url in spec["signposts"](row):
            print(f"    open    : {url}")
        print()
    print(
        "Then, per row:  attest --kind "
        f"{kind} --id <id> --source-url <the page you read> --read <what you compared>"
    )
    return 0


def cmd_attest(db, kind: str, identifier: str, url: str, read: str, force: bool, dry_run: bool) -> int:
    spec = KINDS[kind]
    wanted, problem = _lookup(spec, identifier)
    if problem:
        print(f"Refused: {problem}", file=sys.stderr)
        return 2
    row = db.scalars(select(spec["model"]).where(spec["id_column"] == wanted)).first()
    if row is None:
        print(f"No {kind} row with {spec['id_column'].key} '{identifier}'.", file=sys.stderr)
        return 2
    problem = _url_problem(url)
    if problem and not force:
        print(
            f"Refused: {problem}.\n"
            "A date on a card is a promise that somebody read an official page. If the page "
            "really is the right one and this list is just too narrow, say so once with "
            "--host-is-official.",
            file=sys.stderr,
        )
        return 2
    if len(read.strip()) < 25:
        print(
            "Refused: --read has to say what you compared, in at least a sentence. "
            "Not for the record — because a line too short to name the fact is a line that "
            "was typed without opening the page.",
            file=sys.stderr,
        )
        return 2

    today = datetime.now(timezone.utc)
    print(f"{spec['name'](row)}")
    print(f"  page    : {url}")
    print(f"  compared: {read.strip()}")
    print(f"  stamped : {today.date().isoformat()} (today, by this script — never supplied)")
    if dry_run:
        print("\nNothing written (--dry-run).")
        return 0

    setattr(row, spec["source"], url.strip())
    setattr(row, spec["date"], today)
    if "verified_flag" in spec:
        setattr(row, spec["verified_flag"], True)
    else:
        setattr(row, spec["unverified_flag"], False)
    audit.record(
        db,
        None,
        f"content.{kind}_verified",
        subject_type=kind,
        # The address a person can look the row up by — a slug for a career or a university,
        # the number for a scheme — which is what the operator's own edits to a career log
        # under, so the two writers of this table agree on what identifies a row.
        subject_id=identifier,
        detail=_audit_detail(url.strip(), read.strip()),
        origin=audit.SCRIPT,
    )
    db.commit()
    print("\nRecorded, and written to the audit log as a change made from a shell.")
    return 0


def cmd_unattest(db, kind: str, identifier: str) -> int:
    spec = KINDS[kind]
    wanted, problem = _lookup(spec, identifier)
    if problem:
        print(f"Refused: {problem}", file=sys.stderr)
        return 2
    row = db.scalars(select(spec["model"]).where(spec["id_column"] == wanted)).first()
    if row is None:
        print(f"No {kind} row with {spec['id_column'].key} '{identifier}'.", file=sys.stderr)
        return 2
    setattr(row, spec["source"], None)
    setattr(row, spec["date"], None)
    if "verified_flag" in spec:
        setattr(row, spec["verified_flag"], False)
    else:
        setattr(row, spec["unverified_flag"], True)
    audit.record(
        db,
        None,
        f"content.{kind}_unverified",
        subject_type=kind,
        subject_id=identifier,
        detail="source and date cleared from a shell",
        origin=audit.SCRIPT,
    )
    db.commit()
    print(f"{spec['name'](row)} is back to 'nobody has read this yet'.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    modes = parser.add_subparsers(dest="mode", required=True)

    report = modes.add_parser("report", help="where every table actually stands")
    report.add_argument("--kind", choices=sorted(KINDS), default=None,
                        help="one table instead of all three")

    work = modes.add_parser("worklist", help="what to check, per row. Writes nothing.")
    work.add_argument("--kind", required=True, choices=sorted(KINDS))
    work.add_argument("--limit", type=int, default=None, help="first N rows in list order")

    attest = modes.add_parser("attest", help="sign that you read a row against a page")
    attest.add_argument("--kind", required=True, choices=sorted(KINDS))
    attest.add_argument("--id", required=True, dest="identifier", help="slug, or id for a scholarship")
    attest.add_argument("--source-url", required=True, help="the exact page you opened")
    attest.add_argument("--read", required=True, help="what you compared it against")
    attest.add_argument("--host-is-official", action="store_true", dest="force")
    attest.add_argument("--dry-run", action="store_true")

    undo = modes.add_parser("unattest", help="take the badge back off a row")
    undo.add_argument("--kind", required=True, choices=sorted(KINDS))
    undo.add_argument("--id", required=True, dest="identifier")

    args = parser.parse_args(argv)
    with SessionLocal() as db:
        if args.mode == "report":
            return cmd_report(db, args.kind)
        if args.mode == "worklist":
            return cmd_worklist(db, args.kind, args.limit)
        if args.mode == "attest":
            return cmd_attest(
                db, args.kind, args.identifier, args.source_url, args.read,
                args.force, args.dry_run,
            )
        return cmd_unattest(db, args.kind, args.identifier)


if __name__ == "__main__":
    raise SystemExit(main())
