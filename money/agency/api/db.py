"""Postgres connection: psycopg 3, plain SQL, rows as dicts."""
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json  # noqa: F401  (main.py writes jsonb with it)

import config


def connect():
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row)


def get_conn():
    """FastAPI dependency: one connection per request, committed on success."""
    with connect() as conn:
        yield conn


def setting(conn, key, default=None):
    row = conn.execute("SELECT value FROM settings WHERE key = %s", (key,)).fetchone()
    return default if row is None else row["value"]


def suppressed(conn, email=None, domain=None):
    """True when the address, its domain, or the given domain (e.g. the shop's website) is on the do-not-email list."""
    email = (email or "").strip().lower()
    domains = {d for d in ((email.split("@", 1)[1] if "@" in email else ""), (domain or "").strip().lower()) if d}
    if not email and not domains:
        return False
    return conn.execute(
        "SELECT 1 FROM suppressions WHERE lower(email) = %s OR lower(domain) = ANY(%s) LIMIT 1", (email, list(domains))
    ).fetchone() is not None
