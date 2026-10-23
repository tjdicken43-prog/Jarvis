"""API + outreach + sender test against a real, throwaway Postgres. Nothing is ever sent.

  TEST_DATABASE_URL=postgresql://postgres@localhost/agency_test python3 money/agency/api/tests/test_api.py
The database's public schema is wiped first, so never point this at a real one.
"""
import datetime as dt
import os
import pathlib
import sys
import types

API = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API))
URL = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres@localhost/agency_test")
os.environ.update(DATABASE_URL=URL, OPERATOR_TOKEN="test-token", PUBLIC_URL="https://api.example.test")
for k in ("ANTHROPIC_API_KEY", "MAILING_ADDRESS", "MAILER", "SMTP_USER", "SMTP_PASSWORD", "FROM_EMAIL"):
    os.environ.pop(k, None)

import psycopg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import config  # noqa: E402
import db  # noqa: E402
import mailer  # noqa: E402
import main  # noqa: E402
import outreach  # noqa: E402

with psycopg.connect(URL, autocommit=True) as c:
    c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    c.execute((API / "schema.sql").read_text())
    c.execute((API / "schema.sql").read_text())  # re-running is safe
    rows = [  # id, name, trade, city, email, website, rating, state, flaw, mockup, status
        ("overture/a", "Ozark Pipe Co", "plumbing", "Rogers", "owner@ozarkpipe.com", "https://www.ozarkpipe.com", 4.6, "DATED",
         "no tap-to-call, © 2019", "https://ozark-pipe.preview.example.test", "built"),
        ("overture/b", "Gone Air", "hvac", "Bentonville", "x@goneair.com", "goneair.com", 4.0, "DATED", "no https", None, "checked"),
        ("overture/c", "Low Star Roofing", "roofing", "Lowell", "a@lowstar.com", "lowstar.com", 2.1, "DATED", "no https", None, "checked"),
        ("overture/d", "No Mail Plumbing", "plumbing", "Rogers", None, "nomailplumb.com", 4.0, "DATED", "no https", None, "checked"),
        ("overture/e", "Ridge Roofing", "roofing", "Bella Vista", "info@ridgeroof.com", "ridgeroof.com", None, "DOWN",
         "Site down: no DNS", None, "checked"),
        ("overture/f", "New Heat", "hvac", "Siloam Springs", "hi@newheat.com", "newheat.com", 4.9, "DATED", "no https", None, "new"),
    ]
    for r in rows:
        c.execute("""INSERT INTO prospects (id, name, trade, city, email, website, rating, site_state, flaw, mockup_url, status)
                     VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", r)
    c.execute("INSERT INTO suppressions (domain, reason) VALUES ('goneair.com', 'asked to stop')")

api = TestClient(main.app)
H = {"Authorization": "Bearer test-token"}
ok = lambda r, code=200: (r.status_code == code) or sys.exit(f"{r.request.method} {r.request.url}: {r.status_code} {r.text}")

# Auth: every operator route needs the token; health and unsubscribe don't
ok(api.get("/queue"), 401)
ok(api.get("/queue", headers={"Authorization": "Bearer wrong"}), 401)
h = api.get("/health").json()
assert h["drafter"] == "stub" and h["mailer"] == "stub" and h["paused"] is True and not h["mailing_address_set"], h

# Outreach: only eligible trade shops get drafts; do-not-email domain is skipped and marked
r = api.post("/outreach/draft", json={"limit": 10}, headers=H); ok(r)
out = r.json()
assert sorted(x["prospect_id"] for x in out["created"]) == ["overture/a", "overture/e"], out
assert [x["prospect_id"] for x in out["skipped"]] == ["overture/b"] and "do-not-email" in out["skipped"][0]["reason"], out
assert api.post("/outreach/draft", json={}, headers=H).json()["created"] == []  # no duplicates
items = {i["prospect"]["id"]: i for i in api.get("/queue", headers=H).json()["items"]}
a, e = items["overture/a"], items["overture/e"]
assert "https://ozark-pipe.preview.example.test" in a["email"]["body"] and "tap-to-call" in a["email"]["body"], a
assert "burst pipe" in a["email"]["body"] and "isn't loading" in e["email"]["subject"], (a, e)
for i in (a, e):
    assert len(i["email"]["body"].split()) <= outreach.MAX_WORDS, i
    assert "unsub_token" not in i["email"] and "https://api.example.test/u/" in i["footer"], i
    assert "mailing address missing" in i["footer"], i
with db.connect() as c:
    assert c.execute("SELECT status FROM prospects WHERE id='overture/b'").fetchone()["status"] == "unsubscribed"

# Pre-flight blocks placeholders, made-up prices, missing preview link, long bodies
p = {"mockup_url": "https://x.test"}
assert outreach.preflight("Hi", "See https://x.test for [NAME]", p) == ["placeholder text left in"]
assert "price $500 is not one of ours" in outreach.preflight("Hi", "It is $500. https://x.test", p)
assert "preview link missing" in outreach.preflight("Hi", "No link here.", p)
assert any("words" in x for x in outreach.preflight("Hi", "word " * 90, {}))

# Edit, then approve; a placeholder edit can't be approved
eid, aid = e["email"]["id"], a["email"]["id"]
ok(api.patch(f"/emails/{eid}", json={"body": "Hi {first_name}, your site is down."}, headers=H))
ok(api.post(f"/emails/{eid}/approve", headers=H), 400)
r = api.patch(f"/emails/{eid}", json={"body": "Hi,\n\nYour site didn't load for me today. Want a free preview of a fixed one?"}, headers=H)
ok(r); assert r.json()["email"]["edited"] is True
r = api.post(f"/emails/{aid}/approve", headers=H); ok(r)
assert r.json()["queued"] and "Stub mailer" in r.json()["detail"], r.json()
assert mailer.in_window(dt.datetime.fromisoformat(r.json()["item"]["email"]["send_after"])), r.json()
ok(api.patch(f"/emails/{aid}", json={"body": "x"}, headers=H), 409)  # approved = locked
ok(api.post(f"/emails/{aid}/unapprove", headers=H)); ok(api.post(f"/emails/{aid}/approve", headers=H))

# Sender: paused, no address, outside window, then stub dry run; nothing sends
tue_10am = dt.datetime(2026, 10, 27, 15, 0, tzinfo=dt.timezone.utc)   # 10:00 Central
sat_10am = dt.datetime(2026, 10, 31, 15, 0, tzinfo=dt.timezone.utc)
sent = []
fake_send = lambda msg: sent.append(msg) or "<fake@id>"
with db.connect() as c:
    assert "paused" in mailer.send_due(c, tue_10am, fake_send)["held"][0]["reason"]
ok(api.post("/settings/pause", json={"paused": False}, headers=H))
with db.connect() as c:
    assert "mailing address" in mailer.send_due(c, tue_10am, fake_send)["held"][0]["reason"]
    config.MAILING_ADDRESS = "PO Box 1, Bentonville, AR 72712"
    assert "send window" in mailer.send_due(c, sat_10am, fake_send)["held"][0]["reason"]
    res = mailer.send_due(c, tue_10am, fake_send)
    assert res["dry_run"] and res["sent"] == 0 and "1 would have gone out" in res["detail"] and not sent, res
    assert c.execute("SELECT status FROM emails WHERE id=%s", (aid,)).fetchone()["status"] == "approved"

# Live path with a fake SMTP: footer, address and one-click unsubscribe headers go out; then the daily cap holds
config.MAILER, config.SMTP_USER, config.SMTP_PASSWORD, config.FROM_EMAIL = "smtp", "u", "p", "tj@cold.example.test"
config.DAILY_SEND_CAP = 1
ok(api.post(f"/emails/{eid}/approve", headers=H))
with db.connect() as c:
    c.execute("UPDATE emails SET send_after = NULL")
    c.commit()
    res = mailer.send_due(c, tue_10am, fake_send)
    assert res["sent"] == 1 and len(sent) == 1 and "daily cap" in res["held"][0]["reason"], res
    msg = sent[0]
    text = msg.get_content()
    assert msg["To"] == "owner@ozarkpipe.com" and msg["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click", msg
    assert "PO Box 1, Bentonville" in text and msg["List-Unsubscribe"].strip("<>") in text, text
    assert c.execute("SELECT status FROM prospects WHERE id='overture/a'").fetchone()["status"] == "emailed"
config.MAILER = "stub"

# Unsubscribe link (GET and one-click POST) adds to the list forever and stops pending mail
with db.connect() as c:
    token_a = c.execute("SELECT unsub_token FROM emails WHERE id=%s", (aid,)).fetchone()["unsub_token"]
r = api.get(f"/u/{token_a}"); ok(r); assert "won't get any more emails" in r.text
ok(api.post(f"/u/{token_a}"))  # twice is fine
ok(api.get("/u/nope"), 404)
r = api.post("/suppressions", json={"domain": "https://www.ridgeroof.com/contact", "reason": "called and said stop"}, headers=H); ok(r)
assert r.json()["domain"] == "ridgeroof.com", r.json()
with db.connect() as c:
    st = {x["id"]: x["status"] for x in c.execute("SELECT id, status FROM prospects")}
    assert st["overture/a"] == "unsubscribed" and st["overture/e"] == "unsubscribed", st
    assert c.execute("SELECT status FROM emails WHERE id=%s", (eid,)).fetchone()["status"] == "cancelled"
    assert c.execute("SELECT count(*) AS n FROM suppressions").fetchone()["n"] == 3
    # Re-import keeps the list: rows are never deleted, so the next draft run skips them
    assert db.suppressed(c, "anyone@ridgeroof.com") and db.suppressed(c, "OWNER@ozarkpipe.com")

# Claude drafter: request shape (model, structured output) and refusal handling, with a fake client
calls = []


class FakeClient:
    def __init__(self, api_key):
        self.messages = self

    def create(self, **kw):
        calls.append(kw)
        stop = "refusal" if "Refuse" in kw["messages"][0]["content"] else "end_turn"
        body = '{"subject": "Calls from Test Co\'s website", "body": "Hi,\\n\\nOne. Two. Three?"}'
        return types.SimpleNamespace(stop_reason=stop, content=[types.SimpleNamespace(type="text", text=body)])


import anthropic  # noqa: E402
anthropic.Anthropic = FakeClient
config.ANTHROPIC_API_KEY = "test"
shop = {"name": "Test Co", "trade": "hvac", "city": "Rogers", "website": "t.co", "flaw": "no tap-to-call", "site_state": "DATED"}
subj, body = outreach.claude_draft(shop)
assert subj.startswith("Calls from") and body.startswith("Hi,"), (subj, body)
assert calls[0]["model"] == "claude-haiku-5-5" and calls[0]["output_config"]["format"]["type"] == "json_schema", calls[0]
try:
    outreach.claude_draft(dict(shop, name="Refuse Co"))
    sys.exit("refusal should raise")
except RuntimeError:
    pass
assert api.get("/health").json()["drafter"] == "claude"

print("agency api ok")
