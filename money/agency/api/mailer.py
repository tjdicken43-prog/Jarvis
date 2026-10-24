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
import events
import quality

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


# Warm-up ramp for a brand-new cold domain: (days since the inbox started warming, cold emails a day).
# Week 1 is warm-up only (TJ's own real emails); cold mail starts small in week 2 and grows weekly.
RAMP = [(7, 0), (14, 3), (21, 5), (28, 10)]
RAMP_AFTER = 20


def daily_cap(conn, now):
    """(cap, why). The ramp sets it from the warm-up start date; DAILY_SEND_CAP is the ceiling."""
    started = db.setting(conn, "warmup_started")
    if not started:
        return 0, "set the warm-up start date first (Settings)"
    days = (now.astimezone(CENTRAL).date() - dt.date.fromisoformat(started)).days
    cap = next((n for limit, n in RAMP if days < limit), RAMP_AFTER)
    cap = min(cap, config.DAILY_SEND_CAP)
    if cap == 0:
        return 0, f"warm-up day {max(days, 0) + 1}: cold email starts on day {RAMP[0][0] + 1}"
    return cap, f"warm-up day {days + 1}: {cap} a day"


def sent_today(conn, now):
    midnight = dt.datetime.combine(now.astimezone(CENTRAL).date(), dt.time(0), CENTRAL)
    return conn.execute("SELECT count(*) AS n FROM emails WHERE sent_at >= %s", (midnight,)).fetchone()["n"]  # replied ones count too


def build(row):
    msg = EmailMessage()
    msg["From"] = formataddr((config.FROM_NAME, config.FROM_EMAIL))
    msg["To"] = row["to_email"]
    msg["Subject"] = row["subject"]
    msg["Message-ID"] = make_msgid(domain=(config.FROM_EMAIL.split("@")[-1] or None))
    if row.get("thread"):  # follow-ups land in the same thread as the first email
        msg["In-Reply-To"] = row["thread"][-1]
        msg["References"] = " ".join(row["thread"])
    msg["List-Unsubscribe"] = f"<{unsub_url(row['unsub_token'])}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(row["body"].rstrip() + "\n\n" + footer(row["unsub_token"]) + "\n")
    return msg


def smtp_send(msg):
    s = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30)
    try:
        s.starttls(context=ssl.create_default_context())
        s.login(config.SMTP_USER, config.SMTP_PASSWORD)
        s.send_message(msg)  # once this returns, the server has the email
    except Exception:
        s.close()
        raise
    try:
        s.quit()
    except Exception:
        s.close()  # a hiccup saying goodbye doesn't unsend it
    return msg["Message-ID"]


DUE = """
SELECT e.*, p.email AS to_email, p.website, p.name FROM emails e JOIN prospects p ON p.id = e.prospect_id
WHERE e.status = 'approved' AND (e.send_after IS NULL OR e.send_after <= %s)
  AND p.email IS NOT NULL AND p.email <> ''
ORDER BY e.send_after NULLS FIRST, e.approved_at, e.id
"""


FREE_MAIL = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "live.com", "msn.com",
             "att.net", "sbcglobal.net", "cox.net", "me.com", "ymail.com", "proton.me", "protonmail.com"}
SEND_LOCK = 4207  # pg advisory lock id: one sender at a time, so two runs can't email the same shop


def company(addr):
    """What the one-email-per-company-per-day rule counts: the domain, or the whole address on free mail."""
    addr = (addr or "").strip().lower()
    domain = addr.split("@")[-1]
    return addr if domain in FREE_MAIL else domain


def permanent(e):
    """The receiving server refused this address for good (5xx, not a login problem): don't retry it."""
    if isinstance(e, smtplib.SMTPRecipientsRefused):
        return True
    return isinstance(e, smtplib.SMTPResponseException) and 500 <= e.smtp_code < 600 and e.smtp_code not in (530, 534, 535)


def send_due(conn, now=None, send=None, hold_follow_ups=False):
    """Send what is approved and due. Returns {sent, dry_run, held, detail}. One run at a time."""
    if not conn.execute("SELECT pg_try_advisory_lock(%s) AS ok", (SEND_LOCK,)).fetchone()["ok"]:
        return {"sent": 0, "dry_run": config.mailer() != "smtp", "held": [], "detail": "Another send is running."}
    try:
        return _send_due(conn, now, send, hold_follow_ups)
    finally:
        conn.rollback()
        conn.execute("SELECT pg_advisory_unlock(%s)", (SEND_LOCK,))
        conn.commit()


def _send_due(conn, now, send, hold_follow_ups):
    import followups  # imports this module
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
    if live and not config.PUBLIC_URL.startswith("https://"):
        return hold_all("PUBLIC_URL isn't an https address, so the unsubscribe and preview links would be dead")
    if not in_window(now):
        return hold_all("outside the send window (weekdays %d-%d Central)" % config.SEND_WINDOW)

    cap, cap_why = daily_cap(conn, now)
    if cap == 0:
        return hold_all(cap_why)
    room = cap - sent_today(conn, now)
    companies_today = {company(r["to_email"]) for r in conn.execute(
        "SELECT p.email AS to_email FROM emails e JOIN prospects p ON p.id = e.prospect_id "
        "WHERE e.sent_at >= %s", (now - dt.timedelta(hours=24),)).fetchall()}
    would = 0
    for r in rows:
        who = company(r["to_email"])
        if db.suppressed(conn, r["to_email"], host(r["website"])):
            conn.execute("UPDATE emails SET status = 'cancelled' WHERE id = %s", (r["id"],))
            conn.execute("UPDATE prospects SET status = 'unsubscribed', updated_at = now() WHERE id = %s AND status <> 'won'",
                         (r["prospect_id"],))
            held.append({"email_id": r["id"], "reason": "on the do-not-email list; cancelled"})
            continue
        if hold_follow_ups and r["kind"] != "first":
            held.append({"email_id": r["id"], "reason": "inbox check failed, so follow-ups wait"})
            continue
        if why := followups.blocked(conn, r):
            if why[0] == "stop":
                conn.execute("UPDATE emails SET status = 'cancelled' WHERE id = %s", (r["id"],))
            held.append({"email_id": r["id"], "reason": why[1] + ("; cancelled" if why[0] == "stop" else "")})
            continue
        if missing := quality.contract("send", conn.execute("SELECT * FROM prospects WHERE id = %s",
                                                              (r["prospect_id"],)).fetchone(), r):
            held.append({"email_id": r["id"], "reason": "; ".join(missing)})
            events.log("send", True, "held: " + "; ".join(missing), prospect_id=r["prospect_id"], email_id=r["id"])
            continue
        if room <= 0:
            held.append({"email_id": r["id"], "reason": f"daily cap of {cap} reached ({cap_why})"})
            continue
        if who in companies_today:
            held.append({"email_id": r["id"], "reason": f"already emailed {who} in the last 24 hours"})
            continue
        if not live:
            would += 1
            room -= 1
            companies_today.add(who)
            continue
        # Claim it: a tap on Undo, Skip or Pause since this run started wins, and a crash mid-send leaves it
        # 'sending' for TJ to look at, never sent twice.
        claimed = conn.execute("""UPDATE emails SET status = 'sending' WHERE id = %s AND status = 'approved'
                                  AND NOT coalesce((SELECT value = 'true'::jsonb FROM settings WHERE key = 'paused'), true)
                                  RETURNING id""", (r["id"],)).fetchone()
        conn.commit()
        if not claimed:
            held.append({"email_id": r["id"], "reason": "changed or paused while sending; left alone"})
            continue
        try:
            provider_id = send(build(dict(r, thread=followups.thread_ids(conn, r["prospect_id"]))))
        except Exception as e:
            if permanent(e):  # their server refused the address: never retry it, carry on with the rest
                conn.execute("UPDATE emails SET status = 'failed' WHERE id = %s", (r["id"],))
                conn.execute("UPDATE prospects SET status = 'no-email', updated_at = now() WHERE id = %s", (r["prospect_id"],))
                conn.execute("INSERT INTO suppressions (email, reason) VALUES (%s, 'refused by their mail server') "
                             "ON CONFLICT DO NOTHING", (r["to_email"].strip().lower(),))
                conn.commit()
                held.append({"email_id": r["id"], "reason": "their mail server refused the address; on the do-not-email list"})
                events.log("send", True, f"address refused: {e}"[:300], prospect_id=r["prospect_id"], email_id=r["id"])
                continue
            conn.execute("UPDATE emails SET status = 'approved' WHERE id = %s", (r["id"],))
            conn.commit()
            held.append({"email_id": r["id"], "reason": f"send failed: {type(e).__name__}"})
            events.log("send", False, f"send failed: {type(e).__name__}: {e}"[:300], prospect_id=r["prospect_id"], email_id=r["id"])
            break  # stop on the first error; TJ looks before anything else goes out
        conn.execute("UPDATE emails SET status = 'sent', sent_at = %s, provider_id = %s WHERE id = %s",
                     (now, provider_id, r["id"]))
        conn.execute("UPDATE prospects SET status = 'emailed', updated_at = now() WHERE id = %s AND status IN "
                     "('checked','built','approved','emailed')", (r["prospect_id"],))
        conn.commit()
        events.log("send", True, f"sent {r['kind']}", prospect_id=r["prospect_id"], email_id=r["id"])
        if r["kind"] == "first":
            try:
                followups.schedule(conn, r["prospect_id"], now)
                conn.commit()
            except Exception as e:  # the first one went out; TJ sees why its follow-ups didn't queue
                conn.rollback()
                held.append({"email_id": r["id"], "reason": f"sent, but follow-ups not queued: {e}"[:200]})
                events.log("send", False, f"follow-ups not queued: {e}"[:300], prospect_id=r["prospect_id"], email_id=r["id"])
        sent += 1
        room -= 1
        companies_today.add(who)
    conn.commit()
    detail = (f"Sent {sent}." if live else
              f"Stub mailer: nothing sent. {would} would have gone out with real keys.")
    return {"sent": sent, "dry_run": not live, "held": held, "detail": detail}
