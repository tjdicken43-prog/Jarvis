"""One log for the whole line. Every step writes a row: which shop, which step, passed or failed, and why.

Rows go in on their own connection, so a step that rolls back still leaves its failure behind. The same step
failing REPEAT_FAILS times in a row stops it (sending pauses; other steps refuse to run) until TJ resumes it.
"""
import json

import psycopg

import config
import db

STOPPABLE = {"flaw", "mockup", "draft", "send"}


def log(step, ok, reason=None, prospect_id=None, email_id=None, client_id=None, detail=None):
    try:
        with psycopg.connect(config.DATABASE_URL, autocommit=True) as c:
            c.execute("""INSERT INTO events (step, ok, reason, prospect_id, email_id, client_id, detail)
                         VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)""",
                      (step, ok, (reason or "")[:500] or None, prospect_id, email_id, client_id,
                       json.dumps(detail, default=str) if detail is not None else None))
            if not ok and step in STOPPABLE:
                trip(c, step)
    except psycopg.Error:
        pass  # the log never breaks the step it is logging


def trip(c, step):
    """Stop a step after REPEAT_FAILS failures in a row (oks in between reset it)."""
    rows = c.execute("SELECT ok FROM events WHERE step = %s ORDER BY id DESC LIMIT %s",
                     (step, config.REPEAT_FAILS)).fetchall()
    if len(rows) < config.REPEAT_FAILS or any(r[0] for r in rows):
        return
    if step == "send":
        c.execute("""INSERT INTO settings (key, value) VALUES ('paused', 'true')
                     ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now()""")
    c.execute("""INSERT INTO settings (key, value) VALUES ('stopped', jsonb_build_array(%s::text))
                 ON CONFLICT (key) DO UPDATE SET value = CASE WHEN settings.value ? %s THEN settings.value
                   ELSE settings.value || jsonb_build_array(%s::text) END, updated_at = now()""", (step, step, step))
    c.execute("INSERT INTO events (step, ok, reason) VALUES ('breaker', false, %s)",
              (f"{step} failed {config.REPEAT_FAILS} times in a row, so it stopped until TJ resumes it",))


def stopped(conn):
    return list(db.setting(conn, "stopped", []) or [])


def resume(conn, step):
    conn.execute("""UPDATE settings SET value = coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements_text(value) x
                    WHERE x <> %s), '[]'::jsonb), updated_at = now() WHERE key = 'stopped'""", (step,))
    conn.commit()
    log("breaker", True, f"TJ resumed {step}")


def recent(conn, step=None, failed_only=False, limit=100):
    where, args = [], []
    if step:
        where.append("step = %s")
        args.append(step)
    if failed_only:
        where.append("NOT ok")
    sql = "SELECT * FROM events" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY id DESC LIMIT %s"
    return conn.execute(sql, (*args, limit)).fetchall()


def summary(conn, hours=24):
    rows = conn.execute("""SELECT step, count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS failed
                           FROM events WHERE at > now() - make_interval(hours => %s) GROUP BY step ORDER BY step""",
                        (hours,)).fetchall()
    return {r["step"]: {"ok": r["ok"], "failed": r["failed"]} for r in rows}
