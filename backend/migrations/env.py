"""
Alembic environment configuration.

This file is executed by Alembic for both online (with live DB) and
offline (SQL script generation) migration modes.

DATABASE_URL is read from the environment so no credentials are
hard-coded here or in alembic.ini.
"""

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Import Base and ALL models so Alembic autogenerate can detect every table.
# The models package __init__.py re-exports all ORM classes.
from app.core.database import Base  # noqa: F401
import app.models  # noqa: F401 — registers User, Location, DisasterEvent, Alert

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config

# Apply Python logging config from alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The metadata object Alembic uses to detect schema changes.
target_metadata = Base.metadata

# ── Database URL ──────────────────────────────────────────────────────────────
# Override the sqlalchemy.url with the value from the environment.
from app.core.config import settings
db_url = settings.DATABASE_URL
config.set_main_option("sqlalchemy.url", db_url)


# ── Offline migration (generates SQL scripts) ─────────────────────────────────
def run_migrations_offline() -> None:
    """
    Run migrations without a live database connection.

    Useful for generating SQL scripts to review before applying.
    """
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online migration (applies changes to the database) ────────────────────────
def run_migrations_online() -> None:
    """
    Run migrations against a live database.

    Alembic creates a connection, applies all pending revisions in a
    transaction, and then closes cleanly.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
