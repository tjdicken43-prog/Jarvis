"""Offline test of turning Overture rows into scout places (no network)."""
import importlib.util, pathlib

spec = importlib.util.spec_from_file_location("overture", pathlib.Path(__file__).parents[1] / "prospects" / "overture.py")
ov = importlib.util.module_from_spec(spec); spec.loader.exec_module(ov)

base = {
    "id": "abc", "names": {"primary": "Ozark  Comfort Heating & Air"}, "confidence": 0.9,
    "categories": {"primary": "hvac_services", "alternate": ["plumbing"]},
    "phones": ["+14795550100"], "websites": ["ozarkcomfort.com"], "emails": None,
    "socials": ["https://www.facebook.com/ozarkcomfort"], "brand": None,
    "addresses": [{"freeform": "12 Main St", "locality": "ROGERS", "postcode": "72756-1234"}],
    "bbox": {"xmin": -94.12, "ymin": 36.33},
}
p = ov.place_from_row(base)
assert p["name"] == "Ozark Comfort Heating & Air" and p["trade"] == "HVAC" and p["ticket"] == 2, p
assert p["zip"] == "72756" and p["city_hint"] == "Rogers" and p["facebook"].endswith("ozarkcomfort"), p
assert p["lat"] == 36.33 and p["lon"] == -94.12 and p["id"] == "overture/abc"

# newer releases use basic_category
assert ov.place_from_row(base | {"categories": None, "basic_category": "roofing_contractor"})["trade"] == "Roofer"
# chains, stale places and off-target categories are skipped
assert ov.place_from_row(base | {"brand": {"names": {"primary": "Aire Serv"}}}) is None
assert ov.place_from_row(base | {"confidence": 0.3}) is None
assert ov.place_from_row(base | {"categories": {"primary": "restaurant", "alternate": []}}) is None
# alternate category rescues a vague primary one
assert ov.place_from_row(base | {"categories": {"primary": "professional_services", "alternate": ["pest_control_service"]}})["trade"] == "Pest control"
assert ov.trade_of("moving_company") == ("Movers", 2) and ov.trade_of("nail_salon") == ("Beauty", 1)
assert ov.place_from_row(base | {"categories": None, "basic_category": "home_service"})["trade"] == "Home services"
assert ov.place_from_row(base | {"categories": None, "basic_category": "storage_facility"}) is None
assert ov.place_from_row(base | {"categories": None, "taxonomy": {"primary": "electrician", "hierarchy": ["home_service", "electrician"]}})["trade"] == "Electrician"
assert ov.trade_of("contractor") == ("Home improvement", 2)
print("overture ok")
