#!/usr/bin/env python3
"""Site Care, step 1 (Assess): the checks a script can do on one page. The monthly run (README.md) starts here.

Usage: python3 money/sites/care/care.py PAGE.html [--live]
Prints a markdown findings list grouped by area. Exit 0 always: findings feed the backlog, they don't block.
--live adds the checks that only matter on a client's live site (canonical, privacy page, texting opt-in).
--tool is for our own tools sites (Tradesheet): skips the trade-business checks (call bar, reviews, trade schema).
"""
import importlib.util
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("trade_build", HERE.parent / "trade_build.py")
tb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tb)

# (area, label, regex that must match). Sources: money/sites/PREMIUM.md, money/SITE_BAR.md.
CHECKS = [
    ("Leads", "tap-to-call link", r'href="tel:'),
    ("Leads", "sticky call bar on phones", r'class="bar"'),
    ("Leads", "after-hours section (Front Desk)", r'id="after-hours"'),
    ("Leads", "quote form with photos", r'type="file"'),
    ("Trust", "reviews or rating", r"(?i)review|on google"),
    ("Trust", "license or insurance line", r"(?i)licen[sc]|insur"),
    ("Search", "page title", r"<title>[^<]{10,}</title>"),
    ("Search", "meta description", r'name="description"'),
    ("Search", "trade schema (Plumber / HVACBusiness / RoofingContractor)", r'"@type":\s*"(Plumber|HVACBusiness|RoofingContractor)"'),
    ("Search", "areaServed in schema", r'"areaServed"'),
    ("Search", "link preview tags", r'property="og:title"'),
    ("AI search", "FAQPage schema", r'"FAQPage"'),
    ("AI search", "FAQ answers on the page (not only in schema)", r"<details>|<summary>"),
    ("AI search", "towns named in plain text", r"(?i)where we work|service area|towns"),
    ("AI search", "phone written out in text, same as schema", r"\(\d{3}\) \d{3}-\d{4}|\d{3}-\d{3}-\d{4}"),
    ("Access", "page language", r"<html[^>]*lang="),
    ("Access", "skip link", r'class="skip"'),
    ("Access", "form labels", r"<label"),
    ("Access", "form status read out", r'aria-live="polite"'),
    ("Access", "reduced-motion rule", r"prefers-reduced-motion"),
    ("Access", "visible focus", r"focus-visible|:focus\{"),
    ("Speed", "font-display swap", r"font-display:\s*swap"),
]
LIVE = [
    ("Search", "canonical link", r'rel="canonical"'),
    ("Legal", "privacy and texting terms link", r"(?i)privacy and texting terms"),
    ("Legal", "texting opt-in box (unticked)", r'name="sms_ok"'),
]
MAX_KB = 1024  # SITE_BAR.md: whole page under 1 MB


TRADE_ONLY = {"Leads", "Trust"}


def assess(page, live=False, tool=False):
    checks = [x for x in CHECKS if not (tool and (x[0] in TRADE_ONLY or "trade schema" in x[1] or "areaServed" in x[1]
                                                  or "towns" in x[1] or "phone written" in x[1] or "FAQ" in x[1]))]
    if "<input" not in page:
        checks = [x for x in checks if x[1] not in ("form labels", "form status read out")]
    if "@font-face" not in page:
        checks = [x for x in checks if x[1] != "font-display swap"]  # system fonts: nothing to swap
    out = [(a, f"missing: {label}") for a, label, rx in checks + (LIVE if live else []) if not re.search(rx, page)]
    out += [("Bar", p) for p in (tb.audit(page) if not tool else [])]
    kb = len(page.encode()) // 1024
    if kb > MAX_KB:
        out.append(("Speed", f"page is {kb} KB (max {MAX_KB})"))
    if live and "noindex" in page.lower():
        out.append(("Search", "live page says noindex"))
    return out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for path in args:
        f = pathlib.Path(path)
        page = f.read_text()
        for href in re.findall(r'<link rel="stylesheet" href="([^":]+)"', page):  # local stylesheets count too
            css = (f.parent / href).resolve()
            page += css.read_text() if css.is_file() else ""
        found = assess(page, "--live" in sys.argv, "--tool" in sys.argv)
        print(f"## {path}\n")
        print("\n".join(f"- **{a}:** {f}" for a, f in found) or "- Nothing the script can see. Do the by-hand checks in README.md.")
        print()
