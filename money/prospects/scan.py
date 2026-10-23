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
# Many hosts block unknown bots (403/429), which says nothing about the site, so audits use a normal browser UA.
BROWSER_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"
HOME = (36.3729, -94.2088)  # Bentonville square
TOWNS = {"Bentonville": (36.3729, -94.2088), "Rogers": (36.3320, -94.1185), "Bella Vista": (36.4812, -94.2733),
         "Centerton": (36.3598, -94.2852), "Lowell": (36.2554, -94.1308), "Springdale": (36.1867, -94.1288),
         "Fayetteville": (36.0626, -94.1574), "Cave Springs": (36.2634, -94.2319), "Pea Ridge": (36.4540, -94.1169)}
FRANCHISE = re.compile(r"\b(chevrolet|chevy|ford|toyota|honda|nissan|hyundai|kia|chrysler|dodge|jeep|ram|buick|gmc|cadillac|"
                       r"subaru|mazda|volkswagen|vw|bmw|mercedes|lexus|acura|infiniti|audi|volvo|mitsubishi|carmax|"
                       r"great clips|supercuts|sport clips|planet fitness|anytime fitness|orangetheory)\b", re.I)
SKIP_WORDS = re.compile(r"\b(injection|botox|medspa|med spa|dental|dentist|chiropract|doctor)\b", re.I)

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


def http_get(url, timeout=20, data=None, ua=UA):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": ua, "Accept": "text/html,*/*;q=0.8",
                                                          "Accept-Language": "en-US,en;q=0.9"})
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
    print("Overpass failed: reusing last week's OpenStreetMap shops")
    return None


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
        status, final, body, secs = http_get(url, timeout=20, ua=BROWSER_UA)
    except urllib.error.HTTPError as ex:
        if ex.code in (401, 403, 429, 503):
            a.update(state="UNKNOWN", error=f"blocked our checker (HTTP {ex.code}); check by hand")
        else:
            a.update(state="BROKEN", error=f"page error (HTTP {ex.code})")
        return a
    except ssl.SSLCertVerificationError:
        a.update(state="BROKEN", error="browsers show a security warning (bad certificate)")
        return a
    except Exception as ex:
        msg = str(ex)
        if "CERTIFICATE_VERIFY_FAILED" in msg:
            a.update(state="BROKEN", error="browsers show a security warning (bad certificate)")
        elif "Name or service not known" in msg or "nodename nor servname" in msg:
            a.update(state="BROKEN", error="domain doesn't work (no DNS)")
        elif "timed out" in msg:
            a.update(state="BROKEN", error="site didn't load in 20 seconds")
        elif "SSL" in msg or "EOF" in msg:
            a.update(state="BROKEN", error="secure connection fails")
        else:
            a.update(state="UNKNOWN", error=(type(ex).__name__ + ": " + msg)[:100])
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
    s += {"NO SITE": 3, "BROKEN": 3, "SOCIAL ONLY": 3, "DATED": 2, "OK-ISH": 1, "UNKNOWN": 1}.get(state, 0)
    s += p["ticket"]
    s += 2 if p.get("phone") else 0
    s += 1 if p["site"].get("emails") or p.get("email") else 0
    s += 1 if p.get("street") else 0
    s += 1 if p.get("hours") else 0  # a filled-in listing usually means an active business
    s += 1 if p.get("km_home", 99) <= 15 else 0  # close to Bentonville: easy to walk in
    return min(s, 10)


def km(a, b):
    import math
    dlat, dlon = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def place_from(el):
    t = el.get("tags", {})
    if t.get("brand") or t.get("brand:wikidata") or t.get("operator:wikidata"):
        return None  # chains don't buy local websites
    name = re.sub(r"\s+", " ", t.get("name") or "").strip()
    if not name or FRANCHISE.search(name) or SKIP_WORDS.search(name):
        return None  # franchise dealers and medical offices: not our customers
    label, ticket = classify(t)
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    site = norm_site(t.get("website") or t.get("contact:website") or t.get("url"))
    return {
        "id": f"{el['type']}/{el['id']}",
        "name": name,
        "trade": label,
        "ticket": ticket,
        "phone": t.get("phone") or t.get("contact:phone"),
        "email": t.get("email") or t.get("contact:email"),
        "website": site,
        "street": " ".join(x for x in [t.get("addr:housenumber"), t.get("addr:street")] if x),
        "zip": t.get("addr:postcode"),
        "hours": t.get("opening_hours"),
        "facebook": t.get("contact:facebook"),
        "lat": lat,
        "lon": lon,
    } | where(lat, lon, t.get("addr:city"))


def last_osm_places(prev):
    """OSM shops from the previous run, re-audited this run (used when Overpass is down)."""
    try:
        old = json.loads(prev.read_text()).get("prospects", [])
    except Exception:
        return []
    keep = ("id", "name", "trade", "ticket", "phone", "email", "website", "street", "zip", "hours", "facebook", "lat", "lon",
            "km_home", "city")
    return [{k: p.get(k) for k in keep} for p in old if not p["id"].startswith("overture/")]


def overture_places():
    """Trades and home services from Overture (OSM barely lists them). Skipped if it fails."""
    try:
        import overture
        rows = overture.fetch_rows(BBOX)
    except Exception as ex:
        print("Overture skipped:", ex)
        return []
    out = []
    for r in rows:
        p = overture.place_from_row(r)
        if not p or FRANCHISE.search(p["name"]) or SKIP_WORDS.search(p["name"]):
            continue
        p["website"] = norm_site(p["website"])
        out.append(p | where(p["lat"], p["lon"], p.pop("city_hint")))
    print(f"Overture: {len(out)} independent trades and home services")
    return out


def where(lat, lon, city):
    if lat is None or lon is None:
        return {"km_home": 99, "city": city}
    near = min(TOWNS, key=lambda n: km((lat, lon), TOWNS[n]))
    return {"km_home": round(km((lat, lon), HOME), 1), "city": city or near}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0, help="audit at most N sites (0 = all)")
    ap.add_argument("--no-overture", action="store_true", help="OpenStreetMap only")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    elements = fetch_places()
    if elements is not None:
        places = [p for p in (place_from(e) for e in elements) if p and p["name"]]
    else:
        places = last_osm_places(out / "nwa.json")
    if not args.no_overture:
        places += overture_places()
    seen, uniq = set(), []
    for p in places:
        contact = re.sub(r"\D", "", p["phone"] or "")[-10:] or re.sub(r"[^a-z0-9]", "", (p["street"] or "").lower())
        key = (re.sub(r"[^a-z0-9]", "", p["name"].lower()), contact)
        if key not in seen:
            seen.add(key)
            uniq.append(p)
    print(f"{len(uniq)} independent places found")
    if not uniq:
        raise SystemExit("No places from any source: keeping last week's list untouched")

    with_site = [p for p in uniq if p["website"]]
    if args.limit:
        with_site = with_site[: args.limit]
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
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
    statuses = {}
    if (out / "status.json").exists():  # agents write statuses here; the Scout never rewrites it
        try:
            statuses = json.loads((out / "status.json").read_text())
        except Exception:
            statuses = {}
    today = dt.date.today().isoformat()
    for p in uniq:
        o = old.get(p["id"], {})
        p["first_seen"] = o.get("first_seen", today)
        p["status"] = statuses.get(p["id"], o.get("status", "new"))

    uniq.sort(key=lambda p: (-p["score"], p.get("km_home", 99), p["name"]))
    (out / "nwa.json").write_text(json.dumps(
        {"made": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z", "bbox": BBOX,
         "source": "OpenStreetMap contributors (ODbL) via Overpass; Overture Maps Foundation (CDLA Permissive 2.0)", "prospects": uniq}, indent=1))

    counts = {}
    for p in uniq:
        counts[p["site"]["state"]] = counts.get(p["site"]["state"], 0) + 1
    lines = [
        "# NWA prospects",
        f"Made {today}. {len(uniq)} independent shops in Bentonville, Rogers, Bella Vista, Centerton, Lowell, "
        "Springdale and Fayetteville. Data: © OpenStreetMap contributors (ODbL) and Overture Maps (CDLA Permissive 2.0); both miss some shops.",
        "",
        "Site states: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())),
        "",
        "OSM's \"no website listed\" can be out of date: the agent checks by web search before building.",
        "",
        "| Score | Shop | Trade | City | km | Site | Why | Phone | Status |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for p in uniq[:80]:
        s = p["site"]
        why = s.get("error") or ", ".join(s.get("flags", [])) or ("no website listed" if s["state"] == "NO SITE" else "")
        lines.append(
            f"| {p['score']} | {p['name']} | {p['trade']} | {p.get('city') or ''} | {p.get('km_home', '')} | {s['state']} | {why} | "
            f"{p.get('phone') or ''} | {p['status']} |"
        )
    (out / "nwa.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:30]))


if __name__ == "__main__":
    main()
