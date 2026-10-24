"""Stripe checkout, webhook and receptionist overage. TEST mode only until TJ says live (Tuesday at the earliest).

No Stripe library: three plain HTTPS calls (checkout session, invoice item, invoice) and a signed-webhook check.
With no STRIPE_SECRET_KEY everything still runs; checkout says Stripe is off and overage is a dry run.
"""
import datetime as dt
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request

import config
import events
import mailer

# Prices (TJ, 2026-10-23). Annual = 2 months free (pay 10, get 12).
SETUP_CENTS = 29900
OVERAGE_CENTS_PER_MIN = 25
ANNUAL_MONTHS = 10
PLANS = {
    "front_desk": {"name": "Front Desk", "monthly_cents": 14900, "minutes": 300},
    "front_desk_plus": {"name": "Front Desk Plus", "monthly_cents": 24900, "minutes": 800},
}
BILLING = ("monthly", "annual")
API = "https://api.stripe.com/v1/"
TOLERANCE = 300  # seconds a signed webhook stays valid


class StripeError(Exception):
    pass


def price_cents(plan, billing):
    m = PLANS[plan]["monthly_cents"]
    return m * ANNUAL_MONTHS if billing == "annual" else m


def monthly_value_cents(plan, billing):
    """What a client is worth per month (annual spread over 12)."""
    return round(price_cents(plan, billing) / 12) if billing == "annual" else price_cents(plan, billing)


def form(data, prefix=""):
    """Stripe's form encoding: a[b][0][c]=v."""
    out = []
    items = data.items() if isinstance(data, dict) else enumerate(data)
    for k, v in items:
        key = f"{prefix}[{k}]" if prefix else str(k)
        if isinstance(v, (dict, list)):
            out += form(v, key)
        elif v is not None:
            out.append((key, "true" if v is True else "false" if v is False else str(v)))
    return out


def stripe(path, data, idempotency_key=None):
    """POST to Stripe. Refuses unless the key is a test key (or live is explicitly allowed).
    With an idempotency key, a retry of the same call can never charge twice (Stripe returns the first result)."""
    if config.stripe_mode() not in ("test", "live"):
        raise StripeError("Stripe is " + config.stripe_mode())
    headers = {"Authorization": "Bearer " + config.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    req = urllib.request.Request(API + path, data=urllib.parse.urlencode(form(data)).encode(), method="POST",
                                 headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read())["error"]["message"]
        except Exception:
            msg = f"HTTP {e.code}"
        raise StripeError(msg) from None
    except urllib.error.URLError as e:
        raise StripeError(f"can't reach Stripe: {e.reason}") from None


def checkout_session(client):
    """Subscription checkout: the plan (monthly or yearly) plus the one-time $299 setup on the first invoice."""
    plan, billing = PLANS[client["plan"]], client["billing"]
    meta = {"client_id": client["id"], "plan": client["plan"], "billing": billing}
    data = {
        "mode": "subscription",
        "client_reference_id": client["id"],
        "success_url": config.CHECKOUT_SUCCESS_URL,
        "cancel_url": config.CHECKOUT_CANCEL_URL,
        "line_items": [
            {"quantity": 1, "price_data": {
                "currency": "usd", "unit_amount": price_cents(client["plan"], billing),
                "recurring": {"interval": "year" if billing == "annual" else "month"},
                "product_data": {"name": f"{plan['name']} ({plan['minutes']} min a month, $0.25/min over)"}}},
            {"quantity": 1, "price_data": {"currency": "usd", "unit_amount": SETUP_CENTS,
                                           "product_data": {"name": "Setup: site rebuild and receptionist"}}},
        ],
        "metadata": meta,
        "subscription_data": {"metadata": meta},
    }
    if client.get("stripe_customer_id"):
        data["customer"] = client["stripe_customer_id"]
    else:
        data["customer_email"] = client["email"]
    return stripe("checkout/sessions", data)


def verify(payload: bytes, header: str, secret: str, now=None):
    """Check Stripe-Signature (t=...,v1=...). Returns the event dict or raises ValueError."""
    if not secret:
        raise ValueError("webhook secret not set")
    parts = [p.split("=", 1) for p in (header or "").split(",") if "=" in p]
    ts = next((v for k, v in parts if k == "t"), "")
    sigs = [v for k, v in parts if k == "v1"]
    if not ts.isdigit() or not sigs:
        raise ValueError("bad signature header")
    if abs((now or time.time()) - int(ts)) > TOLERANCE:
        raise ValueError("signature too old")
    want = hmac.new(secret.encode(), ts.encode() + b"." + payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(want.encode(), s.encode()) for s in sigs):
        raise ValueError("signature mismatch")
    return json.loads(payload)


def sign(payload: bytes, secret: str, ts=None):
    """Build a Stripe-Signature header (tests and local replays)."""
    ts = str(int(ts or time.time()))
    return f"t={ts},v1=" + hmac.new(secret.encode(), ts.encode() + b"." + payload, hashlib.sha256).hexdigest()


def _client_for(conn, obj):
    cid = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("client_id")
    if cid and str(cid).isdigit():
        row = conn.execute("SELECT * FROM clients WHERE id = %s", (int(cid),)).fetchone()
        if row:
            return row
    # Newer API versions keep an invoice's subscription under parent.subscription_details
    details = ((obj.get("parent") or {}).get("subscription_details") or {})
    sub = obj.get("id") if obj.get("object") == "subscription" else obj.get("subscription") or details.get("subscription")
    row = sub and conn.execute("SELECT * FROM clients WHERE stripe_subscription_id = %s", (sub,)).fetchone()
    if not row and obj.get("customer"):
        row = conn.execute("SELECT * FROM clients WHERE stripe_customer_id = %s", (obj["customer"],)).fetchone()
    return row or None


def handle_event(conn, event):
    """Apply one verified Stripe event. Each event id is applied once."""
    if bool(event.get("livemode")) != (config.stripe_mode() == "live"):
        return {"ignored": "livemode does not match this server"}
    new = conn.execute("INSERT INTO stripe_events (id, type) VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING id",
                       (event["id"], event.get("type", ""))).fetchone()
    if not new:
        conn.commit()
        return {"duplicate": True}
    kind, obj = event.get("type"), (event.get("data") or {}).get("object") or {}
    client = _client_for(conn, obj)
    out = {"type": kind, "client_id": client["id"] if client else None}
    if not client:
        conn.commit()
        return out
    if kind == "checkout.session.completed" and obj.get("payment_status") in ("paid", "no_payment_required"):
        meta = obj.get("metadata") or {}
        plan = meta.get("plan") if meta.get("plan") in PLANS else client["plan"]
        billing = meta.get("billing") if meta.get("billing") in BILLING else client["billing"]
        conn.execute("""UPDATE clients SET status = 'active', plan = %s, billing = %s, monthly_cents = %s,
                        included_minutes = %s, stripe_customer_id = coalesce(%s, stripe_customer_id),
                        stripe_subscription_id = coalesce(%s, stripe_subscription_id),
                        started_at = coalesce(started_at, now()), cancelled_at = NULL WHERE id = %s""",
                     (plan, billing, PLANS[plan]["monthly_cents"], PLANS[plan]["minutes"], obj.get("customer"),
                      obj.get("subscription"), client["id"]))
        if client["prospect_id"]:
            conn.execute("UPDATE prospects SET status = 'won', updated_at = now() WHERE id = %s", (client["prospect_id"],))
        out["status"] = "active"
    elif kind == "invoice.paid" and client["status"] == "past_due":
        conn.execute("UPDATE clients SET status = 'active' WHERE id = %s", (client["id"],))
        out["status"] = "active"
    elif kind == "invoice.payment_failed" and client["status"] == "active":
        conn.execute("UPDATE clients SET status = 'past_due' WHERE id = %s", (client["id"],))
        out["status"] = "past_due"
    elif kind == "customer.subscription.deleted":
        conn.execute("UPDATE clients SET status = 'cancelled', cancelled_at = now() WHERE id = %s", (client["id"],))
        out["status"] = "cancelled"
        import receptionist  # a cancelled shop's receptionist stops answering, so its calls stop costing us
        try:
            out["receptionist"] = receptionist.turn_off(conn, client)
        except receptionist.VapiError as e:
            out["receptionist"] = f"still on, turn it off in Vapi: {e}"
            events.log("receptionist", False, f"couldn't turn off after cancel: {e}", client_id=client["id"])
    conn.commit()
    events.log("stripe", True, kind, client_id=client["id"], detail={"status": out.get("status")})
    return out


def month_bounds(month=None, now=None):
    """(label, start, end) for a calendar month in Central. month = 'YYYY-MM', default this month."""
    if month:
        y, m = (int(x) for x in month.split("-"))
    else:
        local = (now or dt.datetime.now(dt.timezone.utc)).astimezone(mailer.CENTRAL)
        y, m = local.year, local.month
    start = dt.datetime(y, m, 1, tzinfo=mailer.CENTRAL)
    end = dt.datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=mailer.CENTRAL)
    return f"{y:04d}-{m:02d}", start, end


USAGE = """
SELECT c.id, coalesce(ceil(sum(r.seconds) / 60.0), 0)::int AS minutes, count(r.id)::int AS calls,
  count(r.id) FILTER (WHERE r.after_hours)::int AS after_hours, count(r.id) FILTER (WHERE r.outcome = 'hung_up')::int AS missed
FROM clients c LEFT JOIN receptionist_calls r ON r.client_id = c.id AND r.started_at >= %s AND r.started_at < %s
GROUP BY c.id
"""


def usage(conn, start, end):
    return {r["id"]: r for r in conn.execute(USAGE, (start, end))}


def overage(minutes, included):
    over = max(0, minutes - included)
    return over, over * OVERAGE_CENTS_PER_MIN


def bill_overage(conn, month):
    """Charge last month's minutes over the plan, once per client per month. Dry run when Stripe is off."""
    label, start, end = month_bounds(month)
    live = config.stripe_mode() in ("test", "live")
    used = usage(conn, start, end)
    out = {"month": label, "stripe": config.stripe_mode(), "charged": [], "skipped": []}
    for c in conn.execute("SELECT * FROM clients WHERE status IN ('active','past_due') ORDER BY id").fetchall():
        minutes = used.get(c["id"], {}).get("minutes", 0)
        over, cents = overage(minutes, c["included_minutes"])
        if not cents:
            continue
        line = {"client_id": c["id"], "business_name": c["business_name"], "minutes": minutes, "over_minutes": over,
                "amount_cents": cents}
        done = conn.execute("SELECT stripe_invoice_item_id FROM overage_charges WHERE client_id = %s AND month = %s",
                            (c["id"], label)).fetchone()
        if done and done["stripe_invoice_item_id"]:
            out["skipped"].append(dict(line, reason="already charged"))
            continue
        if not live or not c["stripe_customer_id"]:
            out["skipped"].append(dict(line, reason="dry run: Stripe off" if not live else "no Stripe customer"))
            continue
        # Claim the month first (UNIQUE client+month is the lock), then charge with a fixed idempotency key, so a
        # crash, a retry or two runs at once can never bill the same minutes twice.
        conn.execute("""INSERT INTO overage_charges (client_id, month, minutes, over_minutes, amount_cents)
                        VALUES (%s,%s,%s,%s,%s) ON CONFLICT (client_id, month) DO NOTHING""",
                     (c["id"], label, minutes, over, cents))
        conn.commit()
        claim = conn.execute("""SELECT minutes, over_minutes, amount_cents FROM overage_charges
                                WHERE client_id = %s AND month = %s FOR UPDATE SKIP LOCKED""", (c["id"], label)).fetchone()
        if not claim:
            out["skipped"].append(dict(line, reason="another run is billing this"))
            continue
        over, cents = claim["over_minutes"], claim["amount_cents"]  # bill what was claimed, even on a retry
        try:
            item = stripe("invoiceitems", {
                "customer": c["stripe_customer_id"], "amount": cents, "currency": "usd",
                "description": f"Receptionist {label}: {over} min over {c['included_minutes']} at $0.25"},
                idempotency_key=f"overage-{c['id']}-{label}")
            invoice = None
            if c["billing"] == "annual":  # yearly invoices are months away, so bill this one now
                invoice = stripe("invoices", {"customer": c["stripe_customer_id"], "auto_advance": True,
                                              "pending_invoice_items_behavior": "include"},
                                 idempotency_key=f"overage-invoice-{c['id']}-{label}")["id"]
        except StripeError as e:
            conn.rollback()
            out["skipped"].append(dict(line, reason=str(e)))
            events.log("overage", False, f"Stripe: {e}", client_id=c["id"])
            break  # stop on the first Stripe error; the claimed row stays, and a rerun reuses the same keys
        conn.execute("""UPDATE overage_charges SET stripe_invoice_item_id = %s, stripe_invoice_id = %s
                        WHERE client_id = %s AND month = %s""", (item["id"], invoice, c["id"], label))
        conn.commit()
        events.log("overage", True, f"billed {over} min", client_id=c["id"], detail={"cents": cents, "month": label})
        out["charged"].append(line)
    return out
