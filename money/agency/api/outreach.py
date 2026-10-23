"""Outreach Agent: picks shops ready for a first email, drafts 3 sentences about their one real flaw, and saves
the draft for the Approval Queue. Nothing here sends; mailer.py does that after TJ approves.

Claude writes the draft when ANTHROPIC_API_KEY is set; otherwise a plain template does, so the flow runs
end to end before Tuesday's keys.
"""
import json
import re
import secrets

import config
import db
import flaws
import mockup
from mailer import host

EMERGENCY = {"plumbing": "a burst pipe", "hvac": "a dead AC", "roofing": "a leaking roof"}
TRADE_WORD = {"plumbing": "plumber", "hvac": "heating and air company", "roofing": "roofer"}
PRICES = {"$299", "$149", "$249"}               # the only prices an email may name (Pricing, 2026-10-23)
PLACEHOLDER = re.compile(r"\[[^\]]*\]|\{[^}]*\}|lorem|TODO|XXX|<[a-z]+>", re.I)
MAX_WORDS = 80

ELIGIBLE = """
SELECT p.* FROM prospects p
WHERE p.status IN ('checked', 'built') AND p.trade IN ('plumbing', 'hvac', 'roofing')
  AND p.email IS NOT NULL AND p.email <> '' AND p.flaw IS NOT NULL AND p.flaw <> ''
  AND (p.rating IS NULL OR p.rating >= %(min_rating)s)
  AND NOT EXISTS (SELECT 1 FROM emails e WHERE e.prospect_id = p.id AND e.kind = 'first')
  {only}
ORDER BY p.score DESC NULLS LAST, p.review_count DESC NULLS LAST, p.id
LIMIT %(limit)s
"""


def plain_flaw(flaw):
    """Scout flags ('no tap-to-call, © 2019') -> what a shop owner would see on their own phone."""
    flaw = (flaw or "").strip()
    if flaw.lower().startswith("site down"):
        return ["your website shows an empty placeholder page" if "parked" in flaw.lower() else "your website doesn't load"]
    out = []
    for f in [x.strip() for x in flaw.split(",") if x.strip()]:
        low = f.lower()
        if low == "no https":
            out.append('browsers mark your site "Not secure"')
        elif low == "not mobile-friendly":
            out.append("it doesn't fit a phone screen, so people have to pinch and zoom to read it")
        elif low == "no tap-to-call":
            out.append("there's no tap-to-call button for people on their phones")
        elif low == "phone number hidden on phones":
            out.append("your phone number isn't on the first screen on a phone")
        elif m := re.match(r"©\s*(\d{4})", f):
            out.append(f"the footer still says {m.group(1)}")
        elif m := re.match(r"slow \(([\d.]+)s\)", low):
            out.append(f"your homepage took {m.group(1)} seconds to load")
        else:
            out.append(f)
    return out


def angle(p):
    """Pitch angle by problem (master prompt): down -> losing calls, no tap-to-call -> phone callers, else first impression."""
    if p.get("site_state") == "DOWN":
        return "losing calls"
    if "tap-to-call" in (p.get("flaw") or "") or "phone number hidden" in (p.get("flaw") or ""):
        return "phone callers"
    return "first impression"


def template_draft(p):
    name, city = p["name"], p.get("city") or "your area"
    seen = plain_flaw(p["flaw"])
    a = angle(p)
    if a == "losing calls":
        parked = "parked" in (p.get("flaw") or "").lower()
        state, saw = ("is blank", "only showed a placeholder page") if parked else ("isn't loading", "didn't load")
        subject = f"{name}'s website {state}"
        first = (f"I tried to pull up {host(p.get('website')) or 'your website'} today and it {saw}, "
                 f"so people searching for a {TRADE_WORD[p['trade']]} in {city} hit a dead end.")
    elif a == "phone callers" and "hidden" in (p.get("flaw") or ""):
        subject = f"Calls from {name}'s website"
        first = (f"I looked at your site on my phone and your number isn't on the first screen, so someone in {city} "
                 f"with {EMERGENCY[p['trade']]} has to scroll to find it.")
    elif a == "phone callers":
        subject = f"Calls from {name}'s website"
        first = (f"I looked at your site on my phone and there's no tap-to-call button, so someone in {city} "
                 f"with {EMERGENCY[p['trade']]} has to copy your number by hand.")
    else:
        subject = f"Quick note on {name}'s website"
        found = seen[0] if len(seen) == 1 else f"{seen[0]} and {seen[1]}"
        first = f"I looked at your site on my phone and {found}."
    if p.get("mockup_url"):
        rest = f"I built you a preview of a new one, set up so after-hours calls get answered too:\n{p['mockup_url']}\n\nIs it worth a quick look?"
    else:
        rest = "I can build a free preview of a fixed one this week, set up so after-hours calls get answered too. Want me to send it over?"
    return subject, f"Hi,\n\n{first} {rest}"


SYSTEM = """You write short cold emails from TJ, who builds websites and an after-hours AI phone receptionist for local plumbers, HVAC companies and roofers in Northwest Arkansas.

Rules:
- Subject: plain and honest, under 8 words, names the business. No clickbait, no "Re:", no emoji.
- Body: start with "Hi," on its own line, then exactly 3 sentences, at most 70 words in all. Plain words a shop owner uses.
- Sentence 1 names the one problem from the facts, as something TJ saw himself. Only use the facts given. Never invent numbers, reviews, competitors or results.
- Sentence 2 offers the fix: the preview link if one is given (paste it exactly), otherwise offer to build a free preview. You may mention calls being answered after hours.
- Sentence 3 is one simple question.
- No prices, no signature, no sign-off, no unsubscribe line (TJ's footer adds those). No exclamation marks, no em dashes, no buzzwords (leverage, elevate, seamless, solutions, game-changer, boost), no flattery."""

SCHEMA = {
    "type": "object",
    "properties": {"subject": {"type": "string"}, "body": {"type": "string"}},
    "required": ["subject", "body"],
    "additionalProperties": False,
}


def claude_draft(p):
    import anthropic

    facts = {
        "business": p["name"], "trade": p["trade"], "city": p.get("city"), "website": p.get("website"),
        "problems_seen": plain_flaw(p["flaw"]), "pitch_angle": angle(p), "preview_link": p.get("mockup_url"),
    }
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model=config.DRAFT_MODEL,
        max_tokens=2000,
        system=SYSTEM,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": "Write the email from these facts:\n" + json.dumps(facts)}],
    )
    if resp.stop_reason != "end_turn":
        raise RuntimeError(f"Claude stopped early ({resp.stop_reason})")
    text = next(b.text for b in resp.content if b.type == "text")
    out = json.loads(text)
    return out["subject"].strip(), out["body"].strip()


def preflight(subject, body, p):
    """Reasons this draft must not reach the queue (empty list = fine)."""
    problems = []
    if not subject.strip() or not body.strip():
        problems.append("empty subject or body")
    if PLACEHOLDER.search(subject + " " + body):
        problems.append("placeholder text left in")
    if len(body.split()) > MAX_WORDS:
        problems.append(f"over {MAX_WORDS} words")
    for price in re.findall(r"\$\d[\d,]*", body):
        if price not in PRICES:
            problems.append(f"price {price} is not one of ours")
    if p.get("mockup_url") and p["mockup_url"] not in body:
        problems.append("preview link missing")
    if "!" in subject:
        problems.append("exclamation mark in subject")
    return problems


def draft_first_emails(conn, limit=10, prospect_ids=None, drafter=None):
    """Draft first emails for up to `limit` eligible shops. Returns {created, skipped}."""
    write = drafter or (claude_draft if config.drafter() == "claude" else template_draft)
    only = "AND p.id = ANY(%(ids)s)" if prospect_ids else ""
    rows = conn.execute(ELIGIBLE.format(only=only),
                        {"min_rating": config.MIN_RATING, "limit": limit, "ids": prospect_ids}).fetchall()
    created, skipped = [], []
    for p in rows:
        if db.suppressed(conn, p["email"], host(p.get("website"))):
            conn.execute("UPDATE prospects SET status = 'unsubscribed', updated_at = now() WHERE id = %s", (p["id"],))
            skipped.append({"prospect_id": p["id"], "name": p["name"], "reason": "on the do-not-email list"})
            continue
        try:
            subject, body = write(p)
        except Exception as e:  # one bad draft never stops the batch
            skipped.append({"prospect_id": p["id"], "name": p["name"], "reason": f"draft failed: {e}"[:200]})
            continue
        problems = preflight(subject, body, p)
        if problems:
            skipped.append({"prospect_id": p["id"], "name": p["name"], "reason": "; ".join(problems)})
            continue
        row = conn.execute(
            """INSERT INTO emails (prospect_id, kind, subject, body, unsub_token)
               VALUES (%s, 'first', %s, %s, %s) ON CONFLICT (prospect_id, kind) DO NOTHING RETURNING id""",
            (p["id"], subject, body, secrets.token_urlsafe(24)),
        ).fetchone()
        if row:
            created.append({"email_id": row["id"], "prospect_id": p["id"], "name": p["name"]})
    conn.commit()
    return {"created": created, "skipped": skipped}


READY = """
SELECT p.* FROM prospects p
WHERE p.status IN ('new', 'checked', 'built') AND p.trade IN ('plumbing', 'hvac', 'roofing')
  AND p.email IS NOT NULL AND p.email <> '' AND p.website IS NOT NULL AND p.website <> ''
  AND (p.rating IS NULL OR p.rating >= %(min_rating)s)
  AND NOT EXISTS (SELECT 1 FROM emails e WHERE e.prospect_id = p.id AND e.kind = 'first')
  AND NOT (coalesce(p.facts, '{{}}'::jsonb) ? 'checked_at' AND p.flaw IS NULL)  -- checked, nothing to pitch
  {only}
ORDER BY p.score DESC NULLS LAST, p.review_count DESC NULLS LAST, p.id
LIMIT %(limit)s
"""


def prepare(conn, limit=5, prospect_ids=None, drafter=None, inspect=None):
    """The whole Outreach Agent for up to `limit` shops: find the flaw, build the mockup, draft the email.

    A shop with no real flaw gets no email. A mockup that fails the site bar checks blocks the draft.
    """
    only = "AND p.id = ANY(%(ids)s)" if prospect_ids else ""
    rows = conn.execute(READY.format(only=only),
                        {"min_rating": config.MIN_RATING, "limit": limit, "ids": prospect_ids}).fetchall()
    checked, built, held = [], [], []
    ready = []
    for p in rows:
        if db.suppressed(conn, p["email"], host(p.get("website"))):
            conn.execute("UPDATE prospects SET status = 'unsubscribed', updated_at = now() WHERE id = %s", (p["id"],))
            conn.commit()
            held.append({"prospect_id": p["id"], "name": p["name"], "reason": "on the do-not-email list"})
            continue
        if not (p.get("facts") or {}).get("checked_at"):
            try:
                checked.append(flaws.find_and_save(conn, p["id"], inspect=inspect))
            except Exception as e:  # one bad site never stops the batch
                conn.rollback()
                held.append({"prospect_id": p["id"], "name": p["name"], "reason": f"flaw finder failed: {e}"[:200]})
                continue
        cur = conn.execute("SELECT flaw FROM prospects WHERE id = %s", (p["id"],)).fetchone()
        if not cur["flaw"]:
            held.append({"prospect_id": p["id"], "name": p["name"], "reason": "no clear flaw on their site"})
            continue
        res = mockup.build_and_save(conn, p["id"])
        if not res.get("built"):
            held.append({"prospect_id": p["id"], "name": p["name"],
                         "reason": "mockup failed checks: " + "; ".join(res.get("problems") or [res.get("error", "")])})
            continue
        built.append(res)
        ready.append(p["id"])
    drafts = draft_first_emails(conn, len(ready), ready, drafter) if ready else {"created": [], "skipped": []}
    return {"checked": checked, "built": built, "created": drafts["created"], "skipped": held + drafts["skipped"]}
