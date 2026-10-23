#!/usr/bin/env python3
"""Load the scout's trade businesses into Postgres. Prints SQL; pipe it to psql.

  python3 money/agency/api/import_coldlist.py DIR | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
DIR holds nwa.json and, when they exist, status.json and suppress.csv (the money-data `prospects/` folder).
Only plumbing, HVAC and roofing. Safe to re-run: contact facts refresh, statuses set by agents stay unless
status.json says otherwise, and anyone on the do-not-email list is marked unsubscribed.
"""
import csv
import importlib.util
import json
import pathlib
import sys

_spec = importlib.util.spec_from_file_location("coldlist", pathlib.Path(__file__).parents[2] / "prospects" / "coldlist.py")
coldlist = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(coldlist)

TRADE = {"Plumber": "plumbing", "HVAC": "hvac", "Roofer": "roofing"}
STATE = {"BROKEN": "DOWN", "DATED": "DATED", "OK-ISH": "WEAK", "OK": "OK"}
STATUSES = {"new", "checked", "skip", "no-email", "built", "approved", "emailed", "replied", "won", "lost", "unsubscribed"}


def q(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def sql(src):
    src = pathlib.Path(src)
    shops = json.loads((src / "nwa.json").read_text())["prospects"]
    status_file = src / "status.json"
    statuses = json.loads(status_file.read_text()) if status_file.exists() else {}
    no_emails, no_domains = coldlist.suppressed(src)
    out = ["BEGIN;"]

    sup = src / "suppress.csv"
    for r in (csv.DictReader(sup.open()) if sup.exists() else []):
        email, domain = (r.get("email") or "").strip().lower(), coldlist.host(r.get("domain"))
        if email or domain:
            out.append(f"INSERT INTO suppressions (email, domain, reason) VALUES ({q(email)}, {q(domain)}, "
                       f"{q(r.get('reason') or 'opted out')}) ON CONFLICT DO NOTHING;")

    for p in shops:
        trade = TRADE.get(p.get("trade"))
        if not trade:
            continue
        site = p.get("site") or {}
        email = coldlist.email_of(p)
        website = p.get("website") or site.get("url") or ""
        status = statuses.get(p["id"])
        if (email and (email in no_emails or email.split("@")[1] in no_domains)) or coldlist.host(website) in no_domains:
            status = "unsubscribed"
        if status not in STATUSES:
            status = None
        state = STATE.get(site.get("state"))
        flaw = coldlist.problem(site) if site.get("state") in coldlist.BAD else None
        cols = dict(id=p["id"], name=p["name"], trade=trade, city=p.get("city"), phone=p.get("phone"), email=email,
                    website=website, site_state=state, flaw=flaw, score=p.get("score"),
                    status=status or "new")
        # Postgres is the source of truth once loaded: status.json only fills rows still 'new'; opt-outs always win
        keep = ("'unsubscribed'" if status == "unsubscribed" else
                "CASE WHEN prospects.status = 'new' THEN EXCLUDED.status ELSE prospects.status END")
        out.append(f"INSERT INTO prospects ({', '.join(cols)}) VALUES ({', '.join(q(v) for v in cols.values())})\n"
                   "  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, phone = EXCLUDED.phone,"
                   " email = EXCLUDED.email, website = EXCLUDED.website, site_state = EXCLUDED.site_state,"
                   f" flaw = COALESCE(prospects.flaw, EXCLUDED.flaw), score = EXCLUDED.score, status = {keep},"
                   " updated_at = now();")
    out.append("COMMIT;")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    sys.stdout.write(sql(sys.argv[1]))
