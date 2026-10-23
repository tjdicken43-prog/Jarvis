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
          "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_ALLOW_LIVE"):
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
    c.execute("INSERT INTO prospects (id, name, trade, city, phone, website, status) VALUES "
              "('overture/j', 'Lorem Roofing', 'roofing', 'Rogers', '479-273-0103', 'lorem.com', 'checked')")
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
    assert c.execute("SELECT status FROM prospects WHERE id='overture/a'").fetchone()["status"] == "won"
ok(api.post(f"/clients/{cl['id']}/checkout", json={}, headers=H), 409)  # already paying

# Failed payment -> past_due; paid -> active (newer invoice shape: parent.subscription_details)
for i, (kind, want) in enumerate([("invoice.payment_failed", "past_due"), ("invoice.paid", "active")]):
    e = json.dumps({"id": f"evt_inv{i}", "type": kind, "livemode": False, "data": {"object": {
        "object": "invoice", "customer": "cus_1", "parent": {"subscription_details": {"subscription": "sub_1"}}}}}).encode()
    assert hook(e, billing.sign(e, "whsec_test")).json()["status"] == want

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

print("agency api ok")
