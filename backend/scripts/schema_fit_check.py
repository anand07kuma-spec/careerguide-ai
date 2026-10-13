"""Static check: does the seed content fit the declared column lengths?

SQLite silently ignores varchar(n), so an over-long catalogue row only fails on
the first real Postgres boot. This compares every seeded string value against the
length its model declares, without touching a database.

Run from `backend/`:

    .venv/Scripts/python.exe scripts/schema_fit_check.py
"""

from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import String  # noqa: E402

from app.models import Career, Institution, Resource, Scholarship  # noqa: E402
from app.seed.careers_data import CAREERS  # noqa: E402
from app.seed.catalogue_data import INSTITUTIONS, RESOURCES, SCHOLARSHIPS  # noqa: E402

PAIRS = [
    (Career, CAREERS),
    (Resource, RESOURCES),
    (Scholarship, SCHOLARSHIPS),
    (Institution, INSTITUTIONS),
]

too_long = []
for model, rows in PAIRS:
    cols = model.__table__.columns
    for name in {key for row in rows for key in row}:
        column = cols.get(name)
        if column is None or not isinstance(column.type, String):
            continue
        limit = column.type.length
        if limit is None:
            continue  # varchar without a length is unbounded
        longest = max((len(str(v)) for v in (r.get(name) for r in rows) if v is not None), default=0)
        if longest > limit:
            too_long.append((model.__tablename__, name, limit, longest))

for table, column, limit, longest in too_long:
    print(f"  [FAIL] {table}.{column}: varchar({limit}) holds at most {limit}, seed has {longest}")

if not too_long:
    print(f"  [PASS] every seeded string value fits its declared column length "
          f"({sum(len(r) for _, r in PAIRS)} rows checked)")
print(f"\n{len(too_long)} column(s) too short")
sys.exit(1 if too_long else 0)
