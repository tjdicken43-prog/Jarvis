"""Site Care assess script: golden sites are clean, a bare page shows its gaps, live checks catch a missing opt-in."""
import importlib.util, pathlib
root = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("care", root / "sites" / "care" / "care.py")
care = importlib.util.module_from_spec(spec); spec.loader.exec_module(care)
for g in ("one-call-hvac", "its-plumbing", "johns-quality-roofing"):
    page = (root / "sites" / "golden" / g / "index.html").read_text()
    assert care.assess(page) == [], (g, care.assess(page))
bare = care.assess('<html><body><input></body></html>')
assert ("Leads", "missing: tap-to-call link") in bare and ("AI search", "missing: FAQPage schema") in bare
assert ("Access", "missing: skip link") in bare and any(a == "Bar" for a, _ in bare)
assert not any(a in ("Leads", "Trust") for a, _ in care.assess("<html><body></body></html>", tool=True))
gp = (root / "sites" / "golden" / "one-call-hvac" / "index.html").read_text()
assert ("Legal", "missing: texting opt-in box (unticked)") in care.assess(gp, live=True)
for d in (root / "sites" / "care" / "sites").iterdir():
    assert (d / "BACKLOG.md").is_file() and (d / "CHANGELOG.md").is_file(), d
print("site care ok")
