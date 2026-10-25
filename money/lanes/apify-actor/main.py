"""Apify actor: local trade businesses from OpenStreetMap, with a "no website" filter.

Public data only (OpenStreetMap, ODbL: attribution goes in every run's output). Business details only: name, trade,
phone, website, address. No people, no emails scraped from pages, no social profiles. Runs on Apify (Python SDK);
`python3 main.py --input input.json` runs it by hand and `find_businesses(inp, fetch)` is what the test calls.
"""
import argparse
import json
import re
import time
import urllib.parse
import urllib.request

OVERPASS = "https://overpass-api.de/api/interpreter"
UA = "TradeFinder-apify-actor/1.0 (public OpenStreetMap data)"
ATTRIBUTION = "Data (c) OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright"
TRADES = {"plumber": ("craft", "plumber"), "hvac": ("craft", "hvac"), "roofer": ("craft", "roofer"),
          "electrician": ("craft", "electrician"), "painter": ("craft", "painter"), "carpenter": ("craft", "carpenter"),
          "landscaper": ("craft", "gardener")}
MAX_RESULTS = 1000
SOCIAL = ("facebook.com", "instagram.com", "yelp.com", "linktr.ee", "tiktok.com", "business.site")


class InputError(ValueError):
    pass


def validate(inp):
    bbox = inp.get("boundingBox")
    if not (isinstance(bbox, list) and len(bbox) == 4 and all(isinstance(x, (int, float)) for x in bbox)):
        raise InputError("boundingBox must be [south, west, north, east] in degrees")
    s, w, n, e = bbox
    if not (-90 <= s < n <= 90 and -180 <= w < e <= 180):
        raise InputError("boundingBox is out of range or upside down")
    if (n - s) * (e - w) > 4:   # about a metro area; keeps one run polite to the free Overpass servers
        raise InputError("boundingBox is too big: keep it under 4 square degrees (about one metro area)")
    trades = inp.get("trades") or ["plumber", "hvac", "roofer"]
    bad = [t for t in trades if t not in TRADES]
    if bad:
        raise InputError("unknown trade: " + ", ".join(bad) + ". Choose from: " + ", ".join(TRADES))
    limit = int(inp.get("maxResults") or 200)
    return (s, w, n, e), trades, max(1, min(limit, MAX_RESULTS)), bool(inp.get("onlyWithoutWebsite", False))


def overpass_query(bbox, trades):
    s, w, n, e = bbox
    parts = [f'{t}["{TRADES[x][0]}"="{TRADES[x][1]}"]["name"]({s},{w},{n},{e});' for x in trades for t in ("node", "way")]
    return "[out:json][timeout:120];(" + "".join(parts) + ");out center tags;"


def norm_site(u):
    u = (u or "").strip()
    return u if not u or re.match(r"^https?://", u, re.I) else "http://" + u


def address(tags):
    street = " ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x)
    return ", ".join(x for x in (street, tags.get("addr:city"), tags.get("addr:state"), tags.get("addr:postcode")) if x)


def parse(elements, trades):
    wanted = {TRADES[t]: t for t in trades}
    seen, out = set(), []
    for el in elements:
        tags = el.get("tags") or {}
        trade = next((v for (k, val), v in wanted.items() if tags.get(k) == val), None)
        if not trade or not tags.get("name"):
            continue
        key = (el.get("type"), el.get("id"))
        if key in seen:
            continue
        seen.add(key)
        site = norm_site(tags.get("website") or tags.get("contact:website") or tags.get("url"))
        host = urllib.parse.urlparse(site).netloc.lower()
        social_only = bool(site) and any(s in host for s in SOCIAL)
        c = el.get("center") or {}
        out.append({
            "name": tags["name"].strip(), "trade": trade, "phone": tags.get("phone") or tags.get("contact:phone") or "",
            "website": "" if social_only else site, "socialOnly": social_only, "hasWebsite": bool(site) and not social_only,
            "address": address(tags), "lat": el.get("lat", c.get("lat")), "lon": el.get("lon", c.get("lon")),
            "osmId": f'{el.get("type")}/{el.get("id")}', "attribution": ATTRIBUTION,
        })
    return sorted(out, key=lambda r: (r["trade"], r["name"].lower()))


def http_fetch(query):
    req = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": UA})
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())["elements"]
        except Exception as ex:   # Overpass is busy at times
            last = ex
            time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"OpenStreetMap's Overpass service did not answer: {last}")


def find_businesses(inp, fetch=http_fetch):
    bbox, trades, limit, only_no_site = validate(inp)
    rows = parse(fetch(overpass_query(bbox, trades)), trades)
    if only_no_site:
        rows = [r for r in rows if not r["hasWebsite"]]
    return rows[:limit]


async def actor_main():   # pragma: no cover (needs the Apify runtime)
    from apify import Actor
    async with Actor:
        inp = await Actor.get_input() or {}
        try:
            rows = find_businesses(inp)
        except InputError as ex:
            await Actor.fail(status_message=str(ex))
            return
        # Pay per result: one event per row actually returned (price set in the Apify console)
        for r in rows:
            await Actor.push_data(r)
        await Actor.set_status_message(f"{len(rows)} businesses")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--input")
    a = ap.parse_args()
    if a.input:
        print(json.dumps(find_businesses(json.load(open(a.input))), indent=1))
    else:
        import asyncio
        asyncio.run(actor_main())
