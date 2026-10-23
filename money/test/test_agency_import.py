"""Offline test: the agency import keeps only plumbing/HVAC/roofing, quotes safely and honours the do-not-email list."""
import csv, importlib.util, json, pathlib, tempfile

spec = importlib.util.spec_from_file_location("imp", pathlib.Path(__file__).parents[1] / "agency" / "api" / "import_coldlist.py")
imp = importlib.util.module_from_spec(spec); spec.loader.exec_module(imp)

def shop(i, trade, email, web):
    return {"id": f"overture/{i}", "name": f"Bob's {trade} {i}", "trade": trade, "email": email, "website": web,
            "score": 5, "status": "new", "site": {"state": "DATED", "flags": ["no tap-to-call"]}}

d = pathlib.Path(tempfile.mkdtemp())
(d / "nwa.json").write_text(json.dumps({"prospects": [
    shop(1, "Plumber", "a@keep.com", "keep.com"),
    shop(2, "HVAC", "b@gone.com", "gone.com"),        # opted out by email
    shop(3, "Roofer", "c@x.com", "https://nomail.com"),  # opted out by domain
    shop(4, "Beauty", "d@salon.com", "salon.com")]}))   # not a trade: left out
(d / "status.json").write_text(json.dumps({"overture/1": "checked"}))
with (d / "suppress.csv").open("w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["email", "domain", "date", "reason"])
    w.writerow(["B@gone.com", "", "2026-10-23", "replied stop"]); w.writerow(["", "nomail.com", "2026-10-23", "asked"])
out = imp.sql(d)
assert "salon" not in out, out
assert "'Bob''s Plumber 1'" in out and "'plumbing'" in out and "'checked'" in out, out
assert out.count("INSERT INTO suppressions") == 2 and "'b@gone.com'" in out, out
for i in (2, 3):
    row = next(l for l in out.splitlines() if f"'overture/{i}'" in l)
    assert "'unsubscribed'" in row, row
print("agency import ok")
