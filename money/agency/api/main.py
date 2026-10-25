"""Trades agency API (FastAPI). Run: uvicorn main:app --app-dir money/agency/api

Every route except /health, the public links (/u/, /m/, /shots/, /paid) and the signed Stripe and Vapi webhooks needs
`Authorization: Bearer $OPERATOR_TOKEN`. Nothing sends without TJ's tap in the Approval Queue.
"""
import datetime as dt
import html
import json
import re
import secrets

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from pydantic import BaseModel, Field

import billing
import booking
import calendars
import config
import costs
import db
import demo
import events
import flaws
import followups
import mailer
import mockup
import notices
import outreach
import owner
import quality
import receptionist
import reviews
import shopcfg
import sites
import sms

app = FastAPI(title="Trades agency", docs_url=None, redoc_url=None)


def operator(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not config.OPERATOR_TOKEN or not secrets.compare_digest(token.encode(), config.OPERATOR_TOKEN.encode()):
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


def item(row, founding=False):
    email = dict(row["email"])
    token = email.pop("unsub_token")
    out = {"email": email, "prospect": row["prospect"], "footer": mailer.footer(token)}
    if email["kind"] == "first" and email["status"] in {"draft", "approved"}:
        out["follow_ups"] = followups.preview(row["prospect"], email["subject"], founding)  # approved together with this one
    return out


def get_item(conn, email_id):
    row = conn.execute(ITEM + " WHERE e.id = %s", (email_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such email")
    return item(row, billing.founding_left(conn) > 0)


@app.get("/health")
def health(conn=Conn):
    now = dt.datetime.now(dt.timezone.utc)
    return {
        "ok": True, "db": conn.execute("SELECT 1 AS one").fetchone()["one"] == 1,
        "drafter": config.drafter(), "mailer": config.mailer(), "mailing_address_set": bool(config.MAILING_ADDRESS),
        "paused": bool(db.setting(conn, "paused", True)), "sent_today": mailer.sent_today(conn, now),
        "daily_cap": config.DAILY_SEND_CAP, "in_window": mailer.in_window(now),
        "send_window": "Weekdays %d-%dam Central" % config.SEND_WINDOW, "stripe": config.stripe_mode(),
        "receptionist": config.receptionist(), "vapi_webhook_secret_set": bool(config.VAPI_WEBHOOK_SECRET),
        "textback": config.TEXTBACK, "sms": config.sms(), "transfer_mode": config.TRANSFER_MODE, "notify": config.notifier(), "browser": flaws.browser_status(),
        "owner_page": config.OWNER_PAGE == "on", "calendar_sync": config.calendar_sync(), "fallback": config.FALLBACK,
        "demo_number": config.DEMO_NUMBER or None, "demo_assistant": bool(db.setting(conn, "demo_assistant_id")),
        "operator_email_set": bool(config.OPERATOR_EMAIL), "db_pool": config.DB_POOL,
        "vapi_watch": db.setting(conn, "vapi_watch"),
        "inbox": "imap" if config.mailer() == "smtp" else "stub", "follow_up_days": [d for _, d in followups.STEPS],
        "cap_today": mailer.daily_cap(conn, now)[0], "cap_reason": mailer.daily_cap(conn, now)[1],
        "warmup_started": db.setting(conn, "warmup_started"), "stopped_steps": events.stopped(conn),
        "public_url_ok": config.PUBLIC_URL.startswith("https://"),
        "last_24h": events.summary(conn), "stuck_sending": conn.execute(
            "SELECT count(*) AS n FROM emails WHERE status = 'sending'").fetchone()["n"],
    }


@app.get("/stats", dependencies=op)
def stats(conn=Conn):
    count = lambda t: {r["status"]: r["n"] for r in conn.execute(f"SELECT status, count(*) AS n FROM {t} GROUP BY status")}
    q = conn.execute("""SELECT count(*) FILTER (WHERE status IN ('approved','sending','sent','replied','bounced')) AS approved,
                               count(*) FILTER (WHERE status IN ('approved','sending','sent','replied','bounced') AND NOT edited)
                               AS as_drafted FROM emails WHERE kind = 'first'""").fetchone()
    skips = {r["reason"]: r["n"] for r in conn.execute(
        "SELECT reason, count(*) AS n FROM corrections WHERE kind = 'skip' GROUP BY reason")}
    return {"prospects": count("prospects"), "emails": count("emails"),
            "suppressions": conn.execute("SELECT count(*) AS n FROM suppressions").fetchone()["n"],
            "approved_as_drafted_pct": round(100 * q["as_drafted"] / q["approved"]) if q["approved"] else None,
            "skip_reasons": skips}


@app.get("/queue", dependencies=op)
def queue(status: str = "draft", conn=Conn):
    if status not in {"draft", "approved", "sending", "sent", "failed", "cancelled", "bounced", "replied"}:
        raise HTTPException(400, "unknown status")
    order = "e.created_at, e.id" if status in {"draft", "approved"} else "coalesce(e.sent_at, e.created_at) DESC, e.id DESC"
    rows = conn.execute(ITEM + f" WHERE e.status = %s ORDER BY {order} LIMIT 200", (status,)).fetchall()
    founding = billing.founding_left(conn) > 0
    return {"items": [item(r, founding) for r in rows]}


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
    if (subject, body) == (cur["email"]["subject"], cur["email"]["body"]):
        return get_item(conn, email_id)
    conn.execute("UPDATE emails SET subject = %s, body = %s, edited = true WHERE id = %s", (subject, body, email_id))
    correct(conn, cur, "edit", "edited", None, subject, body)
    conn.commit()
    return get_item(conn, email_id)


SKIP_REASONS = {"wrong_flaw": "Wrong flaw", "weak_mockup": "Weak preview", "tone": "Email doesn't sound right",
                "wrong_shop": "Wrong shop (not a trade, closed, chain)", "bad_fact": "Says something untrue",
                "not_a_fit": "Not a fit right now", "other": "Other"}


def correct(conn, cur, kind, reason, note=None, after_subject=None, after_body=None):
    """Save TJ's correction with what the factory saw, so it can become a test case (evals/freeze.py)."""
    p = conn.execute("SELECT flaw, facts FROM prospects WHERE id = %s", (cur["prospect"]["id"],)).fetchone()
    conn.execute("""INSERT INTO corrections (email_id, prospect_id, kind, reason, note, before_subject, before_body,
                    after_subject, after_body, flaw, signals) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)""",
                 (cur["email"]["id"], cur["prospect"]["id"], kind, reason, note, cur["email"]["subject"],
                  cur["email"]["body"], after_subject, after_body, p["flaw"],
                  json.dumps((p["facts"] or {}).get("signals"))))
    events.log(kind, True, reason + (f": {note}" if note else ""), prospect_id=cur["prospect"]["id"],
               email_id=cur["email"]["id"])


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
    kind = cur["email"]["kind"]
    full = conn.execute("SELECT * FROM prospects WHERE id = %s", (p["id"],)).fetchone()
    if kind == "first" and quality.stale(full):  # evidence, not memory: look at their site again before it goes
        try:
            flaws.find_and_save(conn, p["id"])
        except Exception as e:
            conn.rollback()
            events.log("approve", False, f"couldn't re-check their site: {e}"[:300], prospect_id=p["id"], email_id=email_id)
            raise HTTPException(503, f"couldn't re-check their site before sending ({type(e).__name__}); try again")
        fresh = conn.execute("SELECT * FROM prospects WHERE id = %s", (p["id"],)).fetchone()
        if not fresh["flaw"]:
            conn.execute("UPDATE emails SET status = 'cancelled' WHERE id = %s", (email_id,))
            conn.execute("UPDATE prospects SET status = 'skip', updated_at = now() WHERE id = %s", (p["id"],))
            conn.commit()
            events.log("approve", True, "their site no longer has the flaw; draft cancelled", prospect_id=p["id"], email_id=email_id)
            raise HTTPException(409, "they fixed it: their site no longer has that flaw, so the draft is cancelled")
        if fresh["flaw"] != full["flaw"]:
            events.log("approve", True, f"flaw changed from {full['flaw']} to {fresh['flaw']}", prospect_id=p["id"], email_id=email_id)
            raise HTTPException(409, f"their site changed: the flaw is now \"{fresh['flaw']}\". Tap Redraft, then approve")
        full = fresh
    if missing := quality.contract("approve", full):
        raise HTTPException(400, "not ready: " + "; ".join(missing))
    edited = cur["email"]["edited"]
    problems = outreach.preflight(cur["email"]["subject"], cur["email"]["body"], full, kind, grounded=not edited)
    if problems:
        events.log("approve", False, "; ".join(problems), prospect_id=p["id"], email_id=email_id)
        raise HTTPException(400, "fix before approving: " + "; ".join(problems))
    warnings = quality.grounding(cur["email"]["subject"], cur["email"]["body"], full) if edited and kind == "first" else []
    now = dt.datetime.now(dt.timezone.utc)
    send_after = mailer.next_window(now)
    if kind != "first":  # a follow-up put back to draft and edited still waits for its day
        first = conn.execute("SELECT sent_at FROM emails WHERE prospect_id = %s AND kind = 'first'", (p["id"],)).fetchone()
        if not first or not first["sent_at"]:
            raise HTTPException(409, "the first email hasn't gone out yet")
        send_after = max(send_after, followups.due(first["sent_at"], kind))
    conn.execute("UPDATE emails SET status = 'approved', approved_at = %s, send_after = %s WHERE id = %s",
                 (now, send_after, email_id))
    if kind == "first":
        conn.execute("UPDATE prospects SET status = 'approved', updated_at = now() WHERE id = %s", (p["id"],))
    conn.commit()
    when = send_after.astimezone(mailer.CENTRAL).strftime("%a %b %-d, %-I:%M%p Central")
    note = "" if config.mailer() == "smtp" else " Stub mailer is on, so it won't really send."
    if warnings:  # TJ's own words win, but he sees what the checker couldn't back up
        note += " Check: " + "; ".join(warnings) + "."
    events.log("approve", True, kind, prospect_id=p["id"], email_id=email_id, detail={"warnings": warnings} if warnings else None)
    return {"item": get_item(conn, email_id), "queued": True, "warnings": warnings,
            "detail": f"Queued for the send window ({when}).{note}"}


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


class SkipAsk(BaseModel):
    reason: str
    note: str | None = Field(default=None, max_length=500)


@app.post("/emails/{email_id}/cancel", dependencies=op)
def cancel(email_id: int, ask: SkipAsk, conn=Conn):
    """Skip a shop. The reason is required: it is how the factory learns what TJ won't send."""
    if ask.reason not in SKIP_REASONS:
        raise HTTPException(400, "pick a reason: " + ", ".join(SKIP_REASONS))
    cur = get_item(conn, email_id)
    if cur["email"]["status"] not in {"draft", "approved"}:
        raise HTTPException(409, "already sent")
    correct(conn, cur, "skip", ask.reason, (ask.note or "").strip() or None)
    conn.execute("UPDATE emails SET status = 'cancelled' WHERE id = %s", (email_id,))
    conn.execute("UPDATE prospects SET status = 'skip', updated_at = now() WHERE id = %s AND status IN ('checked','built','approved')",
                 (cur["prospect"]["id"],))
    conn.commit()
    return get_item(conn, email_id)


@app.post("/emails/{email_id}/redraft", dependencies=op)
def redraft(email_id: int, conn=Conn):
    """Write a draft again from what we know now (after the flaw changed, or TJ wants another go)."""
    cur = get_item(conn, email_id)
    if cur["email"]["status"] != "draft" or cur["email"]["kind"] != "first":
        raise HTTPException(409, "only first-email drafts can be redrafted")
    p = conn.execute("SELECT * FROM prospects WHERE id = %s", (cur["prospect"]["id"],)).fetchone()
    try:
        subject, body = (outreach.claude_draft(p, outreach.tj_examples(conn)) if config.drafter() == "claude"
                         else outreach.template_draft(p))
    except Exception as e:
        events.log("draft", False, f"redraft failed: {e}"[:300], prospect_id=p["id"], email_id=email_id)
        raise HTTPException(502, f"redraft failed: {type(e).__name__}")
    if problems := outreach.preflight(subject, body, p):
        events.log("draft", False, "; ".join(problems), prospect_id=p["id"], email_id=email_id)
        raise HTTPException(400, "the new draft didn't pass: " + "; ".join(problems))
    conn.execute("UPDATE emails SET subject = %s, body = %s, edited = false WHERE id = %s", (subject, body, email_id))
    conn.commit()
    events.log("draft", True, "redrafted", prospect_id=p["id"], email_id=email_id)
    return get_item(conn, email_id)


class DraftAsk(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)
    prospect_ids: list[str] | None = None


@app.post("/outreach/draft", dependencies=op)
def draft(ask: DraftAsk, conn=Conn):
    return outreach.draft_first_emails(conn, ask.limit, ask.prospect_ids)


class PrepareAsk(BaseModel):
    limit: int = Field(default=5, ge=1, le=20)
    prospect_ids: list[str] | None = None


@app.post("/outreach/prepare", dependencies=op)
def prepare(ask: PrepareAsk, conn=Conn):
    """Flaw finder + mockup + draft, for shops not drafted yet. Slow: a few seconds a site."""
    return outreach.prepare(conn, ask.limit, ask.prospect_ids)


@app.post("/prospects/{prospect_id:path}/check", dependencies=op)
def check(prospect_id: str, conn=Conn):
    out = flaws.find_and_save(conn, prospect_id)
    if out.get("error"):
        raise HTTPException(404, out["error"])
    return out


@app.post("/prospects/{prospect_id:path}/mockup", dependencies=op)
def build_mockup(prospect_id: str, conn=Conn):
    out = mockup.build_and_save(conn, prospect_id)
    if out.get("error"):
        raise HTTPException(404, out["error"])
    return out


FOUNDING_LINE = re.compile(r'\n?<p class="ofine ofound">.*?</p>', re.S)
NOINDEX = {"X-Robots-Tag": "noindex, nofollow", "Cache-Control": "public, max-age=300"}


@app.get("/m/_/font.woff2")
def mockup_font():
    return FileResponse(mockup.FONT, media_type="font/woff2", headers={"Cache-Control": "public, max-age=31536000"})


@app.get("/m/{slug}", response_class=HTMLResponse)
def mockup_page(slug: str, conn=Conn):  # public: the link in the email
    row = conn.execute("""SELECT m.html FROM mockups m JOIN prospects p ON p.id = m.prospect_id WHERE m.slug = %s
                          AND p.status NOT IN ('unsubscribed', 'skip', 'lost', 'no-email')""", (slug,)).fetchone()
    if not row:  # also gone once they opt out or we skip them
        raise HTTPException(404, "no such preview")
    page = row["html"]
    if billing.founding_left(conn) == 0:  # previews built while spots were open stop offering them once they're gone
        page = FOUNDING_LINE.sub("", page)
    return HTMLResponse(page, headers=NOINDEX)


@app.get("/shots/{token}.png")
def shot(token: str, conn=Conn):  # unguessable link to a screenshot of their own public site
    row = conn.execute("SELECT png FROM shots WHERE token = %s", (token,)).fetchone()
    if not row:
        raise HTTPException(404, "no such screenshot")
    return Response(bytes(row["png"]), media_type="image/png", headers=NOINDEX)


@app.post("/send", dependencies=op)
def send(conn=Conn):
    """Read the inbox first, so a reply or bounce stops its follow-ups before anything goes out."""
    try:
        inbox = followups.check_inbox(conn)
    except Exception as e:  # can't tell who replied: hold the follow-ups, first emails can still go
        conn.rollback()
        inbox = {"error": f"inbox check failed: {type(e).__name__}"}
        events.log("inbox", False, f"inbox check failed: {type(e).__name__}: {e}"[:300])
    out = mailer.send_due(conn, hold_follow_ups=bool(inbox.get("error")))
    return dict(out, inbox=inbox)


@app.post("/outreach/inbox", dependencies=op)
def inbox(conn=Conn):
    return followups.check_inbox(conn)


@app.post("/prospects/{prospect_id:path}/replied", dependencies=op)
def replied(prospect_id: str, conn=Conn):
    """TJ saw a reply: no more follow-ups to this shop. He answers it himself."""
    if not conn.execute("SELECT 1 FROM prospects WHERE id = %s", (prospect_id,)).fetchone():
        raise HTTPException(404, "no such prospect")
    return followups.mark_replied(conn, prospect_id)


@app.post("/prospects/{prospect_id:path}/bounced", dependencies=op)
def bounced(prospect_id: str, conn=Conn):
    """The address bounced: never email it again."""
    if not conn.execute("SELECT 1 FROM prospects WHERE id = %s", (prospect_id,)).fetchone():
        raise HTTPException(404, "no such prospect")
    return followups.mark_bounced(conn, prospect_id, "bounced (marked by TJ)")


class Pause(BaseModel):
    paused: bool


@app.post("/settings/pause", dependencies=op)
def pause(p: Pause, conn=Conn):
    conn.execute("""INSERT INTO settings (key, value, updated_at) VALUES ('paused', %s, now())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()""",
                 ("true" if p.paused else "false",))
    conn.commit()
    return {"paused": p.paused}


class Warmup(BaseModel):
    started: dt.date


@app.post("/settings/warmup", dependencies=op)
def warmup(w: Warmup, conn=Conn):
    """The day the cold inbox started warming up. The daily cap ramps from it (mailer.RAMP)."""
    conn.execute("""INSERT INTO settings (key, value, updated_at) VALUES ('warmup_started', %s::jsonb, now())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()""",
                 (json.dumps(w.started.isoformat()),))
    conn.commit()
    cap, why = mailer.daily_cap(conn, dt.datetime.now(dt.timezone.utc))
    return {"warmup_started": w.started.isoformat(), "cap_today": cap, "detail": why,
            "ramp": [{"from_day": (mailer.RAMP[i - 1][0] if i else 0) + 1, "per_day": n} for i, (_, n) in enumerate(mailer.RAMP)]
            + [{"from_day": mailer.RAMP[-1][0] + 1, "per_day": min(mailer.RAMP_AFTER, config.DAILY_SEND_CAP)}]}


class Resume(BaseModel):
    step: str


@app.post("/settings/resume", dependencies=op)
def resume_step(r: Resume, conn=Conn):
    """TJ looked at the log: let a stopped step run again. Sending also needs its own unpause."""
    if r.step not in events.stopped(conn):
        raise HTTPException(409, f"{r.step} isn't stopped")
    events.resume(conn, r.step)
    return {"stopped_steps": events.stopped(conn)}


@app.get("/events", dependencies=op)
def event_log(step: str | None = None, failed: bool = False, limit: int = 100, conn=Conn):
    return {"items": events.recent(conn, step, failed, min(max(limit, 1), 500)), "last_24h": events.summary(conn),
            "stopped_steps": events.stopped(conn)}


@app.get("/corrections", dependencies=op)
def corrections(conn=Conn):
    return {"items": conn.execute("SELECT * FROM corrections ORDER BY id DESC LIMIT 200").fetchall(),
            "reasons": SKIP_REASONS}


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
        conn.execute("UPDATE prospects SET status = 'unsubscribed', updated_at = now() WHERE id = ANY(%s) AND status <> 'won'", (ids,))
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


CONFIRM = PAGE.replace("<p>{msg}</p>", """<p>Stop all emails from {who}?</p>
<form method="post"><button style="font:inherit;padding:.6rem 1.2rem;border:1px solid #1d1d1f;border-radius:4px;
background:#1d1d1f;color:#fff">Unsubscribe</button></form>""")


@app.get("/u/{token}", response_class=HTMLResponse)
def unsubscribe_link(token: str, conn=Conn):
    """A button, not an instant opt-out: mail scanners open links on their own. Mail apps' one-click POST still works."""
    if not conn.execute("SELECT 1 FROM emails WHERE unsub_token = %s", (token,)).fetchone():
        return unsubscribe(token, conn)
    return HTMLResponse(CONFIRM.format(who=html.escape(config.SENDER_BUSINESS)))


@app.post("/u/{token}", response_class=HTMLResponse)
def unsubscribe_one_click(token: str, conn=Conn):  # RFC 8058: mail apps POST here from the List-Unsubscribe header
    return unsubscribe(token, conn)


# Step 4-5: clients, Stripe checkout (test mode), overage, matchmaking leads (display only)

CLIENT_COLS = """id, prospect_id, business_name, contact_name, email, phone, trade, plan, billing, setup_cents,
  monthly_cents, included_minutes, status, site_url, receptionist_number, checkout_url, started_at, cancelled_at,
  created_at, stripe_customer_id IS NOT NULL AS has_stripe, open_hour, close_hour, open_saturday, textback_enabled,
  vapi_assistant_id IS NOT NULL AS has_receptionist, notify_email, owner_cell, summary_hour, booking, calendar_token, review_url,
  test_call_at, forwarding_confirmed_at, hours_confirmed_at, live_at, founding_no, profile,
  calendar->>'provider' AS calendar_provider, owner_token"""


def client_view(c, used):
    u = used.get(c["id"], {})
    minutes = u.get("minutes", 0)
    founding = bool(c["founding_no"])
    over, cents = billing.overage(minutes, c["included_minutes"], founding)
    c = dict(c)
    token = c.pop("calendar_token", None)
    c["owner_url"] = owner.url(c.pop("owner_token", None)) if config.OWNER_PAGE == "on" else None
    golive = {"paying": c["status"] in ("active", "past_due"), "receptionist_built": c["has_receptionist"],
              "test_call": bool(c["test_call_at"]), "forwarding": bool(c["forwarding_confirmed_at"]),
              "hours": bool(c["hours_confirmed_at"])}
    return dict(c, calendar_url=booking.calendar_url(token), golive=golive,
                golive_missing=[k for k, v in golive.items() if not v], minutes_used=minutes, calls=u.get("calls", 0),
                after_hours_calls=u.get("after_hours", 0),
                missed_calls=u.get("missed", 0), over_minutes=over, overage_cents=cents,
                price_cents=billing.price_cents(c["plan"], c["billing"], founding),
                monthly_value_cents=billing.monthly_value_cents(c["plan"], c["billing"], founding))


def get_client(conn, client_id):
    row = conn.execute(f"SELECT {CLIENT_COLS} FROM clients WHERE id = %s", (client_id,)).fetchone()
    if not row:
        raise HTTPException(404, "no such client")
    return row


@app.get("/clients", dependencies=op)
def clients(conn=Conn):
    label, start, end = billing.month_bounds()
    used = billing.usage(conn, start, end)
    rows = conn.execute(f"""SELECT {CLIENT_COLS} FROM clients ORDER BY
        array_position(ARRAY['active','past_due','pending','cancelled'], status), business_name""").fetchall()
    items = [client_view(c, used) for c in rows]
    paying = [c for c in items if c["status"] in ("active", "past_due")]
    return {"month": label, "stripe": config.stripe_mode(), "items": items,
            "summary": {"active": sum(c["status"] == "active" for c in items),
                        "past_due": sum(c["status"] == "past_due" for c in items),
                        "pending": sum(c["status"] == "pending" for c in items),
                        "mrr_cents": sum(c["monthly_value_cents"] for c in paying),
                        "overage_cents": sum(c["overage_cents"] for c in paying),
                        "founding_left": billing.founding_left(conn), "founding_slots": billing.FOUNDING_SLOTS},
            "costs": costs.month(conn, label),
            "plans": billing.PLANS, "setup_cents": billing.SETUP_CENTS,
            "overage_cents_per_min": billing.OVERAGE_CENTS_PER_MIN}


@app.get("/costs", dependencies=op)
def month_costs(month: str | None = None, conn=Conn):
    """Real cost and margin per paying client for a month (YYYY-MM, default this month)."""
    if month and not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(400, "month must be YYYY-MM")
    return costs.month(conn, month)


@app.get("/payments", dependencies=op)
def payments(since: str | None = None, conn=Conn):
    """Paid invoices as rows for money/tax/income.csv (python3 money/tax/tax.py import FILE). Dates in Central."""
    if since and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", since):
        raise HTTPException(400, "since must be YYYY-MM-DD")
    rows = conn.execute("""SELECT p.*, (p.paid_at AT TIME ZONE 'America/Chicago')::date AS day, c.business_name
                           FROM payments p LEFT JOIN clients c ON c.id = p.client_id
                           WHERE %s::date IS NULL OR (p.paid_at AT TIME ZONE 'America/Chicago')::date >= %s::date
                           ORDER BY p.paid_at""", (since, since)).fetchall()
    out = []
    for r in rows:
        base = {"date": r["day"].isoformat(), "client": r["business_name"] or str(r["client_id"]), "note": r["stripe_invoice_id"]}
        monthly = r["amount_cents"] - r["tax_cents"] - r["setup_cents"]
        if r["setup_cents"]:
            out.append(dict(base, item="setup", amount=r["setup_cents"] / 100, sales_tax=0))
        if monthly > 0:
            out.append(dict(base, item="receptionist", amount=monthly / 100, sales_tax=r["tax_cents"] / 100))
    return {"items": out}


class NewClient(BaseModel):
    prospect_id: str | None = None
    business_name: str | None = Field(default=None, max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    trade: str | None = None
    plan: str = "front_desk"
    billing: str = "monthly"


def check_plan(plan, bill):
    if plan not in billing.PLANS:
        raise HTTPException(400, "plan must be front_desk or front_desk_plus")
    if bill not in billing.BILLING:
        raise HTTPException(400, "billing must be monthly or annual")


@app.post("/clients", dependencies=op)
def add_client(n: NewClient, conn=Conn):
    """A shop that said yes. Starts pending; the Stripe webhook makes it active."""
    check_plan(n.plan, n.billing)
    p = {}
    if n.prospect_id:
        p = conn.execute("SELECT * FROM prospects WHERE id = %s", (n.prospect_id,)).fetchone()
        if not p:
            raise HTTPException(404, "no such prospect")
        if conn.execute("SELECT 1 FROM clients WHERE prospect_id = %s", (n.prospect_id,)).fetchone():
            raise HTTPException(409, "that shop is already a client")
    name = (n.business_name or p.get("name") or "").strip()
    email = (n.email or p.get("email") or "").strip().lower()
    trade = n.trade or p.get("trade")
    if not name or "@" not in email:
        raise HTTPException(400, "business name and email are needed")
    if trade not in ("plumbing", "hvac", "roofing"):
        raise HTTPException(400, "trades only: plumbing, hvac or roofing")
    plan = billing.PLANS[n.plan]
    row = conn.execute("""INSERT INTO clients (prospect_id, business_name, contact_name, email, phone, trade, plan,
                          billing, setup_cents, monthly_cents, included_minutes, site_url)
                          VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                       (n.prospect_id, name, n.contact_name, email, n.phone or p.get("phone"), trade, n.plan,
                        n.billing, billing.SETUP_CENTS, plan["monthly_cents"], plan["minutes"],
                        p.get("mockup_url"))).fetchone()
    if n.prospect_id:  # they said yes: no more cold follow-ups
        conn.execute("UPDATE emails SET status = 'cancelled' WHERE prospect_id = %s AND status IN ('draft','approved')",
                     (n.prospect_id,))
    conn.commit()
    events.log("client", True, "added", prospect_id=n.prospect_id, client_id=row["id"])
    return get_client(conn, row["id"])


class CheckoutAsk(BaseModel):
    plan: str = "front_desk"
    billing: str = "monthly"


@app.post("/clients/{client_id}/checkout", dependencies=op)
def checkout(client_id: int, ask: CheckoutAsk, conn=Conn):
    """Stripe Checkout link for TJ to send: plan + $299 setup. Test keys only unless live is explicitly allowed."""
    check_plan(ask.plan, ask.billing)
    c = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
    if not c:
        raise HTTPException(404, "no such client")
    if c["status"] != "pending":
        raise HTTPException(409, "already paying; change plans in Stripe")
    mode = config.stripe_mode()
    if mode not in ("test", "live"):
        raise HTTPException(503, {"off": "Stripe is off: set STRIPE_SECRET_KEY (sk_test_...) on Render",
                                  "blocked": "live Stripe key refused: test keys only until TJ says go live"}[mode])
    plan = billing.PLANS[ask.plan]
    conn.execute("UPDATE clients SET plan = %s, billing = %s, monthly_cents = %s, included_minutes = %s WHERE id = %s",
                 (ask.plan, ask.billing, plan["monthly_cents"], plan["minutes"], client_id))
    c = dict(c, plan=ask.plan, billing=ask.billing)
    try:
        s = billing.checkout_session(c)
    except billing.StripeError as e:
        conn.rollback()
        raise HTTPException(502, f"Stripe: {e}")
    conn.execute("UPDATE clients SET checkout_url = %s, checkout_session_id = %s WHERE id = %s",
                 (s["url"], s["id"], client_id))
    conn.commit()
    return {"url": s["url"], "mode": mode, "client": get_client(conn, client_id)}


@app.post("/stripe/webhook")
async def stripe_webhook(request: Request, conn=Conn):  # public, but only signed Stripe events get through
    payload = await request.body()
    try:
        event = billing.verify(payload, request.headers.get("stripe-signature", ""), config.STRIPE_WEBHOOK_SECRET)
    except (ValueError, KeyError) as e:
        raise HTTPException(400, f"webhook rejected: {e}")
    return billing.handle_event(conn, event)


class OverageAsk(BaseModel):
    month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


@app.post("/billing/overage", dependencies=op)
def overage(ask: OverageAsk, conn=Conn):
    """Bill minutes over the plan for a month (default: last month). Run once early each month."""
    month = ask.month
    if not month:
        label, start, _ = billing.month_bounds()
        month = billing.month_bounds(None, start - dt.timedelta(days=1))[0]
    return billing.bill_overage(conn, month)


PAID = PAGE.replace("<title>Unsubscribed</title>", "<title>Thank you</title>")


@app.get("/paid", response_class=HTMLResponse)
def paid(cancelled: int = 0):  # where Stripe Checkout sends the shop back
    if cancelled:
        return HTMLResponse(PAID.format(msg="No charge was made. Reply to the email if you have a question."))
    return HTMLResponse(PAID.format(msg=f"Payment received, thank you. {html.escape(config.SENDER_BUSINESS)} "
                                        "will be in touch to set up your receptionist."))


@app.get("/leads", dependencies=op)
def leads(conn=Conn):
    """Matchmaking leads, display only: no matching or charging until the Arkansas license question is checked."""
    rows = conn.execute("""SELECT l.id, l.customer_name, l.zip, l.trade, l.job_description, l.urgency, l.source,
                           l.status, l.job_value_cents, l.commission_pct, l.commission_cents, l.created_at,
                           c.business_name AS matched_to
                           FROM leads l LEFT JOIN clients c ON c.id = l.matched_client_id
                           ORDER BY l.created_at DESC, l.id DESC LIMIT 200""").fetchall()
    count = {r["status"]: r["n"] for r in conn.execute("SELECT status, count(*) AS n FROM leads GROUP BY status")}
    return {"display_only": True, "note": "Display only until the Arkansas license question is checked.",
            "items": rows, "counts": count}


# Step 7: AI receptionist (Vapi). Usage lands in receptionist_calls, which /clients and overage billing read.

class ReceptionistAsk(BaseModel):
    open_hour: int = Field(default=7, ge=0, le=23)
    close_hour: int = Field(default=17, ge=1, le=24)
    open_saturday: bool = False
    textback_enabled: bool = False
    receptionist_number: str | None = Field(default=None, max_length=40)
    owner_cell: str | None = Field(default=None, max_length=40)   # "" clears it; set = emergencies get a live transfer


@app.post("/clients/{client_id}/receptionist", dependencies=op)
def set_up_receptionist(client_id: int, ask: ReceptionistAsk, conn=Conn):
    """Save the shop's hours and create or update its Vapi assistant (dry run without VAPI_API_KEY). Places no calls."""
    if ask.close_hour <= ask.open_hour:
        raise HTTPException(400, "closing hour must be after opening hour")
    number = (ask.receptionist_number or "").strip() or None
    if number and not receptionist.digits(number):
        raise HTTPException(400, "receptionist number needs 10 digits")
    cell = None if ask.owner_cell is None else receptionist.digits(ask.owner_cell)
    if ask.owner_cell and not cell:
        raise HTTPException(400, "owner cell needs 10 digits")
    if get_client(conn, client_id)["status"] not in ("active", "past_due"):
        raise HTTPException(409, "set up the receptionist after they pay (client is not active)")
    if number and conn.execute("""SELECT 1 FROM clients WHERE id <> %s AND right(regexp_replace(coalesce(receptionist_number,
                                  ''), '\\D', '', 'g'), 10) = %s""", (client_id, receptionist.digits(number))).fetchone():
        raise HTTPException(409, "another client already has that receptionist number")
    conn.execute("""UPDATE clients SET open_hour = %s, close_hour = %s, open_saturday = %s, textback_enabled = %s,
                    profile = profile - 'hours',  -- the simple hours replace any per-day hours
                    receptionist_number = coalesce(%s, receptionist_number),
                    owner_cell = CASE WHEN %s::boolean THEN %s ELSE owner_cell END WHERE id = %s""",
                 (ask.open_hour, ask.close_hour, ask.open_saturday, ask.textback_enabled, number,
                  cell is not None, cell or None, client_id))
    c = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
    try:
        out = receptionist.set_up(conn, c)
    except receptionist.VapiError as e:
        conn.rollback()
        events.log("receptionist", False, f"Vapi: {e}"[:300], client_id=client_id)
        raise HTTPException(502, f"Vapi: {e}")
    conn.execute("UPDATE clients SET hours_confirmed_at = NULL, live_at = NULL WHERE id = %s", (client_id,))  # new hours: confirm again
    conn.commit()
    events.log("receptionist", True, f"set up ({out['mode']})", client_id=client_id)
    return dict(out, client=client_view(get_client(conn, client_id), {}))


@app.get("/clients/{client_id}/calls", dependencies=op)
def client_calls(client_id: int, conn=Conn):
    get_client(conn, client_id)
    return {"items": conn.execute("""SELECT r.id, r.started_at, r.seconds, r.after_hours, r.outcome, r.summary,
        r.ended_reason, r.caller_name, r.callback_number, r.caller_number, r.town, r.problem, r.emergency,
        r.urgent_by, r.language, r.answers, r.source, r.handled_at,
        r.recording_url, r.transcript, t.status AS textback FROM receptionist_calls r LEFT JOIN textbacks t ON t.call_id = r.id
        WHERE r.client_id = %s ORDER BY r.started_at DESC LIMIT 100""", (client_id,)).fetchall()}


def after_call():
    """Runs after Vapi has its answer: owner emails queued during the call, then calendar pushes. Own connection."""
    try:
        with db.connect() as conn:
            if config.notifier() == "smtp":
                notices.flush(conn)
            calendars.sync_all(conn)
    except Exception as e:  # noqa: BLE001  (the cron retries; a background failure must never surface to Vapi)
        events.log("after_call", False, str(e)[:300])


@app.post("/vapi/webhook")
async def vapi_webhook(request: Request, tasks: BackgroundTasks, conn=Conn):  # public, only with our Vapi secret
    if not config.VAPI_WEBHOOK_SECRET:
        raise HTTPException(503, "receptionist webhook is off: set VAPI_WEBHOOK_SECRET")
    if not receptionist.secret_ok(request.headers.get("x-vapi-secret")):
        raise HTTPException(401, "bad secret")
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(400, "not JSON")
    out = receptionist.handle(conn, payload if isinstance(payload, dict) else {})
    if out.get("emergency_alert") == "queued" or any("Booked" in (r.get("result") or "") for r in out.get("results", [])):
        tasks.add_task(after_call)
    return out


# Go-live: a receptionist counts as live only after a real test call landed here, TJ called the shop's own line
# after hours and reached it, and the shop OK'd the hours. Then TJ spot-checks real calls for the first month.

GOLIVE = {"forwarding": "forwarding_confirmed_at", "hours": "hours_confirmed_at"}


class GoLiveStep(BaseModel):
    step: str
    done: bool = True


@app.post("/clients/{client_id}/golive", dependencies=op)
def golive_step(client_id: int, g: GoLiveStep, conn=Conn):
    if g.step not in GOLIVE:
        raise HTTPException(400, "step must be forwarding or hours (the test call is ticked by the call itself)")
    get_client(conn, client_id)
    conn.execute(f"UPDATE clients SET {GOLIVE[g.step]} = {'now()' if g.done else 'NULL'} WHERE id = %s", (client_id,))
    if not g.done:
        conn.execute("UPDATE clients SET live_at = NULL WHERE id = %s", (client_id,))
    conn.commit()
    events.log("golive", True, f"{g.step} {'confirmed' if g.done else 'unticked'}", client_id=client_id)
    return client_view(get_client(conn, client_id), {})


@app.post("/clients/{client_id}/live", dependencies=op)
def go_live(client_id: int, conn=Conn):
    c = client_view(get_client(conn, client_id), {})
    if c["golive_missing"]:
        events.log("golive", False, "not ready: " + ", ".join(c["golive_missing"]), client_id=client_id)
        raise HTTPException(409, "not ready to go live: " + ", ".join(c["golive_missing"]))
    conn.execute("UPDATE clients SET live_at = coalesce(live_at, now()) WHERE id = %s", (client_id,))
    conn.commit()
    events.log("golive", True, "live", client_id=client_id)
    return client_view(get_client(conn, client_id), {})


@app.get("/calls/to-review", dependencies=op)
def calls_to_review(conn=Conn):
    """Up to 3 calls a week per client in its first 30 days live, for TJ to listen to."""
    return {"items": conn.execute("""SELECT * FROM (
        SELECT r.id, r.client_id, c.business_name, r.started_at, r.seconds, r.outcome, r.summary,
               row_number() OVER (PARTITION BY r.client_id ORDER BY r.started_at DESC) AS n
        FROM receptionist_calls r JOIN clients c ON c.id = r.client_id
        WHERE c.live_at > now() - interval '30 days' AND r.started_at > now() - interval '7 days'
          AND r.reviewed_at IS NULL AND r.outcome <> 'spam') x WHERE n <= 3 ORDER BY started_at DESC""").fetchall()}


class CallReview(BaseModel):
    ok: bool
    note: str | None = Field(default=None, max_length=500)


@app.post("/calls/{call_id}/review", dependencies=op)
def review_call(call_id: int, r: CallReview, conn=Conn):
    row = conn.execute("""UPDATE receptionist_calls SET reviewed_at = now(), review_ok = %s, review_note = %s
                          WHERE id = %s RETURNING client_id""", (r.ok, r.note, call_id)).fetchone()
    if not row:
        raise HTTPException(404, "no such call")
    conn.commit()
    events.log("call_review", r.ok, r.note or ("good call" if r.ok else "bad call"), client_id=row["client_id"],
               detail={"call_id": call_id})
    return {"call_id": call_id, "ok": r.ok}


class OptOut(BaseModel):
    number: str = Field(max_length=40)


@app.post("/sms/optouts", dependencies=op)
def sms_opt_out(o: OptOut, conn=Conn):
    """A caller replied STOP: never text them again. Typed in by hand until an SMS provider posts these."""
    num = receptionist.opt_out(conn, o.number)
    if not num:
        raise HTTPException(400, "number needs 10 digits")
    return {"number": num, "opted_out": True}


@app.post("/sms/inbound")
async def sms_inbound(request: Request, conn=Conn):  # public: Twilio posts STOP/START/HELP here, signed with our auth token
    form = {k: str(v) for k, v in (await request.form()).items()}
    url = config.PUBLIC_URL + "/sms/inbound"
    if not config.TWILIO_AUTH_TOKEN:
        raise HTTPException(503, "inbound texts are off: set TWILIO_AUTH_TOKEN")
    if not sms.signature_ok(url, form, request.headers.get("x-twilio-signature")):
        raise HTTPException(401, "bad signature")
    return Response(sms.inbound(conn, form, receptionist), media_type="application/xml")


# Step 9: what the demos sell. Owner emails (urgent heads-up, bookings, morning summary), Plus booking + calendar feed,
# Plus review requests, and the live site. Emails are stubs until NOTIFY=smtp; texts stay stubs (no SMS provider).
def client_row(conn, client_id):
    c = conn.execute("SELECT * FROM clients WHERE id = %s", (client_id,)).fetchone()
    if not c:
        raise HTTPException(404, "no such client")
    return c


class OwnerAsk(BaseModel):
    notify_email: str | None = Field(default=None, max_length=200)
    summary_hour: int | None = Field(default=None, ge=4, le=11)
    review_url: str | None = Field(default=None, max_length=300)


@app.post("/clients/{client_id}/owner", dependencies=op)
def owner_settings(client_id: int, ask: OwnerAsk, conn=Conn):
    """Where the owner's emails go, when the morning summary lands (Central), and the shop's Google review link."""
    c = client_row(conn, client_id)
    email = c["notify_email"] if ask.notify_email is None else (ask.notify_email.strip().lower() or None)
    if email and "@" not in email:
        raise HTTPException(400, "that email doesn't look right")
    url = c["review_url"] if ask.review_url is None else (ask.review_url.strip() or None)
    if url and not url.startswith("https://"):
        raise HTTPException(400, "the review link must start with https://")
    conn.execute("UPDATE clients SET notify_email = %s, summary_hour = %s, review_url = %s WHERE id = %s",
                 (email, ask.summary_hour if ask.summary_hour is not None else c["summary_hour"], url, client_id))
    conn.commit()
    return client_view(get_client(conn, client_id), {})


class BookingAsk(BaseModel):
    enabled: bool = True
    windows: list[int] | None = None
    length: int | None = None
    per_window: int | None = None
    days_ahead: int | None = None
    lead_hours: int | None = None


@app.post("/clients/{client_id}/booking", dependencies=op)
def booking_settings(client_id: int, ask: BookingAsk, conn=Conn):
    """Plus only: turn booking on or off and set the visit windows. Updates the Vapi assistant (dry run without a key)."""
    c = client_row(conn, client_id)
    if ask.enabled and c["plan"] != "front_desk_plus":
        raise HTTPException(409, "calendar booking comes with Front Desk Plus")
    if ask.enabled:
        try:
            b = booking.validate(c, ask.model_dump(exclude={"enabled"}))
        except booking.BookingError as e:
            raise HTTPException(400, str(e))
        token = booking.calendar_token(conn, c)
    else:
        b, token = None, c["calendar_token"]
    conn.execute("UPDATE clients SET booking = %s WHERE id = %s", (db.Json(b) if b else None, client_id))
    c = client_row(conn, client_id)
    try:
        out = receptionist.set_up(conn, c)
    except receptionist.VapiError as e:
        conn.rollback()
        raise HTTPException(502, f"Vapi: {e}")
    conn.commit()
    return {"mode": out["mode"], "booking": b, "calendar_url": booking.calendar_url(token),
            "tools": [t["function"]["name"] for t in out["assistant"]["model"].get("tools", [])]}


@app.get("/clients/{client_id}/openings", dependencies=op)
def client_openings(client_id: int, conn=Conn):
    c = client_row(conn, client_id)
    if not booking.enabled(c):
        return {"items": [], "detail": "booking is off"}
    return {"items": [{"start": s, "end": e, "label": booking.label(s, e), "id": booking.slot_id(s)}
                      for s, e in booking.openings(conn, c)]}


@app.get("/clients/{client_id}/bookings", dependencies=op)
def client_bookings(client_id: int, conn=Conn):
    client_row(conn, client_id)
    return {"items": conn.execute("""SELECT b.*, r.status AS review FROM bookings b LEFT JOIN review_requests r
        ON r.booking_id = b.id WHERE b.client_id = %s ORDER BY b.window_start DESC LIMIT 100""", (client_id,)).fetchall()}


class BookingStatus(BaseModel):
    status: str = Field(pattern="^(booked|cancelled|done)$")
    customer_email: str | None = Field(default=None, max_length=200)
    ask_for_review: bool = True


@app.post("/bookings/{booking_id}", dependencies=op)
def set_booking(booking_id: int, ask: BookingStatus, conn=Conn):
    """Mark a visit done (queues the Plus review ask), cancelled, or back to booked."""
    b = conn.execute("SELECT * FROM bookings WHERE id = %s", (booking_id,)).fetchone()
    if not b:
        raise HTTPException(404, "no such booking")
    email = (ask.customer_email or "").strip().lower() or b["customer_email"]
    conn.execute("UPDATE bookings SET status = %s, customer_email = %s, updated_at = now() WHERE id = %s",
                 (ask.status, email, booking_id))
    review = None
    if ask.status == "done" and ask.ask_for_review and not conn.execute(
            "SELECT 1 FROM review_requests WHERE booking_id = %s", (booking_id,)).fetchone():
        try:
            r = reviews.queue(conn, client_row(conn, b["client_id"]), b["customer_name"], b["callback_number"], email,
                              b["ok_to_text"], booking_id)
            review = {"queued": True, "channel": r["channel"], "send_after": r["send_after"]}
        except reviews.ReviewError as e:
            review = {"queued": False, "reason": str(e)}
    conn.commit()
    return {"booking": conn.execute("SELECT * FROM bookings WHERE id = %s", (booking_id,)).fetchone(), "review": review}


@app.get("/cal/{token}.ics")
def calendar_feed(token: str, conn=Conn):  # public, unguessable: the owner's phone calendar subscribes to it
    c = conn.execute("SELECT * FROM clients WHERE calendar_token = %s", (token,)).fetchone()
    if not c:
        raise HTTPException(404, "no such calendar")
    return Response(booking.ics(conn, c), media_type="text/calendar; charset=utf-8",
                    headers={"Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex"})


@app.get("/clients/{client_id}/notices", dependencies=op)
def client_notices(client_id: int, conn=Conn):
    client_row(conn, client_id)
    return {"mode": config.notifier(), "items": conn.execute("""SELECT id, kind, day, to_email, subject, body, status,
        error, created_at FROM owner_notices WHERE client_id = %s ORDER BY created_at DESC, id DESC LIMIT 50""",
                                                             (client_id,)).fetchall()}


class ReviewAsk(BaseModel):
    customer_name: str = Field(min_length=1, max_length=80)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    ok_to_text: bool = False


@app.post("/clients/{client_id}/review-requests", dependencies=op)
def add_review_request(client_id: int, ask: ReviewAsk, conn=Conn):
    """By hand, for a job that didn't come through Front Desk. Same rules: one ask, everyone asked, texts only with a yes."""
    try:
        r = reviews.queue(conn, client_row(conn, client_id), ask.customer_name, ask.phone, ask.email, ask.ok_to_text)
    except reviews.ReviewError as e:
        raise HTTPException(400, str(e))
    conn.commit()
    return r


@app.get("/clients/{client_id}/review-requests", dependencies=op)
def list_review_requests(client_id: int, conn=Conn):
    client_row(conn, client_id)
    return {"items": conn.execute("""SELECT id, booking_id, customer_name, channel, status, detail, send_after, sent_at,
        created_at FROM review_requests WHERE client_id = %s ORDER BY created_at DESC, id DESC LIMIT 100""",
                                  (client_id,)).fetchall()}


@app.post("/frontdesk/run", dependencies=op)
def frontdesk_run(conn=Conn):
    """The cron's job every 15 minutes: morning summaries that are due, then review asks that are due."""
    queued = notices.flush(conn) if config.notifier() == "smtp" else []
    s, r = notices.run_summaries(conn), reviews.send_due(conn)
    cal, vapi = calendars.sync_all(conn), receptionist.watch(conn)
    return {"mode": config.notifier(), "summaries": s["summaries"], "reviews": r["done"], "queued_sent": queued,
            "calendars": cal, "vapi": vapi,
            "detail": f"{len(s['summaries'])} summaries, {len(r['done'])} review asks, {len(queued)} queued, "
                      f"{len(cal)} calendars, vapi {vapi} ({config.notifier()})"}


class SiteAsk(BaseModel):
    domain: str | None = Field(default=None, max_length=200)


@app.post("/clients/{client_id}/site", dependencies=op)
def publish_site(client_id: int, ask: SiteAsk, conn=Conn):
    """Publish (or rebuild) the client's live site from their preview facts. Same site bar audit, indexable."""
    try:
        domain = sites.domain_of(ask.domain) if ask.domain is not None else None
    except ValueError as e:
        raise HTTPException(400, str(e))
    if domain and conn.execute("SELECT 1 FROM client_sites WHERE domain = %s AND client_id <> %s",
                               (domain, client_id)).fetchone():
        raise HTTPException(409, "another client has that domain")
    out = sites.publish(conn, client_row(conn, client_id), domain)
    if not out["published"]:
        raise HTTPException(400, "can't publish: " + "; ".join(out["problems"]))
    return out


LIVE = {"Cache-Control": "public, max-age=300"}


@app.get("/s/{slug}", response_class=HTMLResponse)
def live_site(slug: str, conn=Conn):  # public: the client's live site before their own domain points here
    row = conn.execute("SELECT html FROM client_sites WHERE slug = %s", (slug,)).fetchone()
    if not row:
        raise HTTPException(404, "no such site")
    return HTMLResponse(row["html"], headers=LIVE)


THANKS = PAGE.replace("<title>Unsubscribed</title>", "<title>Request sent</title>")


@app.post("/s/{slug}/request", response_class=HTMLResponse)
async def site_request(slug: str, request: Request, conn=Conn):  # public: the live site's quote form
    site = conn.execute("""SELECT s.domain, s.slug, c.* FROM client_sites s JOIN clients c ON c.id = s.client_id
                           WHERE s.slug = %s""", (slug,)).fetchone()
    if not site:
        raise HTTPException(404, "no such site")
    back = f"https://{site['domain']}" if site["domain"] else f"{config.PUBLIC_URL}/s/{slug}"
    link = f' <a href="{html.escape(back)}">Back to {html.escape(site["business_name"])}</a>.'
    try:
        form = await request.form(max_files=sites.MAX_PHOTOS + 2, max_part_size=sites.MAX_PHOTO_BYTES + 1024)
    except Exception:
        return HTMLResponse(THANKS.format(msg="That didn't go through (photos must be under 5 MB). Please try again or "
                                              "call us." + link), status_code=400)
    fields = {k: v for k, v in form.items() if isinstance(v, str)}
    photos = [(f.content_type or "", await f.read(sites.MAX_PHOTO_BYTES + 1)) for f in form.getlist("photos")
              if isinstance(f, UploadFile) or hasattr(f, "read")]
    try:
        r = sites.save_request(conn, site, fields, photos)
    except sites.RequestError as e:
        return HTMLResponse(THANKS.format(msg=html.escape(str(e)) + link), status_code=400)
    if r:
        notices.web_request(conn, site, r)
        conn.commit()
    return HTMLResponse(THANKS.format(msg=f"Thanks. {html.escape(site['business_name'])} has your request and will call "
                                          "you back." + link))


@app.get("/p/{token}")
def request_photo(token: str, conn=Conn):  # unguessable link in the owner's email
    row = conn.execute("SELECT content_type, data FROM site_request_photos WHERE token = %s", (token,)).fetchone()
    if not row:
        raise HTTPException(404, "no such photo")
    return Response(bytes(row["data"]), media_type=row["content_type"],
                    headers={"Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex"})


@app.get("/clients/{client_id}/requests", dependencies=op)
def client_requests(client_id: int, conn=Conn):
    client_row(conn, client_id)
    return {"items": conn.execute("""SELECT r.*, count(p.token) AS photos FROM site_requests r LEFT JOIN site_request_photos p
        ON p.request_id = r.id WHERE r.client_id = %s GROUP BY r.id ORDER BY r.created_at DESC LIMIT 100""",
                                  (client_id,)).fetchall()}


# Pro pass (2026-10-25): per-client profile, owner page, two-way calendar, demo line.

def rebuild(conn, client_id):
    """Rebuild the client's Vapi assistant after a settings change (dry run without a key). Rolls back on a Vapi error."""
    c = client_row(conn, client_id)
    if c["status"] not in ("active", "past_due") and not c["vapi_assistant_id"]:
        conn.commit()
        return {"mode": "saved", "detail": "saved; the assistant is built after they pay"}
    try:
        out = receptionist.set_up(conn, c)
    except receptionist.VapiError as e:
        conn.rollback()
        events.log("receptionist", False, f"Vapi: {e}"[:300], client_id=client_id)
        raise HTTPException(502, f"Vapi: {e}")
    conn.commit()
    return {"mode": out["mode"], "fallback": out.get("fallback")}


@app.get("/clients/{client_id}/profile", dependencies=op)
def get_profile(client_id: int, conn=Conn):
    """The shop's own settings, with the trade defaults it falls back on, and exactly what the assistant is told."""
    c = client_row(conn, client_id)
    return {"profile": c["profile"], "effective": shopcfg.merged(c), "hours": shopcfg.hours_text(c),
            "greeting": receptionist.greeting(c), "prompt": receptionist.prompt(c),
            "tools": [t["function"]["name"] for t in receptionist.assistant(c)["model"].get("tools", [])]}


@app.post("/clients/{client_id}/profile", dependencies=op)
async def set_profile(client_id: int, request: Request, conn=Conn):
    """Replace the shop's profile (send {} for trade defaults). Validated; the assistant is rebuilt right away."""
    c = client_row(conn, client_id)
    try:
        body = await request.json()
        profile = shopcfg.validate(body, c["trade"])
    except (ValueError, shopcfg.ProfileError) as e:
        raise HTTPException(400, str(e) if isinstance(e, shopcfg.ProfileError) else "not JSON")
    if c["booking"] and profile.get("hours"):
        try:
            booking.validate(dict(c, profile=profile), c["booking"])
        except booking.BookingError as e:
            raise HTTPException(400, f"those hours don't fit the booking windows: {e}")
    conn.execute("UPDATE clients SET profile = %s, hours_confirmed_at = CASE WHEN %s THEN NULL ELSE hours_confirmed_at "
                 "END WHERE id = %s", (db.Json(profile), profile.get("hours") != (c["profile"] or {}).get("hours"),
                                       client_id))
    out = rebuild(conn, client_id)
    events.log("profile", True, "saved: " + ", ".join(sorted(profile)) if profile else "reset to defaults",
               client_id=client_id)
    return dict(out, profile=profile, prompt=receptionist.prompt(client_row(conn, client_id)))


@app.post("/clients/{client_id}/owner-link", dependencies=op)
def owner_link(client_id: int, rotate: bool = False, conn=Conn):
    """The owner's page link (made on first ask). rotate=true makes a new one and kills the old (a lost phone)."""
    t = owner.token(conn, client_row(conn, client_id), rotate)
    conn.commit()
    return {"url": owner.url(t), "live": config.OWNER_PAGE == "on"}


def owner_client(conn, token):
    if config.OWNER_PAGE != "on" or len(token) < 20:
        raise HTTPException(404, "not found")
    c = conn.execute("SELECT * FROM clients WHERE owner_token = %s AND status <> 'cancelled'", (token,)).fetchone()
    if not c:
        raise HTTPException(404, "not found")
    return c


@app.get("/o/{token}", response_class=HTMLResponse)
def owner_page(token: str, note: str | None = None, conn=Conn):  # public, unguessable: the owner's own page
    c = owner_client(conn, token)
    msg = {"saved": "Saved. Your assistant has the changes.", "done": "Marked as called back."}.get(note, None)
    return HTMLResponse(owner.page(conn, c, token, msg), headers=owner.HEADERS)


@app.post("/o/{token}/settings", response_class=HTMLResponse)
async def owner_save(token: str, request: Request, conn=Conn):
    c = owner_client(conn, token)
    form = {k: str(v) for k, v in (await request.form()).items()}
    try:
        profile, cols = owner.settings_from_form(c, form)
        if c["booking"]:
            booking.validate(dict(c, profile=profile), c["booking"])
    except (shopcfg.ProfileError, booking.BookingError) as e:
        return HTMLResponse(owner.page(conn, c, token, f"Not saved: {e}"), status_code=400, headers=owner.HEADERS)
    conn.execute("""UPDATE clients SET profile = %s, owner_cell = %s, notify_email = %s, summary_hour = %s
                    WHERE id = %s""", (db.Json(profile), cols["owner_cell"], cols["notify_email"], cols["summary_hour"],
                                       c["id"]))
    try:
        rebuild(conn, c["id"])
    except HTTPException:
        return HTMLResponse(owner.page(conn, client_row(conn, c["id"]), token,
                                       "Not saved: the phone system didn't answer. Try again in a minute."),
                            status_code=502, headers=owner.HEADERS)
    events.log("profile", True, "owner saved settings", client_id=c["id"])
    return RedirectResponse(f"/o/{token}?note=saved", status_code=303)


@app.post("/o/{token}/calls/{call_id}/done")
def owner_call_done(token: str, call_id: int, conn=Conn):
    c = owner_client(conn, token)
    conn.execute("UPDATE receptionist_calls SET handled_at = coalesce(handled_at, now()) WHERE id = %s AND client_id = %s",
                 (call_id, c["id"]))
    conn.commit()
    return RedirectResponse(f"/o/{token}?note=done", status_code=303)


class CalendarAsk(BaseModel):
    provider: str = "google"


@app.post("/clients/{client_id}/calendar/connect", dependencies=op)
def calendar_connect(client_id: int, ask: CalendarAsk, conn=Conn):
    """The link the owner opens to let Front Desk read busy times and add visits to their calendar (Plus)."""
    c = client_row(conn, client_id)
    if c["plan"] != "front_desk_plus":
        raise HTTPException(409, "calendar sync comes with Front Desk Plus")
    try:
        return {"url": calendars.provider(ask.provider).connect_url(client_id), "provider": ask.provider}
    except calendars.CalendarError as e:
        raise HTTPException(409 if isinstance(e, calendars.NotConfigured) else 400, str(e))


@app.get("/calendar/google/callback", response_class=HTMLResponse)
def calendar_callback(state: str = "", code: str = "", error: str = "", conn=Conn):  # public: Google sends the owner here
    cid = calendars.client_of_state(state)
    if not cid or error or not code:
        return HTMLResponse(PAGE.format(msg="That didn't connect. Ask for a new link and try again."), status_code=400)
    try:
        secret = calendars.Google.exchange(code)
        calendars.save_connection(conn, cid, "google", secret)
        conn.commit()
    except calendars.CalendarError as e:
        events.log("calendar", False, f"connect: {e}"[:300], client_id=cid)
        return HTMLResponse(PAGE.format(msg="That didn't connect. Ask for a new link and try again."), status_code=400)
    events.log("calendar", True, "connected google", client_id=cid)
    return HTMLResponse(PAGE.format(msg="Connected. Front Desk will skip your busy times and add new visits to your "
                                        "calendar. You can close this page."))


@app.delete("/clients/{client_id}/calendar", dependencies=op)
def calendar_disconnect(client_id: int, conn=Conn):
    client_row(conn, client_id)
    calendars.disconnect(conn, client_id)
    conn.commit()
    return {"calendar": None}


@app.post("/demo/receptionist", dependencies=op)
def demo_set_up(conn=Conn):
    """Create or update the demo-line assistant (dry run without VAPI_API_KEY). Attach the demo number to it on Vapi."""
    try:
        out = demo.set_up(conn)
    except receptionist.VapiError as e:
        raise HTTPException(502, f"Vapi: {e}")
    return {"mode": out["mode"], "assistant_id": out["assistant_id"], "demo_number": config.DEMO_NUMBER or None}


@app.get("/demo/calls", dependencies=op)
def demo_calls(conn=Conn):
    return {"items": conn.execute("SELECT * FROM demo_calls ORDER BY at DESC LIMIT 100").fetchall()}


@app.middleware("http")
async def client_domains(request: Request, call_next):
    """A client's own domain (pointed here by CNAME) gets their live site at /. Everything else is the API as usual."""
    host = (request.headers.get("host") or "").split(":")[0].lower().removeprefix("www.")
    if request.method == "GET" and request.url.path == "/" and host and host != config.PUBLIC_URL.split("//")[-1].split("/")[0]:
        with db.connect() as conn:
            row = conn.execute("SELECT html FROM client_sites WHERE domain = %s", (host,)).fetchone()
        if row:
            return HTMLResponse(row["html"], headers=LIVE)
    return await call_next(request)
