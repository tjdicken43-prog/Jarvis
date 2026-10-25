"""Offline test: the Apify actor's input checks, parsing and no-website filter (no network)."""
import importlib.util, json, pathlib

spec = importlib.util.spec_from_file_location("actor", pathlib.Path(__file__).parents[1] / "lanes" / "apify-actor" / "main.py")
a = importlib.util.module_from_spec(spec); spec.loader.exec_module(a)

els = [
    {"type": "node", "id": 1, "lat": 36.37, "lon": -94.2, "tags": {"craft": "plumber", "name": "Ozark Pipe Co", "phone": "+1 479 555 0101", "website": "ozarkpipe.test", "addr:housenumber": "5", "addr:street": "Main St", "addr:city": "Rogers"}},
    {"type": "way", "id": 2, "center": {"lat": 36.3, "lon": -94.1}, "tags": {"craft": "hvac", "name": "Cool Air", "website": "https://www.facebook.com/coolair"}},
    {"type": "node", "id": 3, "lat": 36.2, "lon": -94.1, "tags": {"craft": "roofer", "name": "Top Roof"}},
    {"type": "node", "id": 3, "lat": 36.2, "lon": -94.1, "tags": {"craft": "roofer", "name": "Top Roof"}},   # duplicate
    {"type": "node", "id": 4, "tags": {"craft": "roofer"}},                                                  # no name
    {"type": "node", "id": 5, "tags": {"shop": "bakery", "name": "Not a trade"}},
]
fetch = lambda q: els
box = [36.03, -94.32, 36.5, -94.05]
rows = a.find_businesses({"boundingBox": box}, fetch)
assert [r["name"] for r in rows] == ["Cool Air", "Ozark Pipe Co", "Top Roof"], rows
by = {r["name"]: r for r in rows}
assert by["Ozark Pipe Co"]["website"] == "http://ozarkpipe.test" and by["Ozark Pipe Co"]["hasWebsite"]
assert by["Ozark Pipe Co"]["address"] == "5 Main St, Rogers"
assert by["Cool Air"]["socialOnly"] and not by["Cool Air"]["hasWebsite"] and by["Cool Air"]["website"] == ""
assert by["Cool Air"]["lat"] == 36.3                                   # way centre used
assert all("OpenStreetMap" in r["attribution"] for r in rows)
assert [r["name"] for r in a.find_businesses({"boundingBox": box, "onlyWithoutWebsite": True}, fetch)] == ["Cool Air", "Top Roof"]
assert len(a.find_businesses({"boundingBox": box, "maxResults": 1}, fetch)) == 1
assert [r["name"] for r in a.find_businesses({"boundingBox": box, "trades": ["hvac"]}, fetch)] == ["Cool Air"]

q = a.overpass_query((1, 2, 3, 4), ["plumber"])
assert '["craft"="plumber"]["name"](1,2,3,4)' in q and q.startswith("[out:json]")
for bad in ({}, {"boundingBox": [1, 2, 3]}, {"boundingBox": [40, 0, 30, 1]}, {"boundingBox": [0, 0, 5, 5]},
            {"boundingBox": box, "trades": ["lawyer"]}, {"boundingBox": ["a", 0, 1, 1]}):
    try:
        a.validate(bad); raise SystemExit(f"accepted {bad}")
    except a.InputError:
        pass
for f in ("input_schema.json", "actor.json"):
    json.load(open(pathlib.Path(a.__file__).parent / ".actor" / f))
print("apify actor ok")
