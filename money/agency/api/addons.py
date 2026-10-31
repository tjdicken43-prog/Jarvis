"""Agency add-ons (TJ picked lane C, 2026-10-25): review replies and weekly Google posts for a paying client.

Drafts only. Nothing here posts to Google: the owner (or TJ, with the owner's OK) copies an approved draft into the
shop's Business Profile. Claude writes when ANTHROPIC_API_KEY is set, otherwise a plain template does, the same as
outreach.py. Rules held for every draft, from Google's review policy and the FTC consumer review rule: reply to every
review, never offer anything for a changed review, never argue in public, never invent facts about the job, and send
unhappy reviewers to a phone call. Prices below are PROPOSED (TJ confirms before billing is wired); billing.py is untouched.
"""
import datetime as dt
import json
import re

import config

ADDONS = {   # monthly cents. status stays "proposed" until TJ says the price in chat.
    "review_replies": {"name": "Review replies", "monthly_cents": 4900, "status": "proposed",
                       "what": "A drafted reply to every new Google review within a day, for the owner's OK."},
    "google_posts": {"name": "Weekly Google post", "monthly_cents": 3900, "status": "proposed",
                     "what": "One drafted Business Profile post a week: a seasonal tip and a call to action."},
    "care_plus": {"name": "Review replies + weekly post", "monthly_cents": 7900, "status": "proposed",
                  "what": "Both of the above, $9 a month less than separately."},
    "site_care": {"name": "Site Care", "monthly_cents": 3900, "status": "proposed",
                  "what": "A monthly check of their site (speed, search and AI-search answers, accessibility, facts vs "
                          "their Google listing) and one approval request; approved fixes done that month."},
}
REPLY_MAX_WORDS = 70
POST_MAX_CHARS = 1500            # Google Business Profile post limit
CLAIMS = re.compile(r"\b(free|discount|% off|refund|coupon|guarantee[d]?|licensed|insured|24/7|cheapest|best in|#1|number one)\b", re.I)
PLACEHOLDER = re.compile(r"\{\{|\[(your|name|business)|lorem|todo|example\.com|555-", re.I)

TIPS = {   # (trade, season) -> one plain, true, general tip. Seasons: winter, spring, summer, fall.
    ("hvac", "winter"): "Change your furnace filter each month in heating season. A clogged filter makes the system work harder and can shorten its life.",
    ("hvac", "spring"): "Spring is the time to have your air conditioner checked, before the first hot week when every shop is booked.",
    ("hvac", "summer"): "If your AC runs all day and the house still will not cool, turn it off and call. Running a frozen system can damage the compressor.",
    ("hvac", "fall"): "Test your heat on the first cool morning, not the first freezing one. A short test now leaves time for a repair.",
    ("plumbing", "winter"): "Know where your main water shutoff is. If a pipe freezes and bursts, shutting the water off fast limits the damage.",
    ("plumbing", "spring"): "Check under every sink and around the water heater for slow drips. A small leak found now is a smaller repair.",
    ("plumbing", "summer"): "Heavy use of sprinklers and guests can show up as low water pressure. If pressure drops in the whole house, call.",
    ("plumbing", "fall"): "Disconnect and drain outdoor hoses before the first freeze. Water left in the spigot line can split the pipe.",
    ("roofing", "winter"): "After ice or heavy snow, look from the ground for sagging gutters or lifted shingles. Stay off the roof.",
    ("roofing", "spring"): "After hail or a wind storm, photograph the roof and yard from the ground and call for an inspection. Many insurance policies have time limits.",
    ("roofing", "summer"): "Dark stains on the ceiling after a rain mean water is getting in. A repair this month is cheaper than drywall next month.",
    ("roofing", "fall"): "Clear gutters once the leaves are down. Water backed up at the roof edge is a common cause of leaks.",
}


class AddonError(Exception):
    pass


def season(d):
    return {12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
            6: "summer", 7: "summer", 8: "summer"}.get(d.month, "fall")


def first_name(n):
    n = (n or "").strip().split(" ")[0]
    return n if n and n.isalpha() else ""


def words(s):
    return len(s.split())


def reply_stub(client, review):
    who = first_name(review.get("reviewer"))
    hi = f"Hi {who}," if who else "Hi,"
    shop = client["business_name"]
    if review["rating"] >= 4:
        return f"{hi} thank you for the kind words and for choosing {shop}. We are glad it went well. If you need anything else, call us at {client['phone']}."
    return (f"{hi} we are sorry this did not go the way it should have. We would like to hear more and make it right if we can. "
            f"Please call {client['phone']} and ask for the owner.")


def reply_preflight(reply, review, client):
    """Reasons a drafted reply must not reach the owner (empty list = fine)."""
    p = []
    if not reply.strip():
        return ["empty reply"]
    if PLACEHOLDER.search(reply):
        p.append("placeholder text left in")
    if words(reply) > REPLY_MAX_WORDS:
        p.append(f"over {REPLY_MAX_WORDS} words")
    if CLAIMS.search(reply):
        p.append("offers or claims we cannot back (free, discount, refund, license, 24/7, guarantee)")
    allowed = set(re.findall(r"\d+", review.get("text", "") + " " + (client.get("phone") or "")))
    for n in re.findall(r"\d+", reply):
        if n not in allowed:
            p.append(f"number {n} is not in the review or the shop's phone")
    if review["rating"] <= 3 and client.get("phone") and client["phone"] not in reply:
        p.append("a low rating needs the shop's phone number so it moves offline")
    if review["rating"] <= 3 and re.search(r"\b(not true|false|lie[sd]?|liar|wrong|never happened)\b", reply, re.I):
        p.append("do not argue in public")
    return p


def claude_reply(client, review):
    import anthropic
    import costs
    system = ("You write a short public reply from a trade shop's owner to a Google review. Rules: at most 70 words; plain words; "
              "thank them by first name if one is given; mention only what the review itself says; never invent details about the job; "
              "never offer discounts, refunds, free work or anything of value; never argue or blame; for 3 stars or fewer, apologize "
              "once, and ask them to call the shop's phone number, copied exactly. Never claim licenses, insurance or hours. No exclamation marks, no emoji.")
    resp = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY).messages.create(
        model=config.DRAFT_MODEL, max_tokens=400, system=system,
        messages=[{"role": "user", "content": json.dumps({"shop": client["business_name"], "phone": client.get("phone"),
                                                          "rating": review["rating"], "reviewer": review.get("reviewer"), "review": review.get("text", "")})}])
    costs.log_ai("addon_reply", config.DRAFT_MODEL, getattr(resp, "usage", None), client_id=client.get("id"))
    return next(b.text for b in resp.content if b.type == "text").strip()


def draft_reply(client, review, write=None):
    """A reply the owner approves. Falls back to the template when Claude's draft fails the checks."""
    if client.get("addons") is not None and not ({"review_replies", "care_plus"} & set(client["addons"])):
        raise AddonError("this shop does not have review replies")
    if not (1 <= review.get("rating", 0) <= 5):
        raise AddonError("rating must be 1 to 5")
    write = write or (claude_reply if config.ANTHROPIC_API_KEY else None)
    if write:
        try:
            r = write(client, review)
            if not reply_preflight(r, review, client):
                return {"reply": r, "by": "claude"}
        except Exception:   # a failed call never blocks the owner's reply
            pass
    r = reply_stub(client, review)
    bad = reply_preflight(r, review, client)
    if bad:
        raise AddonError("template reply failed checks: " + "; ".join(bad))
    return {"reply": r, "by": "template"}


def post_stub(client, today):
    tip = TIPS[(client["trade"], season(today))]
    return f"{tip}\n\nQuestions or need a hand? Call {client['business_name']} at {client['phone']}."


def post_preflight(text, client):
    p = []
    if PLACEHOLDER.search(text):
        p.append("placeholder text left in")
    if len(text) > POST_MAX_CHARS:
        p.append(f"over {POST_MAX_CHARS} characters")
    if CLAIMS.search(text):
        p.append("claims we cannot back (free, discount, license, 24/7, guarantee)")
    if "!" in text:
        p.append("exclamation mark")
    allowed = set(re.findall(r"\d+", client.get("phone") or ""))
    for n in re.findall(r"\d+", text):
        if n not in allowed:
            p.append(f"number {n} is not the shop's phone")
    if client.get("phone") and client["phone"] not in text:
        p.append("shop's phone number missing")
    return p


def draft_post(client, today=None):
    if client.get("addons") is not None and not ({"google_posts", "care_plus"} & set(client["addons"])):
        raise AddonError("this shop does not have weekly posts")
    if client["trade"] not in ("plumbing", "hvac", "roofing"):
        raise AddonError("unknown trade")
    text = post_stub(client, today or dt.date.today())
    bad = post_preflight(text, client)
    if bad:
        raise AddonError("post failed checks: " + "; ".join(bad))
    return {"post": text, "by": "template"}


def monthly_summary(clients):
    """What the add-ons are worth: (name, count, cents a month) for the dashboard and the weekly note."""
    out = {}
    for c in clients:
        for a in c.get("addons") or []:
            n, cents = out.get(a, (0, 0))
            out[a] = (n + 1, cents + ADDONS[a]["monthly_cents"])
    return out
