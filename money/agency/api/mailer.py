"""Sender (no AI). Sends approved emails from the Google Workspace inbox on the cold domain, inside the send
window, under the daily cap, one shop per domain per day. Adds the CAN-SPAM footer (sender, postal address,
one-click unsubscribe) and re-checks the do-not-email list right before each send.

MAILER=stub (the default until Tuesday) runs every check and reports what would go out, but sends nothing.
"""
import datetime as dt
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from zoneinfo import ZoneInfo

import config
import db

CENTRAL = ZoneInfo("America/Chicago")


def host(url):
    return re.sub(r"^www\.", "", re.sub(r"^https?://", "", (url or "").strip().lower())).split("/")[0]


def unsub_url(token):
    return f"{config.PUBLIC_URL}/u/{token}"


def footer(token):
    address = config.MAILING_ADDRESS or "[mailing address missing: set MAILING_ADDRESS]"
    return (f"{config.FROM_NAME}\n{config.SENDER_BUSINESS}\n{address}\n\n"
            f"Not interested? One click and you won't hear from me again: {unsub_url(token)}")


def in_window(now):
    local = now.astimezone(CENTRAL)
    start, end = config.SEND_WINDOW
    return local.weekday() < 5 and start <= local.hour < end


def next_window(now):
    """Start of the next weekday send window (or now, if inside one)."""
    if in_window(now):
        return now
    local = now.astimezone(CENTRAL)
    day = local.date()
    for _ in range(8):
        start = dt.datetime.combine(day, dt.time(config.SEND_WINDOW[0]), CENTRAL)
        if day.weekday() < 5 and start > local:
            return start
        day += dt.timedelta(days=1)
    raise RuntimeError("no send window found")


def sent_today(conn, now):
    midnight = dt.datetime.combine(now.astimezone(CENTRAL).date(), dt.time(0), CENTRAL)
    return conn.execute("SELECT count(*) AS n FROM emails WHERE status = 'sent' AND sent_at >= %s", (midnight,)).fetchone()["n"]


def build(row):
    msg = EmailMessage()
    msg["From"] = formataddr((config.FROM_NAME, config.FROM_EMAIL))
    msg["To"] = row["to_email"]
    msg["Subject"] = row["subject"]
    msg["Message-ID"] = make_msgid(domain=(config.FROM_EMAIL.split("@")[-1] or None))
    msg["List-Unsubscribe"] = f"<{unsub_url(row['unsub_token'])}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(row["body"].rstrip() + "\n\n" + footer(row["unsub_token"]) + "\n")
    return msg


def smtp_send(msg):
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as s:
        s.starttls(context=ssl.create_default_context())
        s.login(config.SMTP_USER, config.SMTP_PASSWORD)
        s.send_message(msg)
    return msg["Message-ID"]


DUE = """
SELECT e.*, p.email AS to_email, p.website, p.name FROM emails e JOIN prospects p ON p.id = e.prospect_id
WHERE e.status = 'approved' AND (e.send_after IS NULL OR e.send_after <= %s)
ORDER BY e.approved_at, e.id
"""


def send_due(conn, now=None, send=None):
    """Send what is approved and due. Returns {sent, dry_run, held, detail}."""
    now = now or dt.datetime.now(dt.timezone.utc)
    live = config.mailer() == "smtp"
    send = send or smtp_send
    rows = conn.execute(DUE, (now,)).fetchall()
    held, sent = [], 0

    def hold_all(reason):
        return {"sent": 0, "dry_run": not live, "held": [{"email_id": r["id"], "reason": reason} for r in rows],
                "detail": f"Nothing sent: {reason}."}

    if not rows:
        return {"sent": 0, "dry_run": not live, "held": [], "detail": "Nothing approved and due."}
    if db.setting(conn, "paused", True):
        return hold_all("sending is paused")
    if not config.MAILING_ADDRESS:
        return hold_all("no mailing address (MAILING_ADDRESS)")
    if not in_window(now):
        return hold_all("outside the send window (weekdays %d-%d Central)" % config.SEND_WINDOW)

    room = config.DAILY_SEND_CAP - sent_today(conn, now)
    domains_today = {host(r["to_email"].split("@")[-1]) for r in conn.execute(
        "SELECT p.email AS to_email FROM emails e JOIN prospects p ON p.id = e.prospect_id "
        "WHERE e.status = 'sent' AND e.sent_at >= %s", (now - dt.timedelta(hours=24),)).fetchall()}
    would = 0
    for r in rows:
        domain = r["to_email"].split("@")[-1].lower()
        if db.suppressed(conn, r["to_email"], host(r["website"])):
            conn.execute("UPDATE emails SET status = 'cancelled' WHERE id = %s", (r["id"],))
            conn.execute("UPDATE prospects SET status = 'unsubscribed', updated_at = now() WHERE id = %s", (r["prospect_id"],))
            held.append({"email_id": r["id"], "reason": "on the do-not-email list; cancelled"})
            continue
        if room <= 0:
            held.append({"email_id": r["id"], "reason": f"daily cap of {config.DAILY_SEND_CAP} reached"})
            continue
        if domain in domains_today:
            held.append({"email_id": r["id"], "reason": f"already emailed {domain} in the last 24 hours"})
            continue
        if not live:
            would += 1
            room -= 1
            domains_today.add(domain)
            continue
        try:
            provider_id = send(build(r))
        except Exception as e:
            held.append({"email_id": r["id"], "reason": f"send failed: {type(e).__name__}"})
            conn.commit()
            break  # stop on the first error; TJ looks before anything else goes out
        conn.execute("UPDATE emails SET status = 'sent', sent_at = %s, provider_id = %s WHERE id = %s",
                     (now, provider_id, r["id"]))
        conn.execute("UPDATE prospects SET status = 'emailed', updated_at = now() WHERE id = %s", (r["prospect_id"],))
        conn.commit()
        sent += 1
        room -= 1
        domains_today.add(domain)
    conn.commit()
    detail = (f"Sent {sent}." if live else
              f"Stub mailer: nothing sent. {would} would have gone out with real keys.")
    return {"sent": sent, "dry_run": not live, "held": held, "detail": detail}
