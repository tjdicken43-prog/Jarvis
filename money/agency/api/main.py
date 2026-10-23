"""Trades agency API (FastAPI). Run: uvicorn main:app --app-dir money/agency/api

Every route except /health, the public links (/u/, /m/, /shots/, /paid) and the signed Stripe webhook needs
`Authorization: Bearer $OPERATOR_TOKEN`. Nothing sends without TJ's tap in the Approval Queue.
"""
import datetime as dt
import html
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from pydantic import BaseModel, Field

import billing
import config
import db
import flaws
import mailer
import mockup
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
        "send_window": "Weekdays %d-%dam Central" % config.SEND_WINDOW, "stripe": config.stripe_mode(),
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


NOINDEX = {"X-Robots-Tag": "noindex, nofollow", "Cache-Control": "public, max-age=300"}


@app.get("/m/_/font.woff2")
def mockup_font():
    return FileResponse(mockup.FONT, media_type="font/woff2", headers={"Cache-Control": "public, max-age=31536000"})


@app.get("/m/{slug}", response_class=HTMLResponse)
def mockup_page(slug: str, conn=Conn):  # public: the link in the email
    row = conn.execute("SELECT html FROM mockups WHERE slug = %s", (slug,)).fetchone()
    if not row:
        raise HTTPException(404, "no such preview")
    return HTMLResponse(row["html"], headers=NOINDEX)


@app.get("/shots/{token}.png")
def shot(token: str, conn=Conn):  # unguessable link to a screenshot of their own public site
    row = conn.execute("SELECT png FROM shots WHERE token = %s", (token,)).fetchone()
    if not row:
        raise HTTPException(404, "no such screenshot")
    return Response(bytes(row["png"]), media_type="image/png", headers=NOINDEX)


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


# Step 4-5: clients, Stripe checkout (test mode), overage, matchmaking leads (display only)

CLIENT_COLS = """id, prospect_id, business_name, contact_name, email, phone, trade, plan, billing, setup_cents,
  monthly_cents, included_minutes, status, site_url, receptionist_number, checkout_url, started_at, cancelled_at,
  created_at, stripe_customer_id IS NOT NULL AS has_stripe"""


def client_view(c, used):
    u = used.get(c["id"], {})
    minutes = u.get("minutes", 0)
    over, cents = billing.overage(minutes, c["included_minutes"])
    return dict(c, minutes_used=minutes, calls=u.get("calls", 0), over_minutes=over, overage_cents=cents,
                price_cents=billing.price_cents(c["plan"], c["billing"]),
                monthly_value_cents=billing.monthly_value_cents(c["plan"], c["billing"]))


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
                        "overage_cents": sum(c["overage_cents"] for c in paying)},
            "plans": billing.PLANS, "setup_cents": billing.SETUP_CENTS,
            "overage_cents_per_min": billing.OVERAGE_CENTS_PER_MIN}


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
    conn.commit()
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
