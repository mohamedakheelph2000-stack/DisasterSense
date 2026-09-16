#!/usr/bin/env python
"""
setup_db.py — DisasterSense local PostgreSQL setup helper.

Run this script ONCE to create the disastersense role and database
before running Alembic migrations.

Usage:
    python scripts/setup_db.py

Prerequisites:
    - PostgreSQL is running on localhost:5432
    - You know the postgres superuser password
    - Python package psycopg2-binary is installed

What this script does:
    1. Connects to PostgreSQL as the 'postgres' superuser.
    2. Creates the 'disastersense' role if it does not already exist.
    3. Creates the 'disastersense' database owned by that role.

After running this script:
    1. Set DATABASE_URL in backend/.env:
           DATABASE_URL=postgresql://disastersense:<your_password>@localhost:5432/disastersense
    2. Run Alembic migrations:
           cd backend
           python -m alembic upgrade head

WARNING:
    This script contains NO default passwords.
    You will be prompted for the postgres superuser password and
    the new disastersense role password at runtime.
    Never hard-code passwords in source files.
"""

import getpass
import sys

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("ERROR: psycopg2-binary is not installed.")
    print("  pip install psycopg2-binary")
    sys.exit(1)


def main() -> None:
    """Prompt for credentials and create the DB role and database."""
    print("=" * 60)
    print("DisasterSense — Local PostgreSQL Setup")
    print("=" * 60)

    postgres_password = getpass.getpass("Enter postgres superuser password: ")
    ds_password = getpass.getpass("Enter NEW password for disastersense role: ")
    ds_password_confirm = getpass.getpass("Confirm password: ")

    if ds_password != ds_password_confirm:
        print("ERROR: Passwords do not match.")
        sys.exit(1)

    # Connect as postgres superuser.
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            dbname="postgres",
            user="postgres",
            password=postgres_password,
        )
    except psycopg2.OperationalError as exc:
        print(f"ERROR: Could not connect to PostgreSQL: {exc}")
        sys.exit(1)

    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Create the role if it does not exist.
    cur.execute(
        "SELECT 1 FROM pg_roles WHERE rolname = %s",
        ("disastersense",),
    )
    if cur.fetchone() is None:
        # Use psycopg2 quoting to prevent injection.
        cur.execute(
            "CREATE ROLE disastersense LOGIN PASSWORD %s",
            (ds_password,),
        )
        print("✓ Role 'disastersense' created.")
    else:
        # Update the password if the role already exists.
        cur.execute(
            "ALTER ROLE disastersense PASSWORD %s",
            (ds_password,),
        )
        print("✓ Role 'disastersense' already exists — password updated.")

    # Create the database if it does not exist.
    cur.execute(
        "SELECT 1 FROM pg_database WHERE datname = %s",
        ("disastersense",),
    )
    if cur.fetchone() is None:
        cur.execute(
            "CREATE DATABASE disastersense OWNER disastersense ENCODING 'UTF8'"
        )
        print("✓ Database 'disastersense' created.")
    else:
        print("✓ Database 'disastersense' already exists.")

    cur.close()
    conn.close()

    print()
    print("Setup complete.")
    print()
    print("Next steps:")
    print("  1. Add to backend/.env:")
    print("       DATABASE_URL=postgresql://disastersense:<your_password>@localhost:5432/disastersense")
    print("  2. Run migrations:")
    print("       cd backend")
    print("       python -m alembic upgrade head")


if __name__ == "__main__":
    main()
