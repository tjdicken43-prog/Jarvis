"""The client's live site: the "rebuilt and hosted" part of both plans.

Same builder and facts as their preview, with the preview parts off: no concept bar, no owner panel, no "not connected
yet" note, and search engines allowed. It must pass the same site bar audit. Served at /s/<slug>, and at their own
domain once it points here (TJ adds the domain to agency-api on Render; the shop's DNS gets a CNAME). Plus answers
24/7, so its page says every call gets answered. The quote form posts to /s/<slug>/request: the request (and up to 3
photos) is saved and emailed to the owner at once, and shows in the morning summary.
"""
import re
import secrets

import config
import mockup


def domain_of(d):
    d = re.sub(r"^https?://", "", (d or "").strip().lower()).split("/")[0].removeprefix("www.")
    if d and not re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)+", d):
        raise ValueError("that doesn't look like a domain")
    return d or None


def publish(conn, c, domain=None):
    """Build and save the live page. Returns {published, url} or {published: False, problems}."""
    if c["status"] not in ("active", "past_due"):
        return {"published": False, "problems": ["publish after they've paid"]}
    if not c["prospect_id"]:
        return {"published": False, "problems": ["no shop facts: add the client from a prospect to build their site"]}
    p = conn.execute("SELECT * FROM prospects WHERE id = %s", (c["prospect_id"],)).fetchone()
    old = conn.execute("SELECT slug, domain FROM client_sites WHERE client_id = %s", (c["id"],)).fetchone()
    slug = old["slug"] if old else mockup.slug_for(p)
    content = dict(mockup.content_for(p), preview=False, phone=c["phone"] or p["phone"], email=c["email"],
                   form_action=f"{config.PUBLIC_URL}/s/{slug}/request", privacy_url=f"{config.PUBLIC_URL}/s/{slug}/privacy")
    domain = domain if domain is not None else (old or {}).get("domain")
    content["site_url"] = f"https://{domain}" if domain else f"{config.PUBLIC_URL}/s/{slug}"
    if c["plan"] == "front_desk_plus":
        content["open_247"] = True  # Plus answers day and night
    page = mockup.trade_build.render(content)
    problems = mockup.trade_build.audit(page, content)
    if "noindex" in page.lower():
        problems.append("live page still says noindex")
    if problems:
        return {"published": False, "problems": problems}
    conn.execute("""INSERT INTO client_sites (client_id, slug, domain, html) VALUES (%s,%s,%s,%s)
                    ON CONFLICT (client_id) DO UPDATE SET domain = EXCLUDED.domain, html = EXCLUDED.html,
                    published_at = now()""", (c["id"], slug, domain, page))
    url = f"https://{domain}" if domain else f"{config.PUBLIC_URL}/s/{slug}"
    conn.execute("UPDATE clients SET site_url = %s WHERE id = %s", (url, c["id"]))
    conn.commit()
    return {"published": True, "url": url, "path": f"/s/{slug}", "domain": domain}


PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_PHOTOS, MAX_PHOTO_BYTES = 3, 5 * 1024 * 1024
HOURLY_LIMIT = 20  # requests per site per hour; more is a bot


class RequestError(Exception):
    pass


def privacy_page(conn, slug):
    """The live site's privacy and texting terms (linked from its form and footer). None if no such site."""
    row = conn.execute("""SELECT s.slug, s.domain, c.business_name, c.phone, c.email FROM client_sites s
                          JOIN clients c ON c.id = s.client_id WHERE s.slug = %s""", (slug,)).fetchone()
    if not row:
        return None
    back = f"https://{row['domain']}" if row["domain"] else f"{config.PUBLIC_URL}/s/{row['slug']}"
    return mockup.trade_build.legal_html({"name": row["business_name"], "phone": row["phone"], "email": row["email"],
                                          "site_url": back, "legal_date": LEGAL_DATE})


LEGAL_DATE = "2026-10-31"  # bump when legal_html's wording changes


def save_request(conn, c, form, photos):
    """One form request. photos: [(content_type, bytes)]. Returns the request row (None for a bot, silently)."""
    if (form.get("website") or "").strip():
        return None  # the hidden field was filled in: a bot
    name = re.sub(r"\s+", " ", form.get("name") or "").strip()[:80]
    phone = re.sub(r"\D", "", form.get("phone") or "")[-10:]
    if not name or len(phone) != 10:
        raise RequestError("Please give your name and a 10-digit phone number.")
    if conn.execute("SELECT count(*) AS n FROM site_requests WHERE client_id = %s AND created_at > now() - interval '1 hour'",
                    (c["id"],)).fetchone()["n"] >= HOURLY_LIMIT:
        raise RequestError("Too many requests right now. Please call instead.")
    pick = lambda k, n: (re.sub(r"\s+", " ", form.get(k) or "").strip()[:n] or None)
    sms_ok = (form.get("sms_ok") or "") == "yes"  # the unticked box on the form; proof of opt-in for texting (TCPA, 10DLC)
    row = conn.execute("""INSERT INTO site_requests (client_id, name, phone, job, town, day, sms_ok, sms_ok_at)
                          VALUES (%s,%s,%s,%s,%s,%s,%s, CASE WHEN %s THEN now() END) RETURNING *""",
                       (c["id"], name, phone, pick("job", 120), pick("town", 120), pick("day", 60), sms_ok, sms_ok)).fetchone()
    urls = []
    for ctype, data in [p for p in photos if p[1]][:MAX_PHOTOS]:
        if ctype not in PHOTO_TYPES or len(data) > MAX_PHOTO_BYTES:
            continue
        token = secrets.token_urlsafe(18)
        conn.execute("INSERT INTO site_request_photos (token, request_id, content_type, data) VALUES (%s,%s,%s,%s)",
                     (token, row["id"], ctype, data))
        urls.append(f"{config.PUBLIC_URL}/p/{token}")
    return dict(row, photos=urls)
