"""Plus calendar booking: the receptionist books a visit window from the shop's own openings.

Modeled on how field-service tools do it (Housecall Pro's online booking: fixed arrival windows on open days, a
"soonest availability" lead time, a window is full once it has a job). The shop picks its windows (default 8-10, 10-12,
1-3, 3-5), how many jobs fit in each, and how far ahead callers can book. Emergencies are never booked: they go to the
owner right away (notices.py). The owner sees bookings three ways: an email the moment one is made, the morning
summary, and a calendar feed (/cal/<token>.ics) that Google Calendar or an iPhone subscribes to. No Google sign-in.

Vapi tool calls follow docs.vapi.ai/tools/custom-tools as of 2026-10: a "tool-calls" message with toolCallList
[{id, function: {name, arguments}}], answered with {"results": [{"toolCallId", "result"}]}, result a one-line string.
"""
import datetime as dt
import json
import re
import secrets

import config
import notices
from mailer import CENTRAL

DEFAULT = {"windows": [8, 10, 13, 15], "length": 2, "per_window": 1, "days_ahead": 7, "lead_hours": 3}
LIMITS = {"length": (1, 4), "per_window": (1, 10), "days_ahead": (1, 21), "lead_hours": (0, 48)}
OFFER = 3  # openings read out per check


class BookingError(Exception):
    pass


def enabled(c):
    return c.get("plan") == "front_desk_plus" and bool(c.get("booking"))


def settings(c):
    return dict(DEFAULT, **(c.get("booking") or {}))


def validate(c, b):
    """Clean the shop's booking settings, or raise BookingError saying what's wrong."""
    out = dict(DEFAULT, **{k: v for k, v in b.items() if v is not None})
    for k, (lo, hi) in LIMITS.items():
        if not isinstance(out[k], int) or not lo <= out[k] <= hi:
            raise BookingError(f"{k} must be {lo} to {hi}")
    w = sorted(set(out["windows"]))
    if not w or len(w) > 8 or any(not isinstance(h, int) for h in w):
        raise BookingError("give 1 to 8 window start hours")
    for h in w:
        if h < c["open_hour"] or h + out["length"] > c["close_hour"]:
            raise BookingError(f"the {label_hour(h)} window falls outside office hours")
    for a, b2 in zip(w, w[1:]):
        if b2 - a < out["length"]:
            raise BookingError("windows overlap")
    out["windows"] = w
    return {k: out[k] for k in DEFAULT}


def label_hour(h):
    return dt.time(h % 24).strftime("%-I%p").lower().replace(":00", "") if h < 24 else "midnight"


def label(start, end):
    s, e = start.astimezone(CENTRAL), end.astimezone(CENTRAL)
    sh = s.strftime("%-I").lower() if s.strftime("%p") == e.strftime("%p") else s.strftime("%-I%p").lower()
    return f"{s.strftime('%A %B %-d')}, {sh} to {e.strftime('%-I%p').lower()}"


def open_day(c, d):
    return d.weekday() < 5 or (d.weekday() == 5 and c["open_saturday"])


def openings(conn, c, now=None, day=None):
    """Free windows from now + lead time through days_ahead, in Central. day narrows to one date."""
    now = now or dt.datetime.now(dt.timezone.utc)
    b = settings(c)
    earliest = now + dt.timedelta(hours=b["lead_hours"])
    first = now.astimezone(CENTRAL).date()
    taken = {}
    for r in conn.execute("""SELECT window_start, count(*) AS n FROM bookings WHERE client_id = %s AND status = 'booked'
                             AND window_start >= %s GROUP BY window_start""", (c["id"], now)).fetchall():
        taken[r["window_start"]] = r["n"]
    out = []
    for i in range(b["days_ahead"] + 1):
        d = first + dt.timedelta(days=i)
        if not open_day(c, d) or (day and d != day):
            continue
        for h in b["windows"]:
            start = dt.datetime.combine(d, dt.time(h), CENTRAL)
            if start < earliest or taken.get(start, 0) >= b["per_window"]:
                continue
            out.append((start, start + dt.timedelta(hours=b["length"])))
    return out


def slot_id(start):
    return start.astimezone(CENTRAL).strftime("%Y-%m-%dT%H:%M")


def parse_day(text, now):
    """'today', 'tomorrow', a weekday name, or YYYY-MM-DD. Anything else: no filter."""
    t = (text or "").strip().lower()
    today = now.astimezone(CENTRAL).date()
    if not t or t in ("any", "soonest", "first available"):
        return None
    if t == "today":
        return today
    if t == "tomorrow":
        return today + dt.timedelta(days=1)
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, name in enumerate(days):
        if t.startswith(name[:3]):
            return today + dt.timedelta(days=(i - today.weekday()) % 7 or 7)
    try:
        return dt.date.fromisoformat(t[:10])
    except ValueError:
        return None


def tools():
    """The two Vapi function tools (only on Plus with booking on). Same server and secret as the call reports."""
    server = {"url": config.PUBLIC_URL + "/vapi/webhook", "secret": config.VAPI_WEBHOOK_SECRET}
    return [
        {"type": "function", "server": server,
         "messages": [{"type": "request-start", "content": "One moment while I check the schedule."}],
         "function": {"name": "check_openings",
                      "description": "Open visit windows for this shop. Call before offering any time.",
                      "parameters": {"type": "object", "properties": {
                          "day": {"type": "string", "description": "today, tomorrow, a weekday name, YYYY-MM-DD, or soonest"}}}}},
        {"type": "function", "server": server,
         "messages": [{"type": "request-start", "content": "Booking that now."}],
         "function": {"name": "book_visit",
                      "description": "Book one visit window the caller picked from check_openings. Never for emergencies.",
                      "parameters": {"type": "object", "required": ["start", "customer_name", "callback_number"],
                                     "properties": {
                                         "start": {"type": "string", "description": "the exact start check_openings gave, like 2026-10-27T08:00"},
                                         "customer_name": {"type": "string"},
                                         "callback_number": {"type": "string"},
                                         "address": {"type": "string"},
                                         "problem": {"type": "string", "description": "what's wrong, one sentence"},
                                         "ok_to_text": {"type": "boolean", "description": "true only if they said yes to texts about this visit"}}}}},
    ]


def digits(n):
    d = re.sub(r"\D", "", n or "")
    return d[-10:] if len(d) >= 10 else ""


def check(conn, c, args, now):
    if not enabled(c) or c["status"] not in ("active", "past_due"):
        return "Booking is off for this shop. Take a message instead."
    want = parse_day(args.get("day"), now)
    free = openings(conn, c, now, want)
    if not free and want:
        free = openings(conn, c, now)
        if free:
            return "Nothing open that day. Next openings: " + "; ".join(
                f"{label(s, e)} (start {slot_id(s)})" for s, e in free[:OFFER])
    if not free:
        return "No openings in the next week. Take a message and say the team will call to schedule."
    return "Openings: " + "; ".join(f"{label(s, e)} (start {slot_id(s)})" for s, e in free[:OFFER])


def book(conn, c, args, call_id=None, now=None):
    """Book one window. Locks the client row so two callers can't take the last spot. Returns the booking row."""
    now = now or dt.datetime.now(dt.timezone.utc)
    if not enabled(c) or c["status"] not in ("active", "past_due"):
        raise BookingError("Booking is off for this shop. Take a message instead.")
    name = re.sub(r"\s+", " ", str(args.get("customer_name") or "")).strip()[:80]
    number = digits(str(args.get("callback_number") or ""))
    if not name or not number:
        raise BookingError("Need the caller's name and a 10-digit callback number before booking.")
    try:
        start = dt.datetime.fromisoformat(str(args.get("start") or "")[:16]).replace(tzinfo=CENTRAL)
    except ValueError:
        raise BookingError("Use the exact start check_openings gave.")
    conn.execute("SELECT id FROM clients WHERE id = %s FOR UPDATE", (c["id"],))
    if call_id and conn.execute("SELECT 1 FROM bookings WHERE vapi_call_id = %s AND status = 'booked'", (call_id,)).fetchone():
        raise BookingError("This caller is already booked on this call.")
    free = {s: e for s, e in openings(conn, c, now)}
    if start not in free:
        alt = list(free.items())[:2]
        raise BookingError("That opening isn't free. " + ("Offer these instead: " + "; ".join(
            f"{label(s, e)} (start {slot_id(s)})" for s, e in alt) if alt else "Take a message instead."))
    row = conn.execute("""INSERT INTO bookings (client_id, vapi_call_id, window_start, window_end, customer_name,
                          callback_number, address, problem, ok_to_text) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                       (c["id"], call_id, start, free[start], name, number,
                        (str(args.get("address") or "").strip()[:200] or None),
                        (str(args.get("problem") or "").strip()[:300] or None), args.get("ok_to_text") is True)).fetchone()
    notices.booking(conn, c, row)
    return row


def tool_calls(conn, m, c, now=None):
    """Answer Vapi's tool calls. Always 200 with one result per call, so the assistant can fall back to a message."""
    now = now or dt.datetime.now(dt.timezone.utc)
    call_id = (m.get("call") or {}).get("id")
    results = []
    for tc in m.get("toolCallList") or [t.get("toolCall") or {} for t in m.get("toolWithToolCallList") or []]:
        fn = tc.get("function") or {}
        name, args = fn.get("name") or tc.get("name"), fn.get("arguments", tc.get("arguments")) or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except ValueError:
                args = {}
        if not c:
            out = "This line isn't set up for booking. Take a message instead."
        elif name == "check_openings":
            out = check(conn, c, args, now)
        elif name == "book_visit":
            try:
                b = book(conn, c, args, call_id, now)
                conn.commit()
                out = (f"Booked: {label(b['window_start'], b['window_end'])}. Tell the caller the team will call to "
                       "confirm before they come.")
            except BookingError as e:
                conn.rollback()
                out = str(e)
        else:
            out = "Unknown tool. Take a message instead."
        results.append({"toolCallId": tc.get("id"), "result": " ".join(out.split())})
    return {"results": results}


def calendar_token(conn, c):
    if c.get("calendar_token"):
        return c["calendar_token"]
    t = secrets.token_urlsafe(18)
    conn.execute("UPDATE clients SET calendar_token = %s WHERE id = %s", (t, c["id"]))
    return t


def calendar_url(token):
    return f"{config.PUBLIC_URL}/cal/{token}.ics" if token else None


def ics_escape(s):
    return (s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold(line):
    """RFC 5545: lines over 75 octets continue on the next line after a space."""
    out, b = [], line.encode()
    while len(b) > 75:
        cut = 75
        while (b[cut] & 0xC0) == 0x80:  # don't split a UTF-8 character
            cut -= 1
        out.append(b[:cut].decode())
        b = b" " + b[cut:]
    out.append(b.decode())
    return "\r\n".join(out)


def ics(conn, c, now=None):
    """The owner's calendar feed: booked visits from 30 days back. Read-only; the token is the only key."""
    now = now or dt.datetime.now(dt.timezone.utc)
    z = lambda t: t.astimezone(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    rows = conn.execute("""SELECT * FROM bookings WHERE client_id = %s AND status IN ('booked', 'done')
                           AND window_start >= %s ORDER BY window_start""",
                        (c["id"], now - dt.timedelta(days=30))).fetchall()
    host = config.PUBLIC_URL.split("//")[-1].split("/")[0]
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sites by TJ//Front Desk//EN", "CALSCALE:GREGORIAN",
             f"X-WR-CALNAME:{ics_escape(c['business_name'] + ' bookings')}", "X-WR-TIMEZONE:America/Chicago",
             "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M"]
    for b in rows:
        where = b["address"] or ""
        desc = "\n".join(x for x in (b["problem"], f"Call back: {notices.pretty(b['callback_number'])}",
                                     "Texts OK" if b["ok_to_text"] else "No texts", "Booked by Front Desk") if x)
        lines += ["BEGIN:VEVENT", f"UID:booking-{b['id']}@{host}", f"DTSTAMP:{z(b['updated_at'])}",
                  f"DTSTART:{z(b['window_start'])}", f"DTEND:{z(b['window_end'])}",
                  f"SUMMARY:{ics_escape(('Done: ' if b['status'] == 'done' else '') + 'Visit: ' + b['customer_name'])}",
                  f"LOCATION:{ics_escape(where)}", f"DESCRIPTION:{ics_escape(desc)}", "STATUS:CONFIRMED", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return "\r\n".join(fold(x) for x in lines) + "\r\n"
