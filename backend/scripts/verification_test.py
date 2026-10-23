"""Prove that a green date on a card can only have come from a person who opened a page.

A career page, a scholarship card and a university row can each show "Verified 23 Oct 2026"
beside a link to the official page the numbers were read out of. That badge is the app telling
a fifteen-year-old that somebody checked, so the four ways it could be made without anybody
checking are each tested here:

* **The database.** Migration 0016's three columns are nullable with no default and the seed
  writes none of them, so a fresh catalogue carries zero dates — section 1 measures that
  number instead of asserting it, because the measurement is the finding.
* **A request.** No HTTP route accepts a `source_url`, a `verified_at` or the verified flag
  for these rows. Section 3 asks for all three from an operator's seat and re-reads the row
  afterwards, because a route that answers 422 and writes anyway would pass a status test.
* **A shell given a date.** `scripts/verify_data.py` is the only writer and it stamps *today*
  rather than a date it was handed: `attest --help` has no option that takes one, and asking
  for one is an argparse error. Section 4 proves both halves.
* **A shell given nothing but a link.** It refuses an http address, a local host, a domain
  that is not a regulator, ministry, exam body or university, and a "what I compared" line too
  short to be a sentence. Section 5 runs each refusal against a row and re-reads it.

The rest covers what the shape of the data gets wrong quietly: a row with a page but no date
or a date but no page, which would draw a badge over half a record (section 7), the audit
entry that is the only proof of who signed a date — no actor, because a shell has no token
(section 6) — and `worklist`, which is the requested bulk mode with the lie taken out of it:
ten rows, their claims, their pages, and nothing written (section 8).

Runs against a throwaway database, never `careerguide.db`. Nothing here touches the network —
the script under test has no network access at all, which is why it can record a person's
claim to have read a page but cannot read one itself.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/verification_test.py
"""

from __future__ import annotations

import io
import os
import pathlib
import sys
import tempfile
from contextlib import ExitStack, redirect_stderr, redirect_stdout
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

DB_PATH = pathlib.Path(tempfile.gettempdir()) / "careerguide_verification_test.db"
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["AI_PROVIDER"] = "demo"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # throttles are proved in security_test.py

import verify_data  # noqa: E402  - the script under test, imported the way admin_test.py imports admin_grant
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import inspect, select  # noqa: E402

from app import models  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AuditEvent, Career, Scholarship, University  # noqa: E402

PASS: list[str] = []
FAIL: list[str] = []

# A real regulator of Indian medical practice, and the sort of host the script exists to
# accept. No request is made to it — the point of section 4 is that the script could not make
# one if it wanted to.
NMC = "https://www.nmc.org.in/mbbs-admissions/"
# Three pages that are not: not https, not public, not anybody's regulator.
INSECURE = "http://www.nmc.org.in/mbbs-admissions/"
LOCAL = "http://localhost:8000/sources"
BLOG = "https://careerblogger.example.com/how-to-become-a-doctor"

A_SENTENCE = "compared the entry requirements on the page with the two lines on this card"
TOO_SHORT = "read it"


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def check(label: str, condition, detail: str = "") -> None:
    if condition:
        PASS.append(label)
        print(f"  [PASS] {label}")
    else:
        FAIL.append(label)
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


def run(argv: list[str]) -> tuple[int, str, str]:
    """One `verify_data` invocation, with both of its streams kept.

    The exit code is what most of this suite asserts, so a crash gets a code of its own: 2 is
    the script saying no, 99 is the script breaking, and a check that expected a refusal must
    not pass on a stack trace.
    """
    out, err = io.StringIO(), io.StringIO()
    try:
        with redirect_stdout(out), redirect_stderr(err):
            code = verify_data.main(argv)
    except SystemExit as caught:  # argparse's own refusal
        return (caught.code if isinstance(caught.code, int) else 2), out.getvalue(), err.getvalue()
    except Exception as caught:  # noqa: BLE001 - reported as a failed check, not a traceback
        return 99, out.getvalue(), f"{type(caught).__name__}: {caught}"
    return code or 0, out.getvalue(), err.getvalue()


def state(kind: str, identifier: str) -> dict:
    """The three columns a badge is drawn from, read from a fresh session."""
    spec = verify_data.KINDS[kind]
    wanted, problem = verify_data._lookup(spec, identifier)
    if problem:
        raise AssertionError(problem)
    with SessionLocal() as db:
        row = db.scalars(select(spec["model"]).where(spec["id_column"] == wanted)).first()
        if row is None:
            raise AssertionError(f"no {kind} {identifier}")
        return {
            "source": getattr(row, spec["source"]),
            "date": getattr(row, spec["date"]),
            "flag": getattr(row, spec.get("verified_flag") or spec["unverified_flag"]),
        }


def blank(kind: str, identifier: str) -> bool:
    """Neither half of a badge on the row, and the warning still standing."""
    return state(kind, identifier) == {"source": None, "date": None, "flag": True}


def audit_rows(action: str) -> list[AuditEvent]:
    with SessionLocal() as db:
        rows = list(db.scalars(select(AuditEvent).where(AuditEvent.action == action)))
        for row in rows:
            db.expunge(row)
        return rows


def audit_count() -> int:
    with SessionLocal() as db:
        return int(db.query(AuditEvent).count())


def set_columns(table, identifier_column, identifier: str, **values) -> None:
    """Write a column no route can write, which is the only way to build these fixtures."""
    with SessionLocal() as db:
        row = db.scalars(select(table).where(identifier_column == identifier)).first()
        for field, value in values.items():
            setattr(row, field, value)
        db.commit()


# The lifespan builds the schema and seeds the catalogue, so every row below is one a family
# could actually be shown rather than a fixture that flatters the script.
client = TestClient(app)
LIFESPAN = ExitStack()
LIFESPAN.enter_context(client)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- 1
section("1. a fresh catalogue has no dates on it")
# The feature was requested as a script that filled these columns for the top ten careers and
# every university and set the date to today. This section is the reason that was not built:
# the honest answer to "how many of these have been read against a source?" is zero, and a
# badge saying otherwise is the bug the rest of the file guards against.
with SessionLocal() as db:
    careers = list(db.scalars(select(Career).order_by(Career.slug)))
    scholarships = list(db.scalars(select(Scholarship).order_by(Scholarship.id)))
    universities = list(db.scalars(select(University).order_by(University.slug)))

total = len(careers) + len(scholarships) + len(universities)
check("the seed gives the app rows to show, so this is a real catalogue and not an empty "
      "table",
      careers and scholarships and universities,
      f"{len(careers)} careers, {len(scholarships)} scholarships, {len(universities)} universities")
print(f"  ({len(careers)} careers, {len(scholarships)} scholarships, "
      f"{len(universities)} universities on this database)")

witnessed = ([r.slug for r in careers if r.verified_at or r.source_url]
             + [str(s.id) for s in scholarships if s.last_verified_at or s.source_url]
             + [u.slug for u in universities if u.verified_at or u.source_url])
check(f"…and not one of the {total} rows arrives with a page or a date beside it",
      witnessed == [], witnessed[:5])

disagreements = (
    [r.slug for r in careers if bool(r.verified_at or r.source_url) != (not r.needs_verification)]
    + [str(s.id) for s in scholarships
       if bool(s.last_verified_at or s.source_url) != s.verified]
    + [u.slug for u in universities
       if bool(u.verified_at or u.source_url) != u.verified]
)
check("…so the warning flag and the two new columns cannot disagree on any row, which is the "
      "state the badge reads",
      disagreements == [], disagreements[:5])

with SessionLocal() as db:
    engine = db.get_bind()
    columns = {
        f"{table}.{column}": next(
            (item for item in inspect(engine).get_columns(table)
             if item["name"] == column), None)
        for table, column in [("careers", "source_url"), ("careers", "verified_at"),
                              ("scholarships", "source_url")]
    }
check("0016's three columns are there, nullable, and with no default to fall back on",
      all(item is not None and item["nullable"] and item.get("default") is None
          for item in columns.values()),
      sorted(key for key, item in columns.items() if item is None))

# The fixtures are rows the seed left waiting, which is the only state an attestation starts from.
career_slug = next(row.slug for row in careers if row.needs_verification)
second_career = next(row.slug for row in careers if row.slug != career_slug)
third_career = next(row.slug for row in careers
                    if row.slug not in {career_slug, second_career})
spare_career = next(row.slug for row in careers
                    if row.slug not in {career_slug, second_career, third_career})
scholarship_id = str(next(row.id for row in scholarships if not row.verified))

# --------------------------------------------------------------------------- 2
section("2. the API tells the pages what they can actually say")
# `SourceBadge` reads these fields off the payload: a null renders as "Not yet checked against
# a source", a value renders as green with a date. So the payload is where a fabricated badge
# would enter the frontend, and this is what is really in it.
detail = client.get(f"/api/careers/{career_slug}")
check("a career's own page carries both fields rather than leaving them off the payload",
      detail.status_code == 200 and {"source_url", "verified_at"} <= set(detail.json()),
      detail.text[:200])
check("…and both are null, which is the grey badge and not the green one",
      detail.json().get("source_url") is None and detail.json().get("verified_at") is None,
      {key: detail.json().get(key) for key in ("source_url", "verified_at")})

scheme = client.get("/api/scholarships")
check("every scholarship in the list carries a source field",
      scheme.status_code == 200 and len(scheme.json()) == len(scholarships)
      and all("source_url" in row for row in scheme.json()),
      str(len(scheme.json())) + " rows")
check("…and none of them claims a page",
      all(row["source_url"] is None for row in scheme.json()),
      [row["source_url"] for row in scheme.json() if row["source_url"]][:3])

served = client.get("/api/study-abroad/universities")
check("the university list carries the date and the page, because the question is asked at "
      "the list rather than after opening a row",
      served.status_code == 200
      and all({"source_url", "verified_at"} <= set(row) for row in served.json()),
      sorted(served.json()[0])[:8] if served.json() else "no rows")
check("…and on this database every one of them is empty",
      all(row["source_url"] is None and row["verified_at"] is None
          for row in served.json()),
      [row["slug"] for row in served.json() if row["source_url"]][:3])

# The fixture is a row from that list rather than the first slug in the table: 510
# institutions are served twenty-destinations at a time, and the check worth having is that
# the page a family scrolls through shows the date once the row is read.
university_slug = next(row["slug"] for row in served.json() if not row["verified"])

# --------------------------------------------------------------------------- 3
section("3. no request can light the badge")
# The operator's screen corrects catalogue prose all day. It is the one place a form could
# carry a `verified_at`, and the answer has to be that the field does not exist there.
signup = client.post("/api/auth/onboarding", json={
    "role": "parent", "display_name": "Meera Nair", "preferred_language": "en",
    "consent_profile": True, "consent_voice": False, "consent_age": "adult"})
assert signup.status_code == 200, signup.text[:300]
operator = signup.json()["token"]
with SessionLocal() as db:
    account = db.get(models.User, signup.json()["user"]["id"])
    account.is_admin = True
    db.commit()

refused = client.patch(f"/api/admin/content/careers/{career_slug}",
                       headers=auth(operator), json={"needs_verification": False})
check("an operator cannot switch a career's verified flag from a form",
      refused.status_code == 422, refused.text[:200])
check("…with the reason in the answer rather than only in a comment",
      "not editable here" in refused.text, refused.text[:200])
check("…and the row is exactly what the seed left it",
      blank("career", career_slug), state("career", career_slug))

for field, value in [("source_url", NMC), ("verified_at", "2020-01-01T00:00:00Z")]:
    answer = client.patch(f"/api/admin/content/careers/{career_slug}",
                          headers=auth(operator), json={field: value})
    check(f"a career patch does not accept a {field} at all",
          answer.status_code == 422, answer.text[:200])
    check(f"…so no request can put a {field} on the row",
          blank("career", career_slug), state("career", career_slug))

university_patch = client.patch(f"/api/study-abroad/admin/universities/{university_slug}",
                                headers=auth(operator), json={"verified": True})
check("the university route that predates this feature still refuses a flag with no source "
      "behind it",
      university_patch.status_code == 422, university_patch.text[:200])
check("…and that row is unverified too",
      state("university", university_slug)["flag"] is False, state("university", university_slug))

student = client.post("/api/auth/onboarding", json={
    "role": "student", "display_name": "Aarav", "preferred_language": "en",
    "consent_profile": True, "consent_voice": False, "consent_age": "11-12",
    "class_level": "class-12"}).json()["token"]
as_student = client.patch(f"/api/admin/content/careers/{career_slug}",
                          headers=auth(student), json={"source_url": NMC})
check("…and a student is refused the request entirely, rather than being handed the shape of "
      "a field that would work for somebody else",
      as_student.status_code == 403, as_student.text[:120])

# --------------------------------------------------------------------------- 4
section("4. the script cannot be handed a date")
# If `attest` accepted one, every check above would be worth nothing: the date on the card
# would be an argument, and an argument somebody typed is not a record of reading.
code, help_text, _ = run(["attest", "--help"])
check("attest's own help lists the page and the sentence it needs",
      code == 0 and "--source-url" in help_text and "--read" in help_text, help_text[:200])
check("…and lists no option that takes a date, so there is nothing to type one into",
      not any(option in help_text for option in
              ("--verified-at", "--verified_at", "--date", "--checked-at", "--as-of", "--on")),
      [line for line in help_text.splitlines() if line.strip().startswith("--")])

code, _, err = run(["attest", "--kind", "career", "--id", career_slug,
                    "--source-url", NMC, "--read", A_SENTENCE,
                    "--verified-at", "2020-01-01"])
check("asking for the option that is not there is an error, not a silent ignore",
      code == 2 and "unrecognized arguments" in err, f"{code}: {err[:160]}")
check("…and the row it was aimed at is still blank",
      blank("career", career_slug), state("career", career_slug))

code, _, err = run(["attest", "--kind", "career", "--id", career_slug, "--source-url", NMC])
check("--read is required, not optional", code == 2 and "required" in err, f"{code}: {err[:160]}")
check("…and the three ways to make this a bulk stamping — every row, a file of rows, every "
      "row older than a date — are not options either",
      not any(option in help_text for option in ("--all", "--from-csv", "--since"))
      and "attest [-h]" in help_text,
      help_text[:160])

# --------------------------------------------------------------------------- 5
section("5. attest refuses a page that is not a page")
# Each refusal is followed by a re-read of the row, because the failure that would matter is a
# script printing "Refused" and committing anyway.
before = audit_count()
cases = [
    (["--source-url", INSECURE, "--read", A_SENTENCE], "an http address, i.e. a page nobody "
     "can trust to be the page it claims"),
    (["--source-url", LOCAL, "--read", A_SENTENCE], "a host that is not on the internet"),
    (["--source-url", BLOG, "--read", A_SENTENCE], "a domain that is not a regulator, "
     "ministry, exam body or university"),
    (["--source-url", "not a url at all", "--read", A_SENTENCE], "not a URL"),
    (["--source-url", NMC, "--read", TOO_SHORT], "a note too short to name what was compared"),
    (["--source-url", NMC, "--read", "   "], "no note at all, only spaces"),
]
for extra, why in cases:
    code, _, err = run(["attest", "--kind", "career", "--id", career_slug] + extra)
    check(f"refuses {why}", code == 2 and "Refused" in err, f"{code}: {err[:160]}")
    check("…and writes nothing for it", blank("career", career_slug),
          state("career", career_slug))
check("…so the refusals left no audit entries either, and the log still lists only readings "
      "that happened",
      audit_count() == before, f"{before} before, {audit_count()} after")

code, _, err = run(["attest", "--kind", "career", "--id", "no-such-career",
                    "--source-url", NMC, "--read", A_SENTENCE])
check("a row that does not exist is a refusal, not a stack trace",
      code == 2 and "No career row" in err, f"{code}: {err[:160]}")
code, _, err = run(["attest", "--kind", "scholarship", "--id", "twelve",
                    "--source-url", NMC, "--read", A_SENTENCE])
check("a scheme addressed by a word instead of its number is refused in the same breath, "
      "because on Postgres the same argument would surface as a type error inside the script",
      code == 2 and "is a number" in err, f"{code}: {err[:160]}")

# --------------------------------------------------------------------------- 6
section("6. attest writes, and the date is today by the script")
code, out, err = run(["attest", "--kind", "career", "--id", career_slug,
                      "--source-url", NMC, "--read", A_SENTENCE])
check("a real regulator's page and a real sentence are accepted", code == 0,
      f"{code}: {err[:200]}")
after = state("career", career_slug)
check("…and the row holds exactly the page that was named", after["source"] == NMC, after)
today = datetime.now(timezone.utc).date()
check("…the day the clock says, which is the only day this script can produce",
      after["date"] is not None and after["date"].date() == today, f"{after['date']!r} vs {today}")
check("…and the flag the badge is drawn from, now turned by the same act",
      after["flag"] is False, after)
check("…which is what it told the terminal it had done", "Recorded" in out and str(today) in out,
      out[:300])

entries = audit_rows("content.career_verified")
check("one audit entry for the act, and not one per retry", len(entries) == 1,
      [entry.detail for entry in entries])
entry = entries[0] if entries else None
check("…written with no actor, because a shell holds no token — the null is the signal that "
      "something ran without a person",
      entry is not None and entry.actor_user_id is None and entry.actor_name is None,
      (entry.actor_user_id, entry.actor_name) if entry else None)
check("…and logged as a change made from a script rather than from a page",
      entry is not None and entry.origin == "script", entry.origin if entry else None)
check("…naming the row and the page, which is the whole content a verification record has",
      entry is not None and entry.subject_type == "career" and entry.subject_id == career_slug
      and NMC in (entry.detail or ""),
      (entry.subject_type, entry.subject_id, entry.detail) if entry else None)

long_read = "compared " + ("the entry list against the brochure and the fee table, " * 20)
code, _, err = run(["attest", "--kind", "career", "--id", second_career,
                    "--source-url", NMC, "--read", long_read])
check("a reading note longer than the audit column still records the page instead of failing "
      "after the change was made", code == 0, f"{code}: {err[:200]}")
entries = audit_rows("content.career_verified")
check("…one entry per row, each carrying its URL, none of them over the column's 400 "
      "characters",
      len(entries) == 2 and all(len(item.detail or "") <= 400 for item in entries)
      and all(NMC in (item.detail or "") for item in entries),
      sorted(len(item.detail or "") for item in entries))

code, out, err = run(["attest", "--kind", "career", "--id", third_career,
                      "--source-url", NMC, "--read", A_SENTENCE, "--dry-run"])
check("--dry-run prints the whole plan and changes nothing",
      code == 0 and "Nothing written" in out
      and state("career", third_career)["source"] is None
      and state("career", third_career)["date"] is None,
      f"{code}: {err[:120]} {state('career', third_career)}")
check("…and does not log a reading that did not happen",
      len(audit_rows("content.career_verified")) == 2,
      len(audit_rows("content.career_verified")))

code, _, err = run(["attest", "--kind", "university", "--id", university_slug,
                    "--source-url", "https://www.adelaide.edu.au/", "--read", A_SENTENCE])
check("a university's own domain is accepted the same way, since that page is the source for "
      "its name and its city", code == 0, f"{code}: {err[:200]}")
row = state("university", university_slug)
check("…with the flag the row already had, not a new kind of flag",
      row["flag"] is True and row["source"] == "https://www.adelaide.edu.au/", row)
listed = {item["slug"]: item for item in client.get("/api/study-abroad/universities").json()}
check("…and the list route serves that same date to the badge, rather than re-stamping it",
      listed[university_slug]["source_url"] == row["source"]
      and str(listed[university_slug]["verified_at"] or "").startswith(
          row["date"].isoformat()[:13]),
      listed[university_slug])

# --------------------------------------------------------------------------- 7
section("7. the half states a badge cannot be drawn from")
# A page with no date, or a date with no page: either one lets the frontend print a claim the
# database only half holds, so `report` looks for them and says so out loud.
code, out, err = run(["report", "--kind", "career"])
check("report finds no half-row while every attestation is a pair",
      code == 0 and "IMPOSSIBLE" not in out and "consistent" in out, f"{code}: {err[:120]}")
check("…and counts what it saw, which is the number a reviewer would otherwise take on trust",
      f"career: {len(careers)} rows" in out and "with a page recorded  : 2" in out, out[:300])

set_columns(Career, Career.slug, spare_career, source_url=NMC)
code, out, _ = run(["report", "--kind", "career"])
check("a row given a page and no date by hand is called impossible rather than counted as "
      "checked",
      "IMPOSSIBLE STATE" in out and spare_career in out, out[:400])
set_columns(Career, Career.slug, spare_career, source_url=None)
check("…and clearing it makes the report clean again, which is what makes the warning worth "
      "reading",
      "IMPOSSIBLE" not in run(["report", "--kind", "career"])[1],
      run(["report", "--kind", "career"])[1][:300])

code, out, err = run(["unattest", "--kind", "career", "--id", career_slug])
check("a badge can be taken back off a row", code == 0 and "nobody has read this yet" in out,
      f"{code}: {err[:160]}")
check("…and the undo clears all three columns together, leaving no date standing alone",
      blank("career", career_slug), state("career", career_slug))
check("…which is itself logged, so a claim that was wrong has a history rather than a silence",
      len(audit_rows("content.career_unverified")) == 1, len(audit_rows("content.career_unverified")))

# --------------------------------------------------------------------------- 8
section("8. worklist is the top ten, and it writes nothing")
# This is the requested bulk mode with the lie taken out of it: the rows a family is most
# likely to read, each with the sentences it asks to be believed and the page worth opening.
untouched = audit_count()
code, out, err = run(["worklist", "--kind", "career", "--limit", "10"])
check("up to ten rows are listed for a person to go and read",
      code == 0 and out.count("\n- ") == 10, f"{code}: {out.count(chr(10) + '- ')} rows")
check("…each with what the row asks the reader to believe, so they know what they are checking",
      "believes:" in out and "entry requirements:" in out, out[:300])
check("…and with the official page it already points at",
      "open    : https://" in out, out[:400])
check("…while the whole run touches nothing: the rows it listed are as blank as they were, "
      "and no log line was written",
      blank("career", third_career) and blank("career", spare_career)
      and audit_count() == untouched,
      f"{audit_count()} audit rows against {untouched} before")

code, out, _ = run(["worklist", "--kind", "career"])
with SessionLocal() as db:
    waiting = int(db.query(Career).filter(Career.needs_verification.is_(True)).count())
check("with no limit it is the whole waiting table, which is the honest size of the job",
      code == 0 and out.count("\n- ") == waiting,
      f"{out.count(chr(10) + '- ')} listed, {waiting} waiting")
check("…and the row that was read and kept is not among them, so nobody is sent to check what "
      "has been checked",
      second_career not in out and career_slug in out, out[:120])

code, out, _ = run(["worklist", "--kind", "career", "--limit", "1"])
check("one row of the shortest list still arrives with its own link to open",
      code == 0 and "open    : https://" in out and out.count("\n- ") == 1, out[:200])

code, out, _ = run(["report"])
check("the closing report states where all three tables stand, which is the number this "
      "feature exists to be honest about",
      code == 0 and all(name in out for name in ("career:", "scholarship:", "university:")),
      out[:400])

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED: " + ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
