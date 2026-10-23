#!/usr/bin/env python3
"""Build one-page shop sites from content JSON.

Usage: python3 money/sites/build.py [slug ...]   (no slug = build every shop)
Reads  money/sites/shops/<slug>/content.json
Writes money/sites/out/<slug>/index.html   (plus out/index.html, a list of builds)

One template, many shops: the agent only writes content.json. Previews get a
"concept preview" bar and noindex; set "preview": false for a paid, live site.
"""
import html
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SHOPS = ROOT / "shops"
OUT = ROOT / "out"

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def esc(s):
    return html.escape(str(s or ""), quote=True)


def digits(phone):
    return "".join(c for c in str(phone or "") if c.isdigit() or c == "+")


def hex_ok(c, fallback):
    c = str(c or "").strip()
    if len(c) in (4, 7) and c.startswith("#") and all(x in "0123456789abcdefABCDEF" for x in c[1:]):
        return c
    return fallback


def contrast_text(hexcolor):
    """Pick near-black or white text for a background, by relative luminance."""
    h = hexcolor.lstrip("#")
    if len(h) == 3:
        h = "".join(x * 2 for x in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

    def lin(v):
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    # contrast vs white = 1.05/(lum+.05); vs near-black (#111) about (lum+.05)/0.056
    return "#ffffff" if 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.056 else "#111111"


def pretty_hours(h):
    """'07:30 - 17:30' -> '7:30am – 5:30pm'; anything else is shown as written."""
    parts = [x.strip() for x in str(h or "").split("-")]
    if len(parts) != 2:
        return str(h or "")
    out = []
    for t in parts:
        try:
            hh, mm = (int(x) for x in t.split(":"))
        except ValueError:
            return str(h)
        suffix = "am" if hh < 12 else "pm"
        hh = hh % 12 or 12
        out.append(f"{hh}{':%02d' % mm if mm else ''}{suffix}")
    return " – ".join(out)


def schema_json(c):
    data = {
        "@context": "https://schema.org",
        "@type": c.get("schema_type") or "LocalBusiness",
        "name": c.get("name"),
        "telephone": c.get("phone"),
        "address": {
            "@type": "PostalAddress",
            "streetAddress": c.get("street"),
            "addressLocality": c.get("city"),
            "addressRegion": c.get("state", "AR"),
            "postalCode": c.get("zip"),
            "addressCountry": "US",
        },
        "areaServed": c.get("area"),
        "url": c.get("url"),
    }
    hours = c.get("hours") or []
    spec = []
    for row in hours:
        if len(row) >= 2 and row[1] and str(row[1]).lower() != "closed" and "-" in str(row[1]):
            opens, closes = [x.strip() for x in str(row[1]).split("-", 1)]
            spec.append({"@type": "OpeningHoursSpecification", "dayOfWeek": row[0], "opens": opens, "closes": closes})
    if spec:
        data["openingHoursSpecification"] = spec
    data = {k: v for k, v in data.items() if v}
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def render(c):
    name = c["name"]
    accent = hex_ok(c.get("accent"), "#b4462a")
    ink = hex_ok(c.get("ink"), "#1d1b19")
    paper = hex_ok(c.get("paper"), "#f7f4ee")
    on_accent = contrast_text(accent)
    on_ink = contrast_text(ink)
    tel = digits(c.get("phone"))
    preview = c.get("preview", True)
    address = ", ".join(x for x in [c.get("street"), c.get("city"), c.get("state", "AR")] if x)
    maps = "https://www.google.com/maps/search/?api=1&query=" + html.escape(
        (c.get("map_query") or f"{name} {address}").replace(" ", "+"), quote=True)

    services = "".join(
        f'<li class="svc"><h3>{esc(s.get("name"))}</h3><p>{esc(s.get("desc"))}</p>'
        + (f'<p class="price">{esc(s.get("price"))}</p>' if s.get("price") else "")
        + "</li>"
        for s in c.get("services", [])
    )
    reasons = "".join(
        f'<li><strong>{esc(r.get("title"))}</strong><span>{esc(r.get("text"))}</span></li>'
        for r in c.get("reasons", [])
    )
    reviews = "".join(
        f'<figure class="rev"><blockquote>“{esc(r.get("quote"))}”</blockquote>'
        f'<figcaption>{esc(r.get("who"))}{(" · " + esc(r.get("source"))) if r.get("source") else ""}</figcaption></figure>'
        for r in c.get("reviews", [])
    )
    hours = "".join(
        f"<tr><th scope=\"row\">{esc(d)}</th><td>{esc(pretty_hours(h))}</td></tr>" for d, h in (c.get("hours") or [])
    )
    faq = "".join(
        f"<details><summary>{esc(q.get('q'))}</summary><p>{esc(q.get('a'))}</p></details>"
        for q in c.get("faq", [])
    )
    stats = "".join(
        f'<div class="stat"><b>{esc(s.get("value"))}</b><span>{esc(s.get("label"))}</span></div>'
        for s in c.get("stats", [])
    )
    sample_note = c.get("sample_note")
    bar = ""
    if preview:
        bar = (
            '<div class="pv" role="note">Concept preview made by <b>Sites by TJ</b> for '
            f'{esc(name)}. Not affiliated with or approved by the business. '
            + (esc(sample_note) + " " if sample_note else "")
            + "Removed after 14 days unless the owner asks to keep it.</div>"
        )
    robots = '<meta name="robots" content="noindex,nofollow">' if preview else ""
    title = f"{name} | {c.get('trade', '')} in {c.get('city', 'Bentonville')}, {c.get('state', 'AR')}"
    desc = c.get("meta_description") or c.get("subhead") or ""

    sections = []
    if services:
        sections.append(
            f'<section id="services" class="wrap"><p class="kicker">{esc(c.get("services_kicker", "What we do"))}</p>'
            f'<h2>{esc(c.get("services_title", "Services"))}</h2><ul class="svcs">{services}</ul></section>'
        )
    if reasons:
        sections.append(
            f'<section class="band"><div class="wrap"><h2>{esc(c.get("reasons_title", "Why people come back"))}</h2>'
            f'<ul class="reasons">{reasons}</ul></div></section>'
        )
    if reviews:
        sections.append(
            f'<section id="reviews" class="wrap"><h2>{esc(c.get("reviews_title", "What customers say"))}</h2>'
            f'<div class="revs">{reviews}</div></section>'
        )
    if faq:
        sections.append(f'<section class="wrap faq"><h2>Questions</h2>{faq}</section>')

    about = c.get("about")
    hours_js = json.dumps([[d, pretty_hours(h)] for d, h in (c.get("hours") or [])]).replace("</", "<\\/")
    top3 = "".join(f"<li>{esc(x.get('name'))}</li>" for x in c.get("services", [])[:4])
    aside = ""
    if c.get("hours"):
        aside = (
            '<aside class="today" aria-label="Today"><h2>Today</h2>'
            '<p class="now" id="today">See hours below</p>'
            + (f'<p>{esc(c.get("area"))}</p>' if c.get("area") else "")
            + (f"<ul>{top3}</ul>" if top3 else "")
            + "</aside>"
            f"<script>(function(){{var H={hours_js};var d=new Date().toLocaleDateString('en-US',{{weekday:'short',timeZone:'America/Chicago'}});"
            "for(var i=0;i<H.length;i++){if(H[i][0]===d){var e=document.getElementById('today');"
            "e.textContent=(/closed/i.test(H[i][1])?'Closed today':'Open today '+H[i][1]);}}})();</script>"
        )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
{robots}
<meta name="theme-color" content="{ink}">
<script type="application/ld+json">{schema_json(c)}</script>
<style>
:root{{--accent:{accent};--on-accent:{on_accent};--ink:{ink};--on-ink:{on_ink};--paper:{paper};
--text:#1b1a18;--muted:#5d5852;--line:rgba(0,0,0,.12);--r:14px;
--f:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--d:Georgia,"Iowan Old Style","Times New Roman",serif}}
*{{box-sizing:border-box}}html{{-webkit-text-size-adjust:100%}}
body{{margin:0;font:17px/1.55 var(--f);color:var(--text);background:var(--paper)}}
a{{color:inherit}}img{{max-width:100%;display:block}}
.wrap{{max-width:1080px;margin:0 auto;padding:56px 20px}}
.pv{{background:#222;color:#eee;font-size:13px;line-height:1.4;padding:8px 16px;text-align:center}}
.top{{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1080px;margin:0 auto;padding:14px 20px}}
.logo{{font:700 19px/1.1 var(--d);letter-spacing:.2px;text-decoration:none}}
.top nav a{{margin-left:18px;text-decoration:none;color:var(--muted);font-size:15px}}
.top nav a:hover{{color:var(--text)}}
@media(max-width:700px){{.top nav{{display:none}}}}
.hero{{background:var(--ink);color:var(--on-ink)}}
.hero .wrap{{padding-top:64px;padding-bottom:72px;display:grid;gap:36px;align-items:center}}
.herotext{{display:grid;gap:24px}}
@media(min-width:900px){{.herogrid{{grid-template-columns:1.5fr 1fr}}}}
.today{{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:var(--r);padding:22px}}
.today h2{{font-size:22px;margin:0 0 6px}}.today p{{margin:0 0 4px;opacity:.85}}
.today .now{{font-weight:700;opacity:1}}.today ul{{margin:12px 0 0;padding-left:18px;opacity:.85}}
.kicker{{text-transform:uppercase;letter-spacing:.14em;font-size:12.5px;font-weight:700;color:var(--accent);margin:0 0 10px}}
.hero .kicker{{color:inherit;opacity:.75}}
h1{{font:700 clamp(36px,7vw,64px)/1.03 var(--d);margin:0;max-width:15ch;letter-spacing:-.5px}}
.sub{{font-size:19px;max-width:52ch;opacity:.9;margin:0}}
.ctas{{display:flex;flex-wrap:wrap;gap:12px}}
.btn{{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 22px;border-radius:4px;
font-weight:700;text-decoration:none;border:2px solid transparent;transition:transform .15s ease,background-color .15s ease}}
.btn:active{{transform:scale(.97)}}
.btn.main{{background:var(--accent);color:var(--on-accent)}}
.btn.ghost{{border-color:currentColor}}
.btn:focus-visible,a:focus-visible,summary:focus-visible{{outline:3px solid var(--accent);outline-offset:3px}}
.stats{{display:flex;flex-wrap:wrap;gap:28px;margin-top:6px}}
.stat b{{display:block;font:700 28px/1 var(--d)}}.stat span{{font-size:14px;opacity:.75}}
h2{{font:700 clamp(28px,4.4vw,40px)/1.1 var(--d);margin:0 0 26px;letter-spacing:-.3px}}
.svcs{{list-style:none;margin:0;padding:0;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}}
.svc{{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:20px}}
.svc h3{{margin:0 0 6px;font-size:18px}}.svc p{{margin:0;color:var(--muted);font-size:15.5px}}
.svc .price{{margin-top:10px;color:var(--text);font-weight:700}}
.band{{background:#fff;border-block:1px solid var(--line)}}
.reasons{{list-style:none;margin:0;padding:0;display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}}
.reasons li{{border-left:3px solid var(--accent);padding-left:14px}}
.reasons strong{{display:block;font-size:18px}}.reasons span{{color:var(--muted);font-size:15.5px}}
.revs{{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}}
.rev{{margin:0;background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:22px}}
.rev blockquote{{margin:0 0 12px;font:500 18px/1.45 var(--d)}}.rev figcaption{{color:var(--muted);font-size:14px}}
.faq details{{border-bottom:1px solid var(--line);padding:14px 0}}
.faq summary{{cursor:pointer;font-weight:700;font-size:17px}}.faq p{{color:var(--muted);margin:8px 0 0}}
.visit{{background:var(--ink);color:var(--on-ink)}}
.visit .wrap{{display:grid;gap:32px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}}
.visit table{{border-collapse:collapse;width:100%;max-width:360px}}
.visit th,.visit td{{text-align:left;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.14);font-weight:400}}
.visit th{{width:42%;opacity:.8}}
.visit p{{margin:0 0 10px}}
footer{{font-size:13.5px;color:var(--muted);text-align:center;padding:24px 20px 96px}}
.callbar{{position:fixed;left:12px;right:12px;bottom:12px;display:none;gap:10px;z-index:5}}
.callbar .btn{{flex:1;box-shadow:0 8px 24px rgba(0,0,0,.25)}}
.callbar .ghost{{background:var(--paper);color:var(--text);border-color:var(--paper)}}
@media(max-width:700px){{.callbar{{display:flex}}.wrap{{padding:44px 18px}}}}
@media(prefers-reduced-motion:reduce){{*{{transition:none!important}}}}
</style>
</head>
<body>
{bar}
<header class="top"><a class="logo" href="#">{esc(name)}</a>
<nav aria-label="Sections"><a href="#services">Services</a>{'<a href="#reviews">Reviews</a>' if reviews else ''}<a href="#visit">Hours &amp; location</a></nav></header>
<main>
<section class="hero"><div class="wrap herogrid"><div class="herotext">
<p class="kicker">{esc(c.get("kicker") or (c.get("trade", "") + " · " + c.get("city", "Bentonville") + ", " + c.get("state", "AR")))}</p>
<h1>{esc(c.get("headline") or name)}</h1>
<p class="sub">{esc(c.get("subhead"))}</p>
<div class="ctas">{f'<a class="btn main" href="tel:{tel}">Call {esc(c.get("phone"))}</a>' if tel else ''}
<a class="btn ghost" href="{maps}" rel="noopener">Get directions</a></div>
{f'<div class="stats">{stats}</div>' if stats else ''}
</div>{aside}</div></section>
{''.join(sections)}
{f'<section class="wrap"><h2>{esc(c.get("about_title", "About us"))}</h2><p style="max-width:62ch">{esc(about)}</p></section>' if about else ''}
<section id="visit" class="visit"><div class="wrap">
<div><p class="kicker" style="color:inherit;opacity:.75">Visit</p><h2>Hours &amp; location</h2>
<p>{esc(address)} {esc(c.get("zip", ""))}</p>
{f'<p><a href="tel:{tel}">{esc(c.get("phone"))}</a></p>' if tel else ''}
{f'<p><a href="mailto:{esc(c.get("email"))}">{esc(c.get("email"))}</a></p>' if c.get("email") else ''}
<p><a class="btn main" href="{maps}" rel="noopener">Open in Maps</a></p></div>
{f'<table aria-label="Opening hours"><tbody>{hours}</tbody></table>' if hours else ''}
</div></section>
</main>
<footer>© {esc(c.get("year", "2026"))} {esc(name)} · {esc(c.get("area") or c.get("city", ""))}{' · Site by Sites by TJ' if not preview else ''}</footer>
{f'<div class="callbar"><a class="btn main" href="tel:{tel}">Call now</a><a class="btn ghost" href="{maps}" rel="noopener">Directions</a></div>' if tel else ''}
</body>
</html>
"""


def build(slug):
    src = SHOPS / slug / "content.json"
    c = json.loads(src.read_text())
    c.setdefault("slug", slug)
    out = OUT / slug
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(render(c))
    return c


def main(argv):
    slugs = argv or sorted(p.name for p in SHOPS.iterdir() if (p / "content.json").exists())
    built = [build(s) for s in slugs]
    every = sorted(p.name for p in OUT.iterdir() if (p / "index.html").exists()) if OUT.exists() else []
    links = "".join(f'<li><a href="{esc(s)}/">{esc(s)}</a></li>' for s in every)
    (OUT / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex,nofollow"><title>Sites by TJ previews</title>'
        f'<body style="font:17px system-ui;padding:24px"><h1>Previews</h1><ul>{links}</ul></body>'
    )
    for c in built:
        print(f"built {c['slug']}: {OUT / c['slug'] / 'index.html'}")


if __name__ == "__main__":
    main(sys.argv[1:])
