"""The demo line: a number prospects call to hear Front Desk answer for a made-up shop (DEMO_BUSINESS).

It is the Plus assistant with booking on, built from a client-shaped dict that never touches the clients table, so it
is never billed, never in MRR or costs, and its bookings are pretend (nothing is saved, nobody is emailed). Each call
is logged in demo_calls and TJ gets one email with the caller's number: someone who calls a demo is a warm lead who
reached out first. We never call or text them from here (TCPA); TJ decides how to follow up.

Set up with POST /demo/receptionist (dry run without VAPI_API_KEY). TJ buys the number on Vapi and attaches it to the
assistant id this returns, then sets DEMO_NUMBER so /health and the sites can show it.
"""
import datetime as dt
import json

import booking
import config
import db
import notices

MAX_SECONDS = 300  # a demo is a taste, and caps what a prank caller can cost


def shop():
    """A client-shaped dict: Plus, booking on, weekday hours, no owner cell (a demo never rings a real phone)."""
    return {"id": 0, "business_name": config.DEMO_BUSINESS, "trade": "plumbing", "plan": "front_desk_plus",
            "status": "active", "open_hour": 7, "close_hour": 17, "open_saturday": True, "owner_cell": None,
            "booking": dict(booking.DEFAULT), "calendar": None,
            "profile": {"greeting": f"Thanks for calling {config.DEMO_BUSINESS}. This is a demo of Front Desk, the "
                                    "automated assistant, and this call may be recorded. Pretend you're a customer: "
                                    "what's going on?",
                        "fees": [{"name": "after-hours service call", "amount": "$149 (demo price)"}],
                        "faq": [{"q": "Is this a real plumber?",
                                 "a": "No, this is a demo line. Your real shop's assistant uses your name, hours and services."}],
                        "languages": ["en", "es"]}}


def assistant():
    import receptionist
    a = receptionist.assistant(shop())
    a["name"] = "Front Desk demo"
    a["maxDurationSeconds"] = MAX_SECONDS
    a["metadata"] = {"demo": True}
    return a


def assistant_id(conn):
    return db.setting(conn, "demo_assistant_id")


def set_up(conn):
    import receptionist
    a = assistant()
    if config.receptionist() == "stub":
        return {"mode": "stub", "assistant_id": assistant_id(conn), "assistant": a}
    aid = assistant_id(conn)
    out = receptionist.vapi("PATCH", f"/assistant/{aid}", a) if aid else receptionist.vapi("POST", "/assistant", a)
    conn.execute("""INSERT INTO settings (key, value) VALUES ('demo_assistant_id', to_jsonb(%s::text))
                    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()""", (out["id"],))
    conn.commit()
    return {"mode": "vapi", "assistant_id": out["id"], "assistant": a}


def is_demo(conn, m):
    call = m.get("call") or {}
    aid = m.get("assistantId") or call.get("assistantId") or (m.get("assistant") or {}).get("id")
    meta = (m.get("assistant") or {}).get("metadata") or call.get("metadata") or {}
    return meta.get("demo") is True or (aid is not None and aid == assistant_id(conn))


def tool_calls(conn, m, now=None):
    """Same answers as a real Plus shop (client id 0 has no bookings, so every window is open), never saved."""
    now = now or dt.datetime.now(dt.timezone.utc)
    results = []
    for tc in m.get("toolCallList") or []:
        fn = tc.get("function") or {}
        args = fn.get("arguments") or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except ValueError:
                args = {}
        if fn.get("name") == "check_openings":
            free = booking.openings(conn, shop(), now, booking.parse_day(args.get("day"), now))[:booking.OFFER]
            out = ("Openings: " + "; ".join(f"{booking.label(s, e)} (start {booking.slot_id(s)})" for s, e in free)
                   if free else "No openings that day. Offer the soonest day instead.")
        elif fn.get("name") == "book_visit":
            out = ("Booked (demo, nothing saved). Tell the caller the team would call to confirm, and that this is how "
                   "their own customers would be booked.")
        else:
            out = "Unknown tool. Take a message instead."
        results.append({"toolCallId": tc.get("id"), "result": out})
    return {"results": results}


def record(conn, m, send=None):
    import receptionist
    if m.get("type") != "end-of-call-report":
        return {"ok": True, "demo": True, "ignored": m.get("type") or "unknown"}
    call = m.get("call") or {}
    caller = receptionist.digits((m.get("customer") or call.get("customer") or {}).get("number"))
    seconds = int(round(float(m.get("durationSeconds") or 0)))
    summary = ((m.get("analysis") or {}).get("summary") or "")[:1000] or None
    row = conn.execute("""INSERT INTO demo_calls (vapi_call_id, caller_number, seconds, summary) VALUES (%s,%s,%s,%s)
                          ON CONFLICT (vapi_call_id) DO NOTHING RETURNING id""",
                       (call.get("id") or m.get("callId"), caller or None, seconds, summary)).fetchone()
    conn.commit()
    if not row:
        return {"ok": True, "demo": True, "duplicate": True}
    alert = notices.operator(f"Someone called the Front Desk demo ({notices.pretty(caller)})",
                             f"A {max(1, round(seconds / 60))} minute demo call from {notices.pretty(caller)}.\n\n"
                             f"{summary or 'No summary.'}\n\nThey called us first. Follow up by email or a call back "
                             "only if they asked for one.", send=send)
    return {"ok": True, "demo": True, "demo_call_id": row["id"], "alert": alert}


def handle(conn, m, now=None):
    if m.get("type") == "tool-calls":
        return tool_calls(conn, m, now)
    return record(conn, m)
