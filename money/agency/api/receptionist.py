"""AI receptionist (Vapi), one assistant per client. Front Desk answers after hours, Plus answers 24/7.

The shop forwards its line to the client's Vapi number (after hours on Front Desk). Vapi posts an end-of-call report
to /vapi/webhook; each call becomes a row in receptionist_calls, which the Clients view and overage billing read.
A caller who hangs up before leaving details can get ONE text back, only if the shop turned it on. Text-back is a
stub: it records the text and sends nothing. Never cold texts or calls (TCPA): we only ever answer people who called.

Every call also saves what the caller said (name, callback number, town, problem, emergency). An emergency emails the
owner right away; everything else goes in the next-morning summary (notices.py). On Plus with booking on, the assistant
can book a visit window from the shop's openings through two tools (booking.py), like Housecall Pro's arrival windows.

Vapi field names follow their docs as of 2026-10 (check on Tuesday with a real test call).
"""
import datetime as dt
import json
import re
import secrets
import urllib.error
import urllib.request

import booking
import config
import notices
import sms
from mailer import CENTRAL

TRADE = {"plumbing": "plumbing", "hvac": "heating and air", "roofing": "roofing"}
OUTCOMES = ("booked", "message", "spam", "hung_up")
MISSED_SECONDS = 20          # shorter than this with no details taken = a missed call
TEXTBACK_WINDOW = dt.timedelta(minutes=15)  # only text someone who called in the last 15 minutes
TEXTBACK_GAP = dt.timedelta(days=7)         # at most one text per caller per shop a week

SAFETY = {
    "plumbing": "If they have water pouring in, tell them to shut off the main water valve. If they smell gas, tell "
                "them to leave the house now and call 911 or the gas company from outside, then end the call.",
    "hvac": "If they smell gas or a carbon monoxide alarm is going off, tell them to leave the house now and call 911 "
            "or the gas company from outside, then end the call.",
    "roofing": "If water is coming through a ceiling, tell them to move belongings and stay out from under any "
               "sagging ceiling. Never tell anyone to get on a roof.",
}


def transfer_on(c):
    return bool(digits(c.get("owner_cell")))


def transfer_tool(c):
    """Warm-transfer an emergency to the owner's cell. Vapi calls the owner first and only then connects the caller;
    on no answer the assistant is told the transfer failed and goes back to taking the message (the urgent email
    still goes out). Mode comes from TRANSFER_MODE so it can change without a deploy if Vapi renames it."""
    return {"type": "transferCall", "function": {"name": "transfer_call"}, "destinations": [{
        "type": "number", "number": "+1" + digits(c["owner_cell"]),
        "description": "The owner. Only for an emergency the caller says cannot wait.",
        "message": f"I'm trying to reach someone at {c['business_name']} right now. Please stay on the line.",
        "transferPlan": {"mode": config.TRANSFER_MODE}}]}


def transfer_rule(c):
    if not transfer_on(c):
        return ""
    return (f"\n- EMERGENCY (they say it can't wait): after the safety step, say you will try to reach the owner now, then use "
            f"transfer_call. If it does not connect, say the owner has been alerted and will call right back, and "
            f"finish taking their name, number and address. Never transfer anything that isn't an emergency.")


class VapiError(Exception):
    pass


def hours_text(c):
    days = "Monday to Saturday" if c["open_saturday"] else "Monday to Friday"
    h = lambda x: dt.time(x % 24).strftime("%-I%p").lower() if x < 24 else "midnight"
    return f"{days}, {h(c['open_hour'])} to {h(c['close_hour'])} Central"


def is_after_hours(c, when):
    """True outside the shop's hours (Central). Plus clients get 24/7 answering, but this still tags the call."""
    local = when.astimezone(CENTRAL)
    open_day = local.weekday() < 5 or (local.weekday() == 5 and c["open_saturday"])
    return not (open_day and c["open_hour"] <= local.hour < c["close_hour"])


def prompt(c):
    name, trade = c["business_name"], TRADE[c["trade"]]
    when = "any time of day" if c["plan"] == "front_desk_plus" else "when the office is closed"
    if booking.enabled(c):
        return booking_prompt(c, name, trade, when)
    return f"""You answer the phone for {name}, a {trade} company in Northwest Arkansas, {when}.
Office hours: {hours_text(c)}.

Your job: take a clear message so the team can call back. Get, one question at a time:
1. Their name. 2. The best callback number (read it back). 3. The address or town. 4. What's wrong, in their words.
5. Is it an emergency right now, or can it wait for business hours?
Then say someone from {name} will call them back, and end the call politely.

Rules:
- If asked, say you are the company's automated after-hours assistant. Never claim to be a person.
- Never quote prices, give estimates, promise an arrival time or diagnose the problem.
- Never book a time slot. You take messages only.
- {SAFETY[c["trade"]]}{transfer_rule(c)}
- If you are not sure what they said, ask them to say it again. If you don't know an answer, say you will pass the
  question on. Never guess a name, number or address.
- If the caller is selling something or it's a robocall, thank them and end the call.
- Short sentences, warm and plain. No jargon."""


def booking_prompt(c, name, trade, when):
    return f"""You answer the phone for {name}, a {trade} company in Northwest Arkansas, {when}.
Office hours: {hours_text(c)}.

Your job: take a clear message, and if it is not an emergency, offer to book a visit window. Get, one question at a time:
1. Their name. 2. The best callback number (read it back). 3. The address or town. 4. What's wrong, in their words.
5. Is it an emergency right now, or can it wait for a scheduled visit?
If it's an emergency: do not book. Say you're marking it urgent and the team will call back as soon as they can.
If it can wait: use check_openings, offer at most two openings, and when they pick one, use book_visit with the exact
start the tool gave you. Ask "Is it OK if {name} texts you about this visit?" and pass their answer as ok_to_text.
Read the window back and say the team will call to confirm before they come. If booking fails, take the message instead.

Rules:
- If asked, say you are the company's automated assistant. Never claim to be a person.
- Never quote prices, give estimates, promise an exact arrival time or diagnose the problem. A booking is a window.
- Only book openings the tool gave you. Never invent a time.
- {SAFETY[c["trade"]]}{transfer_rule(c)}
- If you are not sure what they said, ask them to say it again. If you don't know an answer, say you will pass the
  question on. Never guess a name, number or address.
- If the caller is selling something or it's a robocall, thank them and end the call.
- Short sentences, warm and plain. No jargon."""


def assistant(c):
    """The Vapi assistant for one client. Creating it places no calls."""
    name = c["business_name"]
    return {
        "name": f"{name} front desk"[:40],
        "firstMessage": f"Thanks for calling {name}. This is the automated after-hours assistant, and this call may be "
                        "recorded. I can take a message and have someone call you back. What's going on?",
        "model": dict({"provider": "anthropic", "model": config.RECEPTIONIST_MODEL,  # no temperature: the API refuses it since 2026-10-21
                       "messages": [{"role": "system", "content": prompt(c)}]},
                      **({"tools": (booking.tools() if booking.enabled(c) else []) + ([transfer_tool(c)] if transfer_on(c) else [])}
                         if booking.enabled(c) or transfer_on(c) else {})),
        "voice": {"provider": "vapi", "voiceId": "Elliot"},
        "transcriber": {"provider": "deepgram", "model": "nova-3", "language": "en"},
        "maxDurationSeconds": 600,          # 10 minutes caps a stuck call's cost
        "silenceTimeoutSeconds": 30,
        "endCallPhrases": ["goodbye", "bye now"],
        "server": {"url": config.PUBLIC_URL + "/vapi/webhook", "secret": config.VAPI_WEBHOOK_SECRET},
        "serverMessages": ["end-of-call-report"] + (["tool-calls"] if booking.enabled(c) else []),
        "analysisPlan": {"structuredDataSchema": {"type": "object", "properties": {
            "outcome": {"type": "string", "enum": ["message", "spam", "hung_up"],
                        "description": "message if they left details, spam for sales or robocalls, hung_up if they left before giving details"},
            "caller_name": {"type": "string", "description": "the caller's name, as they said it"},
            "callback_number": {"type": "string", "description": "the number they asked to be called back on"},
            "town": {"type": "string", "description": "the address or town of the job"},
            "problem": {"type": "string", "description": "what's wrong, in one short sentence in their words"},
            "emergency": {"type": "boolean", "description": "true only if they said it can't wait (water pouring, no heat in freezing weather, gas smell, active leak)"}}}},
        "metadata": {"client_id": c["id"]},
    }


def vapi(method, path, body=None):
    req = urllib.request.Request("https://api.vapi.ai" + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {config.VAPI_API_KEY}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise VapiError(f"{e.code} {e.read().decode(errors='replace')[:200]}")
    except urllib.error.URLError as e:
        raise VapiError(str(e.reason))


def set_up(conn, c):
    """Create or update the client's assistant on Vapi. Without VAPI_API_KEY it's a dry run that saves nothing remote."""
    a = assistant(c)
    if config.receptionist() == "stub":
        return {"mode": "stub", "assistant_id": c["vapi_assistant_id"], "assistant": a}
    if not config.VAPI_WEBHOOK_SECRET:
        raise VapiError("set VAPI_WEBHOOK_SECRET first, or calls can't be counted")
    aid = c["vapi_assistant_id"]
    out = vapi("PATCH", f"/assistant/{aid}", a) if aid else vapi("POST", "/assistant", a)
    conn.execute("UPDATE clients SET vapi_assistant_id = %s WHERE id = %s", (out["id"], c["id"]))
    return {"mode": "vapi", "assistant_id": out["id"], "assistant": a}


def turn_off(conn, c):
    """Cancelled: delete the client's assistant on Vapi so the forwarded line stops reaching it."""
    aid = c.get("vapi_assistant_id")
    if not aid:
        return "none set up"
    if config.receptionist() != "stub":
        vapi("DELETE", f"/assistant/{aid}")
    conn.execute("UPDATE clients SET vapi_assistant_id = NULL, live_at = NULL WHERE id = %s", (c["id"],))
    return "turned off"


def secret_ok(header):
    return bool(config.VAPI_WEBHOOK_SECRET) and secrets.compare_digest((header or "").encode(),
                                                                       config.VAPI_WEBHOOK_SECRET.encode())


def digits(n):
    d = re.sub(r"\D", "", n or "")
    return d[-10:] if len(d) >= 10 else ""


def when(v):
    try:
        return dt.datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None


def outcome(m, seconds):
    o = ((m.get("analysis") or {}).get("structuredData") or {}).get("outcome")
    if o in OUTCOMES:
        return o
    return "hung_up" if seconds < MISSED_SECONDS else "message"


def find_client(conn, m):
    call = m.get("call") or {}
    aid = m.get("assistantId") or call.get("assistantId") or (m.get("assistant") or {}).get("id")
    if aid:
        row = conn.execute("SELECT * FROM clients WHERE vapi_assistant_id = %s", (aid,)).fetchone()
        if row:
            return row
    num = digits((m.get("phoneNumber") or call.get("phoneNumber") or {}).get("number"))
    if num:
        return conn.execute("SELECT * FROM clients WHERE right(regexp_replace(coalesce(receptionist_number, ''), "
                            "'\\D', '', 'g'), 10) = %s", (num,)).fetchone()
    return None


def handle(conn, payload, now=None):
    """Everything Vapi posts: end-of-call reports and, on Plus with booking on, the booking tool calls."""
    m = payload.get("message") or {}
    if m.get("type") == "tool-calls":
        return booking.tool_calls(conn, m, find_client(conn, m), now)
    return record_call(conn, payload, now)


def link(v):
    return v if isinstance(v, str) and v.startswith("https://") and len(v) < 500 else None


def clean(v, n=200):
    return re.sub(r"\s+", " ", str(v)).strip()[:n] or None if v not in (None, "") else None


def record_call(conn, payload, now=None):
    """Save one end-of-call report (once per Vapi call id), then maybe queue a text-back."""
    m = payload.get("message") or {}
    if m.get("type") != "end-of-call-report":
        return {"ok": True, "ignored": m.get("type") or "unknown"}
    call = m.get("call") or {}
    call_id = call.get("id") or m.get("callId")
    c = find_client(conn, m)
    if not call_id or not c:
        return {"ok": True, "ignored": "no matching client" if call_id else "no call id"}
    started = when(m.get("startedAt") or call.get("startedAt")) or now or dt.datetime.now(dt.timezone.utc)
    ended = when(m.get("endedAt") or call.get("endedAt"))
    seconds = m.get("durationSeconds")
    seconds = int(round(float(seconds))) if seconds is not None else max(0, int((ended - started).total_seconds())) if ended else 0
    o = outcome(m, seconds)
    if conn.execute("SELECT 1 FROM bookings WHERE client_id = %s AND vapi_call_id = %s AND status = 'booked'",
                    (c["id"], call_id)).fetchone():
        o = "booked"
    sd = (m.get("analysis") or {}).get("structuredData") or {}
    caller = (m.get("customer") or call.get("customer") or {}).get("number")
    emergency = sd.get("emergency") is True and o in ("message", "booked")
    cost = m.get("cost")
    art = m.get("artifact") or {}
    row = conn.execute("""INSERT INTO receptionist_calls (client_id, vapi_call_id, started_at, seconds, after_hours,
                          outcome, summary, cost_cents, ended_reason, caller_number, caller_name, callback_number, town,
                          problem, emergency, recording_url, transcript) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                          ON CONFLICT (vapi_call_id) DO NOTHING RETURNING *""",
                       (c["id"], call_id, started, seconds, is_after_hours(c, started), o,
                        ((m.get("analysis") or {}).get("summary") or m.get("summary") or "")[:1000] or None,
                        round(float(cost) * 100) if cost is not None else None, m.get("endedReason"),
                        digits(caller) or None, clean(sd.get("caller_name"), 80),
                        digits(sd.get("callback_number")) or digits(caller) or None, clean(sd.get("town"), 120),
                        clean(sd.get("problem"), 300), emergency, link(art.get("recordingUrl") or m.get("recordingUrl")),
                        str(art.get("transcript") or m.get("transcript") or "")[:20000] or None)).fetchone()
    if not row:
        conn.commit()
        return {"ok": True, "duplicate": True}
    conn.execute("UPDATE clients SET test_call_at = coalesce(test_call_at, now()) WHERE id = %s", (c["id"],))  # go-live tick
    text = textback(conn, c, row["id"], caller, o, started, now) if o == "hung_up" else None
    alert = notices.emergency(conn, c, row) if emergency and c["status"] in ("active", "past_due") else None
    conn.commit()
    return {"ok": True, "call_id": row["id"], "client_id": c["id"], "outcome": o, "textback": text,
            "emergency_alert": alert}


def textback_body(c):
    return (f"Sorry we missed your call to {c['business_name']}. Reply with what you need, or call back during "
            f"office hours ({hours_text(c)}). Reply STOP to opt out.")


def textback(conn, c, call_id, caller, o, started, now=None):
    """One text to a caller who just hung up on the receptionist. Stub: recorded, never sent."""
    now = now or dt.datetime.now(dt.timezone.utc)
    num = digits(caller)
    if not c["textback_enabled"]:
        return "off"
    if c["status"] not in ("active", "past_due"):
        return "skipped: not an active client"
    if not num or o != "hung_up":
        return "skipped: no caller number"
    if now - started > TEXTBACK_WINDOW:
        return "skipped: call too old"
    if conn.execute("SELECT 1 FROM sms_optouts WHERE number = %s", (num,)).fetchone():
        return "skipped: opted out"
    if conn.execute("SELECT 1 FROM textbacks WHERE client_id = %s AND to_number = %s AND created_at > %s",
                    (c["id"], num, now - TEXTBACK_GAP)).fetchone():
        return "skipped: texted this week"
    body = textback_body(c)
    if config.sms() != "twilio":
        conn.execute("INSERT INTO textbacks (client_id, call_id, to_number, body, status) VALUES (%s,%s,%s,%s,'stub')",
                     (c["id"], call_id, num, body))
        return "stub"  # real texts need TEXTBACK=twilio + Twilio keys, set only after 10DLC is approved, on TJ's word
    try:
        sid, err = sms.send(num, body), None
    except sms.SmsError as e:
        sid, err = None, str(e)[:300]  # one try only: a double text is worse than a missed one
    conn.execute("INSERT INTO textbacks (client_id, call_id, to_number, body, status, provider_id, error) "
                 "VALUES (%s,%s,%s,%s,%s,%s,%s)", (c["id"], call_id, num, body, "sent" if sid else "failed", sid, err))
    return "sent" if sid else "failed"


def opt_out(conn, number):
    num = digits(number)
    if not num:
        return None
    conn.execute("INSERT INTO sms_optouts (number) VALUES (%s) ON CONFLICT DO NOTHING", (num,))
    conn.commit()
    return num
