#!/usr/bin/env python3
"""Prospect scout for Sites by TJ: find NWA shops with no or weak websites.

Runs on GitHub Actions (the cloud sessions can't reach these hosts).
  python3 money/prospects/scan.py --out DIR [--limit N]
Writes DIR/nwa.json (everything) and DIR/nwa.md (ranked list for TJ).

Source: OpenStreetMap via the Overpass API (free, ODbL; attribution in the
report). OSM misses some shops, so the job runner can add more by web search.
Only public business details are kept: name, trade, phone, website, address.
"""
import argparse
import concurrent.futures as cf
import datetime as dt
import json
import pathlib
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

# Bentonville, Rogers, Bella Vista, Centerton, Lowell, Springdale, Fayetteville
BBOX = (36.03, -94.32, 36.50, -94.05)  # south, west, north, east
OVERPASS = "https://overpass-api.de/api/interpreter"
UA = "SitesByTJ-prospect-scout/1.0 (local web design research)"

# tag -> (label, ticket points: how much a site is worth to them)
CATEGORIES = {
    ("shop", "car_repair"): ("Auto repair", 2),
    ("shop", "tyres"): ("Tires", 2),
    ("shop", "car"): ("Car dealer", 2),
    ("amenity", "car_wash"): ("Car wash", 1),
    ("craft", "roofer"): ("Roofer", 2),
    ("craft", "hvac"): ("HVAC", 2),
    ("craft", "plumber"): ("Plumber", 2),
    ("craft", "electrician"): ("Electrician", 2),
    ("craft", "carpenter"): ("Carpenter", 2),
    ("craft", "painter"): ("Painter", 2),
    ("craft", "upholsterer"): ("Upholstery", 1),
    ("craft", "gardener"): ("Landscaping", 2),
    ("shop", "hairdresser"): ("Barber/salon", 1),
    ("shop", "beauty"): ("Beauty", 1),
    ("shop", "tattoo"): ("Tattoo", 1),
    ("leisure", "fitness_centre"): ("Gym", 2),
    ("shop", "florist"): ("Florist", 1),
    ("shop", "bakery"): ("Bakery", 1),
    ("shop", "pet_grooming"): ("Pet grooming", 1),
    ("shop", "dry_cleaning"): ("Dry cleaning", 1),
    ("shop", "furniture"): ("Furniture", 1),
    ("shop", "bicycle"): ("Bike shop", 1),
    ("amenity", "restaurant"): ("Restaurant", 1),
    ("amenity", "cafe"): ("Cafe", 1),
    ("amenity", "fast_food"): ("Food", 1),
    ("amenity", "veterinary"): ("Vet", 2),
}

SOCIAL = ("facebook.com", "instagram.com", "yelp.com", "linktr.ee", "google.com", "business.site", "tiktok.com")
BUILDERS = {
    "wix.com": "Wix", "squarespace": "Squarespace", "godaddy": "GoDaddy", "wordpress": "WordPress",
    "weebly": "Weebly", "shopify": "Shopify", "webflow": "Webflow", "duda": "Duda",
}
PARKED = ("domain is for sale", "buy this domain", "parked free", "this domain may be for sale", "domain parking",
          "website coming soon", "under construction", "account suspended", "this site can't be reached")


def overpass_query():
    s, w, n, e = BBOX
    parts = []
    for (k, v) in CATEGORIES:
        for t in ("node", "way"):
            parts.append(f'{t}["{k}"="{v}"]["name"]({s},{w},{n},{e});')
    return "[out:json][timeout:120];(" + "".join(parts) + ");out center tags;"


def http_get(url, timeout=20, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "*/*"})
    ctx = ssl.create_default_context()
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        body = r.read(800_000)
        return r.status, r.geturl(), body, time.time() - t0


def fetch_places():
    q = overpass_query()
    for attempt in range(4):
        try:
            _, _, body, _ = http_get(OVERPASS, timeout=180, data=urllib.parse.urlencode({"data": q}).encode())
            return json.loads(body)["elements"]
        except Exception as ex:  # Overpass is busy at times
            print("overpass retry", attempt, ex)
            time.sleep(10 * (attempt + 1))
    raise SystemExit("Overpass failed")


def classify(tags):
    for (k, v), (label, ticket) in CATEGORIES.items():
        if tags.get(k) == v:
            return label, ticket
    return "Other", 1


def norm_site(u):
    u = (u or "").strip()
    if not u:
        return ""
    if not re.match(r"^https?://", u, re.I):
        u = "http://" + u
    return u


def audit(url):
    """Check one website. Returns a dict of facts; never raises."""
    a = {"url": url}
    host = urllib.parse.urlparse(url).netloc.lower()
    if any(s in host for s in SOCIAL):
        a["state"] = "SOCIAL ONLY"
        return a
    try:
        status, final, body, secs = http_get(url, timeout=20)
    except urllib.error.HTTPError as ex:
        a.update(state="BROKEN", error=f"HTTP {ex.code}")
        return a
    except Exception as ex:
        a.update(state="BROKEN", error=type(ex).__name__ + ": " + str(ex)[:120])
        return a
    text = body.decode("utf-8", "ignore")
    low = text.lower()
    years = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})", low)]
    emails = sorted(set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)) - {"example@example.com"})
    emails = [e for e in emails if not e.lower().endswith((".png", ".jpg", ".gif", ".webp", ".svg")) and "sentry" not in e][:3]
    title = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
    a.update(
        status=status,
        final=final,
        https=final.lower().startswith("https://"),
        seconds=round(secs, 2),
        kb=round(len(body) / 1024),
        viewport='name="viewport"' in low or "name=viewport" in low,
        tel_link="href=\"tel:" in low or "href='tel:" in low,
        year=max(years) if years else None,
        builder=next((b for k, b in BUILDERS.items() if k in low), None),
        emails=emails,
        title=re.sub(r"\s+", " ", title.group(1)).strip()[:90] if title else "",
    )
    if any(p in low for p in PARKED) or len(low) < 800:
        a["state"] = "BROKEN"
        a["error"] = "parked, empty or coming-soon page"
        return a
    flags = []
    if not a["https"]:
        flags.append("no https")
    if not a["viewport"]:
        flags.append("not mobile-friendly")
    if not a["tel_link"]:
        flags.append("no tap-to-call")
    if a["year"] and a["year"] <= dt.date.today().year - 3:
        flags.append(f"© {a['year']}")
    if a["seconds"] > 4:
        flags.append(f"slow ({a['seconds']}s)")
    a["flags"] = flags
    a["state"] = "DATED" if len(flags) >= 2 else ("OK-ISH" if flags else "GOOD")
    return a


def score(p):
    s = 0
    state = p["site"]["state"]
    s += {"NO SITE": 3, "BROKEN": 3, "SOCIAL ONLY": 3, "DATED": 2, "OK-ISH": 1}.get(state, 0)
    s += p["ticket"]
    s += 2 if p.get("phone") else 0
    s += 1 if p["site"].get("emails") or p.get("email") else 0
    s += 1 if p.get("street") else 0
    s += 1 if p.get("hours") else 0  # a filled-in listing usually means an active business
    return min(s, 10)


def place_from(el):
    t = el.get("tags", {})
    if t.get("brand") or t.get("brand:wikidata") or t.get("operator:wikidata"):
        return None  # chains don't buy local websites
    label, ticket = classify(t)
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    site = norm_site(t.get("website") or t.get("contact:website") or t.get("url"))
    return {
        "id": f"{el['type']}/{el['id']}",
        "name": t.get("name"),
        "trade": label,
        "ticket": ticket,
        "phone": t.get("phone") or t.get("contact:phone"),
        "email": t.get("email") or t.get("contact:email"),
        "website": site,
        "street": " ".join(x for x in [t.get("addr:housenumber"), t.get("addr:street")] if x),
        "city": t.get("addr:city"),
        "zip": t.get("addr:postcode"),
        "hours": t.get("opening_hours"),
        "facebook": t.get("contact:facebook"),
        "lat": lat,
        "lon": lon,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0, help="audit at most N sites (0 = all)")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    places = [p for p in (place_from(e) for e in fetch_places()) if p and p["name"]]
    seen, uniq = set(), []
    for p in places:
        key = (p["name"].lower(), (p["street"] or "").lower())
        if key not in seen:
            seen.add(key)
            uniq.append(p)
    print(f"{len(uniq)} independent places found")

    with_site = [p for p in uniq if p["website"]]
    if args.limit:
        with_site = with_site[: args.limit]
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        for p, a in zip(with_site, ex.map(lambda p: audit(p["website"]), with_site)):
            p["site"] = a
    for p in uniq:
        p.setdefault("site", {"state": "NO SITE"})
        p["score"] = score(p)

    old = {}
    prev = out / "nwa.json"
    if prev.exists():
        try:
            old = {p["id"]: p for p in json.loads(prev.read_text()).get("prospects", [])}
        except Exception:
            old = {}
    today = dt.date.today().isoformat()
    for p in uniq:
        o = old.get(p["id"], {})
        p["first_seen"] = o.get("first_seen", today)
        p["status"] = o.get("status", "new")  # TJ/runner set: approved, built, contacted, won, lost, skip

    uniq.sort(key=lambda p: (-p["score"], p["trade"], p["name"]))
    (out / "nwa.json").write_text(json.dumps(
        {"made": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z", "bbox": BBOX,
         "source": "OpenStreetMap contributors (ODbL) via Overpass", "prospects": uniq}, indent=1))

    counts = {}
    for p in uniq:
        counts[p["site"]["state"]] = counts.get(p["site"]["state"], 0) + 1
    lines = [
        "# NWA prospects",
        f"Made {today}. {len(uniq)} independent shops in Bentonville, Rogers, Bella Vista, Centerton, Lowell, "
        "Springdale and Fayetteville. Data: © OpenStreetMap contributors (ODbL); OSM misses some shops.",
        "",
        "Site states: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())),
        "",
        "| Score | Shop | Trade | City | Site | Why | Phone | Status |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for p in uniq[:80]:
        s = p["site"]
        why = s.get("error") or ", ".join(s.get("flags", [])) or ("no website listed" if s["state"] == "NO SITE" else "")
        lines.append(
            f"| {p['score']} | {p['name']} | {p['trade']} | {p.get('city') or ''} | {s['state']} | {why} | "
            f"{p.get('phone') or ''} | {p['status']} |"
        )
    (out / "nwa.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:30]))


if __name__ == "__main__":
    main()
