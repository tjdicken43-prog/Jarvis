"""Per-client profile: everything that makes one shop's assistant its own, set without a code change.

Stored in clients.profile (jsonb). Empty = the trade's defaults, so a new client works on day one. TJ sets it with
POST /clients/{id}/profile (or the owner on their page, for the safe fields) and the Vapi assistant is rebuilt.

  greeting       first sentence callers hear. The recording and automated-assistant notices are added if missing.
  tone           warm (default), brisk or formal: one line in the prompt, never a different set of rules.
  services       what the shop does. not_services: what it doesn't (the assistant says so, still takes the message).
  service_area   towns served. Outside them: still take the message, say the team will confirm they can come.
  fees           [{name, amount}] the ONLY money the assistant may say, word for word (e.g. a service-call fee).
                 Empty = never says a price, the default for every trade.
  faq            [{q, a}] answers the assistant may give word for word. Anything else: "I'll pass the question on".
  questions      up to 3 extra intake questions (e.g. "Is the unit gas or electric?"); answers land on the call row.
  emergency_words  extra words that mean "urgent" for this shop, on top of the trade's own.
  languages      ["en"] or ["en", "es"]: Spanish callers get Spanish (multilingual transcriber).
  voice          a Vapi voice id; blank = the default voice.
  hours          per day {"mon": [7, 17], ..., "sun": null}; overrides open_hour/close_hour/open_saturday.
  closed_dates   holidays ["2026-12-25", ...]: after-hours all day, no bookings.
  transfer       emergency (default when owner_cell is set) or never.

Owner-entered text goes into a system prompt, so every string is length-capped, single-line, and stripped of the
template braces Vapi expands. Rules that protect callers (safety step, no guessing, disclosure, no diagnosis) are
never configurable.
"""
import datetime as dt
import re

from mailer import CENTRAL

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
TONES = {"warm": "Warm and plain, like a friendly neighbor.",
         "brisk": "Brisk and efficient: short sentences, no small talk, still polite.",
         "formal": "Polite and professional: full sentences, sir or ma'am is fine."}
LANGUAGES = ({"en"}, {"en", "es"})
TRANSFER = ("emergency", "never")

TRADE_DEFAULTS = {
    "plumbing": {"services": ["leaks and burst pipes", "water heaters", "drains and sewer lines", "toilets and faucets",
                              "sump pumps", "gas lines"],
                 "emergency_words": ["burst pipe", "flooding", "water everywhere", "sewage", "gas smell"]},
    "hvac": {"services": ["furnace and heating repair", "air conditioning repair", "heat pumps", "new systems",
                          "maintenance tune-ups", "thermostats"],
             "emergency_words": ["no heat", "gas smell", "carbon monoxide", "co alarm", "burning smell"]},
    "roofing": {"services": ["roof leaks", "storm and hail damage", "roof replacement", "repairs", "gutters",
                             "inspections"],
                "emergency_words": ["leaking through the ceiling", "water coming in", "tree on the roof",
                                    "ceiling sagging", "hole in the roof"]},
}
# NWA towns and trade words the transcriber should expect (Deepgram keyterm prompting). Town names are where
# speech-to-text slips most, and a wrong town sends the truck to the wrong place.
NWA_TOWNS = ["Bentonville", "Rogers", "Bella Vista", "Fayetteville", "Springdale", "Lowell", "Cave Springs", "Pea Ridge",
             "Siloam Springs", "Centerton", "Gravette", "Farmington", "Prairie Grove", "Elkins", "Tontitown", "Garfield"]
LIMITS = {"services": (20, 60), "not_services": (20, 60), "service_area": (25, 40), "questions": (3, 150),
          "emergency_words": (15, 40), "closed_dates": (40, 10)}


class ProfileError(ValueError):
    pass


def text(v, n, field):
    """One clean line: no newlines, no {{ }} (Vapi expands them), capped."""
    if v is None:
        return None
    if not isinstance(v, str):
        raise ProfileError(f"{field} must be text")
    s = re.sub(r"\s+", " ", v.replace("{", "(").replace("}", ")")).strip()
    if len(s) > n:
        raise ProfileError(f"{field} is too long (max {n} characters)")
    return s or None


def text_list(v, field):
    most, n = LIMITS[field]
    if v is None:
        return []
    if not isinstance(v, list) or len(v) > most:
        raise ProfileError(f"{field}: give at most {most}")
    out = [text(x, n, field) for x in v]
    return [x for x in dict.fromkeys(out) if x]


def validate(p, trade=None):
    """Clean a profile, or raise ProfileError saying what's wrong. Unknown keys are refused, so typos show up."""
    if not isinstance(p, dict):
        raise ProfileError("profile must be an object")
    known = {"greeting", "tone", "services", "not_services", "service_area", "fees", "faq", "questions",
             "emergency_words", "languages", "voice", "hours", "closed_dates", "transfer"}
    extra = set(p) - known
    if extra:
        raise ProfileError("unknown setting: " + ", ".join(sorted(extra)))
    out = {}
    if p.get("greeting") is not None:
        out["greeting"] = text(p["greeting"], 300, "greeting")
    if p.get("tone") is not None:
        if p["tone"] not in TONES:
            raise ProfileError("tone must be warm, brisk or formal")
        out["tone"] = p["tone"]
    for f in ("services", "not_services", "service_area", "questions", "emergency_words"):
        if f in p:
            out[f] = text_list(p[f], f)
    if "fees" in p:
        fees = p["fees"] or []
        if not isinstance(fees, list) or len(fees) > 8:
            raise ProfileError("fees: give at most 8")
        out["fees"] = []
        for f in fees:
            name, amount = text((f or {}).get("name"), 60, "fee name"), text((f or {}).get("amount"), 40, "fee amount")
            if not name or not amount or not re.search(r"\d", amount):
                raise ProfileError("each fee needs a name and an amount with a number, like $89")
            out["fees"].append({"name": name, "amount": amount})
    if "faq" in p:
        faq = p["faq"] or []
        if not isinstance(faq, list) or len(faq) > 15:
            raise ProfileError("faq: give at most 15")
        out["faq"] = []
        for f in faq:
            q, a = text((f or {}).get("q"), 120, "faq question"), text((f or {}).get("a"), 300, "faq answer")
            if not q or not a:
                raise ProfileError("each faq needs a question and an answer")
            out["faq"].append({"q": q, "a": a})
    if p.get("languages") is not None:
        if not isinstance(p["languages"], list) or set(p["languages"]) not in LANGUAGES:
            raise ProfileError('languages must be ["en"] or ["en", "es"]')
        out["languages"] = ["en"] + (["es"] if "es" in p["languages"] else [])
    if p.get("voice") is not None:
        v = text(p["voice"], 40, "voice")
        if v and not re.fullmatch(r"[A-Za-z0-9_\-]+", v):
            raise ProfileError("voice must be a Vapi voice id (letters, numbers, - and _)")
        if v:
            out["voice"] = v
    if p.get("hours") is not None:
        out["hours"] = valid_hours(p["hours"])
    if "closed_dates" in p:
        days = []
        for d in text_list(p["closed_dates"], "closed_dates"):
            try:
                days.append(dt.date.fromisoformat(d).isoformat())
            except ValueError:
                raise ProfileError(f"closed date {d} must be YYYY-MM-DD")
        out["closed_dates"] = sorted(set(days))
    if p.get("transfer") is not None:
        if p["transfer"] not in TRANSFER:
            raise ProfileError("transfer must be emergency or never")
        out["transfer"] = p["transfer"]
    return {k: v for k, v in out.items() if v not in (None, [])}


def valid_hours(h):
    if not isinstance(h, dict) or set(h) - set(DAYS):
        raise ProfileError("hours: use mon, tue, wed, thu, fri, sat, sun")
    out = {}
    for d in DAYS:
        v = h.get(d)
        if v is None:
            out[d] = None
            continue
        if (not isinstance(v, list) or len(v) != 2 or not all(isinstance(x, int) for x in v)
                or not 0 <= v[0] < v[1] <= 24):
            raise ProfileError(f"hours for {d} must be [open, close] in whole hours, like [7, 17]")
        out[d] = v
    if not any(out.values()):
        raise ProfileError("hours: the shop must be open at least one day")
    return out


def merged(c):
    """The profile with the trade's defaults filled in. Always use this, never the raw column."""
    p = dict(c.get("profile") or {})
    d = TRADE_DEFAULTS[c["trade"]]
    p.setdefault("services", d["services"])
    p["emergency_words"] = list(dict.fromkeys(d["emergency_words"] + p.get("emergency_words", [])))
    p.setdefault("tone", "warm")
    p.setdefault("languages", ["en"])
    p.setdefault("transfer", "emergency")
    for k in ("not_services", "service_area", "fees", "faq", "questions", "closed_dates"):
        p.setdefault(k, [])
    return p


def week(c):
    """Open hours per weekday (0 = Monday) as (open, close) or None, from the profile or the simple columns."""
    h = (c.get("profile") or {}).get("hours")
    if h:
        return [tuple(h[d]) if h.get(d) else None for d in DAYS]
    weekday = (c["open_hour"], c["close_hour"])
    return [weekday] * 5 + [weekday if c["open_saturday"] else None, None]


def day_hours(c, d):
    """(open, close) for a date in Central, or None if the shop is shut that day (weekend or a holiday)."""
    if d.isoformat() in ((c.get("profile") or {}).get("closed_dates") or []):
        return None
    return week(c)[d.weekday()]


def is_after_hours(c, when):
    local = when.astimezone(CENTRAL)
    h = day_hours(c, local.date())
    return not (h and h[0] <= local.hour < h[1])


def clock(x):
    return dt.time(x % 24).strftime("%-I%p").lower() if x < 24 else "midnight"


def hours_text(c):
    """'Monday to Friday, 7am to 5pm Central', or day by day when the days differ."""
    w = week(c)
    names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    groups = []  # runs of consecutive days with the same hours
    for i, h in enumerate(w):
        if h and groups and groups[-1][2] == h and groups[-1][1] == i - 1:
            groups[-1][1] = i
        elif h:
            groups.append([i, i, h])
    parts = [(names[a] if a == b else f"{names[a]} to {names[b]}") + f", {clock(h[0])} to {clock(h[1])}"
             for a, b, h in groups]
    return "; ".join(parts) + " Central"


def keyterms(c):
    """Words the transcriber should listen for: the shop's name, its towns, NWA towns. Deepgram caps the list."""
    p = merged(c)
    words = [c["business_name"]] + p["service_area"] + NWA_TOWNS
    return list(dict.fromkeys(w for w in words if w))[:50]


def urgent_words_hit(c, *texts):
    """A trade emergency word in what the caller said: the backstop when the call summary missed the urgency."""
    hay = " ".join(t for t in texts if t).lower()
    return next((w for w in merged(c)["emergency_words"] if w.lower() in hay), None)
