"""Bring an already-created database up to date with the models.

`Base.metadata.create_all` only makes whole tables — it never ALTERs a table it
built earlier, so a column added to a model after a database was first prepared
does not exist there. On a live deployment that turns every query touching the
table into an error, so both `scripts/db_init.py` and the app's own startup call
this before serving anything.

Only nullable columns are ever added: that is the one thing safe to attach to a
table holding real people's rows, since existing rows simply read back as NULL.
"""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .database import Base


def add_missing_columns(engine: Engine) -> list[str]:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    added: list[str] = []
    with engine.connect() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in tables:
                continue  # create_all will build it complete
            present = {column["name"] for column in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in present or not column.nullable:
                    continue
                sql_type = column.type.compile(dialect=engine.dialect)
                conn.execute(
                    text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {sql_type}')
                )
                added.append(f"{table.name}.{column.name}")
                if column.index:
                    conn.execute(
                        text(
                            f'CREATE INDEX IF NOT EXISTS "ix_{table.name}_{column.name}" '
                            f'ON "{table.name}" ("{column.name}")'
                        )
                    )
            # A table that already exists never gets its declared indexes either, so
            # a unique rule added to a model afterwards — one email, one account —
            # would exist in the models and in Alembic but not in the database the
            # app is actually talking to. The router's own check would still refuse
            # it; the database should not have to rely on that.
            named = {index["name"] for index in inspector.get_indexes(table.name)}
            for index in table.indexes:
                if index.name and index.name not in named:
                    index.create(conn, checkfirst=True)
        conn.commit()
    return added
