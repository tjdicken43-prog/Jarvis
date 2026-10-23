"""Trades agency API (FastAPI). Run: uvicorn main:app --app-dir money/agency/api

Every route except /health and the public unsubscribe link /u/{token} needs
`Authorization: Bearer $OPERATOR_TOKEN`. Nothing sends without TJ's tap in the Approval Queue.
"""
import datetime as dt
import html
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

import config
import db
import mailer
import outreach

app = FastAPI(title="Trades agency", docs_url=None, redoc_url=None)


def operator(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not config.OPERATOR_TOKEN or not secrets.compare_digest(token, config.OPERATOR_TOKEN):
        raise HTTPException(401, "operator token required")


Conn = Depends(db.get_conn)
op = [Depends(operator)]

ITEM = """
SELECT row_to_json(e.*) AS email, json_build_object(
  'id', p.id, 'name', p.name, 'trade', p.trade, 'city', p.city, 'phone', p.phone, 'email', p.email,
  'website', p.website, 'rating', p.rating, 'review_count', p.review_count, 'site_state', p.site_state,
  'flaw', p.flaw, 'flaw_evidence', p.flaw_evidence, 'mockup_url', p.mockup_url, 'status', p.status) AS prospect
FROM emails e JOIN prospects p ON p.id = e.prospect_id
"""


def item(row):
    email = dict(row["email"])
    token = email.pop("unsub_token")
    return {"email": email, "prospect": row["prospect"], "footer": mailer.footer(token)}


def get_item(conn, email_id):
    row = conn.execute(ITEM + " WHERE e.id = %s", (email_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such email")
    return item(row)


@app.get("/health")
def health(conn=Conn):
    now = dt.datetime.now(dt.timezone.utc)
    return {
        "ok": True, "db": conn.execute("SELECT 1 AS one").fetchone()["one"] == 1,
        "drafter": config.drafter(), "mailer": config.mailer(), "mailing_address_set": bool(config.MAILING_ADDRESS),
        "paused": bool(db.setting(conn, "paused", True)), "sent_today": mailer.sent_today(conn, now),
        "daily_cap": config.DAILY_SEND_CAP, "in_window": mailer.in_window(now),
        "send_window": "Weekdays %d-%dam Central" % config.SEND_WINDOW,
    }


@app.get("/stats", dependencies=op)
def stats(conn=Conn):
    count = lambda t: {r["status"]: r["n"] for r in conn.execute(f"SELECT status, count(*) AS n FROM {t} GROUP BY status")}
    return {"prospects": count("prospects"), "emails": count("emails"),
            "suppressions": conn.execute("SELECT count(*) AS n FROM suppressions").fetchone()["n"]}


@app.get("/queue", dependencies=op)
def queue(status: str = "draft", conn=Conn):
    if status not in {"draft", "approved", "sent", "cancelled", "bounced", "replied"}:
        raise HTTPException(400, "unknown status")
    order = "e.created_at, e.id" if status in {"draft", "approved"} else "coalesce(e.sent_at, e.created_at) DESC, e.id DESC"
    rows = conn.execute(ITEM + f" WHERE e.status = %s ORDER BY {order} LIMIT 200", (status,)).fetchall()
    return {"items": [item(r) for r in rows]}


@app.get("/emails/{email_id}", dependencies=op)
def get_email(email_id: int, conn=Conn):
    return get_item(conn, email_id)


class Edit(BaseModel):
    subject: str | None = Field(default=None, max_length=200)
    body: str | None = Field(default=None, max_length=2000)


@app.patch("/emails/{email_id}", dependencies=op)
def edit_email(email_id: int, edit: Edit, conn=Conn):
    cur = get_item(conn, email_id)
    if cur["email"]["status"] != "draft":
        raise HTTPException(409, "only drafts can be edited")
    subject = (edit.subject if edit.subject is not None else cur["email"]["subject"]).strip()
    body = (edit.body if edit.body is not None else cur["email"]["body"]).strip()
    if not subject or not body:
        raise HTTPException(400, "subject and body can't be empty")
    conn.execute("UPDATE emails SET subject = %s, body = %s, edited = true WHERE id = %s", (subject, body, email_id))
    conn.commit()
    return get_item(conn, email_id)


@app.post("/emails/{email_id}/approve", dependencies=op)
def approve(email_id: int, conn=Conn):
    cur = get_item(conn, email_id)
    if cur["email"]["status"] != "draft":
        raise HTTPException(409, "only drafts can be approved")
    p = cur["prospect"]
    if db.suppressed(conn, p["email"], mailer.host(p["website"])):
        conn.execute("UPDATE emails SET status = 'cancelled' WHERE id = %s", (email_id,))
        conn.execute("UPDATE prospects SET status = 'unsubscribed', updated_at = now() WHERE id = %s", (p["id"],))
        conn.commit()
        raise HTTPException(409, "this shop is on the do-not-email list; draft cancelled")
    problems = outreach.preflight(cur["email"]["subject"], cur["email"]["body"], p)
    if problems:
        raise HTTPException(400, "fix before approving: " + "; ".join(problems))
    now = dt.datetime.now(dt.timezone.utc)
    send_after = mailer.next_window(now)
    conn.execute("UPDATE emails SET status = 'approved', approved_at = %s, send_after = %s WHERE id = %s",
                 (now, send_after, email_id))
    conn.execute("UPDATE prospects SET status = 'approved', updated_at = now() WHERE id = %s", (p["id"],))
    conn.commit()
    when = send_after.astimezone(mailer.CENTRAL).strftime("%a %b %-d, %-I:%M%p Central")
    note = "" if config.mailer() == "smtp" else " Stub mailer is on, so it won't really send."
    return {"item": get_item(conn, email_id), "queued": True, "detail": f"Queued for the send window ({when}).{note}"}


@app.post("/emails/{email_id}/unapprove", dependencies=op)
def unapprove(email_id: int, conn=Conn):
    cur = get_item(conn, email_id)
    if cur["email"]["status"] != "approved":
        raise HTTPException(409, "only approved, unsent emails can go back to draft")
    conn.execute("UPDATE emails SET status = 'draft', approved_at = NULL, send_after = NULL WHERE id = %s", (email_id,))
    conn.execute("UPDATE prospects SET status = 'built', updated_at = now() WHERE id = %s AND status = 'approved'",
                 (cur["prospect"]["id"],))
    conn.commit()
    return get_item(conn, email_id)


@app.post("/emails/{email_id}/cancel", dependencies=op)
def cancel(email_id: int, conn=Conn):
    cur = get_item(conn, email_id)
    if cur["email"]["status"] not in {"draft", "approved"}:
        raise HTTPException(409, "already sent")
    conn.execute("UPDATE emails SET status = 'cancelled' WHERE id = %s", (email_id,))
    conn.execute("UPDATE prospects SET status = 'skip', updated_at = now() WHERE id = %s AND status IN ('checked','built','approved')",
                 (cur["prospect"]["id"],))
    conn.commit()
    return get_item(conn, email_id)


class DraftAsk(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)
    prospect_ids: list[str] | None = None


@app.post("/outreach/draft", dependencies=op)
def draft(ask: DraftAsk, conn=Conn):
    return outreach.draft_first_emails(conn, ask.limit, ask.prospect_ids)


@app.post("/send", dependencies=op)
def send(conn=Conn):
    return mailer.send_due(conn)


class Pause(BaseModel):
    paused: bool


@app.post("/settings/pause", dependencies=op)
def pause(p: Pause, conn=Conn):
    conn.execute("""INSERT INTO settings (key, value, updated_at) VALUES ('paused', %s, now())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()""",
                 ("true" if p.paused else "false",))
    conn.commit()
    return {"paused": p.paused}


@app.get("/suppressions", dependencies=op)
def suppressions(conn=Conn):
    return {"items": conn.execute("SELECT * FROM suppressions ORDER BY created_at DESC, id DESC").fetchall()}


class Suppress(BaseModel):
    email: str | None = None
    domain: str | None = None
    reason: str = Field(default="asked to stop", min_length=1, max_length=200)


def suppress(conn, email, domain, reason):
    """Add to the do-not-email list (never deleted) and stop everything pending for matching shops."""
    email, domain = (email or "").strip().lower() or None, mailer.host(domain) or None
    if not email and not domain:
        raise HTTPException(400, "give an email or a domain")
    conn.execute("INSERT INTO suppressions (email, domain, reason) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                 (email, domain, reason))
    match = """SELECT id FROM prospects WHERE lower(email) = %(e)s OR split_part(lower(email), '@', 2) = %(d)s
               OR split_part(regexp_replace(lower(website), '^(https?://)?(www\\.)?', ''), '/', 1) = %(d)s"""
    ids = [r["id"] for r in conn.execute(match, {"e": email, "d": domain})]
    if ids:
        conn.execute("UPDATE prospects SET status = 'unsubscribed', updated_at = now() WHERE id = ANY(%s)", (ids,))
        conn.execute("UPDATE emails SET status = 'cancelled' WHERE prospect_id = ANY(%s) AND status IN ('draft','approved')", (ids,))
    conn.commit()
    return conn.execute("SELECT * FROM suppressions WHERE lower(email) = %s OR lower(domain) = %s ORDER BY id DESC LIMIT 1",
                        (email, domain)).fetchone()


@app.post("/suppressions", dependencies=op)
def add_suppression(s: Suppress, conn=Conn):
    return suppress(conn, s.email, s.domain, s.reason)


PAGE = """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#1d1d1f">
<p>{msg}</p></body></html>"""


def unsubscribe(token, conn):
    row = conn.execute("SELECT e.prospect_id, p.email FROM emails e JOIN prospects p ON p.id = e.prospect_id "
                       "WHERE e.unsub_token = %s", (token,)).fetchone()
    if not row:
        return HTMLResponse(PAGE.format(msg="That link doesn't match anything we sent. Reply to the email with "
                                            "\"stop\" and we'll take you off by hand."), status_code=404)
    suppress(conn, row["email"], None, "unsubscribed (link)")
    return HTMLResponse(PAGE.format(msg=f"Done. {html.escape(row['email'])} won't get any more emails from "
                                        f"{html.escape(config.SENDER_BUSINESS)}."))


@app.get("/u/{token}", response_class=HTMLResponse)
def unsubscribe_link(token: str, conn=Conn):
    return unsubscribe(token, conn)


@app.post("/u/{token}", response_class=HTMLResponse)
def unsubscribe_one_click(token: str, conn=Conn):  # RFC 8058: mail apps POST here from the List-Unsubscribe header
    return unsubscribe(token, conn)
