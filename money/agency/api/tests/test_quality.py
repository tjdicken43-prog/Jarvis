"""Accuracy pass (2026-10-24): handoff contracts, grounding, stale flaw re-check, event log and breaker, TJ's
corrections, warm-up ramp, send lock and claims, inbox misreads, go-live checklist, overage idempotency.
Real throwaway Postgres; nothing is sent or fetched.

  TEST_DATABASE_URL=postgresql://postgres@localhost/agency_test python3 money/agency/api/tests/test_quality.py
The database's public schema is wiped first, so never point this at a real one.
"""
import datetime as dt
import json
import os
import pathlib
import smtplib
import sys
import threading

API = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API))
URL = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres@localhost/agency_test")
os.environ.update(DATABASE_URL=URL, OPERATOR_TOKEN="test-token", PUBLIC_URL="https://api.example.test")
for k in ("ANTHROPIC_API_KEY", "MAILING_ADDRESS", "MAILER", "SMTP_USER", "SMTP_PASSWORD", "FROM_EMAIL",
          "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_ALLOW_LIVE", "VAPI_API_KEY", "VAPI_WEBHOOK_SECRET"):
    os.environ.pop(k, None)

import psycopg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import billing  # noqa: E402
import config  # noqa: E402
import db  # noqa: E402
import events  # noqa: E402
import flaws  # noqa: E402
import followups  # noqa: E402
import mailer  # noqa: E402
import main  # noqa: E402
import outreach  # noqa: E402
import quality  # noqa: E402
import receptionist  # noqa: E402

with psycopg.connect(URL, autocommit=True) as c:
    c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    c.execute((API / "schema.sql").read_text())
    c.execute((API / "schema.sql").read_text())  # re-running is safe

quality._dns_works = lambda: False  # no real MX lookups for made-up test shops

api = TestClient(main.app)
H = {"Authorization": "Bearer test-token"}
ok = lambda r, code=200: (r.status_code == code) or sys.exit(f"{r.request.method} {r.request.url}: {r.status_code} {r.text}")
NOW = dt.datetime.now(dt.timezone.utc)
iso = lambda t: t.isoformat(timespec="seconds")


def shop(pid, flaw="no tap-to-call", checked=NOW, **kw):
    row = dict(id=pid, name=f"Shop {pid}", trade="plumbing", city="Rogers", phone="479-555-0101",
               email=f"owner@{pid}.com", website=f"https://{pid}.com", rating=4.5, flaw=flaw, status="built",
               mockup_slug=f"{pid}-abc", mockup_url=f"https://api.example.test/m/{pid}-abc",
               facts=json.dumps({"checked_at": iso(checked), "check_mode": "http",
                                 "site_text": "Licensed and insured plumbers in Rogers since 2004. © 2019",
                                 "signals": {"tel_links": 0}}))
    row.update(kw)
    with db.connect() as c:
        c.execute(f"INSERT INTO prospects ({', '.join(row)}) VALUES ({', '.join(['%s'] * len(row))})", list(row.values()))
        c.commit()
    return row


def prospect(pid):
    with db.connect() as c:
        return c.execute("SELECT * FROM prospects WHERE id = %s", (pid,)).fetchone()


# Grounding: every claim in an AI-written email must come from what we saved
p = shop("g1")
P = prospect("g1")
good = "Hi,\n\nI looked at your site on my phone and there's no tap-to-call button, so people in Rogers copy your number by hand. " \
       "I built you a preview: https://api.example.test/m/g1-abc\n\nWorth a look?"
assert quality.grounding("Calls from Shop g1's website", good, P) == [], quality.grounding("x", good, P)
bad = quality.grounding("x", "Hi,\n\nYour 4.9 stars and 212 reviews beat the other guys in Bentonville. Call 479-555-9999 or see "
                             "https://evil.example/x and https://api.example.test/m/g1-abc. We're family-owned. Worth a look?", P)
for want in ("4.9", "212", "Bentonville", "479-555-9999", "evil.example", "family-owned", "stars", "competitor"[:4]):
    assert any(want in x or (want == "comp" and "other guys" in x) for x in bad), (want, bad)
assert "doesn't name the flaw we found" in bad
assert quality.grounding("x", "Hi,\n\nYour footer still says 2019 and you're licensed and insured. Preview: "
                              "https://api.example.test/m/g1-abc\n\nLook?", dict(P, flaw="© 2019")) == []
assert "the number 299" in " ".join(outreach.preflight("Hi", good + " Only $299.", P))  # prices aren't facts either
assert all(outreach.preflight(*outreach.template_draft(dict(P, flaw=f)), dict(P, flaw=f)) == []
           for f in ("no tap-to-call", "not mobile-friendly", "no https", "© 2019", "slow (5.2s)",
                     "phone number hidden on phones", "Site down: no DNS")), "template drafts must ground"

# Contracts: a shop can't move on with missing pieces
assert quality.contract("draft", dict(P, mockup_url=None, facts={})) == ["missing facts.checked_at", "missing mockup_url"]
assert "missing screenshot of the flaw" in quality.contract("draft", dict(P, facts={"checked_at": iso(NOW), "check_mode": "browser"}))
assert any("blocked our checker" in x for x in quality.contract("draft", dict(P, facts={"checked_at": iso(NOW), "signals": {"blocked": True}})))
assert any("https" in x for x in quality.contract("draft", dict(P, mockup_url="http://localhost:8000/m/x")))
old = dict(P, facts={"checked_at": iso(NOW - dt.timedelta(days=20))})
assert quality.stale(old) and not quality.stale(P)
assert any("over 14 days" in x for x in quality.contract("send", old, {"kind": "first", "approved_at": NOW}))
assert quality.mail_domain_ok("a@b.c") in (None, False)  # never True for a made-up domain; None when DNS can't tell

# Drafting logs every outcome, then TJ's corrections: skip needs a reason, edits are saved before and after
with db.connect() as c:
    out = outreach.draft_first_emails(c, 10, ["g1"], drafter=outreach.template_draft)
assert len(out["created"]) == 1, out
eid = out["created"][0]["email_id"]
ok(api.post(f"/emails/{eid}/cancel", headers=H), 422)
ok(api.post(f"/emails/{eid}/cancel", json={"reason": "meh"}, headers=H), 400)
body = api.get(f"/emails/{eid}", headers=H).json()["email"]["body"]
ok(api.patch(f"/emails/{eid}", json={"body": body.replace("Hi,", "Hey there,")}, headers=H))
r = api.post(f"/emails/{eid}/cancel", json={"reason": "tone", "note": "too stiff"}, headers=H); ok(r)
cs = api.get("/corrections", headers=H).json()["items"]
assert [x["kind"] for x in cs] == ["skip", "edit"] and cs[0]["reason"] == "tone" and cs[0]["note"] == "too stiff", cs
assert cs[1]["before_body"].startswith("Hi,") and cs[1]["after_body"].startswith("Hey there,") and cs[1]["flaw"] == "no tap-to-call", cs
assert cs[0]["signals"] == {"tel_links": 0}, cs  # what the flaw finder saw, so evals can replay it
with db.connect() as c:
    assert outreach.tj_examples(c) == [cs[1]["after_body"]]
st = api.get("/stats", headers=H).json()
assert st["skip_reasons"] == {"tone": 1}, st
log = api.get("/events?step=draft", headers=H).json()["items"]
assert log[0]["ok"] and log[0]["email_id"] == eid, log

# The cold list can hold one business twice: only one gets a sequence
shop("dup1", email="office@samebiz.com", website="https://samebiz.com")
shop("dup2", email="office@samebiz.com", website="https://www.samebiz.com/")
with db.connect() as c:
    out = outreach.draft_first_emails(c, 10, ["dup1", "dup2"], drafter=outreach.template_draft)
assert len(out["created"]) == 1 and "same shop" in out["skipped"][0]["reason"], out

# Approve re-checks a stale flaw: fixed -> cancelled; changed -> redraft first; same -> goes
seen = {}
flaws.inspect_site = lambda url: (seen[url], b"\x89PNG")
base = {"mode": "browser", "status": 200, "final_url": "https://x.test/", "seconds": 1.0, "viewport_meta": True,
        "scroll_width": 390, "viewport_width": 390, "tel_links": 1, "tel_on_first_screen": True,
        "phone_on_first_screen": True, "text": "Plumbing in Rogers " + "w " * 300, "html_len": 40000}
for pid in ("s1", "s2", "s3"):
    shop(pid, checked=NOW - dt.timedelta(days=9))
    with db.connect() as c:
        outreach.draft_first_emails(c, 10, [pid], drafter=outreach.template_draft)
ids = {i["prospect"]["id"]: i["email"]["id"] for i in api.get("/queue", headers=H).json()["items"]}
seen["https://s1.com"] = base                                     # they added tap-to-call
seen["https://s2.com"] = dict(base, final_url="http://x.test/")   # now the worst thing is no https
seen["https://s3.com"] = dict(base, tel_links=0)                  # still no tap-to-call
r = api.post(f"/emails/{ids['s1']}/approve", headers=H); ok(r, 409); assert "they fixed it" in r.json()["detail"]
assert prospect("s1")["status"] == "skip"
r = api.post(f"/emails/{ids['s2']}/approve", headers=H); ok(r, 409); assert "no https" in r.json()["detail"]
r = api.post(f"/emails/{ids['s2']}/redraft", headers=H); ok(r); assert "Not secure" in r.json()["email"]["body"], r.json()
ok(api.post(f"/emails/{ids['s2']}/approve", headers=H))
ok(api.post(f"/emails/{ids['s3']}/approve", headers=H))
assert not quality.stale(prospect("s3"))
# TJ's own edit isn't blocked by grounding, but he sees what couldn't be backed up
shop("s4")
with db.connect() as c:
    e4 = outreach.draft_first_emails(c, 10, ["s4"], drafter=outreach.template_draft)["created"][0]["email_id"]
b4 = api.get(f"/emails/{e4}", headers=H).json()["email"]["body"]
ok(api.patch(f"/emails/{e4}", json={"body": b4 + " I'm right here in Bentonville."}, headers=H))
r = api.post(f"/emails/{e4}/approve", headers=H); ok(r)
assert any("Bentonville" in w for w in r.json()["warnings"]) and "Check:" in r.json()["detail"], r.json()
st = api.get("/stats", headers=H).json()
assert st["approved_as_drafted_pct"] == 67, st  # 3 approved, one edited

# Warm-up ramp: no date = nothing goes; week 1 warm-up only; then 3, 5, 10, 20 a day
with db.connect() as c:
    assert mailer.daily_cap(c, NOW) == (0, "set the warm-up start date first (Settings)")
r = api.post("/settings/warmup", json={"started": "2026-10-27"}, headers=H); ok(r)
assert [x["per_day"] for x in r.json()["ramp"]] == [0, 3, 5, 10, 20] and [x["from_day"] for x in r.json()["ramp"]] == [1, 8, 15, 22, 29]
C = mailer.CENTRAL
with db.connect() as c:
    caps = [mailer.daily_cap(c, dt.datetime(2026, m, d, 10, tzinfo=C))[0] for m, d in
            ((10, 27), (11, 2), (11, 3), (11, 10), (11, 17), (11, 24), (12, 30))]
assert caps == [0, 0, 3, 5, 10, 20, 20], caps

# Sender: one run at a time, claims each email, permanent refusals don't block the rest, free mail isn't one company
config.MAILING_ADDRESS = "PO Box 1, Bentonville, AR 72712"
config.MAILER, config.SMTP_USER, config.SMTP_PASSWORD, config.FROM_EMAIL = "smtp", "u", "p", "tj@cold.example.test"
ok(api.post("/settings/pause", json={"paused": False}, headers=H))
for pid in ("f1", "f2"):
    shop(pid, email=f"{pid}shop@gmail.com")
    with db.connect() as c:
        ok(api.post(f"/emails/{outreach.draft_first_emails(c, 10, [pid], drafter=outreach.template_draft)['created'][0]['email_id']}/approve", headers=H))
with db.connect() as c:
    c.execute("UPDATE emails SET send_after = NULL")
    c.commit()
tue = dt.datetime(2026, 11, 17, 15, 0, tzinfo=dt.timezone.utc)  # warm-up day 22: 10 a day
sent = []


def picky(msg):
    if msg["To"] == "owner@s2.com":
        raise smtplib.SMTPRecipientsRefused({"owner@s2.com": (550, b"no such user")})
    sent.append(msg["To"])
    return msg["Message-ID"]


lock = psycopg.connect(URL, autocommit=True)
lock.execute("SELECT pg_advisory_lock(%s)", (mailer.SEND_LOCK,))
with db.connect() as c:
    assert mailer.send_due(c, tue, picky)["detail"] == "Another send is running." and not sent
lock.execute("SELECT pg_advisory_unlock(%s)", (mailer.SEND_LOCK,))
config.PUBLIC_URL = "http://localhost:8000"
with db.connect() as c:
    assert "PUBLIC_URL" in mailer.send_due(c, tue, picky)["held"][0]["reason"] and not sent
config.PUBLIC_URL = "https://api.example.test"
with db.connect() as c:
    res = mailer.send_due(c, tue, picky)
assert sorted(sent) == ["f1shop@gmail.com", "f2shop@gmail.com", "owner@s3.com", "owner@s4.com"], (sent, res)
assert any("refused" in h["reason"] for h in res["held"]), res
with db.connect() as c:
    assert db.suppressed(c, "owner@s2.com") and prospect("s2")["status"] == "no-email"
    assert c.execute("SELECT status FROM emails WHERE id = %s", (ids["s2"],)).fetchone()["status"] == "failed"
# Two runs at once: only one sends
shop("t1")
with db.connect() as c:
    e = outreach.draft_first_emails(c, 10, ["t1"], drafter=outreach.template_draft)["created"][0]["email_id"]
ok(api.post(f"/emails/{e}/approve", headers=H))
with db.connect() as c:
    c.execute("UPDATE emails SET send_after = NULL WHERE id = %s", (e,))
    c.commit()
sent.clear()
gate = threading.Barrier(2)


def run():
    gate.wait()
    with db.connect() as c:
        mailer.send_due(c, tue + dt.timedelta(days=1), lambda m: sent.append(m["To"]) or m["Message-ID"])


ts = [threading.Thread(target=run) for _ in range(2)]
[t.start() for t in ts]
[t.join() for t in ts]
assert sent == ["owner@t1.com"], sent

# Breaker: 3 send failures in a row pause sending and stop the step until TJ resumes it
for pid in ("b1", "b2", "b3"):
    shop(pid)
    with db.connect() as c:
        ok(api.post(f"/emails/{outreach.draft_first_emails(c, 10, [pid], drafter=outreach.template_draft)['created'][0]['email_id']}/approve", headers=H))
with db.connect() as c:
    c.execute("UPDATE emails SET send_after = NULL WHERE status = 'approved'")
    c.commit()
boom = lambda m: (_ for _ in ()).throw(OSError("smtp down"))
for i in range(3):
    with db.connect() as c:
        res = mailer.send_due(c, tue + dt.timedelta(days=2, minutes=i), boom)
    assert "send failed" in res["held"][-1]["reason"], res
h = api.get("/health").json()
assert h["paused"] and h["stopped_steps"] == ["send"] and h["last_24h"]["send"]["failed"] == 3, h
assert api.get("/events?failed=true", headers=H).json()["items"][0]["step"] == "breaker"
with db.connect() as c:
    assert c.execute("SELECT count(*) AS n FROM emails WHERE status = 'approved' AND prospect_id LIKE 'b%%'").fetchone()["n"] == 3
ok(api.post("/settings/resume", json={"step": "send"}, headers=H))
ok(api.post("/settings/resume", json={"step": "send"}, headers=H), 409)
assert api.get("/health").json()["stopped_steps"] == []
# Drafting stops the same way: three junk drafts in a row
for pid in ("d1", "d2", "d3"):
    shop(pid)
with db.connect() as c:
    out = outreach.draft_first_emails(c, 10, ["d1", "d2", "d3"], drafter=lambda p: ("Hi", "Hi [NAME]"))
    assert len(out["skipped"]) == 3 and "draft" in events.stopped(c)
    assert "stopped" in outreach.draft_first_emails(c, 10, ["d1"], drafter=outreach.template_draft)
ok(api.post("/settings/resume", json={"step": "draft"}, headers=H))

# Inbox: Outlook quotes, our own footer, long "no thanks", delay notices and read receipts don't opt anyone out
config.MAILER = "smtp"
fid = {m: x for m, x in [("f1shop@gmail.com", None)]}
with db.connect() as c:
    mid = {r["email"]: r["provider_id"] for r in c.execute(
        "SELECT p.email, e.provider_id FROM emails e JOIN prospects p ON p.id = e.prospect_id WHERE e.status = 'sent'")}


def mail(frm, subject, body, ctype=None, **hdr):
    head = "".join(f"{k.replace('_', '-')}: {v}\r\n" for k, v in hdr.items())
    ct = f"Content-Type: {ctype}\r\n" if ctype else ""
    return f"From: {frm}\r\nTo: tj@cold.example.test\r\nSubject: {subject}\r\n{ct}{head}\r\n{body}\r\n".encode()


msgs = [
    mail("f1shop@gmail.com", "RE: x", "Sure, call me Tuesday.\r\n\r\nFrom: TJ <tj@cold.example.test>\r\nSent: Monday\r\n"
         "Not interested? One click and you won't hear from me again", In_Reply_To=mid["f1shop@gmail.com"]),
    mail("f2shop@gmail.com", "Re: x", "No thanks for now, we are slammed this month, but send me the price sheet in the "
         "spring and I will look at it again with my wife who runs the office and does our books for us.",
         In_Reply_To=mid["f2shop@gmail.com"]),
    mail("mailer-daemon@googlemail.com", "Delivery Status Notification (Delay)",
         "Delivery to owner@s3.com is delayed. We'll keep trying for 2 days.", ),
    mail("owner@s4.com", "Read: x", "--b\r\nContent-Type: text/plain\r\n\r\nYour message was read.\r\n--b--",
         ctype='multipart/report; report-type=disposition-notification; boundary="b"'),
    b"\xff\xfe\x00not an email at all",
]
with db.connect() as c:
    got = followups.check_inbox(c, tue, fetch=lambda since: msgs)
assert sorted(got["replied"]) == ["f1", "f2"] and not got["stopped"] and not got["bounced"], got
with db.connect() as c:
    assert not db.suppressed(c, "f1shop@gmail.com") and not db.suppressed(c, "owner@s3.com") and not db.suppressed(c, "owner@s4.com")
assert followups.kind_of_reply("Please stop emailing me.") == "stop"
dsn = mail("mailer-daemon@googlemail.com", "Undelivered", "--b\r\nContent-Type: message/delivery-status\r\n\r\n"
           "Final-Recipient: rfc822; owner@s3.com\r\nAction: failed\r\nStatus: 5.1.1\r\n--b--",
           ctype='multipart/report; report-type=delivery-status; boundary="b"')
with db.connect() as c:
    assert followups.check_inbox(c, tue, fetch=lambda since: [dsn])["bounced"] == ["s3"]
config.MAILER = "stub"

# A shop that says yes stops getting cold follow-ups the moment it's on Clients
with db.connect() as c:
    followups.schedule(c, "s4", tue)
    c.commit()
    assert c.execute("SELECT count(*) AS n FROM emails WHERE prospect_id = 's4' AND status = 'approved'").fetchone()["n"] == 3
r = api.post("/clients", json={"prospect_id": "s4"}, headers=H); ok(r)
cid = r.json()["id"]
with db.connect() as c:
    assert c.execute("SELECT count(*) AS n FROM emails WHERE prospect_id = 's4' AND status = 'approved'").fetchone()["n"] == 0

# Mockups disappear once a shop opts out or is skipped
ok(api.get("/m/s3-abc"), 404)  # bounced -> on the list
with db.connect() as c:
    c.execute("INSERT INTO mockups (slug, prospect_id, html) VALUES ('t1-abc', 't1', '<p>hi</p>'), ('s1-abc', 's1', '<p>hi</p>')")
    c.commit()
ok(api.get("/m/t1-abc"))
ok(api.get("/m/s1-abc"), 404)  # skipped

# Receptionist go-live: paying, built, a real test call, forwarding and hours confirmed, then live; spot checks after
ok(api.post(f"/clients/{cid}/receptionist", json={}, headers=H), 409)
with db.connect() as c:
    c.execute("UPDATE clients SET status = 'active', vapi_assistant_id = 'asst_s4' WHERE id = %s", (cid,))
    c.commit()
r = api.post(f"/clients/{cid}/live", headers=H); ok(r, 409)
assert "test_call" in r.json()["detail"] and "forwarding" in r.json()["detail"] and "hours" in r.json()["detail"], r.json()
config.VAPI_WEBHOOK_SECRET = "vs"
call = {"message": {"type": "end-of-call-report", "call": {"id": "tc1", "assistantId": "asst_s4"},
                    "startedAt": iso(NOW), "endedAt": iso(NOW + dt.timedelta(seconds=90)), "endedReason": "customer-ended-call"}}
ok(api.post("/vapi/webhook", json=call, headers={"X-Vapi-Secret": "vs"}))
ok(api.post("/vapi/webhook", json=call, headers={"X-Vapi-Secret": "vś".encode()}), 401)  # odd bytes: 401, not a crash
ok(api.post(f"/clients/{cid}/golive", json={"step": "forwarding"}, headers=H))
ok(api.post(f"/clients/{cid}/golive", json={"step": "test_call"}, headers=H), 400)
r = api.post(f"/clients/{cid}/live", headers=H); ok(r, 409); assert r.json()["detail"].endswith("hours"), r.json()
ok(api.post(f"/clients/{cid}/golive", json={"step": "hours"}, headers=H))
r = api.post(f"/clients/{cid}/live", headers=H); ok(r); assert r.json()["live_at"] and not r.json()["golive_missing"]
todo = api.get("/calls/to-review", headers=H).json()["items"]
assert [x["client_id"] for x in todo] == [cid], todo
ok(api.post(f"/calls/{todo[0]['id']}/review", json={"ok": False, "note": "said a price"}, headers=H))
assert api.get("/calls/to-review", headers=H).json()["items"] == []
assert api.get("/events?step=call_review", headers=H).json()["items"][0]["reason"] == "said a price"
# Cancelled in Stripe: the receptionist is turned off so the line stops costing us
config.STRIPE_SECRET_KEY, config.STRIPE_WEBHOOK_SECRET = "sk_test_x", "whsec_t"
with db.connect() as c:
    c.execute("UPDATE clients SET stripe_subscription_id = 'sub_1', stripe_customer_id = 'cus_1' WHERE id = %s", (cid,))
    c.commit()
ev = json.dumps({"id": "evt_c", "type": "customer.subscription.deleted", "livemode": False,
                 "data": {"object": {"id": "sub_1", "customer": "cus_1"}}}).encode()
r = api.post("/stripe/webhook", content=ev, headers={"stripe-signature": billing.sign(ev, "whsec_t")}); ok(r)
assert r.json()["receptionist"] == "turned off", r.json()
with db.connect() as c:
    assert c.execute("SELECT vapi_assistant_id, live_at FROM clients WHERE id = %s", (cid,)).fetchone() == \
        {"vapi_assistant_id": None, "live_at": None}

# Overage: the month is claimed before Stripe is called, with a fixed idempotency key, so it can't bill twice
with db.connect() as c:
    c.execute("UPDATE clients SET status = 'active' WHERE id = %s", (cid,))
    c.execute("INSERT INTO receptionist_calls (client_id, vapi_call_id, started_at, seconds) VALUES (%s, 'big', %s, %s)",
              (cid, NOW, 320 * 60))
    c.commit()
calls = []


class Resp:
    def __init__(self, d):
        self.d = d

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return json.dumps(self.d).encode()


fail_once = [True]


def stripe_fake(req, timeout=None):
    calls.append(req.headers.get("Idempotency-key"))
    if fail_once and fail_once.pop():
        raise billing.urllib.error.URLError("timeout")
    return Resp({"id": "ii_1"})


billing.urllib.request.urlopen = stripe_fake
month = billing.month_bounds()[0]
r = api.post("/billing/overage", json={"month": month}, headers=H).json()
assert not r["charged"] and "can't reach Stripe" in r["skipped"][0]["reason"], r
r = api.post("/billing/overage", json={"month": month}, headers=H).json()
assert len(r["charged"]) == 1 and calls == [f"overage-{cid}-{month}"] * 2, (r, calls)
r = api.post("/billing/overage", json={"month": month}, headers=H).json()
assert r["skipped"][0]["reason"] == "already charged" and len(calls) == 2, r

print("agency quality ok")
