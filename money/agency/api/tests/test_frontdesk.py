"""Front Desk features the demos sell: caller details, urgent heads-up, morning summary, Plus booking + calendar feed,
Plus review asks, the live site. Real throwaway Postgres; nothing is ever sent (fake SMTP, NOTIFY=stub).

  TEST_DATABASE_URL=postgresql://postgres@localhost/agency_test python3 money/agency/api/tests/test_frontdesk.py
The database's public schema is wiped first, so never point this at a real one.
"""
import datetime as dt
import os
import pathlib
import sys

API = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API))
URL = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres@localhost/agency_test")
os.environ.update(DATABASE_URL=URL, OPERATOR_TOKEN="test-token", PUBLIC_URL="https://api.example.test")
for k in ("ANTHROPIC_API_KEY", "MAILER", "SMTP_USER", "SMTP_PASSWORD", "FROM_EMAIL", "NOTIFY", "NOTIFY_FROM_EMAIL",
          "STRIPE_SECRET_KEY", "VAPI_API_KEY", "VAPI_WEBHOOK_SECRET"):
    os.environ.pop(k, None)

import psycopg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import booking  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402
import main  # noqa: E402
import notices  # noqa: E402
import receptionist  # noqa: E402
import reviews  # noqa: E402
from mailer import CENTRAL  # noqa: E402

with psycopg.connect(URL, autocommit=True) as c:
    c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    c.execute((API / "schema.sql").read_text())
    c.execute((API / "schema.sql").read_text())  # re-running is safe
    c.execute("""INSERT INTO prospects (id, name, trade, city, phone, email, website, rating, review_count, facts, status)
                 VALUES ('overture/r', 'Ridge Roofing', 'roofing', 'Bella Vista', '479-273-0100', 'info@ridgeroof.com',
                 'https://ridgeroof.com', 4.7, 38, '{"colors": ["#8a2b1a"], "towns": ["Bella Vista", "Bentonville"]}', 'built')""")

import quality  # noqa: E402
quality._dns_works = lambda: False  # no real MX lookups for made-up test shops

api = TestClient(main.app)
H = {"Authorization": "Bearer test-token"}
ok = lambda r, code=200: (r.status_code == code) or sys.exit(f"{r.request.method} {r.request.url}: {r.status_code} {r.text}")
FRI_8PM = dt.datetime(2026, 10, 23, 20, 0, tzinfo=CENTRAL)
SAT_630AM = dt.datetime(2026, 10, 24, 6, 30, tzinfo=CENTRAL)
MON_11AM = dt.datetime(2026, 10, 26, 11, 0, tzinfo=CENTRAL)
config.VAPI_WEBHOOK_SECRET = "vsecret"
vh = {"X-Vapi-Secret": "vsecret"}


def conn():
    return db.connect()


def client(cid):
    with conn() as c:
        return c.execute("SELECT * FROM clients WHERE id = %s", (cid,)).fetchone()


# Two paying clients: Ridge Roofing on Plus (from a prospect), Hog Valley HVAC on Front Desk (typed in)
plus = api.post("/clients", json={"prospect_id": "overture/r", "plan": "front_desk_plus"}, headers=H).json()
fd = api.post("/clients", json={"business_name": "Hog Valley HVAC", "email": "office@hogvalley.com", "trade": "hvac"},
              headers=H).json()
P, F = plus["id"], fd["id"]
ok(api.post(f"/clients/{P}/site", json={}, headers=H), 400)  # not paid yet: no live site
with conn() as c:
    c.execute("UPDATE clients SET status = 'active', started_at = %s WHERE id IN (%s, %s)", (FRI_8PM - dt.timedelta(days=3), P, F))
    c.commit()
for cid, num in ((P, "479-555-0142"), (F, "479-555-0143")):
    ok(api.post(f"/clients/{cid}/receptionist", json={"open_hour": 7, "close_hour": 18, "receptionist_number": num}, headers=H))
assert api.get("/health").json()["notify"] == "stub"

# Owner settings: where emails go, summary hour, Google review link
ok(api.post(f"/clients/{P}/owner", json={"notify_email": "nope"}, headers=H), 400)
ok(api.post(f"/clients/{P}/owner", json={"review_url": "http://g.page/x"}, headers=H), 400)
ok(api.post(f"/clients/{P}/owner", json={"summary_hour": 3}, headers=H), 422)
ok(api.post(f"/clients/{P}/owner", json={}), 401)
r = api.post(f"/clients/{P}/owner", json={"notify_email": "Boss@RidgeRoof.com", "summary_hour": 6,
                                          "review_url": "https://g.page/r/ridge-roofing/review"}, headers=H); ok(r)
assert r.json()["notify_email"] == "boss@ridgeroof.com" and r.json()["calendar_url"] is None, r.json()

# Booking: Plus only, windows inside office hours, no overlaps
ok(api.post(f"/clients/{F}/booking", json={}, headers=H), 409)
ok(api.post(f"/clients/{P}/booking", json={"windows": [6]}, headers=H), 400)
ok(api.post(f"/clients/{P}/booking", json={"windows": [8, 9]}, headers=H), 400)
ok(api.post(f"/clients/{P}/booking", json={"length": 9}, headers=H), 400)
r = api.post(f"/clients/{P}/booking", json={"lead_hours": 3}, headers=H); ok(r)
out = r.json()
assert out["booking"]["windows"] == [8, 10, 13, 15] and out["tools"] == ["check_openings", "book_visit"], out
cal = out["calendar_url"]
assert cal.startswith("https://api.example.test/cal/") and cal.endswith(".ics"), out
a = receptionist.assistant(client(P))
assert "tool-calls" in a["serverMessages"] and "check_openings" in a["model"]["messages"][0]["content"], a
assert "Never invent a time" in a["model"]["messages"][0]["content"] and "do not book" in a["model"]["messages"][0]["content"]
assert a["model"]["tools"][1]["server"] == {"url": "https://api.example.test/vapi/webhook", "secret": "vsecret"}
props = a["analysisPlan"]["structuredDataSchema"]["properties"]
assert {"caller_name", "callback_number", "town", "problem", "emergency"} <= set(props), props
fa = receptionist.assistant(client(F))
assert "tools" not in fa["model"] and "Never book a time slot" in fa["model"]["messages"][0]["content"], fa
assert fa["serverMessages"] == ["end-of-call-report"]

# Openings: from Friday 8pm with a 3 hour lead, the first is Monday 8-10am (closed weekends)
with conn() as c:
    free = booking.openings(c, client(P), FRI_8PM)
assert booking.label(*free[0]) == "Monday October 26, 8 to 10am" and len(free) == 20, [booking.label(*x) for x in free[:3]]
assert booking.label(*free[1]) == "Monday October 26, 10am to 12pm"
assert booking.parse_day("tuesday", FRI_8PM) == dt.date(2026, 10, 27) and booking.parse_day("soonest", FRI_8PM) is None


def tool(call_id, name, args, now=FRI_8PM, aid=None):
    m = {"type": "tool-calls", "call": {"id": call_id, "phoneNumber": {"number": "+14795550142"}},
         "toolCallList": [{"id": "tc_" + name, "type": "function", "function": {"name": name, "arguments": args}}]}
    if aid:
        m["call"]["assistantId"] = aid
    with conn() as c:
        return receptionist.handle(c, {"message": m}, now)["results"][0]


r = tool("call1", "check_openings", {"day": "monday"})
assert r["toolCallId"] == "tc_check_openings" and "start 2026-10-26T08:00" in r["result"] and "\n" not in r["result"], r
assert "Nothing open that day" in tool("call1", "check_openings", {"day": "sunday"})["result"]
args = {"start": "2026-10-26T08:00", "customer_name": "Dana Price", "callback_number": "(479) 555-0199",
        "address": "12 Elm St, Bella Vista", "problem": "Shingles off, drip upstairs", "ok_to_text": True}
assert "callback number" in tool("call1", "book_visit", dict(args, callback_number="555"))["result"]
assert "exact start" in tool("call1", "book_visit", dict(args, start="Monday morning"))["result"]
r = tool("call1", "book_visit", args)
assert r["result"].startswith("Booked: Monday October 26, 8 to 10am"), r
assert "already booked" in tool("call1", "book_visit", args)["result"]
r = tool("call2", "book_visit", dict(args, customer_name="Sam"))  # someone else wants the same, now full, window
assert "isn't free" in r["result"] and "2026-10-26T10:00" in r["result"], r
assert "set up for booking" in receptionist.handle(db.connect(), {"message": {"type": "tool-calls", "call": {"id": "x"},
    "toolCallList": [{"id": "t", "function": {"name": "check_openings", "arguments": "{}"}}]}})["results"][0]["result"]
# JSON-string arguments (some Vapi versions) work too
assert "Openings" in tool("call3", "check_openings", '{"day": "tomorrow"}', now=dt.datetime(2026, 10, 26, 6, tzinfo=CENTRAL))["result"]
with conn() as c:
    assert "Booking is off" in booking.check(c, dict(client(F)), {}, FRI_8PM)
    n = c.execute("SELECT * FROM owner_notices WHERE client_id = %s AND kind = 'booking'", (P,)).fetchall()
    assert len(n) == 1 and n[0]["status"] == "stub" and n[0]["to_email"] == "boss@ridgeroof.com", n
    assert "Dana Price, 12 Elm St, Bella Vista" in n[0]["body"] and "(479) 555-0199" in n[0]["body"], n[0]["body"]
    assert "Monday October 26, 8 to 10am" in n[0]["subject"], n[0]["subject"]


# End-of-call reports: details saved; the booked call says booked; an emergency emails the owner right away
def report(call_id, start, secs, number="+14795550142", caller="+14795550199", **sd):
    return {"message": {"type": "end-of-call-report", "call": {"id": call_id, "customer": {"number": caller},
            "phoneNumber": {"number": number}}, "startedAt": start.isoformat(),
            "endedAt": (start + dt.timedelta(seconds=secs)).isoformat(),
            "analysis": {"summary": sd.pop("summary", "Caller left details."), "structuredData": sd}}}


r = api.post("/vapi/webhook", headers=vh, json=report("call1", FRI_8PM, 140, outcome="message", caller_name="Dana Price",
             town="Bella Vista", problem="Shingles off, drip upstairs", emergency=False)).json()
assert r["outcome"] == "booked" and r["emergency_alert"] is None, r
r = api.post("/vapi/webhook", headers=vh, json=report("call4", FRI_8PM + dt.timedelta(hours=3), 200, caller="+14795550177",
             outcome="message", caller_name="Lee  Ortiz", callback_number="479 555 0188", town="Bentonville",
             problem="Water pouring through the kitchen ceiling", emergency=True)).json()
assert r["outcome"] == "message" and r["emergency_alert"] == "stub", r
r = api.post("/vapi/webhook", headers=vh, json=report("call5", FRI_8PM + dt.timedelta(hours=4), 30, outcome="spam",
             emergency=True)).json()
assert r["emergency_alert"] is None, r  # spam is never "urgent"
api.post("/vapi/webhook", headers=vh, json=report("call6", FRI_8PM + dt.timedelta(hours=5), 6, caller="+14795550166"))
calls = {x["callback_number"]: x for x in api.get(f"/clients/{P}/calls", headers=H).json()["items"]}
assert calls["4795550188"]["caller_name"] == "Lee Ortiz" and calls["4795550188"]["emergency"], calls
assert calls["4795550188"]["caller_number"] == "4795550177" and calls["4795550166"]["outcome"] == "hung_up", calls
urgent = [x for x in api.get(f"/clients/{P}/notices", headers=H).json()["items"] if x["kind"] == "emergency"]
assert len(urgent) == 1 and "URGENT" in urgent[0]["subject"] and "Lee Ortiz" in urgent[0]["subject"], urgent
assert "Water pouring through the kitchen ceiling" in urgent[0]["body"] and "(479) 555-0188" in urgent[0]["body"], urgent

# Calendar feed: public by unguessable token, valid iCalendar (CRLF, folded lines, UTC times)
ok(api.get("/cal/not-a-token.ics"), 404)
r = api.get(cal.replace("https://api.example.test", "")); ok(r)
assert r.headers["content-type"].startswith("text/calendar"), r.headers
ics = r.text
assert ics.startswith("BEGIN:VCALENDAR\r\n") and ics.endswith("END:VCALENDAR\r\n"), ics
assert "DTSTART:20261026T130000Z" in ics and "DTEND:20261026T150000Z" in ics, ics  # 8-10am CDT
assert "SUMMARY:Visit: Dana Price" in ics and "LOCATION:12 Elm St\\, Bella Vista" in ics, ics
assert all(len(line.encode()) <= 75 for line in ics.split("\r\n")), ics
assert booking.fold("X" * 200).count("\r\n ") == 2

# Morning summary: once a day at the summary hour, everything since the last one
with conn() as c:
    assert notices.run_summaries(c, SAT_630AM - dt.timedelta(hours=1))["summaries"] == []  # 5:30am: too early
    out = notices.run_summaries(c, SAT_630AM)["summaries"]
    assert {x["client_id"] for x in out} == {P, F} and all(x["status"] == "stub" for x in out), out
    assert notices.run_summaries(c, SAT_630AM + dt.timedelta(hours=2))["summaries"] == []  # once a day
    s = {r["client_id"]: r for r in c.execute("SELECT * FROM owner_notices WHERE kind = 'summary'").fetchall()}
body = s[P]["body"]
assert s[P]["subject"] == "Front Desk for Ridge Roofing: 2 messages, 1 urgent", s[P]["subject"]
assert "URGENT" in body and "Lee Ortiz, Bentonville. Call back: (479) 555-0188" in body, body
assert "Messages to call back" in body and "Dana Price, Bella Vista" in body, body
assert "Hung up before leaving details" in body and "(479) 555-0166" in body, body
assert "Sales calls and robocalls ended: 1" in body and "Booked for today" not in body, body
assert s[F]["subject"] == "Quiet night at Hog Valley HVAC: no calls" and "line is on and answering" in s[F]["body"], s[F]
# Monday: the visit shows under "Booked for today"; Sunday's calls aren't repeated
with conn() as c:
    out = notices.run_summaries(c, dt.datetime(2026, 10, 26, 6, 5, tzinfo=CENTRAL))["summaries"]
    mon = c.execute("SELECT * FROM owner_notices WHERE kind = 'summary' AND client_id = %s AND day = '2026-10-26'", (P,)).fetchone()
assert "Booked for today" in mon["body"] and "Dana Price, 12 Elm St" in mon["body"] and "Lee Ortiz" not in mon["body"], mon["body"]
assert mon["subject"].endswith("1 booked today"), mon["subject"]

# With NOTIFY=smtp it really hands the email to SMTP (faked here); a failed send is saved as failed
sent = []
config.NOTIFY, config.SMTP_USER, config.SMTP_PASSWORD, config.NOTIFY_FROM_EMAIL = "smtp", "u", "p", "frontdesk@cold.example"
with conn() as c:
    assert notices.save(c, client(P), "emergency", "t", "b", send=lambda m: sent.append(m))["status"] == "sent"

    def boom(m):
        raise OSError("down")
    assert notices.save(c, client(P), "emergency", "t", "b", send=boom)["status"] == "failed"
    c.rollback()
assert sent[0]["To"] == "boss@ridgeroof.com" and "Front Desk for Ridge Roofing" in sent[0]["From"], sent[0]
config.NOTIFY = "stub"

# Review asks (Plus): queued when a visit is marked done; email if we have it, else a text only with a yes
ok(api.post("/bookings/9999", json={"status": "done"}, headers=H), 404)
ok(api.post("/bookings/1", json={"status": "finished"}, headers=H), 422)
r = api.post("/bookings/1", json={"status": "done"}, headers=H).json()
assert r["booking"]["status"] == "done" and r["review"]["queued"] and r["review"]["channel"] == "sms", r
r = api.post("/bookings/1", json={"status": "done"}, headers=H).json()
assert r["review"] is None, r  # never asked twice for one visit
ok(api.post(f"/clients/{F}/review-requests", json={"customer_name": "Al", "email": "al@x.com"}, headers=H), 400)  # not Plus
ok(api.post(f"/clients/{P}/review-requests", json={"customer_name": "Al", "phone": "4795550123"}, headers=H), 400)  # no yes to texts
r = api.post(f"/clients/{P}/review-requests", json={"customer_name": "Al Green", "email": "AL@x.com"}, headers=H); ok(r)
assert r.json()["channel"] == "email" and "Hi Al," in r.json()["body"] and "honest review" in r.json()["body"], r.json()
assert "https://g.page/r/ridge-roofing/review" in r.json()["body"] and "only time we'll ask" in r.json()["body"]
ok(api.post(f"/clients/{P}/review-requests", json={"customer_name": "Al Green", "email": "al@x.com"}, headers=H), 400)  # 6 months
ok(api.post(f"/clients/{P}/review-requests", json={"customer_name": "Opt Out", "phone": "4795550122", "ok_to_text": True}, headers=H))
with conn() as c:
    c.execute("INSERT INTO sms_optouts (number) VALUES ('4795550122')")
    c.execute("UPDATE review_requests SET send_after = %s", (MON_11AM - dt.timedelta(minutes=1),))
    c.commit()
    assert reviews.send_due(c, dt.datetime(2026, 10, 26, 21, tzinfo=CENTRAL))["done"] == []  # 9pm: waits
    done = {x["id"]: x["status"] for x in reviews.send_due(c, MON_11AM)["done"]}
    rows = {r["customer_name"]: r for r in c.execute("SELECT * FROM review_requests").fetchall()}
assert rows["Dana Price"]["status"] == "stub" and "Reply STOP" in rows["Dana Price"]["body"], rows["Dana Price"]
assert rows["Al Green"]["status"] == "stub" and rows["Opt Out"]["status"] == "skipped", rows
assert len(done) == 3, done
assert reviews.next_send(dt.datetime(2026, 10, 26, 20, tzinfo=CENTRAL)) == dt.datetime(2026, 10, 27, 10, tzinfo=CENTRAL)
# No gating: the ask is the same for everyone, and nothing reads how the job went
assert "happy" not in reviews.email_body(client(P), {"customer_name": "X"}).lower()
assert api.get(f"/clients/{P}/bookings", headers=H).json()["items"][0]["review"] == "stub"

# The cron route runs both jobs
r = api.post("/frontdesk/run", headers=H); ok(r)
assert r.json()["mode"] == "stub" and "summaries" in r.json(), r.json()

# Live site: from the preview facts, no preview parts, indexable, on /s/<slug> and on their own domain
ok(api.post(f"/clients/{F}/site", json={}, headers=H), 400)  # typed in by hand: no shop facts to build from
ok(api.post(f"/clients/{P}/site", json={"domain": "not a domain"}, headers=H), 400)
r = api.post(f"/clients/{P}/site", json={"domain": "https://www.RidgeRoof.com/"}, headers=H); ok(r)
out = r.json()
assert out["url"] == "https://ridgeroof.com" and out["domain"] == "ridgeroof.com", out
page = api.get(out["path"]); ok(page)
low = page.text.lower()
assert "noindex" not in low and "concept preview" not in low and 'id="owner"' not in low, low[:500]
assert "not connected yet" not in low and "ridge roofing" in low and "calling after hours?" in low, low[:500]
assert "every call gets answered" in low  # Plus answers day and night
assert api.get("/", headers={"Host": "www.ridgeroof.com"}).text == page.text
ok(api.get("/", headers={"Host": "unknown.example"}), 404)
ok(api.get("/s/nope"), 404)
assert client(P)["site_url"] == "https://ridgeroof.com"
# privacy and texting terms (A2P 10DLC): linked from the form, served on /s/<slug>/privacy and their domain's /privacy
assert 'name="sms_ok"' in page.text and "Reply STOP" in page.text and 'rel="canonical" href="https://ridgeroof.com"' in page.text
pslug = out["path"].split("/")[-1]
pv = api.get(f"/s/{pslug}/privacy"); ok(pv)
assert f'href="https://api.example.test/s/{pslug}/privacy"' in page.text and "do not sell, rent or share" in pv.text
assert "Back to Ridge Roofing" in pv.text or "ridge roofing" in pv.text.lower()
assert api.get("/privacy", headers={"Host": "ridgeroof.com"}).text == pv.text
ok(api.get("/s/nope/privacy"), 404)

# The live quote form works: saved, photos kept behind unguessable links, the owner emailed at once; bots dropped
slug = out["path"].split("/")[-1]
assert f'action="https://api.example.test/s/{slug}/request"' in page.text and 'name="website"' in page.text
form = {"name": "Kim  Lee", "phone": "479-273-0144", "job": "Roof repair", "town": "Bentonville", "day": "As soon as possible"}
r = api.post(f"/s/{slug}/request", data=form, files=[("photos", ("leak.jpg", b"\xff\xd8jpeg", "image/jpeg")),
                                                     ("photos", ("notes.txt", b"hi", "text/plain"))])
ok(r)
assert "has your request" in r.text and "https://ridgeroof.com" in r.text, r.text
ok(api.post(f"/s/{slug}/request", data=dict(form, phone="12")), 400)
ok(api.post("/s/nope/request", data=form), 404)
ok(api.post(f"/s/{slug}/request", data=dict(form, name="Bot", website="http://spam.example")))
reqs = api.get(f"/clients/{P}/requests", headers=H).json()["items"]
assert len(reqs) == 1 and reqs[0]["name"] == "Kim Lee" and reqs[0]["photos"] == 1, reqs
assert reqs[0]["sms_ok"] is False and reqs[0]["sms_ok_at"] is None  # the box starts unticked
web = [x for x in api.get(f"/clients/{P}/notices", headers=H).json()["items"] if x["kind"] == "web_request"]
assert len(web) == 1 and "Kim Lee" in web[0]["subject"] and "(479) 273-0144" in web[0]["body"], web
photo = web[0]["body"].split("Photo: ")[1].split()[0].replace("https://api.example.test", "")
assert api.get(photo).content == b"\xff\xd8jpeg" and api.get(photo).headers["content-type"] == "image/jpeg"
ok(api.get("/p/nope"), 404)
with conn() as c:
    subj, body = notices.summary(c, client(P), dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1),
                                 dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=1))
assert "From your website" in body and "Kim Lee, Bentonville" in body and "1 message" in subj, (subj, body)

# Booking off: tools gone, the feed keeps working for past visits
r = api.post(f"/clients/{P}/booking", json={"enabled": False}, headers=H).json()
assert r["booking"] is None and r["tools"] == [] and r["calendar_url"] == cal, r
assert "Never book a time slot" in receptionist.prompt(client(P))
iso_now = lambda: dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
# Recording + transcript saved from the end-of-call report (https links only)
config.VAPI_WEBHOOK_SECRET = "vs"
rep = {"message": {"type": "end-of-call-report", "call": {"id": "rec1"}, "assistantId": client(P)["vapi_assistant_id"] or "none",
       "phoneNumber": {"number": client(P)["receptionist_number"] or ""}, "durationSeconds": 40, "startedAt": iso_now(),
       "artifact": {"recordingUrl": "https://storage.vapi.ai/rec1.wav", "transcript": "AI: hi\nUser: pipe burst"}}}
r = api.post("/vapi/webhook", json=rep, headers={"X-Vapi-Secret": "vs"}).json()
assert r.get("call_id"), r
calls = api.get(f"/clients/{P}/calls", headers=H).json()["items"]
top = [x for x in calls if x["recording_url"]]
assert top and top[0]["transcript"].endswith("pipe burst"), calls
assert receptionist.link("http://x") is None and receptionist.link("https://ok.test/a") == "https://ok.test/a"

# Warm transfer of emergencies: needs the owner's cell; booking tools and transfer tool coexist; bad cell refused
a = receptionist.assistant(client(P))
assert "transfer_call" not in a["model"]["messages"][0]["content"] and "tools" not in a["model"], a["model"].keys()
ok(api.post(f"/clients/{P}/receptionist", json={"owner_cell": "12345"}, headers=H), 400)
config.VAPI_API_KEY = ""
r = api.post(f"/clients/{P}/receptionist", json={"owner_cell": "(479) 555-0188"}, headers=H); ok(r)
a = r.json()["assistant"]
t = a["model"]["tools"][0]
assert t["type"] == "transferCall" and t["destinations"][0]["number"] == "+14795550188", t
assert t["destinations"][0]["transferPlan"]["mode"] == config.TRANSFER_MODE
assert "transfer_call" in a["model"]["messages"][0]["content"] and "Never guess" in a["model"]["messages"][0]["content"]
assert client(P)["owner_cell"] == "4795550188"
r = api.post(f"/clients/{P}/receptionist", json={}, headers=H).json()                 # omitted = unchanged
assert client(P)["owner_cell"] == "4795550188"
api.post(f"/clients/{P}/booking", json={"enabled": True}, headers=H)
names = [x.get("function", {}).get("name") for x in receptionist.assistant(client(P))["model"]["tools"]]
assert "transfer_call" in names and len(names) == 3, names                              # check_openings, book_visit, transfer
api.post(f"/clients/{P}/booking", json={"enabled": False}, headers=H)
api.post(f"/clients/{P}/receptionist", json={"owner_cell": ""}, headers=H)             # "" clears it
assert client(P)["owner_cell"] is None

# Real SMS (Twilio) behind TEXTBACK=twilio: stub by default, one try, STOP/START/HELP with a checked signature
import sms  # noqa: E402
import base64, hashlib, hmac  # noqa: E402
assert config.sms() == "stub"
config.TEXTBACK, config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN, config.TWILIO_FROM = "twilio", "ACx", "tok", "+14795550100"
assert config.sms() == "twilio"
posted = []
class FakeResp:
    def __init__(self, b): self.b = b
    def read(self): return self.b
    def __enter__(self): return self
    def __exit__(self, *a): pass
def fake_twilio(req, timeout=0):
    posted.append((req.full_url, req.data.decode(), req.headers.get("Authorization")))
    if posted and "fail" in posted[-1][1]:
        raise sms.urllib.error.URLError("down")
    return FakeResp(b'{"sid": "SM123"}')
sms.urllib.request.urlopen = fake_twilio
assert sms.send("479-555-0133", "hi") == "SM123"
assert posted[0][0].endswith("/Accounts/ACx/Messages.json") and "To=%2B14795550133" in posted[0][1]
assert posted[0][2].startswith("Basic ")
c1 = client(P)
with conn() as c:
    c.execute("UPDATE clients SET status='active', textback_enabled=true WHERE id=%s", (P,))
    c.execute("INSERT INTO receptionist_calls (client_id, vapi_call_id, started_at, seconds, outcome) VALUES (%s,'tb1',now(),3,'hung_up')", (P,))
    cid = c.execute("SELECT id FROM receptionist_calls WHERE vapi_call_id='tb1'").fetchone()["id"]
    cl = c.execute("SELECT * FROM clients WHERE id=%s", (P,)).fetchone()
    res = receptionist.textback(c, cl, cid, "+14795550144", "hung_up", dt.datetime.now(dt.timezone.utc))
    c.commit()
    row = c.execute("SELECT * FROM textbacks WHERE call_id=%s", (cid,)).fetchone()
assert res == "sent" and row["status"] == "sent" and row["provider_id"] == "SM123", (res, row)
# provider down: failed, recorded, not retried
n = len(posted)
with conn() as c:
    c.execute("INSERT INTO receptionist_calls (client_id, vapi_call_id, started_at, seconds, outcome) VALUES (%s,'tb2',now(),3,'hung_up')", (P,))
    cid2 = c.execute("SELECT id FROM receptionist_calls WHERE vapi_call_id='tb2'").fetchone()["id"]
    cl = c.execute("SELECT * FROM clients WHERE id=%s", (P,)).fetchone()
    sms.urllib.request.urlopen = lambda req, timeout=0: (_ for _ in ()).throw(sms.urllib.error.URLError("down"))
    res = receptionist.textback(c, cl, cid2, "+14795550145", "hung_up", dt.datetime.now(dt.timezone.utc))
    c.commit()
    row = c.execute("SELECT * FROM textbacks WHERE call_id=%s", (cid2,)).fetchone()
assert res == "failed" and row["status"] == "failed" and "down" in row["error"], (res, row)

def signed(params):
    txt = "https://api.example.test/sms/inbound" + "".join(k + params[k] for k in sorted(params))
    return base64.b64encode(hmac.new(b"tok", txt.encode(), hashlib.sha1).digest()).decode()
p1 = {"From": "+14795550166", "Body": "STOP"}
ok(api.post("/sms/inbound", data=p1), 401)
ok(api.post("/sms/inbound", data=p1, headers={"X-Twilio-Signature": "nope"}), 401)
r = api.post("/sms/inbound", data=p1, headers={"X-Twilio-Signature": signed(p1)}); ok(r)
assert "opted out" in r.text
with conn() as c:
    assert c.execute("SELECT 1 FROM sms_optouts WHERE number='4795550166'").fetchone()
p2 = {"From": "+14795550166", "Body": "start"}
ok(api.post("/sms/inbound", data=p2, headers={"X-Twilio-Signature": signed(p2)}))
with conn() as c:
    assert not c.execute("SELECT 1 FROM sms_optouts WHERE number='4795550166'").fetchone()
p3 = {"From": "+14795550166", "Body": "when are you open"}
assert "<Message>" not in api.post("/sms/inbound", data=p3, headers={"X-Twilio-Signature": signed(p3)}).text
config.TEXTBACK, config.TWILIO_AUTH_TOKEN = "stub", ""
assert config.sms() == "stub"
ok(api.post("/sms/inbound", data=p1), 503)
config.VAPI_WEBHOOK_SECRET = ""
print("front desk ok")
