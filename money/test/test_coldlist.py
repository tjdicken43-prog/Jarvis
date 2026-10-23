"""Offline test: opted-out shops never come back on the cold list, whatever the weekly scan says."""
import csv, importlib.util, json, pathlib, tempfile

spec = importlib.util.spec_from_file_location("coldlist", pathlib.Path(__file__).parents[1] / "prospects" / "coldlist.py")
coldlist = importlib.util.module_from_spec(spec); spec.loader.exec_module(coldlist)

def shop(i, email, web, status="new"):
    return {"id": f"overture/{i}", "name": f"Shop {i}", "trade": "HVAC", "email": email, "website": web, "status": status,
            "score": 5, "km_home": 3, "site": {"state": "DATED", "flags": ["old year"]}}

d = pathlib.Path(tempfile.mkdtemp())
(d / "nwa.json").write_text(json.dumps({"prospects": [
    shop(1, "a@keep.com", "keep.com"),
    shop(2, "b@gone.com", "gone.com"),              # opted out by email
    shop(3, "c@other.com", "https://www.nomail.com"),  # opted out by domain (new id, same business)
    shop(4, "d@later.com", "later.com", "unsubscribed")]}))
with (d / "suppress.csv").open("w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["email", "domain", "date", "reason"])
    w.writerow(["B@gone.com", "", "2026-10-23", "replied stop"]); w.writerow(["", "nomail.com", "2026-10-23", "asked"])
coldlist.main(str(d / "nwa.json"), str(d / "out"))
names = [r["name"] for r in csv.DictReader((d / "out" / "cold-list.csv").open())]
assert names == ["Shop 1"], names
print("coldlist ok")
