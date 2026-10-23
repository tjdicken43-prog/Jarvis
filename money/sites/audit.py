#!/usr/bin/env python3
"""Auditor: the script half of the site bar (money/SITE_BAR.md).

Usage: python3 money/sites/audit.py [--suppress suppress.csv] PATH ...
PATH is a built page (.html), a pitch (.md), a content.json, or a shop folder
money/sites/shops/<slug> (checks its content.json, pitch.md and built page).
Prints PASS or FAIL with reasons for each file; exits 1 if anything fails.

It only catches what a script can be sure of. The screenshot judgment
(sections 1, 2 and 4 of the bar) is still the Auditor agent's job.
"""
import csv
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent

# SITE_BAR.md section 1. Keep in step with that file.
BANNED = [
    "elevate", "seamless", "unlock", "unleash", "empower", "cutting-edge", "state-of-the-art",
    "your trusted partner", "look no further", "we pride ourselves", "one-stop shop",
    "in today's fast-paced world", "nestled", "testament", "tailored solutions",
]
PLACEHOLDERS = [r"\bLorem\b", r"\bTODO\b", r"\{\{", r"\[your", r"example\.com", r"\b555-",
                r"Business Name", r"City, State"]
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
MAX_EMDASH = 3
MAX_EMAIL_WORDS = 80


def visible_text(page):
    t = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", page)
    t = re.sub(r"(?s)<!--.*?-->", " ", t)
    return html.unescape(re.sub(r"<[^>]+>", " ", t))


def banned_words(text):
    low = text.lower().replace("’", "'")
    return [w for w in BANNED if re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", low)]


def placeholders(text):
    return [p.replace("\\b", "").replace("\\", "") for p in PLACEHOLDERS if re.search(p, text)]


def audit_page(page):
    fails = []
    text = visible_text(page)
    if b := banned_words(text):
        fails.append("AI words: " + ", ".join(b))
    if p := placeholders(text):
        fails.append("placeholders: " + ", ".join(p))
    if "!" in text:
        fails.append("exclamation mark in the copy")
    if text.count("—") > MAX_EMDASH:
        fails.append(f"{text.count(chr(0x2014))} em dashes (max {MAX_EMDASH})")
    css = re.sub(r"\s+", "", page.lower())
    if "background-clip:text" in css:
        fails.append("gradient text")
    heads = [visible_text(h).strip() for h in re.findall(r"(?is)<h[1-3][^>]*>.*?</h[1-3]>", page)]
    if any(EMOJI.search(h) for h in heads):
        fails.append("emoji in a heading")
    if any(re.fullmatch(r"(\w+\.\s*){3}", h) for h in heads):
        fails.append("three-word slogan heading")
    h2 = [h for h in heads if h]
    if len(h2) >= 3 and all(h.endswith("?") for h in h2):
        fails.append("every heading is a question")
    if 'name="viewport"' not in page:
        fails.append("no phone viewport tag")
    if 'href="tel:' not in page:
        fails.append("no tap-to-call link")
    if "concept preview" in text.lower() and "noindex" not in page:
        fails.append("preview without noindex")
    return fails


def email_section(pitch):
    """The draft under the first heading that names the email (not a follow-up)."""
    lines, out, inside = pitch.splitlines(), [], False
    for line in lines:
        if line.startswith("#"):
            if inside:
                break
            low = line.lower()
            inside = "email" in low and "follow" not in low
            continue
        if inside:
            out.append(line)
    return "\n".join(out).strip()


def audit_pitch(pitch):
    fails = []
    email = email_section(pitch)
    if not email:
        return ["no '## Email' section"]
    # The CAN-SPAM footer (address, opt-out) sits under a "--" line and isn't counted.
    body = re.split(r"(?m)^--\s*$", email, maxsplit=1)[0]
    words = len(re.findall(r"[A-Za-z0-9'$]+", body))
    if words > MAX_EMAIL_WORDS:
        fails.append(f"email is {words} words (max {MAX_EMAIL_WORDS})")
    if body.count("?") > 1:
        fails.append(f"{body.count('?')} questions (one only)")
    if not re.search(r"(?i)unsubscribe|opt.?out|reply\W+stop|\bstop\b.*\b(email|hear)", email):
        fails.append("no opt-out line")
    if "[mailing address]" not in email and not re.search(r"\b\d{5}(-\d{4})?\b", email):
        fails.append("no mailing address")
    if b := banned_words(email):
        fails.append("AI words: " + ", ".join(b))
    return fails


def audit_content(c):
    fails = []
    for i, r in enumerate(c.get("reviews") or [], 1):
        if not str(r.get("who", "")).strip() or not str(r.get("source", "")).strip():
            fails.append(f"review {i} has no name or source")
    if c.get("preview") is False and c.get("sample_note"):
        fails.append("a sample shop marked live")
    return fails


def load_suppress(path):
    emails, domains = set(), set()
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            if (e := (row.get("email") or "").strip().lower()):
                emails.add(e)
            if (d := (row.get("domain") or "").strip().lower()):
                domains.add(d)
    return emails, domains


def suppressed(text, suppress):
    if not suppress:
        return []
    emails, domains = suppress
    hits = []
    for e in {m.lower() for m in EMAIL.findall(text)}:
        if e in emails or e.split("@", 1)[1] in domains:
            hits.append(e)
    for d in domains:
        if re.search(r"(?i)(//|www\.|\b)" + re.escape(d) + r"\b", text):
            hits.append(d)
    return sorted(set(hits))


def audit_file(path, suppress=None):
    raw = path.read_text(encoding="utf-8")
    if path.suffix == ".html":
        fails = audit_page(raw)
    elif path.suffix == ".md":
        fails = audit_pitch(raw)
    elif path.suffix == ".json":
        fails = audit_content(json.loads(raw))
    else:
        return [f"don't know how to audit {path.suffix or 'this'}"]
    if hits := suppressed(raw, suppress):
        fails.append("on the do-not-email list: " + ", ".join(hits))
    return fails


def targets(arg):
    p = pathlib.Path(arg)
    if not p.is_dir():
        return [p]
    found = [p / "content.json", p / "pitch.md", ROOT / "out" / p.name / "index.html", p / "index.html"]
    return [f for f in found if f.exists()]


def main(argv):
    suppress, paths = None, []
    it = iter(argv)
    for a in it:
        if a == "--suppress":
            suppress = load_suppress(next(it))
        else:
            paths.extend(targets(a))
    if not paths:
        print(__doc__.strip().splitlines()[2])
        return 2
    bad = 0
    for p in paths:
        fails = audit_file(p, suppress)
        bad += bool(fails)
        print(("FAIL " if fails else "PASS ") + str(p) + (": " + "; ".join(fails) if fails else ""))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
