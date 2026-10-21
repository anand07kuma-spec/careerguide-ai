"""Alembic environment.

The URL comes from the app's own settings, so `.env` decides which database is
migrated and there is no second copy of the connection string to keep in step.

The application models are the source of truth for table shape, which is why
`target_metadata` is the real `Base.metadata`: `alembic revision --autogenerate`
compares the running database against exactly the tables the app uses.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.database import Base
from app import models  # noqa: F401  — importing registers every table on the metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL instead of running it: `alembic upgrade head --sql`, i.e. the diff
    to read before touching a database that holds real children's answers."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # SQLite cannot ALTER most things in place; batching rewrites the table
            # instead, so the same migration works on SQLite and PostgreSQL.
            render_as_batch=True,
            # Without this, autogenerate ignores a column whose type changed and
            # silently leaves the database mismatched with the models.
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
