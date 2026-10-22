"""Second lead source for the scout: Overture Maps places (free, open data).

OpenStreetMap barely lists NWA trades (2 roofers, 4 HVAC in the first scan), so this
pulls home-service, trade, auto, beauty and moving businesses from Overture's places
theme, which carries phones, websites and categories. Runs on GitHub Actions
(needs `pip install duckdb`). Data: Overture Maps Foundation, CDLA Permissive 2.0.
"""
import re
import urllib.request

BUCKET = "https://overturemaps-us-west-2.s3.amazonaws.com"

# (pattern on the category, label, ticket). First match wins, so specific trades go first.
TRADES = [
    (r"hvac|heating|air_condition|furnace", "HVAC", 2),
    (r"plumb|water_heater|septic|drain", "Plumber", 2),
    (r"roof", "Roofer", 2),
    (r"electric(ian|al_(contractor|service))", "Electrician", 2),
    (r"fenc", "Fencing", 2),
    (r"landscap|lawn|gardener|tree_(service|trimming)|irrigation|sprinkler", "Landscaping", 2),
    (r"pest|extermin|termite", "Pest control", 2),
    (r"pressure_wash|power_wash|window_wash|carpet_clean|gutter", "Exterior cleaning", 1),
    (r"house_clean|home_clean|maid|cleaning_service|janitor", "Cleaning", 1),
    (r"pool|hot_tub", "Pools", 2),
    (r"garage_door", "Garage doors", 2),
    (r"handyman", "Handyman", 1),
    (r"^contractor$|remodel|general_contractor|home_builder|construction|carpent|flooring|drywall|concrete|painting|"
     r"siding|insulation|cabinet|countertop|foundation|window_installation|blinds|shutters|masonry|deck",
     "Home improvement", 2),
    (r"mover|moving_(company|service)", "Movers", 2),
    (r"towing|auto_(repair|body|glass|detail)|automotive_repair|car_repair|mechanic|tire|body_shop|oil_change|"
     r"transmission|brake|car_wash|detailing", "Auto", 2),
    (r"barber|hair|nail|beauty|lash|brow|wax|esthetic|tanning", "Beauty", 1),
    # coarse fallbacks when only basic_category is known
    (r"^home_service$|building_or_construction_service", "Home services", 2),
    (r"^automotive_service$|^vehicle_service$", "Auto", 2),
]
TRADE_RES = [(re.compile(p), label, ticket) for p, label, ticket in TRADES]


def latest_release():
    """Newest release folder name, e.g. 2026-09-17.0, from the public bucket listing."""
    url = f"{BUCKET}/?list-type=2&prefix=release/&delimiter=/"
    with urllib.request.urlopen(url, timeout=30) as r:
        xml = r.read().decode()
    rels = re.findall(r"<Prefix>release/([^/<]+)/</Prefix>", xml)
    if not rels:
        raise RuntimeError("no Overture releases listed")
    return sorted(rels)[-1]


def trade_of(cat):
    cat = (cat or "").lower()
    for rx, label, ticket in TRADE_RES:
        if rx.search(cat):
            return label, ticket
    return None


def category(row):
    """Most detailed category available: categories.primary (e.g. hvac_services), then the newer
    taxonomy.primary, then the coarse basic_category (e.g. home_service)."""
    cats = row.get("categories") or {}
    tax = row.get("taxonomy") or {}
    return cats.get("primary") or tax.get("primary") or row.get("basic_category") or ""


def all_categories(row):
    cats = row.get("categories") or {}
    tax = row.get("taxonomy") or {}
    return " ".join([category(row)] + list(cats.get("alternate") or []) + list(tax.get("hierarchy") or [])
                    + list(tax.get("alternates") or []) + [row.get("basic_category") or ""])


def first(xs):
    return (xs or [None])[0]


def place_from_row(row):
    """Turn one Overture row (a dict) into the scout's place shape, or None to skip it."""
    t = trade_of(category(row)) or trade_of(all_categories(row))
    if not t:
        return None
    if (row.get("confidence") or 0) < 0.6:
        return None  # low confidence usually means closed or stale
    brand = row.get("brand") or {}
    if (brand.get("names") or {}).get("primary") or brand.get("wikidata"):
        return None  # chains don't buy local websites
    name = re.sub(r"\s+", " ", ((row.get("names") or {}).get("primary") or "")).strip()
    if not name:
        return None
    addr = first(row.get("addresses")) or {}
    bbox = row.get("bbox") or {}
    lat, lon = bbox.get("ymin"), bbox.get("xmin")
    socials = row.get("socials") or []
    return {
        "id": f"overture/{row.get('id')}",
        "name": name,
        "trade": t[0],
        "ticket": t[1],
        "phone": first(row.get("phones")),
        "email": first(row.get("emails")),
        "website": first(row.get("websites")),
        "street": addr.get("freeform") or "",
        "zip": (addr.get("postcode") or "")[:5] or None,
        "hours": None,
        "facebook": next((s for s in socials if "facebook.com" in (s or "")), None),
        "lat": lat,
        "lon": lon,
        "city_hint": (addr.get("locality") or "").title() or None,
        "source": "overture",
        "category": category(row),
    }


def fetch_rows(bbox, release=None):
    """All Overture places inside bbox (south, west, north, east) as dicts."""
    import duckdb

    release = release or latest_release()
    s, w, n, e = bbox
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    cur = con.execute(
        f"""SELECT * FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*',
                                     hive_partitioning=1)
            WHERE bbox.xmin BETWEEN {w} AND {e} AND bbox.ymin BETWEEN {s} AND {n}"""
    )
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    print(f"Overture {release}: {len(rows)} places in the box")
    return rows


if __name__ == "__main__":
    # Debug aid: which categories exist in the box, and what each one maps to.
    import collections, json, pathlib, sys
    bbox = (36.03, -94.32, 36.50, -94.05)
    rows = fetch_rows(bbox)
    counts = collections.Counter(category(r) or "(none)" for r in rows)
    lines = ["| Category | Places | Our label |", "|---|---|---|"]
    for cat, n in counts.most_common():
        lines.append(f"| {cat} | {n} | {(trade_of(cat) or ('',))[0]} |")
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    (out / "overture_categories.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:60]))
