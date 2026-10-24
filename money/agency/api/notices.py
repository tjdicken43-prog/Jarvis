"""Owner emails: what Front Desk hands the shop. Three kinds, each saved in owner_notices whether it sends or not.

- emergency: the moment a caller says it can't wait, so the owner can call back tonight, not tomorrow
  (answering services like Smith.ai and Ruby page the on-call person for urgent calls instead of waiting).
- booking (Plus): the moment the receptionist books a visit window.
- web_request: the moment someone sends the live site's "request a call back" form, with links to their photos.
- summary: every morning at the shop's summary hour (default 6am Central), every call since the last one: who, where,
  what's wrong, callback number, emergency or not, hang-ups, today's bookings. A quiet night says so, so the owner
  knows it's working.

NOTIFY=stub (the default) builds and saves every email and sends nothing. NOTIFY=smtp sends from the Workspace inbox.
These are to paying clients about their own calls, so they skip the cold-email pause, window and cap.
"""
import datetime as dt
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import config
import mailer
from mailer import CENTRAL

LOOKBACK = dt.timedelta(hours=24)  # the first summary covers the last day


def pretty(n):
    d = "".join(ch for ch in (n or "") if ch.isdigit())[-10:]
    return f"({d[:3]}) {d[3:6]}-{d[6:]}" if len(d) == 10 else (n or "no number")


def to_of(c):
    return (c.get("notify_email") or c["email"]).strip()


def clock(t):
    return t.astimezone(CENTRAL).strftime("%-I:%M%p").lower().replace(":00", "")


def mins(s):
    return f"{max(1, round((s or 0) / 60))} min"


def save(conn, c, kind, subject, body, day=None, period_end=None, send=None):
    """Save the notice, then send it if NOTIFY=smtp. A failed send is saved as failed, never retried in a loop."""
    to = to_of(c)
    status, error = "stub", None
    if config.notifier() == "smtp":
        msg = EmailMessage()
        msg["From"] = formataddr((f"Front Desk for {c['business_name']}"[:70], config.NOTIFY_FROM_EMAIL))
        msg["To"] = to
        msg["Subject"] = subject
        msg["Message-ID"] = make_msgid(domain=(config.NOTIFY_FROM_EMAIL.split("@")[-1] or None))
        msg.set_content(body)
        try:
            (send or mailer.smtp_send)(msg)
            status = "sent"
        except Exception as e:
            status, error = "failed", type(e).__name__
    return conn.execute("""INSERT INTO owner_notices (client_id, kind, day, period_end, to_email, subject, body, status,
                           error) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id, status""",
                        (c["id"], kind, day, period_end, to, subject, body, status, error)).fetchone()


def call_lines(r):
    who = ", ".join(x for x in (r["caller_name"] or "Name not given", r["town"]) if x)
    out = [f"- {clock(r['started_at'])}, {mins(r['seconds'])}. {who}. Call back: {pretty(r['callback_number'] or r['caller_number'])}"]
    if r["problem"] or r["summary"]:
        out.append(f"  {r['problem'] or r['summary']}")
    return out


def emergency(conn, c, r, send=None):
    """Right away, one email per urgent call."""
    subject = f"URGENT call for {c['business_name']}: call {r['caller_name'] or 'them'} back"
    body = "\n".join([f"Someone called {c['business_name']} at {clock(r['started_at'])} and said it can't wait.", ""]
                     + call_lines(r) + ["", "The caller was told the team will call back as soon as they can.",
                                        "", "Front Desk by " + config.SENDER_BUSINESS])
    return save(conn, c, "emergency", subject, body, send=send)["status"]


def booking_line(b):
    from booking import label
    where = f", {b['address']}" if b["address"] else ""
    out = [f"- {label(b['window_start'], b['window_end'])}: {b['customer_name']}{where}. "
           f"Call back: {pretty(b['callback_number'])}{'. Texts OK' if b['ok_to_text'] else ''}"]
    if b["problem"]:
        out.append(f"  {b['problem']}")
    return out


def booking(conn, c, b, send=None):
    from booking import label
    subject = f"New booking for {c['business_name']}: {label(b['window_start'], b['window_end'])}"
    body = "\n".join(["Front Desk booked a visit from a call:", ""] + booking_line(b)
                     + ["", "The caller was told the team will call to confirm before coming. It's in your calendar "
                            "feed too.", "", "Front Desk by " + config.SENDER_BUSINESS])
    return save(conn, c, "booking", subject, body, send=send)["status"]


def web_request(conn, c, r, send=None):
    subject = f"Website request for {c['business_name']}: {r['name']}, {r['job'] or 'call back'}"
    body = "\n".join([f"Someone sent the form on your website at {clock(r['created_at'])}:", "",
                      f"- {r['name']}{', ' + r['town'] if r['town'] else ''}. Call back: {pretty(r['phone'])}",
                      f"  {r['job'] or 'No job picked'}{'. When: ' + r['day'] if r['day'] else ''}"]
                     + ([f"  Photo: {u}" for u in r.get("photos") or []]) + ["", "Front Desk by " + config.SENDER_BUSINESS])
    return save(conn, c, "web_request", subject, body, send=send)["status"]


def summary(conn, c, start, end):
    """Subject and body of the morning summary for calls in [start, end)."""
    calls = conn.execute("""SELECT * FROM receptionist_calls WHERE client_id = %s AND started_at >= %s AND started_at < %s
                            ORDER BY started_at""", (c["id"], start, end)).fetchall()
    day = end.astimezone(CENTRAL).date()
    today = conn.execute("""SELECT * FROM bookings WHERE client_id = %s AND status = 'booked' AND window_start >= %s
                            AND window_start < %s ORDER BY window_start""",
                         (c["id"], dt.datetime.combine(day, dt.time(0), CENTRAL),
                          dt.datetime.combine(day + dt.timedelta(days=1), dt.time(0), CENTRAL))).fetchall()
    forms = conn.execute("""SELECT * FROM site_requests WHERE client_id = %s AND created_at >= %s AND created_at < %s
                            ORDER BY created_at""", (c["id"], start, end)).fetchall()
    urgent = [r for r in calls if r["emergency"]]
    taken = [r for r in calls if not r["emergency"] and r["outcome"] in ("message", "booked")]
    hung = [r for r in calls if r["outcome"] == "hung_up"]
    spam = sum(r["outcome"] == "spam" for r in calls)
    texts = {t["call_id"]: t["status"] for t in conn.execute(
        "SELECT call_id, status FROM textbacks WHERE call_id = ANY(%s)", ([r["id"] for r in hung],)).fetchall()}
    since = start.astimezone(CENTRAL).strftime("%-I:%M%p %A").lower().replace(":00", "").capitalize()
    n = len(urgent) + len(taken) + len(forms)
    if not calls and not today and not forms:
        subject = f"Quiet night at {c['business_name']}: no calls"
    else:
        bits = [f"{n} message{'s' if n != 1 else ''}" if n else "", f"{len(urgent)} urgent" if urgent else "",
                f"{len(today)} booked today" if today else ""]
        subject = f"Front Desk for {c['business_name']}: " + ", ".join(b for b in bits if b) if any(bits) else \
            f"Front Desk for {c['business_name']}: {len(hung)} hang-up{'s' if len(hung) != 1 else ''}"
    lines = [f"Good morning. Here's what Front Desk handled since {since}.", ""]
    if not calls:
        lines += ["No calls came in. The line is on and answering.", ""]
    if urgent:
        lines += ["URGENT (you got an email for each)"] + [x for r in urgent for x in call_lines(r)] + [""]
    if taken:
        lines += ["Messages to call back"] + [x for r in taken for x in call_lines(r)] + [""]
    if forms:
        lines += ["From your website (you got an email for each)"]
        for f in forms:
            lines.append(f"- {clock(f['created_at'])}. {f['name']}{', ' + f['town'] if f['town'] else ''}. "
                         f"Call back: {pretty(f['phone'])}. {f['job'] or 'Call back'}")
        lines.append("")
    if hung:
        lines += ["Hung up before leaving details"]
        for r in hung:
            t = {"stub": " (text-back saved, not sent yet)", "sent": " (texted back)"}.get(texts.get(r["id"]), "")
            lines.append(f"- {clock(r['started_at'])}, from {pretty(r['caller_number'])}{t}")
        lines.append("")
    if spam:
        lines += [f"Sales calls and robocalls ended: {spam}", ""]
    if today:
        lines += ["Booked for today"] + [x for b in today for x in booking_line(b)] + [""]
    lines += ["Front Desk by " + config.SENDER_BUSINESS + ". Reply to change anything."]
    return subject, "\n".join(lines)


def due_hour(c, local):
    return local.hour >= c["summary_hour"]


def run_summaries(conn, now=None, send=None):
    """Send each paying client's morning summary once a day, at or after its summary hour (Central). Safe to run often."""
    now = now or dt.datetime.now(dt.timezone.utc)
    local = now.astimezone(CENTRAL)
    done = []
    for c in conn.execute("""SELECT * FROM clients WHERE status IN ('active', 'past_due')
                             AND (vapi_assistant_id IS NOT NULL OR receptionist_number IS NOT NULL) ORDER BY id""").fetchall():
        if not due_hour(c, local):
            continue
        if conn.execute("SELECT 1 FROM owner_notices WHERE client_id = %s AND kind = 'summary' AND day = %s",
                        (c["id"], local.date())).fetchone():
            continue
        last = conn.execute("SELECT max(period_end) AS t FROM owner_notices WHERE client_id = %s AND kind = 'summary'",
                            (c["id"],)).fetchone()["t"]
        start = last or max(now - LOOKBACK, c["started_at"] or now - LOOKBACK)
        subject, body = summary(conn, c, start, now)
        row = save(conn, c, "summary", subject, body, local.date(), now, send)
        conn.commit()
        done.append({"client_id": c["id"], "status": row["status"], "subject": subject})
    return {"mode": config.notifier(), "summaries": done}
