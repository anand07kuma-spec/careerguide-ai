"""Database engine + session wiring.

SQLite by default, and any PostgreSQL URL works unchanged — including a Supabase
project. `DATABASE_URL` is the only switch; nothing else in the app is
dialect-specific, because the models avoid SQLite-only SQL and store JSON as
JSONB on PostgreSQL (see `app/models.py`).
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")

# Hosted Postgres sits behind a pooler that kills idle connections and may run
# PgBouncer in transaction mode, where server-side prepared statements break.
# Recycling connections and disabling prepared statements keeps both pooler
# modes (5432 session, 6543 transaction) working. `prepare_threshold` is a
# driver argument, so it travels in `connect_args`; passing it to
# `create_engine` directly raises TypeError.
if _is_sqlite:
    connect_args = {"check_same_thread": False}
    pool_args: dict = {}
else:
    connect_args = {"prepare_threshold": None}
    pool_args = {"pool_recycle": 300}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    **pool_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
