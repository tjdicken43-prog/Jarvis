"""Postgres connection: psycopg 3, plain SQL, rows as dicts."""
import atexit

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json  # noqa: F401  (main.py writes jsonb with it)

import config


def connect():
    return psycopg.connect(config.DATABASE_URL, row_factory=dict_row)


_pool = None


def pool():
    """A small pool, opened on first use. A new Postgres connection costs a TCP + TLS handshake and auth (tens of ms
    on Render); a booking tool call during a live phone call shouldn't pay that every time. DB_POOL=0 turns it off."""
    global _pool
    if _pool is None and config.DB_POOL > 0:
        from psycopg_pool import ConnectionPool
        _pool = ConnectionPool(config.DATABASE_URL, min_size=1, max_size=config.DB_POOL, open=True,
                               kwargs={"row_factory": dict_row}, check=ConnectionPool.check_connection)
        atexit.register(_pool.close)
    return _pool


def get_conn():
    """FastAPI dependency: one connection per request, committed on success (rolled back on an error)."""
    if not pool():
        with connect() as conn:
            yield conn
        return
    with _pool.connection() as conn:
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
