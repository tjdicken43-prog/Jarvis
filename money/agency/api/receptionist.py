"""AI receptionist (Vapi), one assistant per client. Front Desk answers after hours, Plus answers 24/7.

The shop forwards its line to the client's Vapi number (after hours on Front Desk). Vapi posts an end-of-call report
to /vapi/webhook; each call becomes a row in receptionist_calls, which the Clients view and overage billing read.
A caller who hangs up before leaving details can get ONE text back, only if the shop turned it on. Text-back is a
stub: it records the text and sends nothing. Never cold texts or calls (TCPA): we only ever answer people who called.

Vapi field names follow their docs as of 2026-10 (check on Tuesday with a real test call).
"""
import datetime as dt
import json
import re
import secrets
import urllib.error
import urllib.request

import config
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
- {SAFETY[c["trade"]]}
- If the caller is selling something or it's a robocall, thank them and end the call.
- Short sentences, warm and plain. No jargon."""


def assistant(c):
    """The Vapi assistant for one client. Creating it places no calls."""
    name = c["business_name"]
    return {
        "name": f"{name} front desk"[:40],
        "firstMessage": f"Thanks for calling {name}. This is the after-hours assistant, and this call may be "
                        "recorded. I can take a message and have someone call you back. What's going on?",
        "model": {"provider": "anthropic", "model": config.RECEPTIONIST_MODEL, "temperature": 0.3,
                  "messages": [{"role": "system", "content": prompt(c)}]},
        "voice": {"provider": "vapi", "voiceId": "Elliot"},
        "transcriber": {"provider": "deepgram", "model": "nova-3", "language": "en"},
        "maxDurationSeconds": 600,          # 10 minutes caps a stuck call's cost
        "silenceTimeoutSeconds": 30,
        "endCallPhrases": ["goodbye", "bye now"],
        "server": {"url": config.PUBLIC_URL + "/vapi/webhook", "secret": config.VAPI_WEBHOOK_SECRET},
        "serverMessages": ["end-of-call-report"],
        "analysisPlan": {"structuredDataSchema": {"type": "object", "properties": {
            "outcome": {"type": "string", "enum": ["message", "spam", "hung_up"],
                        "description": "message if they left details, spam for sales or robocalls, hung_up if they left before giving details"},
            "emergency": {"type": "boolean"}}}},
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


def secret_ok(header):
    return bool(config.VAPI_WEBHOOK_SECRET) and secrets.compare_digest(header or "", config.VAPI_WEBHOOK_SECRET)


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
    cost = m.get("cost")
    row = conn.execute("""INSERT INTO receptionist_calls (client_id, vapi_call_id, started_at, seconds, after_hours,
                          outcome, summary, cost_cents, ended_reason) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                          ON CONFLICT (vapi_call_id) DO NOTHING RETURNING id""",
                       (c["id"], call_id, started, seconds, is_after_hours(c, started), o,
                        ((m.get("analysis") or {}).get("summary") or m.get("summary") or "")[:1000] or None,
                        round(float(cost) * 100) if cost is not None else None, m.get("endedReason"))).fetchone()
    if not row:
        conn.commit()
        return {"ok": True, "duplicate": True}
    caller = (m.get("customer") or call.get("customer") or {}).get("number")
    text = textback(conn, c, row["id"], caller, o, started, now) if o == "hung_up" else None
    conn.commit()
    return {"ok": True, "call_id": row["id"], "client_id": c["id"], "outcome": o, "textback": text}


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
    conn.execute("INSERT INTO textbacks (client_id, call_id, to_number, body, status) VALUES (%s,%s,%s,%s,'stub')",
                 (c["id"], call_id, num, textback_body(c)))
    return "stub"  # TEXTBACK is stub only: a real SMS provider (10DLC registered) comes later, on TJ's word


def opt_out(conn, number):
    num = digits(number)
    if not num:
        return None
    conn.execute("INSERT INTO sms_optouts (number) VALUES (%s) ON CONFLICT DO NOTHING", (num,))
    conn.commit()
    return num
