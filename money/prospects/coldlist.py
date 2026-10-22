#!/usr/bin/env python3
"""Cold list for TJ: shops whose website is down, dated or weak, ranked, from nwa.json.

  python3 money/prospects/coldlist.py nwa.json OUTDIR
Writes OUTDIR/cold-list.md (top 50 per group) and OUTDIR/cold-list.csv (all).
Trades and home services come first: they pay monthly. Sites that blocked our
checker (UNKNOWN) and good sites are left out. Nothing here is hand-checked yet.
"""
import collections
import csv
import json
import pathlib
import re
import sys

EMAIL = re.compile(r"^[\w.+-]+@[\w-]+(\.[\w-]+)*\.[a-z]{2,}$", re.I)
JUNK = re.compile(r"sentry|wixpress|example|domain\.com|\.(png|jpe?g|gif|svg|webp)$|godaddy|squarespace|@\d", re.I)
TRADES = {"HVAC", "Plumber", "Roofer", "Electrician", "Fencing", "Landscaping", "Pest control", "Exterior cleaning",
          "Cleaning", "Pools", "Garage doors", "Handyman", "Home improvement", "Home services", "Movers", "Auto",
          "Auto repair", "Tires", "Carpenter", "Painter"}
BAD = {"BROKEN": 0, "DATED": 1, "OK-ISH": 2}
LABEL = {"BROKEN": "DOWN", "DATED": "DATED", "OK-ISH": "WEAK"}


def host(url):
    return re.sub(r"^www\.", "", re.sub(r"^https?://", "", (url or "").lower()).split("/")[0])


def email_of(p):
    site = p.get("site") or {}
    dead = re.search(r"no DNS|parked", site.get("error") or "")
    for e in [p.get("email")] + list(site.get("emails") or []):
        if not e or not EMAIL.match(e) or JUNK.search(e):
            continue
        if dead and host(p.get("website")).endswith(e.split("@")[1].lower()):
            continue  # mailbox on a domain that no longer works: it would bounce
        return e.lower()
    return ""


def problem(site):
    if site["state"] == "BROKEN":
        return "Site down: " + (site.get("error") or f"HTTP {site.get('status')}")
    return ", ".join(site.get("flags") or [])


def main(src, outdir):
    shops = json.loads(pathlib.Path(src).read_text())["prospects"]
    rows = []
    for p in shops:
        site = p.get("site") or {}
        if site.get("state") not in BAD or p.get("status") in ("skip", "lost"):
            continue
        rows.append(dict(
            group="Trades & home services" if p["trade"] in TRADES else "Shops & food",
            name=p["name"], trade=p["trade"], city=p.get("city") or "", km=p.get("km_home"),
            site=LABEL[site["state"]], problem=problem(site), email=email_of(p), phone=p.get("phone") or "",
            website=p.get("website") or site.get("url") or "", score=p.get("score", 0), status=p.get("status", "new"),
            id=p["id"]))
    rows.sort(key=lambda r: (r["group"] != "Trades & home services", -r["score"], BAD[{v: k for k, v in LABEL.items()}[r["site"]]],
                             r["km"] if r["km"] is not None else 999))
    out = pathlib.Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    with (out / "cold-list.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    by = collections.Counter(r["group"] for r in rows)
    states = collections.Counter(r["site"] for r in rows)
    mail = sum(1 for r in rows if r["email"])
    lines = ["# Cold list: NWA businesses with a bad website", "",
             f"{len(rows)} businesses whose site is down ({states['DOWN']}), dated ({states['DATED']}) or weak "
             f"({states['WEAK']}). {by['Trades & home services']} are trades and home services. "
             f"{mail} have an email we could find; the agent looks up the rest before building.", "",
             "Ranked by score (how bad the site is, job size, closeness to Bentonville), then how bad, then distance. "
             "Not hand-checked yet: before any email, an agent confirms the business is open and the problem is real.",
             "", "Sources: OpenStreetMap (ODbL) and Overture Maps (CDLA Permissive 2.0)."]
    for group in ("Trades & home services", "Shops & food"):
        lines += ["", f"## {group}: top 50", "", "| # | Business | Trade | Town | km | Site | Problem | Email |",
                  "|---|---|---|---|---|---|---|---|"]
        for i, r in enumerate([r for r in rows if r["group"] == group][:50], 1):
            lines.append(f"| {i} | {r['name']} | {r['trade']} | {r['city']} | {r['km'] if r['km'] is not None else ''} | "
                         f"{r['site']} | {r['problem'][:70]} | {'yes' if r['email'] else 'no'} |")
    (out / "cold-list.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:4]))


if __name__ == "__main__":
    main(*sys.argv[1:3])
