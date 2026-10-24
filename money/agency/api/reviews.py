"""Plus review requests: one ask after a finished job, with the shop's Google review link.

How the review tools trades use do it (Podium, NiceJob, Housecall Pro): send soon after the job is marked done, during
the day, one ask per customer. Rules we hold, from Google's review policy and the FTC's consumer review rule (in force
2024-10-21): everyone gets the same ask (no "review gating": never filter by how happy they are), no rewards for
reviews, never write or suggest the review. Texts only to callers who said yes on the call, and texting stays a stub
until an SMS provider with A2P 10DLC registration, on TJ's word. Email goes out with NOTIFY=smtp.
"""
import datetime as dt
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import config
import db
import mailer
from mailer import CENTRAL

DELAY = dt.timedelta(hours=2)        # after the job is marked done
HOURS = (10, 19)                     # only send 10am-7pm Central
GAP = dt.timedelta(days=180)         # one ask per customer per shop every 6 months


class ReviewError(Exception):
    pass


def eligible(c):
    if c["plan"] != "front_desk_plus":
        return "review requests come with Front Desk Plus"
    if c["status"] not in ("active", "past_due"):
        return "not a paying client"
    if not c.get("review_url"):
        return "add the shop's Google review link first"
    return None


def next_send(t):
    local = t.astimezone(CENTRAL)
    if local.hour < HOURS[0]:
        return dt.datetime.combine(local.date(), dt.time(HOURS[0]), CENTRAL)
    if local.hour >= HOURS[1]:
        return dt.datetime.combine(local.date() + dt.timedelta(days=1), dt.time(HOURS[0]), CENTRAL)
    return t


def first_name(name):
    return (name or "").split(" ")[0].strip() or "there"


def sms_body(c, r):
    return (f"Hi {first_name(r['customer_name'])}, thanks for choosing {c['business_name']}. If you have a minute, an "
            f"honest Google review helps a small local business a lot: {c['review_url']} Reply STOP to opt out.")


def email_body(c, r):
    phone = f"\n{c['phone']}" if c.get("phone") else ""
    return (f"Hi {first_name(r['customer_name'])},\n\nThanks for choosing {c['business_name']}. If you have a minute, "
            f"would you leave an honest review on Google? It helps a small local business a lot.\n\n{c['review_url']}\n\n"
            f"{c['business_name']}{phone}\n\nThis is the only time we'll ask.")


def queue(conn, c, customer_name, number=None, email=None, ok_to_text=False, booking_id=None, now=None):
    """Queue one ask. Email if we have one, else a text if they said yes to texts. Raises ReviewError if we can't."""
    now = now or dt.datetime.now(dt.timezone.utc)
    why = eligible(c)
    if why:
        raise ReviewError(why)
    name = (customer_name or "").strip()[:80]
    num = "".join(ch for ch in (number or "") if ch.isdigit())[-10:]
    num = num if len(num) == 10 else ""
    email = (email or "").strip().lower() or None
    if email and "@" not in email:
        raise ReviewError("that email doesn't look right")
    if not name:
        raise ReviewError("customer name needed")
    channel = "email" if email else "sms" if num and ok_to_text else None
    if not channel:
        raise ReviewError("need their email, or a number they said yes to texts on")
    recent = conn.execute("""SELECT 1 FROM review_requests WHERE client_id = %s AND created_at > %s
                             AND ((to_email IS NOT NULL AND to_email = %s) OR (to_number IS NOT NULL AND to_number = %s))""",
                          (c["id"], now - GAP, email, num or None)).fetchone()
    if recent:
        raise ReviewError("already asked this customer in the last 6 months")
    r = {"customer_name": name}
    body = email_body(c, r) if channel == "email" else sms_body(c, r)
    return conn.execute("""INSERT INTO review_requests (client_id, booking_id, customer_name, to_number, to_email, channel,
                           body, send_after) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                        (c["id"], booking_id, name, num or None, email, channel, body,
                         next_send(now + DELAY))).fetchone()


def finish(conn, r, status, detail=None, now=None):
    conn.execute("UPDATE review_requests SET status = %s, detail = %s, sent_at = %s WHERE id = %s",
                 (status, detail, now if status in ("sent", "stub") else None, r["id"]))


def send_due(conn, now=None, send=None):
    """Send what's due. Re-checks the client, opt-outs and the do-not-email list right before each one."""
    now = now or dt.datetime.now(dt.timezone.utc)
    local = now.astimezone(CENTRAL)
    if not HOURS[0] <= local.hour < HOURS[1]:
        return {"mode": config.notifier(), "done": [], "detail": "outside 10am-7pm Central"}
    done = []
    rows = conn.execute("""SELECT r.*, row_to_json(c.*) AS client FROM review_requests r JOIN clients c ON c.id = r.client_id
                           WHERE r.status = 'queued' AND r.send_after <= %s ORDER BY r.send_after, r.id LIMIT 50""",
                        (now,)).fetchall()
    for r in rows:
        c = r["client"]
        why = eligible(c)
        if why:
            finish(conn, r, "skipped", why)
        elif r["channel"] == "sms":
            if conn.execute("SELECT 1 FROM sms_optouts WHERE number = %s", (r["to_number"],)).fetchone():
                finish(conn, r, "skipped", "opted out of texts")
            else:
                finish(conn, r, "stub", "texting is a stub until 10DLC", now)  # saved, never sent
        elif db.suppressed(conn, r["to_email"]):
            finish(conn, r, "skipped", "on the do-not-email list")
        elif config.notifier() != "smtp":
            finish(conn, r, "stub", "NOTIFY=stub: saved, not sent", now)
        else:
            msg = EmailMessage()
            msg["From"] = formataddr((c["business_name"][:60], config.NOTIFY_FROM_EMAIL))
            msg["Reply-To"] = c.get("notify_email") or c["email"]
            msg["To"] = r["to_email"]
            msg["Subject"] = f"Thanks from {c['business_name']}"
            msg["Message-ID"] = make_msgid(domain=(config.NOTIFY_FROM_EMAIL.split("@")[-1] or None))
            msg.set_content(r["body"])
            try:
                (send or mailer.smtp_send)(msg)
                finish(conn, r, "sent", None, now)
            except Exception as e:
                finish(conn, r, "failed", type(e).__name__)
        conn.commit()
        done.append({"id": r["id"], "status": conn.execute("SELECT status FROM review_requests WHERE id = %s",
                                                            (r["id"],)).fetchone()["status"]})
    return {"mode": config.notifier(), "done": done}
