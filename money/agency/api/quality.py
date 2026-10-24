"""Checks between the agents, so one step can't hand a bad result to the next one.

- contract(stage, p, email): the fields a shop must carry before it moves on. Missing ones stop it, by name.
- grounding(subject, body, p): every number, year, link, phone, town and claim in an AI-written email must come
  from what we saved about that shop, and the email must name the flaw we actually found.
- stale(p): the flaw check is too old to trust; approve looks at their site again.
- mail_domain_ok(email): the address's domain takes mail (MX). Bounces hurt a new domain the most.
"""
import datetime as dt
import functools
import re

import config

URL = re.compile(r"https?://[^\s)>\]]+|www\.[^\s)>\]]+", re.I)
PHONE = re.compile(r"\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
NUMBER = re.compile(r"\b\d+(?:\.\d+)?\b")
# Claims an email may only make when the shop's own site says so (word -> what must be in their site text)
CLAIMS = {
    r"\blicen[cs]ed\b": "licens", r"\binsured\b": "insured", r"\bbonded\b": "bonded", r"\bfamily[- ]owned\b": "family",
    r"\bveteran[- ]owned\b": "veteran", r"\baward": "award", r"\bbbb\b": "bbb", r"\bwarrant": "warrant",
    r"\bfinanc": "financ", r"\b24/7\b|\b24 hours\b": "24", r"\bcertified\b": "certified",
    r"\breviews?\b|\bstars?\b|\brated\b": None,      # never: we don't quote ratings in cold email
    r"\bcompetitors?\b|\bthe other guys\b": None,     # never: no competitor talk
    r"\bguarantee": None,                            # never: we promise nothing
}
# Words that show the email names the flaw we found (sentence 1 rule)
FLAW_WORDS = {
    "down": ("load", "placeholder", "blank", "down", "error", "dead end"),
    "not mobile-friendly": ("pinch", "zoom", "fit", "mobile", "sideways"),
    "no tap-to-call": ("tap-to-call", "tap to call", "call button", "copy your number", "tap"),
    "phone number hidden on phones": ("first screen", "scroll", "number isn't", "number is not", "find your number"),
    "slow": ("seconds", "slow", "load"),
    "no https": ("not secure", "https", "secure"),
    "©": ("footer", "still says", "copyright"),
}

CONTRACTS = {  # stage -> fields that must be there (dotted = inside facts)
    "mockup": ("facts.checked_at",),  # built from what their site says; a flaw is only needed to email them
    "draft": ("email", "flaw", "facts.checked_at", "mockup_url", "mockup_slug"),
    "approve": ("email", "flaw", "facts.checked_at", "mockup_url"),
    "send": ("email", "flaw", "facts.checked_at"),
}


def _get(p, field):
    if field.startswith("facts."):
        return (p.get("facts") or {}).get(field.split(".", 1)[1])
    return p.get(field)


def contract(stage, p, email=None):
    """Missing pieces for this stage (empty = fine to move on)."""
    missing = [f"missing {f}" for f in CONTRACTS[stage] if not _get(p, f)]
    if stage in ("draft", "approve") and ((p.get("facts") or {}).get("signals") or {}).get("blocked"):
        missing.append("their site blocked our checker, so the flaw is the scout's guess; check it by hand")
    if stage in ("draft", "approve") and p.get("mockup_url") and not p["mockup_url"].startswith("https://"):
        missing.append("preview link isn't https (set PUBLIC_URL)")
    if p.get("email") and "@" not in p["email"]:
        missing.append("email address isn't valid")
    if (p.get("facts") or {}).get("check_mode") == "browser" and not p.get("flaw_evidence") and stage != "send":
        missing.append("missing screenshot of the flaw")
    if stage == "send" and email is not None:
        if not email.get("approved_at"):
            missing.append("never approved")
        if email.get("kind") == "first" and age_days(p) is not None and age_days(p) > config.SEND_FLAW_MAX_AGE_DAYS:
            missing.append(f"flaw check is over {config.SEND_FLAW_MAX_AGE_DAYS} days old; approve it again")
        if not config.MAILING_ADDRESS:
            missing.append("no mailing address")
    return missing


def age_days(p, now=None):
    at = (p.get("facts") or {}).get("checked_at")
    if not at:
        return None
    now = now or dt.datetime.now(dt.timezone.utc)
    return (now - dt.datetime.fromisoformat(at)).total_seconds() / 86400


def stale(p, now=None):
    a = age_days(p, now)
    return a is None or a > config.FLAW_MAX_AGE_DAYS


def flaw_key(flaw):
    low = (flaw or "").lower()
    if low.startswith("site down"):
        return "down"
    for k in FLAW_WORDS:
        if low.startswith(k):
            return k
    return None


def _known_text(p):
    """Everything we may repeat back to a shop: their own site text, the flaw, and our own record of them."""
    import outreach  # imports this module
    facts = p.get("facts") or {}
    parts = [p.get("name"), p.get("city"), p.get("website"), p.get("flaw"), facts.get("site_text"),
             " ".join(outreach.plain_flaw(p.get("flaw"))), " ".join(facts.get("towns") or []),
             str(facts.get("since") or ""), str((facts.get("signals") or {}).get("seconds") or "")]
    return " ".join(str(x) for x in parts if x).lower()


def grounding(subject, body, p):
    """Claims in an AI-written first email that we can't back with what we saved. Empty list = grounded."""
    import flaws  # heavy import (playwright), only when needed
    problems = []
    text = f"{subject}\n{body}"
    known = _known_text(p)
    allowed_urls = {u.rstrip("/.").lower() for u in (p.get("mockup_url"), p.get("website")) if u}
    site = re.sub(r"^https?://(www\.)?", "", (p.get("website") or "").lower()).split("/")[0]
    for u in URL.findall(text):
        u = u.rstrip("/.,").lower()
        bare = re.sub(r"^https?://(www\.)?", "", u).split("/")[0]
        if u not in allowed_urls and not (site and bare == site):
            problems.append(f"link {u} isn't their site or our preview")
    stripped = URL.sub(" ", text)
    if EMAIL.search(stripped):
        problems.append("an email address in the body")
    own = re.sub(r"\D", "", p.get("phone") or "")[-10:]
    for ph in PHONE.findall(stripped):
        if re.sub(r"\D", "", ph)[-10:] != own:
            problems.append(f"phone number {ph} isn't theirs")
    stripped = PHONE.sub(" ", stripped)
    for n in NUMBER.findall(stripped):
        if n not in known and not re.search(rf"\b{re.escape(n)}\b", known):
            problems.append(f"the number {n} isn't in anything we saw on their site")
    low = stripped.lower()
    for pattern, need in CLAIMS.items():
        if re.search(pattern, low):
            if need is None:
                problems.append(f"says \"{re.search(pattern, low).group(0)}\", which cold emails never claim")
            elif need not in known:
                problems.append(f"says \"{re.search(pattern, low).group(0)}\" but their site doesn't")
    for town in flaws.TOWNS:
        if town.lower() in low and town.lower() not in known:
            problems.append(f"mentions {town}, which isn't their town or on their site")
    key = flaw_key(p.get("flaw"))
    if key and not any(w in low for w in FLAW_WORDS[key]):
        problems.append("doesn't name the flaw we found")
    return list(dict.fromkeys(problems))


@functools.lru_cache(maxsize=1)
def _dns_works():
    """Some networks answer every MX question with nothing. Then we can't tell, so we don't block."""
    try:
        import dns.resolver
        return bool(dns.resolver.resolve("gmail.com", "MX", lifetime=5))
    except Exception:
        return False


@functools.lru_cache(maxsize=512)
def mail_domain_ok(email):
    """True: takes mail. False: domain doesn't exist or has no mail server. None: couldn't tell."""
    domain = (email or "").rsplit("@", 1)[-1].strip().lower()
    if not domain or not _dns_works():
        return None
    try:
        import dns.resolver
        dns.resolver.resolve(domain, "MX", lifetime=5)
        return True
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        try:  # no MX: mail falls back to the A record (RFC 5321)
            dns.resolver.resolve(domain, "A", lifetime=5)
            return True
        except Exception:
            return False
    except Exception:
        return None
