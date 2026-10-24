"""Follow-ups (no AI). Three short ones after the first email, each with a new angle, never "just bumping this":
day 3 after-hours calls, day 7 no work on their end, day 14 a polite close. Approved with the first email
(master prompt v3): when the first one really sends, the three are queued in the same thread. Each one waits for
its day and the next send window, and stops on any reply, bounce or opt-out.

Replies and bounces come from the Workspace inbox over IMAP (read only, nothing marked read). With the stub mailer
there is no inbox, so TJ marks them by hand on the Sent tab.
"""
import datetime as dt
import email
import email.policy
import imaplib
import re
import secrets
from email.utils import parseaddr

import config
import events
import mailer
import outreach

STEPS = [("follow_up_1", 3), ("follow_up_2", 7), ("follow_up_3", 14)]  # days after the first email went out
DAYS = dict(STEPS)
STOP_STATUSES = {"replied", "won", "lost", "unsubscribed"}


def write(kind, p, first_subject):
    """(subject, body) for one follow-up. Same thread, so the subject is the first one's with Re:."""
    name, city = p["name"], p.get("city") or "your area"
    link = p.get("mockup_url")
    subject = first_subject if first_subject.lower().startswith("re:") else f"Re: {first_subject}"
    if kind == "follow_up_1":
        fix = (f"The preview I built for {name} comes with a receptionist that answers those calls after hours:\n{link}\n\n"
               if link else f"I can set {name} up with a receptionist that answers those calls after hours. ")
        body = (f"Hi,\n\nOne more thing: when someone in {city} has {outreach.EMERGENCY[p['trade']]} at night, they "
                f"usually call whoever picks up first. {fix}Do you have nights covered already?")
    elif kind == "follow_up_2":
        made = (f"The preview is already built from what's on your current site, so there's very little for you to do:\n{link}\n\n"
                if link else "I'd build it from what's on your current site, so there's very little for you to do. ")
        body = f"Hi,\n\nIf a new site sounds like a lot of work, it isn't on your end. {made}Is a 10-minute call this week worth it?"
    else:
        body = ("Hi,\n\nI haven't heard back, so I'll take it that now isn't the right time and stop writing about this. "
                "If you want the site or the after-hours answering later, just reply here. Thanks for your time.")
    return subject, body


def preview(p, first_subject):
    """What the follow-ups will say, shown on the first email's card before TJ approves it."""
    return [{"kind": k, "day": d, "subject": s, "body": b}
            for k, d in STEPS for s, b in [write(k, p, first_subject)]]


def due(sent_at, kind):
    return mailer.next_window(sent_at + dt.timedelta(days=DAYS[kind]))


def schedule(conn, prospect_id, first_sent_at):
    """Queue the three follow-ups as approved (they ride on the first email's approval). Safe to call twice."""
    p = conn.execute("SELECT * FROM prospects WHERE id = %s", (prospect_id,)).fetchone()
    first = conn.execute("SELECT subject FROM emails WHERE prospect_id = %s AND kind = 'first'", (prospect_id,)).fetchone()
    if not p or not first or p["trade"] not in outreach.TRADE_WORD:
        return []
    made = []
    for kind, _ in STEPS:
        subject, body = write(kind, p, first["subject"])
        problems = outreach.preflight(subject, body, p, kind)
        if problems:
            raise RuntimeError(f"{kind} failed pre-flight: " + "; ".join(problems))
        row = conn.execute(
            """INSERT INTO emails (prospect_id, kind, subject, body, status, unsub_token, approved_at, send_after)
               VALUES (%s, %s, %s, %s, 'approved', %s, %s, %s) ON CONFLICT (prospect_id, kind) DO NOTHING RETURNING id""",
            (prospect_id, kind, subject, body, secrets.token_urlsafe(24), first_sent_at, due(first_sent_at, kind)),
        ).fetchone()
        if row:
            made.append(row["id"])
    return made


def stop(conn, prospect_id, status, reason, email_status="replied"):
    """A reply, bounce or opt-out: mark the shop, mark the last email, cancel every follow-up not sent yet."""
    conn.execute("UPDATE prospects SET status = %s, updated_at = now() WHERE id = %s AND status NOT IN ('won','lost')",
                 (status, prospect_id))
    n = conn.execute("UPDATE emails SET status = 'cancelled' WHERE prospect_id = %s AND status IN ('draft','approved')",
                     (prospect_id,)).rowcount
    last = conn.execute("""SELECT id FROM emails WHERE prospect_id = %s AND status = 'sent'
                           ORDER BY sent_at DESC, id DESC LIMIT 1""", (prospect_id,)).fetchone()
    if last:
        conn.execute("UPDATE emails SET status = %s WHERE id = %s", (email_status, last["id"]))
    events.log("inbox", True, f"{status}: {reason}", prospect_id=prospect_id, detail={"cancelled": n})
    return {"prospect_id": prospect_id, "status": status, "cancelled": n, "reason": reason}


def mark_replied(conn, prospect_id, reason="marked by TJ"):
    out = stop(conn, prospect_id, "replied", reason)
    conn.commit()
    return out


def mark_bounced(conn, prospect_id, reason="bounced"):
    """Bounced addresses go on the do-not-email list forever, like an opt-out."""
    p = conn.execute("SELECT email FROM prospects WHERE id = %s", (prospect_id,)).fetchone()
    out = stop(conn, prospect_id, "unsubscribed", reason, "bounced")
    if p and p["email"]:
        conn.execute("INSERT INTO suppressions (email, reason) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                     (p["email"].strip().lower(), reason))
    conn.commit()
    return out


# Inbox: replies and bounces

AUTO = re.compile(r"^(out of (the )?office|automatic reply|auto(matic)?[- ]?reply|away from)", re.I)
BOUNCER = re.compile(r"^(mailer-daemon|postmaster)@", re.I)
ASKED_STOP = re.compile(r"^\W*stop\W*$|\b(please stop|stop (e-?mailing|sending|contacting|writing)|unsubscribe|remove me|"
                        r"take me off|not interested|no thanks|don'?t (e-?mail|contact|write))\b", re.I | re.M)


def text_of(msg):
    part = msg.get_body(preferencelist=("plain", "html")) if msg.is_multipart() else msg
    try:
        return part.get_content() if part else ""
    except (KeyError, LookupError):
        return ""


QUOTE_START = re.compile(r"^(>|On .+ wrote:$|-{2,}\s*Original Message\s*-{2,}$|_{8,}$|From:\s.+|Sent from my )", re.I)
STOP_MAX_WORDS = 25  # a longer reply that happens to say "no thanks" goes to TJ as a reply, not straight to the list


def new_part(text):
    """The reply itself, above the quoted email (Gmail "On .. wrote:", Outlook "From:" headers or rules, phones)."""
    out = []
    for line in text.splitlines():
        if QUOTE_START.match(line.strip()) or "One click and you won't hear from me again" in line:
            break
        out.append(line)
    return "\n".join(out)


def is_bounce(msg, sender):
    """A real hard bounce: a delivery report that says failed, or a mailer-daemon note that says the address is bad.
    Delay warnings and read receipts are not bounces."""
    body = msg.as_string()
    if msg.get_content_type() == "multipart/report":
        if (msg.get_param("report-type") or "").lower() != "delivery-status":
            return False
        return bool(re.search(r"^Action:\s*failed", body, re.I | re.M) or re.search(r"^Status:\s*5\.", body, re.I | re.M))
    if BOUNCER.match(sender):
        return bool(re.search(r"address not found|does not exist|user unknown|no such user|permanent(ly)? fail|"
                              r"undeliverable|rejected|couldn.?t be found|wasn.?t delivered|could not be delivered|unable to receive|\b5\.\d\.\d+\b", body, re.I))
    return False


def kind_of_reply(text):
    part = new_part(text)
    if ASKED_STOP.search(part) and len(part.split()) <= STOP_MAX_WORDS:
        return "stop"
    return "replied"


def read(conn, raw):
    """One inbox message -> what it means for us, or None. Out-of-office and auto replies don't stop anything."""
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    sender = parseaddr(msg.get("From", ""))[1].lower()
    refs = set(re.findall(r"<[^>]+>", f"{msg.get('In-Reply-To', '')} {msg.get('References', '')}"))
    sent = conn.execute("""SELECT DISTINCT ON (p.id) p.id, lower(p.email) AS email, e.provider_id FROM emails e
                           JOIN prospects p ON p.id = e.prospect_id WHERE e.status = 'sent' AND p.status = 'emailed'
                           ORDER BY p.id""").fetchall()
    ids = {r["provider_id"]: r["id"] for r in conn.execute(
        "SELECT provider_id, prospect_id AS id FROM emails WHERE status = 'sent' AND provider_id IS NOT NULL")}
    by_email = {r["email"]: r["id"] for r in sent}
    live = {r["id"] for r in sent}
    if BOUNCER.match(sender) or msg.get_content_type() == "multipart/report":
        if not is_bounce(msg, sender):
            return None
        body = msg.as_string()
        hit = next((pid for pid in (ids.get(r) for r in re.findall(r"<[^>]+>", body)) if pid in live), None)
        hit = hit or next((pid for addr, pid in by_email.items() if addr and addr in body.lower()), None)
        return {"prospect_id": hit, "kind": "bounced"} if hit else None
    auto = (msg.get("Auto-Submitted", "no").lower() != "no" or msg.get("X-Autoreply") or msg.get("X-Autorespond")
            or AUTO.match(msg.get("Subject", "")))
    hit = next((ids[r] for r in refs if ids.get(r) in live), None) or by_email.get(sender)
    if not hit:
        return None
    if auto:
        return {"prospect_id": hit, "kind": "auto"}
    return {"prospect_id": hit, "kind": kind_of_reply(text_of(msg))}


def imap_fetch(since):
    """Raw messages from the Workspace inbox since a date. Read only (BODY.PEEK), so TJ still sees them as new."""
    out = []
    with imaplib.IMAP4_SSL(config.IMAP_HOST, timeout=30) as m:
        m.login(config.SMTP_USER, config.SMTP_PASSWORD)
        m.select("INBOX", readonly=True)
        _, data = m.search(None, "SINCE", since.strftime("%d-%b-%Y"))
        for num in (data[0] or b"").split()[-200:]:
            _, parts = m.fetch(num, "(BODY.PEEK[])")
            out += [p[1] for p in parts if isinstance(p, tuple)]
    return out


def check_inbox(conn, now=None, fetch=None):
    """Stop the sequence for anyone who replied, bounced or asked to stop. Returns {replied, bounced, stopped, detail}."""
    now = now or dt.datetime.now(dt.timezone.utc)
    if fetch is None and config.mailer() != "smtp":
        return {"replied": [], "bounced": [], "stopped": [], "detail": "No inbox yet (stub mailer); mark replies by hand."}
    fetch = fetch or imap_fetch
    res = {"replied": [], "bounced": [], "stopped": []}
    for raw in fetch(now - dt.timedelta(days=21)):
        try:
            r = read(conn, raw)
        except Exception as e:  # one odd message never blinds us to the rest
            conn.rollback()
            events.log("inbox", False, f"couldn't read one message: {type(e).__name__}"[:300])
            res.setdefault("unreadable", 0)
            res["unreadable"] = res["unreadable"] + 1
            continue
        if not r or r["kind"] == "auto":
            continue
        pid = r["prospect_id"]
        if r["kind"] == "bounced":
            mark_bounced(conn, pid, "bounced")
            res["bounced"].append(pid)
        elif r["kind"] == "stop":
            p = conn.execute("SELECT email FROM prospects WHERE id = %s", (pid,)).fetchone()
            out = stop(conn, pid, "unsubscribed", "asked to stop (reply)")
            if p and p["email"]:
                conn.execute("INSERT INTO suppressions (email, reason) VALUES (%s, 'asked to stop (reply)') "
                             "ON CONFLICT DO NOTHING", (p["email"].strip().lower(),))
            conn.commit()
            res["stopped"].append(out["prospect_id"])
        else:
            mark_replied(conn, pid, "replied (inbox)")
            res["replied"].append(pid)
    res["detail"] = f"Inbox: {len(res['replied'])} replied, {len(res['bounced'])} bounced, {len(res['stopped'])} asked to stop."
    return res


def blocked(conn, row):
    """Why a follow-up must not go out now (None = fine). Checked by the sender right before each one."""
    if row["kind"] == "first":
        return None
    p = conn.execute("SELECT status FROM prospects WHERE id = %s", (row["prospect_id"],)).fetchone()
    if p["status"] in STOP_STATUSES:
        return ("stop", f"shop is {p['status']}")
    if conn.execute("SELECT 1 FROM clients WHERE prospect_id = %s", (row["prospect_id"],)).fetchone():
        return ("stop", "they said yes and are on Clients")
    prior = {r["kind"]: r["status"] for r in conn.execute(
        "SELECT kind, status FROM emails WHERE prospect_id = %s", (row["prospect_id"],))}
    if prior.get("first") != "sent":
        return ("stop", "first email was not sent")
    if {"replied", "bounced"} & set(prior.values()):
        return ("stop", "they replied or it bounced")
    earlier = [k for k, _ in STEPS[:[k for k, _ in STEPS].index(row["kind"])]]
    if any(prior.get(k) == "approved" for k in earlier):
        return ("wait", "waiting on the earlier follow-up")
    return None


def thread_ids(conn, prospect_id):
    """Message-IDs already sent to this shop, oldest first, for In-Reply-To and References."""
    return [r["provider_id"] for r in conn.execute(
        """SELECT provider_id FROM emails WHERE prospect_id = %s AND status IN ('sent','replied') AND provider_id LIKE '<%%'
           ORDER BY sent_at, id""", (prospect_id,))]
