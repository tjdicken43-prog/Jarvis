"""Offline test: auto mockups follow option C and the site bar, and only show facts we were given."""
import importlib.util, pathlib, re

spec = importlib.util.spec_from_file_location("trade_build", pathlib.Path(__file__).parents[1] / "sites" / "trade_build.py")
tb = importlib.util.module_from_spec(spec); spec.loader.exec_module(tb)

base = {"name": "Ozark Pipe Co", "city": "Rogers", "phone": "479-273-0100", "colors": ["#ffffff", "#d80028"]}
for trade, h1, tool in [("plumbing", "Plumbing repair and installs in Rogers.", "Water where it shouldn't be?"),
                        ("hvac", "Heating and AC repair in Rogers.", "Before you call: quick checks"),
                        ("roofing", "Roof repair and replacement in Rogers.", "Repair or replace?")]:
    c = dict(base, trade=trade)
    page = tb.render(c)
    assert tb.audit(page, c) == [], (trade, tb.audit(page, c))
    assert h1 in page and tool in page and 'href="tel:+14792730100"' in page and "noindex" in page, trade
    assert "Concept preview" in page and 'type="file"' in page and 'class="bar"' in page, trade
    # nothing unsourced: no stars, 24/7, license or year without facts
    for claim in ("on Google", "24/7", "Licensed", "Since "):
        assert claim not in page, (trade, claim)
    radii = [int(r) for r in re.findall(r"border-radius:(\d+)px", page)]
    assert max(radii) <= 8 and "999px" not in page, radii

full = dict(base, trade="hvac", rating=4.8, review_count=61, open_247=True, licensed=True, since=2004,
            site_text="geothermal heat pump duct work", towns=["Bentonville", "Rogers"], logo_url="https://x.test/logo.png")
page = tb.render(full)
assert tb.audit(page, full) == []
assert "4.8</b> on Google from 61 reviews" in page and "Since 2004" in page and "24/7 service. Tap to call" in page
assert "Geothermal" in page and "Ductwork" in page and "Refrigeration" not in page
assert page.index("<li>Rogers</li>") < page.index("<li>Bentonville</li>")  # their town first
assert 'src="https://x.test/logo.png"' in page and tb.render(dict(full, logo_url="http://x.test/l.png")).count("<img") == 0

# accent: their color, darkened until white text passes AA; greys and whites are skipped
acc = tb.accent_from(["#ffffff", "#888888", "#ffc93c"])
assert tb.contrast(acc, "#ffffff") >= 4.5 and acc != "#ffc93c", acc
assert tb.accent_from(["#eeeeee"]) == "#106494"

# the audit catches AI tells and placeholders
bad = page.replace("Heating and AC repair in Rogers.", "Elevate your comfort!").replace("border-radius:4px", "border-radius:24px", 1)
probs = tb.audit(bad, full)
assert any("elevate" in p for p in probs) and any("24px" in p for p in probs) and any("exclamation" in p for p in probs), probs
assert any("555-" in p for p in tb.audit(tb.render(dict(base, trade="roofing", phone="479-555-0100")), base))
try:
    tb.render(dict(base, trade="auto repair")); raise SystemExit("trades only")
except ValueError:
    pass

# Front Desk (the AI receptionist): customer section always, owner panel with our prices on previews only
assert 'id="after-hours"' in page and "automated assistant" in page and "Smell gas" in page
assert 'id="owner"' in page and "$149" in page and "$249" in page and "$299 setup" in page and 'href="#owner"' in page
live = tb.render(dict(full, preview=False))
assert 'id="after-hours"' in live and 'id="owner"' not in live and "$149" not in live and "noindex" not in live
assert 'id="after-hours"' not in tb.render(dict(full, front_desk=False))
bill = (pathlib.Path(__file__).parents[1] / "agency" / "api" / "billing.py").read_text()
assert f"SETUP_CENTS = {tb.PLANS['setup']}00" in bill and f'"monthly_cents": {tb.PLANS["front_desk"][0]}00, "minutes": {tb.PLANS["front_desk"][1]}' in bill
assert f'"monthly_cents": {tb.PLANS["plus"][0]}00, "minutes": {tb.PLANS["plus"][1]}' in bill and "OVERAGE_CENTS_PER_MIN = 25" in bill

# the golden sites pass the same audit and carry the receptionist sections
for g in ("one-call-hvac", "its-plumbing", "johns-quality-roofing"):
    gp = (pathlib.Path(__file__).parents[1] / "sites" / "golden" / g / "index.html").read_text()
    assert tb.audit(gp) == [], (g, tb.audit(gp))
    assert 'id="after-hours"' in gp and 'id="owner"' in gp, g
print("trade build ok")

# roofing extras appear only when the owner supplied them, and never on other trades
roof = dict(base, trade="roofing")
plain = tb.render(roof)
for q in ("warranty", "financing", "insurance claim", "inspection free"):
    assert q not in plain.lower().replace("insurance company", ""), q
extra = dict(roof, warranty="Ten years on labor.", financing="Acme Finance", free_inspection=True, claim_help=True)
page = tb.render(extra)
assert tb.audit(page, extra) == []
assert "Ten years on labor." in page and "through Acme Finance" in page and "Is the inspection free?" in page and "help with an insurance claim" in page
assert "financing" not in tb.render(dict(base, trade="hvac", financing="Acme Finance")).lower()
print("trade_build ok")
