"""Auto mockups: builds each prospect's live preview with the option C trade builder (money/sites/trade_build.py)
from the facts the flaw finder saved, runs the site bar checks, and serves it at {PUBLIC_URL}/m/{slug}.

Pages live in the database, not the repo. Their logo is linked from their own site, never copied here.
A mockup that fails the checks is not saved, so no email can point to it.
"""
import secrets
import importlib.util
import pathlib
import re

import config
import events
import quality
from mailer import host

SITES = pathlib.Path(__file__).resolve().parents[2] / "sites"
FONT = SITES / "golden" / "one-call-hvac" / "libre-franklin-latin-wght-normal.woff2"
_spec = importlib.util.spec_from_file_location("trade_build", SITES / "trade_build.py")
trade_build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(trade_build)


def slug_for(p):
    base = re.sub(r"[^a-z0-9]+", "-", p["name"].lower()).strip("-")[:40].strip("-") or "shop"
    return f"{base}-{secrets.token_hex(6)}"  # random, so nobody can guess another shop's preview


def content_for(p):
    f = p.get("facts") or {}
    return {
        "name": p["name"], "trade": p["trade"], "city": p.get("city"), "phone": p.get("phone"),
        "email": p.get("email"), "website": p.get("website"),
        "rating": float(p["rating"]) if p.get("rating") is not None else None, "review_count": p.get("review_count"),
        "logo_url": f.get("logo_url"), "colors": f.get("colors") or [], "open_247": f.get("open_247"),
        "licensed": f.get("licensed"), "since": f.get("since"), "towns": f.get("towns") or [],
        "site_text": f.get("site_text") or "", "font_url": f"{config.PUBLIC_URL}/m/_/font.woff2", "preview": True,
        "source_note": (host(p.get("website")) or "their website") + (" and their Google profile" if p.get("rating") else ""),
    }


def build_and_save(conn, prospect_id):
    p = conn.execute("SELECT * FROM prospects WHERE id = %s", (prospect_id,)).fetchone()
    if not p:
        return {"prospect_id": prospect_id, "error": "no such prospect"}
    if missing := quality.contract("mockup", p):
        events.log("mockup", False, "not ready: " + "; ".join(missing), prospect_id=prospect_id)
        return {"prospect_id": prospect_id, "name": p["name"], "built": False, "problems": missing}
    c = content_for(p)
    page = trade_build.render(c)
    problems = trade_build.audit(page, c)
    if problems:
        events.log("mockup", False, "; ".join(problems), prospect_id=prospect_id)
        return {"prospect_id": prospect_id, "name": p["name"], "built": False, "problems": problems}
    slug = p.get("mockup_slug") or slug_for(p)
    url = f"{config.PUBLIC_URL}/m/{slug}"
    conn.execute("""INSERT INTO mockups (slug, prospect_id, html) VALUES (%s, %s, %s)
                    ON CONFLICT (slug) DO UPDATE SET html = EXCLUDED.html, built_at = now()""", (slug, prospect_id, page))
    conn.execute("""UPDATE prospects SET mockup_slug = %s, mockup_url = %s, updated_at = now(),
                    status = CASE WHEN status IN ('new', 'checked') THEN 'built' ELSE status END WHERE id = %s""",
                 (slug, url, prospect_id))
    conn.commit()
    events.log("mockup", True, "built", prospect_id=prospect_id, detail={"url": url})
    return {"prospect_id": prospect_id, "name": p["name"], "built": True, "mockup_url": url}
