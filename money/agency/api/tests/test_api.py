"""API + outreach + sender test against a real, throwaway Postgres. Nothing is ever sent.

  TEST_DATABASE_URL=postgresql://postgres@localhost/agency_test python3 money/agency/api/tests/test_api.py
The database's public schema is wiped first, so never point this at a real one.
"""
import datetime as dt
import json
import os
import pathlib
import sys
import time
import types
import urllib.parse

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
    # Handoff contract: a draft needs a fresh flaw check and a saved preview, not just the scout's guess
    c.execute("""UPDATE prospects SET facts = jsonb_build_object('checked_at', to_char(now() AT TIME ZONE 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS+00:00'), 'check_mode', 'http'), mockup_slug = replace(id, '/', '-'),
                 mockup_url = coalesce(mockup_url, 'https://' || replace(id, '/', '-') || '.preview.example.test')""")
    c.execute("INSERT INTO settings (key, value) VALUES ('warmup_started', '\"2026-09-01\"')")  # long warmed up

import quality  # noqa: E402
quality._dns_works = lambda: False  # no real MX lookups for made-up test shops

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
r = api.patch(f"/emails/{eid}", json={"body": "Hi,\n\nYour site didn't load for me today. Here is a fixed one: "
                                              "https://overture-e.preview.example.test\n\nWorth a look?"}, headers=H)
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
r = api.get(f"/u/{token_a}"); ok(r); assert "<form method=\"post\">" in r.text  # a button: link scanners can't opt anyone out
r = api.post(f"/u/{token_a}"); ok(r); assert "won't get any more emails" in r.text
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

# Flaw finder: one true flaw, worst first, from what the page did
import flaws  # noqa: E402
import mockup  # noqa: E402
good = {"mode": "browser", "status": 200, "final_url": "https://x.test/", "seconds": 1.2, "viewport_meta": True,
        "scroll_width": 390, "viewport_width": 390, "tel_links": 2, "tel_on_first_screen": True,
        "phone_on_first_screen": True, "text": "Plumbing in Rogers. (c) 2026 " + "words " * 200, "html_len": 40000}
today = dt.date(2026, 10, 23)
assert flaws.pick(good, today) == (None, "OK")
assert flaws.pick({"down": "no DNS"}, today) == ("Site down: no DNS", "DOWN")
assert flaws.pick({"status": 403, "blocked": True}, today) == (None, None)
assert flaws.pick(dict(good, html_len=300), today)[1] == "DOWN"
assert flaws.pick(dict(good, scroll_width=1040), today) == ("not mobile-friendly", "WEAK")
assert flaws.pick(dict(good, viewport_meta=False, tel_links=0), today) == ("not mobile-friendly", "DATED")
assert flaws.pick(dict(good, tel_links=0), today)[0] == "no tap-to-call"
assert flaws.pick(dict(good, tel_on_first_screen=False, phone_on_first_screen=False), today)[0] == "phone number hidden on phones"
assert flaws.pick(dict(good, seconds=6.4), today)[0] == "slow (6.4s)"
assert flaws.pick(dict(good, final_url="http://x.test/"), today)[0] == "no https"
assert flaws.pick(dict(good, text="© 2019 Ozark Pipe " + "w " * 300), today)[0] == "© 2019"
assert flaws.pick(dict(good, text="Copyright 2016 - 2025 " + "w " * 300), today) == (None, "OK")
f = flaws.site_facts("24/7 emergency service. Licensed and insured. Family owned since 1998. Rogers, Bentonville and Lowell.")
assert f == {"open_247": True, "licensed": True, "since": 1998, "towns": ["Bentonville", "Rogers", "Lowell"]}, f
assert flaws.site_facts("open 8-5")["open_247"] is False
assert flaws.brand_colors(["rgb(216, 0, 40)", "rgb(255,255,255)", "rgba(216, 0, 40, 0.1)", "rgb(216, 0, 40)"], "#106494") == ["#106494", "#d80028"]
assert "phone isn't on the first screen" in outreach.plain_flaw("phone number hidden on phones")[0].replace("number ", "")
assert "placeholder" in outreach.plain_flaw("Site down: parked or empty page")[0]

# Outreach Agent end to end with a fake browser: check -> mockup -> draft, nothing sent, nothing fetched
with db.connect() as c:
    c.execute("""INSERT INTO prospects (id, name, trade, city, phone, email, website, rating, review_count, status) VALUES
      ('overture/g', 'Rock Creek Heating & Air', 'hvac', 'Rogers', '479-273-0101', 'office@rockcreekair.com', 'rockcreekair.com', 4.8, 61, 'new'),
      ('overture/h', 'Fine Site Plumbing', 'plumbing', 'Lowell', '479-273-0102', 'hi@finesite.com', 'finesite.com', 4.5, 12, 'new'),
      ('overture/i', 'Blocked Roofing', 'roofing', 'Rogers', NULL, 'hi@blockedroof.com', 'blockedroof.com', 4.1, 9, 'new')""")
    c.commit()
PNG = b"\x89PNG\r\n\x1a\nfake"
SIG = {
    "rockcreekair.com": (dict(good, scroll_width=1100, colors=["rgb(0, 110, 60)", "rgb(0, 110, 60)"],
                              logo_url="https://rockcreekair.com/logo.png",
                              text="24/7 heating and air. Licensed and insured. Since 2004. Rogers, Bentonville. "
                                   "Furnace install, heat pump, duct cleaning. " + "w " * 200), PNG),
    "finesite.com": (good, PNG),
    "blockedroof.com": ({"mode": "browser", "status": 403, "blocked": True}, None),
}
fake = lambda url: SIG[mailer.host(url)]
with db.connect() as c:
    out = outreach.prepare(c, 10, ["overture/g", "overture/h", "overture/i"], inspect=fake)
assert [x["prospect_id"] for x in out["created"]] == ["overture/g"], out
held = {x["prospect_id"]: x["reason"] for x in out["skipped"]}
assert held == {"overture/h": "no clear flaw on their site", "overture/i": "no clear flaw on their site"}, held
with db.connect() as c:
    g = c.execute("SELECT * FROM prospects WHERE id = 'overture/g'").fetchone()
    assert c.execute("SELECT status FROM prospects WHERE id = 'overture/h'").fetchone()["status"] == "checked"
assert g["flaw"] == "not mobile-friendly" and g["status"] == "built" and g["site_state"] == "WEAK", g
assert g["flaw_evidence"].startswith("https://api.example.test/shots/") and g["mockup_url"].startswith("https://api.example.test/m/rock-creek-heating-air-"), g
assert g["facts"]["open_247"] and g["facts"]["since"] == 2004 and g["facts"]["colors"][0] == "#006e3c", g["facts"]
items = {i["prospect"]["id"]: i for i in api.get("/queue", headers=H).json()["items"]}
gi = items["overture/g"]
assert gi["prospect"]["mockup_url"] in gi["email"]["body"] and "fit a phone screen" in gi["email"]["body"], gi
assert gi["prospect"]["flaw_evidence"] == g["flaw_evidence"]
# The preview and screenshot are public links, never indexed
r = api.get("/m/" + g["mockup_slug"]); ok(r)
assert r.headers["x-robots-tag"].startswith("noindex") and "Rock Creek Heating &amp; Air" in r.text and "Concept preview" in r.text
assert "Heating and AC repair in Rogers." in r.text and "tel:+14792730101" in r.text and "Since 2004" in r.text
assert 'src="https://rockcreekair.com/logo.png"' in r.text and "4.8</b> on Google from 61 reviews" in r.text
assert "Geothermal" not in r.text and "Ductwork" in r.text  # only services their site names
ok(api.get("/m/nope"), 404)
ok(api.get("/m/_/font.woff2"))
r = api.get(g["flaw_evidence"].replace("https://api.example.test", "")); ok(r)
assert r.content == PNG and r.headers["content-type"] == "image/png"
ok(api.get("/shots/nope.png"), 404)
# Already checked shops aren't re-scanned; operator routes need the token and handle ids with slashes
with db.connect() as c:
    assert outreach.prepare(c, 10, ["overture/h"], inspect=lambda u: sys.exit("should not re-check"))["created"] == []
ok(api.post("/prospects/overture/h/mockup"), 401)
r = api.post("/prospects/overture/h/mockup", headers=H); ok(r)
assert r.json()["built"] and "/m/fine-site-plumbing-" in r.json()["mockup_url"]
ok(api.post("/prospects/overture/zz/mockup", headers=H), 404)
# A mockup that fails the site bar is not saved, so no email can link to it
with db.connect() as c:
    c.execute("INSERT INTO prospects (id, name, trade, city, phone, website, status, facts) VALUES "
              "('overture/j', 'Lorem Roofing', 'roofing', 'Rogers', '479-273-0103', 'lorem.com', 'checked', "
              "'{\"checked_at\": \"2026-10-24T00:00:00+00:00\"}')")
    c.commit()
    res = mockup.build_and_save(c, "overture/j")
    assert not res["built"] and any("lorem" in x for x in res["problems"]), res
    assert c.execute("SELECT mockup_url FROM prospects WHERE id = 'overture/j'").fetchone()["mockup_url"] is None

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

# Step 4: clients. Trades only; starts pending; checkout refused while Stripe is off or the key is live
ok(api.get("/clients"), 401)
ok(api.post("/clients", json={"business_name": "Nail Salon", "email": "a@b.com", "trade": "salon"}, headers=H), 400)
r = api.post("/clients", json={"prospect_id": "overture/a"}, headers=H); ok(r)
cl = r.json()
assert cl["status"] == "pending" and cl["business_name"] == "Ozark Pipe Co" and cl["included_minutes"] == 300, cl
assert cl["email"] == "owner@ozarkpipe.com" and "stripe_customer_id" not in cl, cl
ok(api.post("/clients", json={"prospect_id": "overture/a"}, headers=H), 409)
assert api.get("/health").json()["stripe"] == "off"
r = api.post(f"/clients/{cl['id']}/checkout", json={}, headers=H); ok(r, 503)
assert "Stripe is off" in r.json()["detail"], r.text
config.STRIPE_SECRET_KEY = "sk_live_x"
r = api.post(f"/clients/{cl['id']}/checkout", json={}, headers=H); ok(r, 503)
assert "test keys only" in r.json()["detail"] and config.stripe_mode() == "blocked", r.text
ok(api.post(f"/clients/{cl['id']}/checkout", json={"plan": "gold"}, headers=H), 400)

# Step 5: checkout session shape (fake Stripe), annual = 10 months, $299 setup line, metadata for the webhook
config.STRIPE_SECRET_KEY = "sk_test_x"
sent = []


class FakeResp:
    def __init__(self, data):
        self.data = data

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return json.dumps(self.data).encode()


def fake_urlopen(req, timeout=None):
    form = dict(urllib.parse.parse_qsl(req.data.decode()))
    sent.append((req.full_url, form, req.headers))
    if req.full_url.endswith("checkout/sessions"):
        return FakeResp({"id": "cs_test_1", "url": "https://checkout.stripe.com/c/pay/cs_test_1"})
    return FakeResp({"id": "ii_test_%d" % len(sent)})


billing.urllib.request.urlopen = fake_urlopen
r = api.post(f"/clients/{cl['id']}/checkout", json={"plan": "front_desk_plus", "billing": "annual"}, headers=H); ok(r)
assert r.json()["url"].startswith("https://checkout.stripe.com/") and r.json()["mode"] == "test", r.json()
url, f, hdr = sent[-1]
assert url == "https://api.stripe.com/v1/checkout/sessions" and hdr["Authorization"] == "Bearer sk_test_x", (url, hdr)
assert f["mode"] == "subscription" and f["client_reference_id"] == str(cl["id"]), f
assert f["line_items[0][price_data][unit_amount]"] == "249000" and f["line_items[0][price_data][recurring][interval]"] == "year", f
assert f["line_items[1][price_data][unit_amount]"] == "29900" and "line_items[1][price_data][recurring][interval]" not in f, f
assert f["subscription_data[metadata][client_id]"] == str(cl["id"]) and f["customer_email"] == "owner@ozarkpipe.com", f
assert f["success_url"] == "https://api.example.test/paid", f
assert billing.price_cents("front_desk", "monthly") == 14900 and billing.price_cents("front_desk", "annual") == 149000
assert billing.overage(312, 300) == (12, 300)

# Webhook: unsigned, wrong secret, stale and live-mode events are refused; a signed one marks the client active once
config.STRIPE_WEBHOOK_SECRET = "whsec_test"
ev = {"id": "evt_1", "type": "checkout.session.completed", "livemode": False, "data": {"object": {
    "object": "checkout.session", "client_reference_id": str(cl["id"]), "payment_status": "paid", "customer": "cus_1",
    "subscription": "sub_1", "metadata": {"client_id": str(cl["id"]), "plan": "front_desk_plus", "billing": "annual"}}}}
raw = json.dumps(ev).encode()
hook = lambda body, sig: api.post("/stripe/webhook", content=body, headers={"Stripe-Signature": sig})
ok(hook(raw, ""), 400)
ok(hook(raw, billing.sign(raw, "whsec_other")), 400)
ok(hook(raw, billing.sign(raw, "whsec_test", time.time() - 900)), 400)
live = json.dumps(dict(ev, id="evt_live", livemode=True)).encode()
assert "ignored" in hook(live, billing.sign(live, "whsec_test")).json()
r = hook(raw, billing.sign(raw, "whsec_test")); ok(r)
assert r.json()["status"] == "active", r.json()
assert hook(raw, billing.sign(raw, "whsec_test")).json() == {"duplicate": True}
with db.connect() as c:
    row = c.execute("SELECT * FROM clients WHERE id = %s", (cl["id"],)).fetchone()
    assert row["status"] == "active" and row["stripe_subscription_id"] == "sub_1" and row["included_minutes"] == 800, row
    assert row["billing"] == "annual" and row["started_at"] is not None, row
    assert row["founding_no"] == 1 and row["monthly_cents"] == 24900, row  # first to pay: founding spot 1
    assert c.execute("SELECT status FROM prospects WHERE id='overture/a'").fetchone()["status"] == "won"
ok(api.post(f"/clients/{cl['id']}/checkout", json={}, headers=H), 409)  # already paying

# Failed payment -> past_due; paid -> active (newer invoice shape: parent.subscription_details)
for i, (kind, want) in enumerate([("invoice.payment_failed", "past_due"), ("invoice.paid", "active")]):
    e = json.dumps({"id": f"evt_inv{i}", "type": kind, "livemode": False, "data": {"object": {
        "object": "invoice", "customer": "cus_1", "parent": {"subscription_details": {"subscription": "sub_1"}}}}}).encode()
    assert hook(e, billing.sign(e, "whsec_test")).json()["status"] == want

# Paid invoices land in payments for the tax set-aside: setup line split out, replays ignored
inv = {"id": "evt_pay", "type": "invoice.paid", "livemode": False, "data": {"object": {
    "object": "invoice", "id": "in_1", "customer": "cus_1", "amount_paid": 44800, "tax": 0, "status_transitions": {"paid_at": 1793000000},
    "lines": {"data": [{"amount": 14900, "description": "Front Desk"}, {"amount": 29900, "description": "One-time setup"}]}}}}
e = json.dumps(inv).encode()
ok(hook(e, billing.sign(e, "whsec_test")))
e2 = json.dumps(dict(inv, id="evt_pay_again")).encode()
ok(hook(e2, billing.sign(e2, "whsec_test")))
pay = api.get("/payments", headers=H).json()["items"]
mine = [p for p in pay if p["note"] == "in_1"]
assert [(p["item"], p["amount"]) for p in mine] == [("setup", 299.0), ("receptionist", 149.0)], pay
assert mine[0]["date"] == "2026-10-26", mine  # 1793000000 is 2026-10-26 Central
ok(api.get("/payments?since=nope", headers=H), 400)
ok(api.get("/payments"), 401)

# Usage this month and overage: Plus includes 800 min; 812 min used = 12 over = $3.00
now = dt.datetime.now(dt.timezone.utc)
_, mstart, _ = billing.month_bounds()
with db.connect() as c:
    for i, secs in enumerate([800 * 60, 11 * 60 + 30]):
        c.execute("INSERT INTO receptionist_calls (client_id, vapi_call_id, started_at, seconds) VALUES (%s,%s,%s,%s)",
                  (cl["id"], f"call_{i}", max(mstart, now - dt.timedelta(minutes=5)), secs))
    c.execute("INSERT INTO receptionist_calls (client_id, vapi_call_id, started_at, seconds) VALUES (%s,'old',%s,600)",
              (cl["id"], mstart - dt.timedelta(days=3)))
    c.commit()
out = api.get("/clients", headers=H).json()
mine = out["items"][0]
assert mine["minutes_used"] == 812 and mine["over_minutes"] == 12 and mine["overage_cents"] == 300 and mine["calls"] == 2, mine
assert out["summary"]["active"] == 1 and out["summary"]["mrr_cents"] == round(249000 / 12), out["summary"]
assert out["summary"]["founding_left"] == 4 and mine["founding_no"] == 1, out["summary"]
line = out["costs"]["lines"][0]  # 812 min with no Vapi cost = estimate; hosting all on the one client; fee spread over 12
assert line["receptionist_cents"] == round(812 * config.VAPI_EST_CENTS_PER_MIN) and line["estimated"], line
assert line["hosting_cents"] == config.HOSTING_CENTS_MONTH and line["revenue_cents"] == round(249000 / 12) + 300, line
assert line["stripe_cents"] == round((249000 * 0.029 + 30) / 12) + round(300 * 0.029), line
assert line["margin_cents"] == line["revenue_cents"] - line["cost_cents"] and out["costs"]["totals"]["cost_cents"] == line["cost_cents"]
ok(api.get("/costs?month=2026-13", headers=H), 400)
assert api.get("/costs?month=2026-01", headers=H).json()["lines"][0]["minutes"] == 0
this_month = billing.month_bounds()[0]
n = len(sent)
r = api.post("/billing/overage", json={"month": this_month}, headers=H).json()
assert [x["amount_cents"] for x in r["charged"]] == [300], r
assert sent[n][0].endswith("/invoiceitems") and sent[n][1]["amount"] == "300" and sent[n][1]["customer"] == "cus_1", sent[n]
assert sent[n + 1][0].endswith("/invoices"), sent[n + 1]  # annual: bill now, not next year
r = api.post("/billing/overage", json={"month": this_month}, headers=H).json()
assert r["charged"] == [] and r["skipped"][0]["reason"] == "already charged", r
ok(api.post("/billing/overage", json={"month": "2026-13"}, headers=H), 422)
assert api.post("/billing/overage", json={}, headers=H).json()["charged"] == []  # last month: under the plan

# Cancelled subscription
e = json.dumps({"id": "evt_del", "type": "customer.subscription.deleted", "livemode": False,
                "data": {"object": {"object": "subscription", "id": "sub_1", "customer": "cus_1"}}}).encode()
assert hook(e, billing.sign(e, "whsec_test")).json()["status"] == "cancelled"
assert "Payment received" in api.get("/paid").text and "No charge" in api.get("/paid?cancelled=1").text

# Matchmaking leads: display only, no write routes
with db.connect() as c:
    c.execute("""INSERT INTO leads (customer_name, phone, zip, trade, job_description, urgency, consent_at, matched_client_id)
                 VALUES ('Pat', '479-555-0100', '72712', 'plumbing', 'Water heater leaking', 'this_week', now(), %s)""", (cl["id"],))
    c.commit()
ld = api.get("/leads", headers=H).json()
assert ld["display_only"] and ld["items"][0]["matched_to"] == "Ozark Pipe Co" and "phone" not in ld["items"][0], ld
assert {r.path for r in main.app.routes if "leads" in r.path} == {"/leads"}
assert all(m == "GET" for r in main.app.routes if r.path == "/leads" for m in r.methods if m != "HEAD")
config.STRIPE_SECRET_KEY = config.STRIPE_WEBHOOK_SECRET = ""

# Receptionist (Vapi): set-up is a dry run without a key; the webhook needs the secret; calls feed /clients
import receptionist  # noqa: E402

r = api.post("/clients", json={"business_name": "Hog Valley HVAC", "email": "office@hogvalley.com", "trade": "hvac"}, headers=H); ok(r)
rc = r.json()
ok(api.post(f"/clients/{rc['id']}/receptionist", json={}, headers=H), 409)  # not paying yet: no receptionist
with db.connect() as c:
    c.execute("UPDATE clients SET status = 'active' WHERE id = %s", (rc["id"],))
    c.commit()
ok(api.post(f"/clients/{rc['id']}/receptionist", json={"open_hour": 17, "close_hour": 8}, headers=H), 400)
ok(api.post(f"/clients/{rc['id']}/receptionist", json={"receptionist_number": "555"}, headers=H), 400)
ok(api.post("/clients/9999/receptionist", json={}, headers=H), 404)
ok(api.post(f"/clients/{rc['id']}/receptionist", json={}), 401)
r = api.post(f"/clients/{rc['id']}/receptionist", headers=H, json={
    "open_hour": 7, "close_hour": 18, "open_saturday": True, "textback_enabled": True, "receptionist_number": "(479) 555-0142"})
ok(r)
out = r.json()
a = out["assistant"]
assert out["mode"] == "stub" and out["assistant_id"] is None, out
assert out["client"]["textback_enabled"] and out["client"]["open_saturday"] and not out["client"]["has_receptionist"], out
sysmsg = a["model"]["messages"][0]["content"]
assert "Hog Valley HVAC" in sysmsg and "heating and air" in sysmsg and "Monday to Saturday, 7am to 6pm Central" in sysmsg, sysmsg
assert "Never quote prices" in sysmsg and "Never claim to be a person" in sysmsg and "911" in sysmsg, sysmsg
assert a["server"]["url"] == "https://api.example.test/vapi/webhook" and a["serverMessages"] == ["end-of-call-report"], a
assert "recorded" in a["firstMessage"] and a["maxDurationSeconds"] == 600, a

# With a key it creates the assistant on Vapi (faked here; nothing leaves the machine), then updates the same one
vapi_sent = []


def fake_vapi(req, timeout=None):
    vapi_sent.append((req.get_method(), req.full_url, req.headers.get("Authorization")))
    return FakeResp({"id": "asst_hog"})


receptionist.urllib.request.urlopen = fake_vapi
config.VAPI_API_KEY = "vapi_test"
ok(api.post(f"/clients/{rc['id']}/receptionist", json={}, headers=H), 502)  # no webhook secret: refuse to set up
config.VAPI_WEBHOOK_SECRET = "vsecret"
r = api.post(f"/clients/{rc['id']}/receptionist", json={"textback_enabled": True}, headers=H); ok(r)
assert r.json()["mode"] == "vapi" and r.json()["client"]["has_receptionist"], r.json()
ok(api.post(f"/clients/{rc['id']}/receptionist", json={"textback_enabled": True}, headers=H))
assert vapi_sent == [("POST", "https://api.vapi.ai/assistant", "Bearer vapi_test"),
                     ("PATCH", "https://api.vapi.ai/assistant/asst_hog", "Bearer vapi_test")], vapi_sent
assert api.get("/health").json()["receptionist"] == "vapi"
config.VAPI_API_KEY = ""

# Webhook: secret required, junk and unknown assistants ignored, each call saved once
iso = lambda t: t.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
now = dt.datetime.now(dt.timezone.utc)


def report(call_id, start, secs, aid="asst_hog", caller="+14795550199", **extra):
    return {"message": dict({"type": "end-of-call-report", "call": {"id": call_id, "assistantId": aid,
            "customer": {"number": caller}}, "startedAt": iso(start), "endedAt": iso(start + dt.timedelta(seconds=secs)),
            "endedReason": "customer-ended-call", "cost": 0.42}, **extra)}


vh = {"X-Vapi-Secret": "vsecret"}
ok(api.post("/vapi/webhook", json=report("v1", now, 30)), 401)
ok(api.post("/vapi/webhook", json=report("v1", now, 30), headers={"X-Vapi-Secret": "nope"}), 401)
assert api.post("/vapi/webhook", json={"message": {"type": "status-update"}}, headers=vh).json()["ignored"] == "status-update"
assert "ignored" in api.post("/vapi/webhook", json=report("v0", now, 30, aid="asst_other", caller=None), headers=vh).json()

# A missed call from a client who stopped paying: saved, but no text
with db.connect() as c:
    c.execute("UPDATE clients SET status = 'pending' WHERE id = %s", (rc["id"],))
    c.commit()
r = api.post("/vapi/webhook", json=report("v1", now - dt.timedelta(minutes=1), 8), headers=vh).json()
assert r["outcome"] == "hung_up" and r["textback"] == "skipped: not an active client", r
with db.connect() as c:
    c.execute("UPDATE clients SET status = 'active' WHERE id = %s", (rc["id"],))
    c.commit()
# Message taken (structured outcome wins), matched by the receptionist number when the assistant id is unknown
msg = report("v2", now - dt.timedelta(minutes=3), 185, aid=None, analysis={"summary": "No heat, upstairs unit",
             "structuredData": {"outcome": "message"}}, phoneNumber={"number": "+1 479-555-0142"})
r = api.post("/vapi/webhook", json=msg, headers=vh).json()
assert r["outcome"] == "message" and r["textback"] is None, r
assert api.post("/vapi/webhook", json=msg, headers=vh).json() == {"ok": True, "duplicate": True}
# Missed call from an active client with text-back on: one stub text, then no second text that week
r = api.post("/vapi/webhook", json=report("v3", now - dt.timedelta(minutes=2), 6), headers=vh).json()
assert r["textback"] == "stub", r
r = api.post("/vapi/webhook", json=report("v4", now - dt.timedelta(minutes=1), 5), headers=vh).json()
assert r["textback"] == "skipped: texted this week", r
# Old call, opted-out number, no caller id: no text
assert api.post("/vapi/webhook", json=report("v5", now - dt.timedelta(hours=1), 5, caller="+14795550111"),
                headers=vh).json()["textback"] == "skipped: call too old"
ok(api.post("/sms/optouts", json={"number": "12"}, headers=H), 400)
assert api.post("/sms/optouts", json={"number": "(479) 555-0122"}, headers=H).json()["number"] == "4795550122"
assert api.post("/vapi/webhook", json=report("v6", now, 5, caller="+1 479 555 0122"), headers=vh).json()["textback"] == "skipped: opted out"
assert api.post("/vapi/webhook", json=report("v7", now, 5, caller=None), headers=vh).json()["textback"] == "skipped: no caller number"
with db.connect() as c:
    t = c.execute("SELECT * FROM textbacks").fetchall()
    assert len(t) == 1 and t[0]["status"] == "stub" and t[0]["to_number"] == "4795550199", t
    assert "Hog Valley HVAC" in t[0]["body"] and "Reply STOP" in t[0]["body"], t
    v2 = c.execute("SELECT * FROM receptionist_calls WHERE vapi_call_id = 'v2'").fetchone()
    assert v2["seconds"] == 185 and v2["cost_cents"] == 42 and v2["summary"] == "No heat, upstairs unit", v2

# Clients view: minutes and counts for this month (calls at the very start of a month can fall in last month)
mine = next(x for x in api.get("/clients", headers=H).json()["items"] if x["id"] == rc["id"])
calls = api.get(f"/clients/{rc['id']}/calls", headers=H).json()["items"]
assert len(calls) == 7 and [c["textback"] for c in calls].count("stub") == 1, calls
if now.astimezone(mailer.CENTRAL).day > 1:
    assert mine["calls"] == 7 and mine["missed_calls"] == 6 and mine["minutes_used"] == 4, mine

# After hours, in Central: Saturday open, Sunday closed, 6pm closed
sat = {"open_hour": 7, "close_hour": 18, "open_saturday": True}
C = mailer.CENTRAL
assert not receptionist.is_after_hours(sat, dt.datetime(2026, 10, 24, 9, tzinfo=C))       # Saturday 9am
assert receptionist.is_after_hours(sat, dt.datetime(2026, 10, 25, 9, tzinfo=C))           # Sunday
assert receptionist.is_after_hours(sat, dt.datetime(2026, 10, 23, 18, tzinfo=C))          # Friday 6pm
assert receptionist.is_after_hours(dict(sat, open_saturday=False), dt.datetime(2026, 10, 24, 9, tzinfo=C))
config.VAPI_WEBHOOK_SECRET = ""
ok(api.post("/vapi/webhook", json=report("v9", now, 5), headers=vh), 503)

# Follow-ups: days 3, 7 and 14 in the same thread, approved with the first email, stopped by reply, bounce or "stop"
import followups  # noqa: E402
sys.path.insert(0, str(API.parents[1] / "sites"))
from audit import banned_words  # noqa: E402
with db.connect() as c:
    c.execute("""INSERT INTO prospects (id, name, trade, city, email, website, rating, flaw, mockup_url, status) VALUES
      ('fu/k', 'Kings Plumbing', 'plumbing', 'Rogers', 'kim@kingsplumb.com', 'kingsplumb.com', 4.4, 'no tap-to-call', 'https://api.example.test/m/kings', 'built'),
      ('fu/l', 'Lake Air', 'hvac', 'Lowell', 'lee@lakeair.com', 'lakeair.com', 4.2, 'no https', NULL, 'checked'),
      ('fu/m', 'Mesa Roofing', 'roofing', 'Bentonville', 'max@mesaroof.com', 'mesaroof.com', 4.0, '© 2019', NULL, 'checked')""")
    c.execute("""UPDATE prospects SET facts = '{"checked_at": "2026-10-24T00:00:00+00:00", "check_mode": "http"}',
                 mockup_slug = replace(id, '/', '-'), mockup_url = coalesce(mockup_url, 'https://api.example.test/m/' || replace(id, '/', '-'))
                 WHERE id LIKE 'fu/%'""")
    c.commit()
    out = outreach.draft_first_emails(c, 10, ["fu/k", "fu/l", "fu/m"], drafter=outreach.template_draft); made = out["created"]
assert len(made) == 3, out
fu_ids = {x["prospect_id"]: x["email_id"] for x in made}
k = api.get(f"/emails/{fu_ids['fu/k']}", headers=H).json()
assert [f["day"] for f in k["follow_ups"]] == [3, 7, 14], k
for kind_id in fu_ids.values():
    for f in api.get(f"/emails/{kind_id}", headers=H).json()["follow_ups"]:
        text = f["subject"] + " " + f["body"]
        assert f["subject"].startswith("Re: ") and len(f["body"].split()) <= outreach.MAX_WORDS, f
        assert "!" not in text and "—" not in text and not banned_words(text) and "bump" not in text.lower(), f
        assert not outreach.PLACEHOLDER.search(text) and "$" not in text, f
assert "https://api.example.test/m/kings" in k["follow_ups"][0]["body"] and "https://api.example.test/m/kings" in k["follow_ups"][1]["body"]
assert "burst pipe" in k["follow_ups"][0]["body"] and "stop writing" in k["follow_ups"][2]["body"], k
for i in fu_ids.values():
    ok(api.post(f"/emails/{i}/approve", headers=H))
assert "follow_ups" not in api.get("/queue?status=sent", headers=H).json()["items"][0]

config.MAILER, config.DAILY_SEND_CAP = "smtp", 20
sent.clear()
fake_send = lambda msg: sent.append(msg) or msg["Message-ID"]
day = lambda m, d, h=15: dt.datetime(2026, m, d, h, 0, tzinfo=dt.timezone.utc)  # 15:00Z = 9 or 10am Central
with db.connect() as c:
    res = mailer.send_due(c, day(10, 27), fake_send)
    assert res["sent"] == 3 and len(sent) == 3 and not any(m["In-Reply-To"] for m in sent), res
    first_ids = {m["To"]: m["Message-ID"] for m in sent}
    fus = c.execute("SELECT prospect_id, kind, status, send_after FROM emails WHERE prospect_id LIKE 'fu/%%' AND kind <> 'first' "
                    "ORDER BY prospect_id, kind").fetchall()
    assert len(fus) == 9 and {f["status"] for f in fus} == {"approved"}, fus
    when = {f["kind"]: f["send_after"].astimezone(mailer.CENTRAL) for f in fus if f["prospect_id"] == "fu/k"}
    assert [when[x].date() for x in ("follow_up_1", "follow_up_2", "follow_up_3")] == \
        [dt.date(2026, 10, 30), dt.date(2026, 11, 3), dt.date(2026, 11, 10)] and all(mailer.in_window(w) for w in when.values()), when
    followups.schedule(c, "fu/k", day(10, 27)); c.commit()  # twice is harmless
    assert c.execute("SELECT count(*) AS n FROM emails WHERE prospect_id = 'fu/k'").fetchone()["n"] == 4
    sent.clear()
    assert mailer.send_due(c, day(10, 29), fake_send)["sent"] == 0 and not sent  # day 2: nothing due yet

# Undo a follow-up, edit it, approve again: it still waits for its day
mid = next(f for f in fus if f["prospect_id"] == "fu/m" and f["kind"] == "follow_up_2")
with db.connect() as c:
    m2 = c.execute("SELECT id FROM emails WHERE prospect_id = 'fu/m' AND kind = 'follow_up_2'").fetchone()["id"]
ok(api.post(f"/emails/{m2}/unapprove", headers=H))
ok(api.patch(f"/emails/{m2}", json={"body": "Hi,\n\nShort and plain: https://api.example.test/m/fu-m\n\nWorth a call this week?"}, headers=H))
r = api.post(f"/emails/{m2}/approve", headers=H); ok(r)
assert dt.datetime.fromisoformat(r.json()["item"]["email"]["send_after"]) >= mid["send_after"], r.json()
with db.connect() as c:
    assert c.execute("SELECT status FROM prospects WHERE id = 'fu/m'").fetchone()["status"] == "emailed"


def mail(frm, subject, body, **hdr):
    head = "".join(f"{k.replace('_', '-')}: {v}\r\n" for k, v in hdr.items())
    return f"From: {frm}\r\nTo: tj@cold.example.test\r\nSubject: {subject}\r\n{head}\r\n{body}\r\n".encode()


inbox = [
    mail("Lee <LEE@lakeair.com>", "Re: x", "Stop by Monday, I'm free after 2.\r\n\r\nOn Tue, TJ wrote:\r\n> stop by anytime",
         In_Reply_To=first_ids["lee@lakeair.com"]),
    mail("Max <max@mesaroof.com>", "Automatic reply: x", "I'm out until Friday.", Auto_Submitted="auto-replied"),
    mail("someone@else.com", "Hello", "Unrelated."),
]
with db.connect() as c:
    got = followups.check_inbox(c, day(10, 30, 14), fetch=lambda since: inbox)
    assert got["replied"] == ["fu/l"] and not got["bounced"] and not got["stopped"], got
    st = {r["kind"]: r["status"] for r in c.execute("SELECT kind, status FROM emails WHERE prospect_id = 'fu/l'")}
    assert st == {"first": "replied", "follow_up_1": "cancelled", "follow_up_2": "cancelled", "follow_up_3": "cancelled"}, st
    assert c.execute("SELECT status FROM prospects WHERE id = 'fu/l'").fetchone()["status"] == "replied"
    assert c.execute("SELECT status FROM prospects WHERE id = 'fu/m'").fetchone()["status"] == "emailed"  # out of office
    sent.clear()
    res = mailer.send_due(c, day(10, 30), fake_send)
    assert res["sent"] == 2 and sorted(m["To"] for m in sent) == ["kim@kingsplumb.com", "max@mesaroof.com"], res
    kfu = next(m for m in sent if m["To"] == "kim@kingsplumb.com")
    assert kfu["In-Reply-To"] == first_ids["kim@kingsplumb.com"] and kfu["Subject"].startswith("Re: "), kfu
    assert "PO Box 1" in kfu.get_content() and kfu["List-Unsubscribe-Post"], kfu

# Bounce (a delivery report naming the address) puts it on the do-not-email list and ends the sequence
dsn = mail("Mail Delivery Subsystem <mailer-daemon@googlemail.com>", "Delivery Status Notification (Failure)",
           "Your message wasn't delivered to max@mesaroof.com because the address couldn't be found.")
with db.connect() as c:
    got = followups.check_inbox(c, day(11, 2), fetch=lambda since: [dsn] + inbox)
    assert got["bounced"] == ["fu/m"] and got["replied"] == [], got  # lee already handled, not counted twice
    assert db.suppressed(c, "max@mesaroof.com")
    assert c.execute("SELECT count(*) AS n FROM emails WHERE prospect_id = 'fu/m' AND status = 'approved'").fetchone()["n"] == 0
    assert c.execute("SELECT status FROM emails WHERE prospect_id = 'fu/m' AND kind = 'follow_up_1'").fetchone()["status"] == "bounced"
    sent.clear()
    res = mailer.send_due(c, day(11, 3), fake_send)
    assert res["sent"] == 1 and sent[0]["To"] == "kim@kingsplumb.com", res
    assert sent[0]["References"].split() == [first_ids["kim@kingsplumb.com"], kfu["Message-ID"]], sent[0]["References"]
    # "Please stop" in the reply (above the quote) = opt-out, not a warm lead
    stop_msg = mail("kim@kingsplumb.com", "Re: x", "Please stop emailing me.\r\n\r\n> Hi, if a new site sounds like a lot of work",
                    References=sent[0]["Message-ID"])
    got = followups.check_inbox(c, day(11, 4), fetch=lambda since: [stop_msg])
    assert got["stopped"] == ["fu/k"] and db.suppressed(c, "kim@kingsplumb.com"), got
    assert c.execute("SELECT status FROM emails WHERE prospect_id = 'fu/k' AND kind = 'follow_up_3'").fetchone()["status"] == "cancelled"
    assert mailer.send_due(c, day(11, 10), fake_send)["sent"] == 0

# A follow-up whose first email never went out is cancelled by the sender, not sent
with db.connect() as c:
    c.execute("""INSERT INTO prospects (id, name, trade, city, email, website, status) VALUES
                 ('fu/n', 'Nash Heat', 'hvac', 'Rogers', 'n@nashheat.com', 'nashheat.com', 'emailed')""")
    c.execute("""INSERT INTO emails (prospect_id, kind, subject, body, status, unsub_token, approved_at)
                 VALUES ('fu/n', 'follow_up_1', 'Re: x', 'Hi', 'approved', 'tok-n', now())""")
    c.commit()
    sent.clear()
    res = mailer.send_due(c, day(11, 10), fake_send)
    assert not sent and any("first email was not sent" in h["reason"] for h in res["held"]), res

# Marked by hand from the Sent tab; an inbox that can't be read holds follow-ups but not first emails
ok(api.post("/prospects/fu/zz/replied", headers=H), 404)
ok(api.post("/prospects/fu/n/replied"), 401)
r = api.post("/prospects/fu/n/replied", headers=H); ok(r)
assert r.json()["status"] == "replied" and r.json()["cancelled"] == 0, r.json()
r = api.post("/prospects/fu/n/bounced", headers=H); ok(r)
with db.connect() as c:
    assert db.suppressed(c, "n@nashheat.com")
followups.imap_fetch = lambda since: (_ for _ in ()).throw(OSError("no route"))
r = api.post("/send", headers=H); ok(r)
assert "inbox check failed" in r.json()["inbox"]["error"], r.json()
config.MAILER = "stub"
assert "by hand" in api.post("/outreach/inbox", headers=H).json()["detail"]
h = api.get("/health").json()
assert h["inbox"] == "stub" and h["follow_up_days"] == [3, 7, 14], h

# Founding clients: spots 2-5 go to the next four to pay, the sixth pays list price and gets no spot
import costs  # noqa: E402
import followups  # noqa: E402
with db.connect() as c:
    ids = [c.execute("""INSERT INTO clients (business_name, email, trade) VALUES (%s, %s, 'plumbing') RETURNING id""",
                     (f"Founding {i}", f"f{i}@found{i}.com")).fetchone()["id"] for i in range(5)]
    c.commit()
config.STRIPE_WEBHOOK_SECRET = "whsec_test"
for i, cid in enumerate(ids):
    e = json.dumps({"id": f"evt_found{i}", "type": "checkout.session.completed", "livemode": False, "data": {"object": {
        "object": "checkout.session", "client_reference_id": str(cid), "payment_status": "paid",
        "metadata": {"client_id": str(cid), "plan": "front_desk", "billing": "monthly"}}}}).encode()
    r = hook(e, billing.sign(e, "whsec_test")).json()
    assert r.get("founding_no") == (i + 2 if i < 4 else None), r
with db.connect() as c:
    assert billing.founding_left(c) == 0
    nums = [r["founding_no"] for r in c.execute("SELECT founding_no FROM clients WHERE founding_no IS NOT NULL ORDER BY 1")]
    assert nums == [1, 2, 3, 4, 5], nums
    assert billing.claim_founding(c, ids[-1]) is None and billing.claim_founding(c, ids[0]) == 2  # no sixth; keeps its own
# A later price rise never reaches a founding client; a cut does
old = dict(billing.PLANS["front_desk"])
billing.PLANS["front_desk"]["monthly_cents"] = 19900
assert billing.price_cents("front_desk", "monthly", founding=True) == 14900 and billing.price_cents("front_desk", "monthly") == 19900
billing.PLANS["front_desk"]["monthly_cents"] = 9900
assert billing.price_cents("front_desk", "monthly", founding=True) == 9900
billing.PLANS["front_desk"].update(old)
# Copy: day-7 follow-up offers the lock only while spots are open; previews drop the line once they're gone
P = {"name": "Ozark Pipe Co", "city": "Rogers", "trade": "plumbing", "mockup_url": "https://x.test/m/a"}
assert "first 5 shops" in followups.write("follow_up_2", P, "Your site", founding=True)[1]
assert "first 5" not in followups.write("follow_up_2", P, "Your site")[1]
assert not outreach.preflight(*followups.write("follow_up_2", P, "Your site", founding=True), P, "follow_up_2")
page = 'x<p class="ofine">$299 setup</p>\n<p class="ofine ofound"><b>Founding offer:</b> the first 5 shops</p></div>'
assert main.FOUNDING_LINE.sub("", page) == 'x<p class="ofine">$299 setup</p></div>'
assert costs.ai_cents("claude-haiku-5-5", 2_000_000, 1_000_000) == 70  # $0.10 + $0.50 per million, in cents

# Cost trim: an address that can't take mail is held before the Chromium visit, not after the mockup
with db.connect() as c:
    c.execute("""INSERT INTO prospects (id, name, trade, city, email, website, status) VALUES
                 ('trim/a', 'Dead Mail Roofing', 'roofing', 'Rogers', 'a@deadmail.test', 'deadmail.test', 'new')""")
    c.commit()
    was, quality.mail_domain_ok = quality.mail_domain_ok, lambda e: False
    out = outreach.prepare(c, 5, ["trim/a"], inspect=lambda u: sys.exit("should not open a browser"))
    quality.mail_domain_ok = was
    assert out["skipped"][0]["reason"] == "deadmail.test doesn't take email" and not out["checked"], out
    assert c.execute("SELECT status FROM prospects WHERE id = 'trim/a'").fetchone()["status"] == "no-email"

print("founding and costs ok")

print("agency api ok")
