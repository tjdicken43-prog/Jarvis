"""Flaw finder: opens a trade shop's site the way a customer on a phone would, picks ONE specific, true flaw, and
saves it (plus a screenshot and the facts the mockup needs) to the prospect.

Uses Playwright + Chromium when installed (screenshot, real layout, load time). Without it, a plain HTTP check
still finds down sites, missing mobile tags, missing tap-to-call, old footers, slow loads and missing https.
Nothing here is guessed: every flaw comes from what the page actually did.
"""
import collections
import datetime as dt
import functools
import json
import os
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

import config

PHONE_UA = ("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/129.0 Mobile Safari/537.36")
PHONE_RE = re.compile(r"\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b")
TOWNS = ["Bentonville", "Rogers", "Bella Vista", "Centerton", "Lowell", "Springdale", "Fayetteville", "Cave Springs",
         "Pea Ridge", "Siloam Springs", "Gravette", "Garfield", "Gentry", "Decatur", "Highfill",
         "Tontitown", "Elm Springs", "Johnson", "Farmington", "Prairie Grove", "Greenland", "Elkins", "West Fork",
         "Goshen", "Little Flock", "Avoca", "Lincoln", "Bethel Heights", "Sulphur Springs", "Winslow", "Huntsville"]
SLOW_SECONDS = 4.0

# Measured in the page: layout, phone visibility, logo and brand colors (all from their own site)
PROBE = r"""() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const tels = [...document.querySelectorAll('a[href^="tel:"]')];
  let firstText = '';
  for (const e of document.querySelectorAll('body *')) {
    if (e.children.length === 0 && vis(e)) firstText += ' ' + (e.innerText || '');
  }
  const imgs = [...document.querySelectorAll('img')].filter(i => /logo/i.test(i.src + ' ' + i.alt + ' ' + i.className + ' ' + (i.parentElement && i.parentElement.className)));
  const logo = imgs.find(i => i.closest('header')) || imgs[0] || document.querySelector('header img');
  const colors = [];
  for (const e of document.querySelectorAll('header, nav, button, .btn, .button, a[class*="btn"], a[class*="button"], h1, h2')) {
    const s = getComputedStyle(e);
    colors.push(s.backgroundColor, s.color);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  return {
    scroll_width: document.documentElement.scrollWidth, viewport_width: vw,
    viewport_meta: !!document.querySelector('meta[name="viewport"]'),
    tel_links: tels.length, tel_on_first_screen: tels.some(vis),
    phone_on_first_screen: /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(firstText),
    logo_url: logo ? (logo.currentSrc || logo.src) : '',
    theme_color: meta ? meta.content : '', colors,
    text: (document.body ? document.body.innerText : '').slice(0, 20000),
    html_len: document.documentElement.outerHTML.length,
  };
}"""


def norm_url(u):
    u = (u or "").strip()
    if u and not re.match(r"^https?://", u, re.I):
        u = "http://" + u
    return u


def rgb_hex(c):
    m = re.match(r"rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)", c or "")
    if not m or (m.group(4) is not None and float(m.group(4)) < 0.5):
        return None
    return "#%02x%02x%02x" % tuple(int(m.group(i)) for i in (1, 2, 3))


def brand_colors(raw, theme=""):
    """Most-used saturated colors on their header, buttons and headings, best first."""
    hexes = [h for h in (rgb_hex(c) for c in raw or []) if h]
    def saturated(h):
        r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
        return max(r, g, b) - min(r, g, b) >= 40
    ranked = [h for h, _ in collections.Counter(h for h in hexes if saturated(h)).most_common(5)]
    if re.fullmatch(r"#[0-9a-fA-F]{6}", theme or ""):
        ranked.insert(0, theme.lower())
    return ranked


def site_facts(text):
    """Facts we may put on a mockup because their own site says them."""
    low = (text or "").lower()
    years = [int(y) for y in re.findall(r"\b(?:since|established|est\.?|founded in)\s*((?:19|20)\d{2})\b", low)]
    return {
        "open_247": bool(re.search(r"\b24\s*/\s*7\b|24 hours a day|24-hour emergency", low)),
        "licensed": bool(re.search(r"licensed\s*(?:&|and|,)\s*(?:bonded\s*(?:&|and)\s*)?insured", low)),
        "since": min(years) if years and min(years) >= 1900 else None,
        "towns": [t for t in dict.fromkeys(TOWNS) if t.lower() in low][:16],
    }


def http_inspect(url):
    """No browser: one GET with a phone user agent."""
    s = {"url": url, "mode": "http"}
    req = urllib.request.Request(url, headers={"User-Agent": PHONE_UA})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read(3_000_000)
            s.update(status=r.status, final_url=r.geturl())
    except urllib.error.HTTPError as e:
        s.update(status=e.code, final_url=url, blocked=e.code in (401, 403, 429, 503))
        return s
    except Exception as e:
        s.update(down=_down_reason(str(e)))
        return s
    s["seconds"] = round(time.monotonic() - t0, 1)
    text = body.decode("utf-8", "ignore")
    low = text.lower()
    s.update(viewport_meta='name="viewport"' in low or "name=viewport" in low,
             tel_links=low.count('href="tel:') + low.count("href='tel:"),
             text=re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text,
                                                                         flags=re.S | re.I))).strip()[:20000],
             html_len=len(text))
    m = re.search(r'<meta[^>]+name=["\']theme-color["\'][^>]+content=["\']([^"\']+)', text, re.I)
    s["theme_color"] = m.group(1) if m else ""
    m = re.search(r'<img[^>]+src=["\']([^"\']*logo[^"\']*)["\']', text, re.I)
    s["logo_url"] = urllib.parse.urljoin(s["final_url"], m.group(1)) if m else ""
    return s


def browser_inspect(url):
    """Real Chromium at 390 px (an iPhone-sized phone). Returns signals plus a PNG of the first screen."""
    from playwright.sync_api import sync_playwright

    s = {"url": url, "mode": "browser"}
    with sync_playwright() as p:
        kw = {"executable_path": config.CHROMIUM_PATH} if config.CHROMIUM_PATH else {}
        b = p.chromium.launch(**kw)
        try:
            page = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                              has_touch=True, user_agent=PHONE_UA)
            t0 = time.monotonic()
            try:
                resp = page.goto(url, wait_until="load", timeout=30000)
            except Exception as e:
                s["down"] = _down_reason(str(e))
                return s, None
            s["seconds"] = round(time.monotonic() - t0, 1)
            s["status"] = resp.status if resp else None
            s["final_url"] = page.url
            if s["status"] and s["status"] >= 400:
                s["blocked"] = s["status"] in (401, 403, 429, 503)
                return s, None
            page.wait_for_timeout(1200)  # let cookie bars and late layout settle
            s.update(page.evaluate(PROBE))
            shot = page.screenshot(type="png")
        finally:
            b.close()
    return s, shot


def _down_reason(msg):
    m = msg.lower()
    if "name_not_resolved" in m or "name or service not known" in m or "nodename" in m:
        return "no DNS"
    if "cert" in m:
        return "security warning (bad certificate)"
    if "timeout" in m or "timed out" in m:
        return "didn't load in 30 seconds"
    if "refused" in m:
        return "connection refused"
    return "didn't load"


@functools.lru_cache(maxsize=1)
def browser_status():
    """chromium when a browser is installed for the flaw finder, else http-fallback. For /health, checked once."""
    if config.CHROMIUM_PATH:
        return "chromium" if os.path.exists(config.CHROMIUM_PATH) else "http-fallback"
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            return "chromium" if os.path.exists(p.chromium.executable_path) else "http-fallback"
    except Exception:
        return "http-fallback"


def inspect_site(url):
    url = norm_url(url)
    try:
        import playwright  # noqa: F401
    except ImportError:
        return http_inspect(url), None
    try:
        return browser_inspect(url)
    except Exception:  # Chromium missing or crashed: still check what HTTP can see
        return http_inspect(url), None


PARKED_TEXT = re.compile(r"coming soon|parked free", re.I)
FOR_SALE = re.compile(r"domain (name\s+)?(\S+\s+)?is for sale|domain (is )?for sale|buy this domain|"
                      r"this domain may be for sale", re.I)
PARKED_HOSTS = ("forsale.godaddy.com", "sedo.com", "afternic.com", "dan.com", "hugedomains.com", "parkingcrew.net",
                "bodis.com", "sav.com", "undeveloped.com")
CHALLENGE = re.compile(r"checking (the site connection security|your browser)|verify you are (a )?human|"
                       r"just a moment\.\.\.|attention required|enable javascript and cookies to continue", re.I)


def pick(s, today=None):
    """One flaw, worst first. Returns (flaw, site_state) or (None, state) when the site is fine or we couldn't tell.

    Flaw strings are the scout's flags, so outreach.plain_flaw() turns them into owner words.
    """
    today = today or dt.date.today()
    if s.get("down"):
        return f"Site down: {s['down']}", "DOWN"
    text = (s.get("text") or "")[:3000]
    if s.get("blocked") or CHALLENGE.search(text):  # a bot wall isn't their site: we can't tell, so no email
        return None, None
    if s.get("status") and s["status"] >= 400:
        return f"Site down: page error {s['status']}", "DOWN"
    parked_host = re.sub(r"^https?://", "", (s.get("final_url") or "").lower()).split("/")[0]
    if FOR_SALE.search(text) or any(parked_host == h or parked_host.endswith("." + h) for h in PARKED_HOSTS):
        return "Site down: domain for sale", "DOWN"
    if s.get("html_len", 1000) < 800 or PARKED_TEXT.search(text):
        return "Site down: parked or empty page", "DOWN"
    found = []
    if not s.get("viewport_meta") or (s.get("scroll_width") or 0) > (s.get("viewport_width") or 390) + 8:
        found.append("not mobile-friendly")
    if not s.get("tel_links"):
        found.append("no tap-to-call")
    elif s.get("mode") == "browser" and not s.get("phone_on_first_screen") and not s.get("tel_on_first_screen"):
        found.append("phone number hidden on phones")
    if (s.get("seconds") or 0) > SLOW_SECONDS:
        found.append(f"slow ({s['seconds']}s)")
    if s.get("final_url") and not s["final_url"].lower().startswith("https://"):
        found.append("no https")
    years = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\s*(?:(?:19|20)\d{2}\s*[-–]\s*)?((?:19|20)\d{2})",
                                        (s.get("text") or "").lower())]
    if years and max(years) <= today.year - 3:
        found.append(f"© {max(years)}")
    if not found:
        return None, "OK"
    return found[0], ("DATED" if len(found) >= 2 else "WEAK")


def find_and_save(conn, prospect_id, inspect=None):
    """Inspect one prospect's site, save the flaw, screenshot and facts. Returns a short result dict."""
    p = conn.execute("SELECT * FROM prospects WHERE id = %s", (prospect_id,)).fetchone()
    if not p:
        return {"prospect_id": prospect_id, "error": "no such prospect"}
    if not p.get("website"):
        return {"prospect_id": prospect_id, "name": p["name"], "flaw": None, "note": "no website to check"}
    signals, shot = (inspect or inspect_site)(p["website"])
    flaw, state = pick(signals)
    if state is None:  # blocked our checker: keep what the scout found, check by hand
        flaw = p.get("flaw")
    evidence = None
    if shot:
        token = secrets.token_urlsafe(18)
        conn.execute("INSERT INTO shots (token, prospect_id, png) VALUES (%s, %s, %s)", (token, prospect_id, shot))
        evidence = f"{config.PUBLIC_URL}/shots/{token}.png"
    facts = dict(p.get("facts") or {})
    facts.update(site_facts(signals.get("text")))
    facts.update({
        "logo_url": signals.get("logo_url") if str(signals.get("logo_url") or "").startswith("https://") else "",
        "colors": brand_colors(signals.get("colors"), signals.get("theme_color")),
        "site_text": (signals.get("text") or "")[:6000],
        "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "check_mode": signals.get("mode"),
        "signals": {k: signals.get(k) for k in ("status", "final_url", "seconds", "viewport_meta", "scroll_width",
                                                "tel_links", "tel_on_first_screen", "phone_on_first_screen",
                                                "down", "blocked")},
    })
    conn.execute(
        """UPDATE prospects SET flaw = %s, flaw_evidence = COALESCE(%s, flaw_evidence), site_state = COALESCE(%s, site_state),
           facts = %s::jsonb, status = CASE WHEN status = 'new' THEN 'checked' ELSE status END, updated_at = now()
           WHERE id = %s""",
        (flaw, evidence, state, json.dumps(facts), prospect_id))
    conn.commit()
    import events
    events.log("flaw", True, flaw or ("blocked us; kept the scout's flaw" if state is None else "no clear flaw"),
               prospect_id=prospect_id, detail={"state": state, "mode": signals.get("mode")})
    return {"prospect_id": prospect_id, "name": p["name"], "flaw": flaw, "site_state": state, "evidence": evidence,
            "mode": signals.get("mode")}
