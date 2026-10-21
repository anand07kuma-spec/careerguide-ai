"""Idempotent seeding of the study-abroad directory.

Three rules this loader keeps, all of them because the alternative is a lie on a page a
seventeen-year-old reads:

* **Only what cannot change is seeded.** A university arrives with its name, city,
  country, funding type and official domain. Tuition, intakes, deadlines and
  English-test requirements stay NULL, which is what makes the page print "not verified
  yet" instead of a number nobody read off a source.
* **Re-running never overwrites a human's work.** A row is written only when its slug
  is absent. Once the owner has filled in a fee with a source and a date, the next
  `seed` call leaves that row alone rather than restoring the empty version of it.
* **No success story is seeded at all.** `study_stories` is created by the migration and
  stays empty; a testimonial is something a named person agreed to, so there is nothing
  here that could legitimately write one.

`checked_at` and `verified_at` are left NULL on every row written, including the country
copy. That is the honest state of text written by whoever made this file: nobody has
opened the visa portal and re-read it against these sentences.

Run directly, on whatever `DATABASE_URL` points at:

    .venv/Scripts/python.exe -m app.seed.study_abroad
"""

from __future__ import annotations

import json
import logging
import pathlib
import re
import unicodedata
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import StudyCountry, StudyService, University

log = logging.getLogger("careerguide.seed.study_abroad")

DATA_PATH = pathlib.Path(__file__).resolve().parents[2] / "data" / "universities.json"


def slugify(value: str) -> str:
    """The slug the public URL is made of, derived from the name it was written with.

    Accents are folded so `Université de Montréal` and `University of Göttingen` get
    addresses a browser can type, and a run of punctuation becomes one dash.
    """
    folded = unicodedata.normalize("NFKD", value)
    ascii_only = folded.encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower())
    return cleaned.strip("-")


def _read_catalogue() -> Sequence[dict]:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    rows = payload["universities"] if isinstance(payload, dict) else payload
    return rows


def seed_study_abroad(db: Session) -> dict:
    """Write any destination, service or university that is not in the database yet."""
    written: dict[str, int] = {}

    from .study_abroad_data import COUNTRIES, SERVICES

    known_countries = set(db.scalars(select(StudyCountry.slug)))
    added = 0
    for index, entry in enumerate(COUNTRIES):
        if entry["slug"] in known_countries:
            continue
        db.add(StudyCountry(**entry, sort_order=index + 1, checked_at=None))
        known_countries.add(entry["slug"])
        added += 1
    if added:
        written["study_countries"] = added

    known_services = set(db.scalars(select(StudyService.slug)))
    added = 0
    for entry in SERVICES:
        if entry["slug"] in known_services:
            continue
        db.add(StudyService(**entry))
        known_services.add(entry["slug"])
        added += 1
    if added:
        written["study_services"] = added

    # Flush before the directory reads the country list back: this app's Session runs
    # with `autoflush=False`, so the rows added a moment ago are still only in the
    # session. Without this, every university in the file is reported as having no
    # matching destination and a fresh database seeds with an empty directory.
    db.flush()

    rows = sorted(_read_catalogue(), key=lambda row: (row["country"], row["name"]))
    country_ids = {
        country.slug: country.id
        for country in db.scalars(select(StudyCountry))
    }
    known_universities = set(db.scalars(select(University.slug)))
    added = 0
    skipped: list[str] = []
    order: dict[str, int] = {}
    for row in rows:
        slug = slugify(row["name"])
        if not slug or slug in known_universities:
            continue
        country_id = country_ids.get(row["country"])
        if country_id is None:
            # A university in a destination this database does not describe. Refusing it
            # is better than inventing a country row to hang it on.
            skipped.append(slug)
            continue
        if not row["url"].startswith(("http://", "https://")):
            skipped.append(slug)
            continue
        order[row["country"]] = order.get(row["country"], 0) + 1
        db.add(
            University(
                country_id=country_id,
                slug=slug,
                name=row["name"],
                city=row["city"],
                kind=row["kind"],
                official_url=row["url"],
                summary=None,
                areas=[],
                sort_order=order[row["country"]],
                # Nothing in the file is verified, and the loader cannot make it so.
                verified=False,
                verified_at=None,
                source_url=None,
                sponsored=False,
            )
        )
        known_universities.add(slug)
        added += 1
    if added:
        written["study_universities"] = added
    if skipped:
        log.warning("Skipped %d university rows with no matching country or a bad url", len(skipped))

    if written:
        db.commit()
        log.info("Seeded study abroad: %s", written)
    return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    from ..database import SessionLocal

    with SessionLocal() as session:
        counts = seed_study_abroad(session)
    print(f"study abroad seed: {counts or 'nothing new to write'}")
