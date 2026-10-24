#!/usr/bin/env python3
"""Option C trade mockups (plumbing, HVAC, roofing) from a prospect's facts.

Usage: python3 money/sites/trade_build.py content.json out.html
The agency API calls render() and audit() directly (money/agency/api/mockup.py).

Same layout as the golden index.html files (option C, Tj 2026-10-23): emergency bar, white sticky header with their
logo, navy hero with the trade texture, Google stars, a 2-field quick form, overlapping trust panel, 3-step strip,
form band with photo upload, the trade's tool from its KIT.md, the work, FAQ, area, final CTA, sticky call bar.
Only facts we were given go on the page: no invented reviews, years, licenses, prices or "free" anything.
Their logo is linked from their own site, never copied into this repo.
"""
import html
import json
import re
import sys

TRADES = ("plumbing", "hvac", "roofing")
INK = "#18263a"
PHONE_SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
             'stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 '
             '1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/></svg>')

# Hero textures: one per trade, drawn in CSS (no stock photos)
TEXTURE = {
    "hvac": "%3Cpath d='M0 8h40M0 18h40M0 28h40M0 38h40' stroke='%23131f2f' stroke-width='4'/%3E",
    "plumbing": "%3Cpath d='M0 23h40M20 0v46' stroke='%23131f2f' stroke-width='6'/%3E%3Ccircle cx='20' cy='23' r='7' fill='%23131f2f'/%3E",
    "roofing": "%3Cpath d='M0 46L20 8l20 38' stroke='%23131f2f' stroke-width='5' fill='none'/%3E",
}

# Services: the base one is true for any shop in the trade; the rest show only when their own site names them.
SERVICES = {
    "plumbing": [
        (None, "Repairs", "Leaks, clogs, running toilets, faucets and fixtures."),
        (r"water heater", "Water heaters", "Repair and replacement, before the old tank fails."),
        (r"tankless", "Tankless water heaters", "Installs and service for tankless units."),
        (r"drain|clog", "Drain cleaning", "Slow and blocked drains, kitchen to main line."),
        (r"sewer", "Sewer lines", "Sewer line problems found and fixed."),
        (r"gas line", "Gas lines", "Gas line work, done to code."),
        (r"repipe|re-pipe", "Repiping", "Old or failing pipes replaced."),
        (r"remodel", "Remodels", "Kitchen and bath plumbing for remodels."),
        (r"commercial", "Commercial", "Plumbing for businesses as well as homes."),
    ],
    "hvac": [
        (None, "Heating and AC repair", "No heat, no cooling, a system that won't start or ices up."),
        (r"install|replace|new system", "New systems", "Furnaces, air conditioners and heat pumps, installed."),
        (r"maintenance|tune-?up", "Maintenance", "Check-ups before the heating and cooling seasons."),
        (r"heat pump", "Heat pumps", "Heat pump repair and installs."),
        (r"geothermal", "Geothermal", "Geothermal heat pump systems."),
        (r"duct", "Ductwork", "Duct repair, sealing and new runs."),
        (r"indoor air|air quality|humidif|purif", "Indoor air quality", "Filters, humidity and cleaner air at home."),
        (r"refrigeration", "Refrigeration", "Refrigeration work for businesses."),
        (r"commercial", "Commercial", "Heating and cooling for businesses as well as homes."),
    ],
    "roofing": [
        (None, "Roof repair", "Leaks, missing shingles and storm damage fixed."),
        (r"replace|re-roof|new roof", "Roof replacement", "Tear-off and a new roof when repairs stop making sense."),
        (r"inspection", "Inspections", "A straight look at what your roof needs."),
        (r"gutter", "Gutters", "Gutter installs and repairs."),
        (r"siding", "Siding", "Siding repair and replacement."),
        (r"metal", "Metal roofing", "Metal roofs installed."),
        (r"new construction", "New construction", "Roofs for new builds, working with your builder."),
        (r"commercial", "Commercial", "Roofing for businesses as well as homes."),
    ],
}

TRADE = {
    "plumbing": dict(
        word="plumbing", headline="Plumbing repair and installs in {city}.",
        lede="Leaks, clogs, water heaters and fixtures for homes around {city}. Call, or send a request with photos.",
        cta="Request a visit", anchor="now", alert=("Water where it shouldn't be?", "What to do first"),
        jobs=["Leak or burst pipe", "Clogged drain", "Water heater", "Toilet or faucet", "Something else"],
        how=[("Call or send photos", "Tell us what's going on."), ("We come out", "A plumber finds the cause."),
             ("We fix it", "You hear the price before the work starts.")],
        final="Ready to get it fixed?"),
    "hvac": dict(
        word="heating and air", headline="Heating and AC repair in {city}.",
        lede="Repairs, new systems and maintenance for homes around {city}. Call, or book a visit online.",
        cta="Book a visit", anchor="checks", alert=("Furnace or AC out?", "Quick checks first"),
        jobs=["Heating or AC repair", "Maintenance check-up", "New system quote", "Something else"],
        how=[("Call or book", "Tell us what the system is doing."), ("We come out", "A tech finds what's wrong."),
             ("We fix it", "Or quote a new system if it's time.")],
        final="Need heat or AC back?"),
    "roofing": dict(
        word="roofing", headline="Roof repair and replacement in {city}.",
        lede="Repairs, new roofs and storm damage for homes around {city}. Send the job and a few photos for a quote.",
        cta="Get a quote", anchor="storm", alert=("Storm damage?", "What to do first"),
        jobs=["Repair or leak", "New roof", "Storm damage", "Inspection", "Something else"],
        how=[("Send the job", "A few photos from the ground help."), ("We take a look", "On the roof, not from the truck."),
             ("You get a straight quote", "Repair if that's enough, replace if it isn't.")],
        final="Ready to get your roof looked at?"),
}

BANNED = ["elevate", "seamless", "unlock", "unleash", "empower", "cutting-edge", "state-of-the-art",
          "your trusted partner", "look no further", "we pride ourselves", "one-stop shop", "fast-paced world",
          "nestled", "testament", "tailored solutions", "lorem", "todo", "{{", "[your", "example.com", "555-",
          "business name", "city, state", "undefined", "none.", ">none<"]


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def tel_of(phone):
    d = re.sub(r"\D", "", str(phone or ""))
    if len(d) == 10:
        d = "1" + d
    return "+" + d if len(d) == 11 else ""


def pretty_phone(phone):
    d = re.sub(r"\D", "", str(phone or ""))[-10:]
    return f"({d[:3]}) {d[3:6]}-{d[6:]}" if len(d) == 10 else str(phone or "")


def _rgb(hexcolor):
    h = hexcolor.lstrip("#")
    if len(h) == 3:
        h = "".join(x * 2 for x in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _lum(rgb):
    def lin(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((_lum(_rgb(a)), _lum(_rgb(b))), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def valid_hex(c):
    return isinstance(c, str) and re.fullmatch(r"#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}", c.strip() or "") is not None


def accent_from(colors, fallback="#106494"):
    """First usable brand color (not near-white, near-black or grey), darkened until white text passes AA (4.5:1)."""
    for c in colors or []:
        if not valid_hex(c):
            continue
        r, g, b = _rgb(c)
        if max(r, g, b) - min(r, g, b) < 40 or _lum((r, g, b)) > 0.85 or _lum((r, g, b)) < 0.01:
            continue
        while contrast("#%02x%02x%02x" % (r, g, b), "#ffffff") < 4.5:
            r, g, b = int(r * 0.92), int(g * 0.92), int(b * 0.92)
        return "#%02x%02x%02x" % (r, g, b)
    return fallback


def darker(c, f=0.82):
    r, g, b = _rgb(c)
    return "#%02x%02x%02x" % (int(r * f), int(g * f), int(b * f))


def services_for(trade, text):
    low = (text or "").lower()
    return [(t, d) for pat, t, d in SERVICES[trade] if pat is None or re.search(pat, low)][:6]


def tool_html(trade, tel, phone, cta):
    call = f'<a class="btn" href="tel:{tel}">{PHONE_SVG}Call {esc(phone)}</a>' if tel else f'<a class="btn" href="#book">{esc(cta)}</a>'
    gas = ('<p class="alert" role="note"><b>Smell gas?</b>Leave the house now. Don\'t flip switches. '
           'Call 911 or your gas company from outside.</p>')
    if trade == "plumbing":
        return f"""<section id="now"><div class="wrap two"><div>
<h2>Water where it shouldn't be? Do this first</h2><ol class="steps">
<li><div><b>Shut off the water</b><p>The main shut-off is usually where the water line comes into the house: a garage, crawlspace, utility room or next to the water heater. Turn the handle clockwise, or turn the lever across the pipe.</p></div></li>
<li><div><b>If it's the water heater</b><p>Close the cold-water valve on top of the tank. Turn off its breaker, or set a gas heater to Pilot.</p></div></li>
<li><div><b>Keep water away from power</b><p>Move cords and keep clear of outlets near the water.</p></div></li>
<li><div><b>Call us</b><p>{f'<a href="tel:{tel}">{esc(phone)}</a>, or ' if tel else ''}<a href="#book">send a request</a> with photos.</p></div></li>
</ol>{gas}</div>
<div class="tool"><h2 class="th">What's going on?</h2><p>Pick the problem for what to try and when to call.</p>
<div class="pick" role="group" aria-label="What is the problem?"><button type="button" data-k="clog">Clogged drain</button><button type="button" data-k="hot">No hot water</button><button type="button" data-k="leak">Leak</button><button type="button" data-k="toilet">Running toilet</button><button type="button" data-k="press">Low pressure</button></div>
<div class="ans">
<div data-a="clog"><ul><li>Try a plunger first.</li><li>Skip chemical drain cleaners. They are hard on pipes.</li><li>More than one drain slow at once points to the main line. Call us.</li></ul></div>
<div data-a="hot"><ul><li>Electric heater: check its breaker.</li><li>Gas heater: check the pilot, following the steps on the tank's label.</li><li>Water around the base, or a tank older than 10 years? Time to talk about a new one.</li></ul></div>
<div data-a="leak"><ul><li>Close the valve under the sink or behind the toilet.</li><li>If you can't find one, shut off the main.</li><li>Put a bucket down and take a photo for us.</li></ul></div>
<div data-a="toilet"><ul><li>Jiggle the handle. A worn flapper is the usual cause.</li><li>Still running? Close the valve behind the toilet until it's fixed.</li></ul></div>
<div data-a="press"><ul><li>One faucet only: unscrew and rinse the aerator at the tip.</li><li>The whole house: call us. It can be a valve, the pressure regulator or a hidden leak.</li></ul></div>
{call}</div></div></div></section>"""
    if trade == "hvac":
        return f"""<section id="checks"><div class="wrap two"><div class="tool">
<h2 class="th">Before you call: quick checks</h2><p>Pick what your system is doing. Some fixes take two minutes.</p>
<div class="pick" role="group" aria-label="What is your system doing?"><button type="button" data-k="heat">No heat</button><button type="button" data-k="cool">AC not cooling</button><button type="button" data-k="air">Weak airflow</button><button type="button" data-k="water">Water by the unit</button><button type="button" data-k="noise">Noise or smell</button></div>
<div class="ans">
<div data-a="heat"><ul><li>Thermostat on <b>Heat</b>, set a few degrees above the room.</li><li>Put fresh batteries in the thermostat.</li><li>Check the furnace breaker, and the switch near the furnace that looks like a light switch.</li><li>Check the filter. A clogged filter can shut a furnace down.</li></ul></div>
<div data-a="cool"><ul><li>Thermostat on <b>Cool</b> and fan on <b>Auto</b>.</li><li>Check both breakers: one for the indoor unit, one for the outdoor unit.</li><li>Change a dirty filter.</li><li>Ice on the copper lines? Turn cooling off, set the fan to <b>On</b> to thaw it, and call us.</li></ul></div>
<div data-a="air"><ul><li>Change the filter first. It is the most common cause.</li><li>Open closed vents and clear anything blocking the return grilles.</li><li>Ice on the lines or a fan that won't spin? Turn the system off and call.</li></ul></div>
<div data-a="water"><ul><li>Turn the system off at the thermostat.</li><li>Wipe up the water and keep it away from cords and outlets.</li><li>A blocked drain line is a common cause. Call and we'll clear it.</li></ul></div>
<div data-a="noise"><ul><li>Grinding, screeching or a burning smell: turn the system off at the thermostat and call.</li><li>Don't keep running it. Small problems get expensive fast.</li></ul>{gas}</div>
{call}</div></div>
<div><h2>Have this ready when you call</h2><ol class="steps plain">
<li><div><b>What it is doing</b><p>No heat, no cooling, a noise, water. And when it started.</p></div></li>
<li><div><b>The brand and age</b><p>It's on the sticker on the indoor or outdoor unit. A phone photo works.</p></div></li>
<li><div><b>Any blinking lights or codes</b><p>Many furnaces show a code through a small window on the panel.</p></div></li>
<li><div><b>Your filter size</b><p>Printed on the edge of the filter, like 16x25x1.</p></div></li>
</ol></div></div></section>"""
    return f"""<section id="storm"><div class="wrap two"><div class="tool">
<h2 class="th">Repair or replace?</h2><p>A one-minute check. Tick what you see on your roof.</p>
<div class="checks" id="signs"><label><input type="checkbox">The roof is about 20 years old or more</label><label><input type="checkbox">Shingles are curling, cracked or missing in more than one spot</label><label><input type="checkbox">There is shingle grit (granules) in the gutters or at the downspouts</label><label><input type="checkbox">It has leaked in more than one place</label><label><input type="checkbox">The roofline dips or sags</label><label><input type="checkbox">Moss or dark streaks cover big areas</label></div>
<p class="verdict" id="verdict" aria-live="polite">Nothing ticked yet.<small>Tick anything that matches your roof.</small></p>
<a class="btn" id="vbtn" href="#book">Get a quote</a>
<p class="fine">A general guide, not a diagnosis. We'll tell you what we see when we're on your roof.</p></div>
<div><h2>After a hail or wind storm</h2><ol class="steps">
<li><div><b>Stay off the roof</b><p>Look from the ground. Take photos of missing shingles, dents in gutters and vents, and any water inside.</p></div></li>
<li><div><b>Stop the water inside</b><p>Move what you can, put a bucket down. If water is coming through a light fixture, turn off that breaker.</p></div></li>
<li><div><b>Call us for a look</b><p>{f'<a href="tel:{tel}">{esc(phone)}</a>, or ' if tel else ''}<a href="#book">send the job</a> with your photos.</p></div></li>
<li><div><b>Call your insurance company soon</b><p>Many policies set a time limit for storm claims. Your photos help.</p></div></li>
</ol></div></div></section>"""


# Front Desk: the after-hours AI receptionist sold with every site (Tj, 2026-10-23). Mirrors money/agency/api/billing.py
# and receptionist.py; test_trade_build.py checks the prices match billing.
PLANS = {"setup": 299, "front_desk": (149, 300), "plus": (249, 800), "over": "0.25"}
# What the assistant tells callers in danger: the same rules receptionist.py gives it, in customer words
CALLER_SAFETY = {
    "plumbing": "<b>Water pouring in?</b> Shut off the main water valve first. <b>Smell gas?</b> Leave the house and "
                "call 911 or the gas company from outside.",
    "hvac": "<b>Smell gas, or a carbon monoxide alarm going off?</b> Leave the house now and call 911 or the gas "
            "company from outside.",
    "roofing": "<b>Water coming through a ceiling?</b> Move your things and stay out from under any sagging spot. "
               "Don't climb onto the roof.",
}
# One example call per trade for the owner panel, written by us and labeled as an example
SAMPLE_CALL = {
    "plumbing": ("There's water coming up around the water heater in the garage.", "It's not spreading. It can wait till morning if someone comes early.",
                 "If it starts pouring, shut off the main water valve.", "Water around the water heater, garage floor. Not spreading."),
    "hvac": ("Our furnace quit and the house is down to 58.", "We have space heaters. Morning is fine.",
             "If you smell gas, leave the house and call 911 from outside.", "Furnace not running, house at 58. Space heaters on."),
    "roofing": ("The storm took some shingles and there's a drip in the upstairs bedroom.", "I've got a bucket under it. It can wait till morning.",
                "Keep the bucket there and stay off the roof.", "Storm damage, missing shingles, slow drip upstairs."),
}


def after_hours_html(trade, short, tel, phone, open_247=False, preview=True):
    """Customer side: every call gets answered. Honest that it's an automated assistant."""
    if open_247:
        lead = (f"Every call gets answered. If the crew is out on a job and can't pick up, our answering assistant "
                f"takes your details and {esc(short)} calls you back.")
    else:
        lead = (f"Call anyway. When the office is closed, our answering assistant picks up, takes your details, and "
                f"{esc(short)} calls you back.")
    call = f'<a class="btn" href="tel:{tel}">{PHONE_SVG}Call {esc(phone)}</a>' if tel else ""
    note = '<p class="fdnote">Preview only. The answering line is not connected yet.</p>' if preview else ""
    return f"""<section id="after-hours" class="fd"><div class="wrap two"><div>
<h2>Calling after hours?</h2><p>{lead}</p>
<p class="fdsafe" role="note">{CALLER_SAFETY[trade]}</p></div>
<div><ol class="fdlist"><li><b>Say what's wrong</b><span>In your own words.</span></li><li><b>Give your name, number and address</b><span>It reads your number back to be sure.</span></li><li><b>Get a call back</b><span>From the team. If you ask, it will tell you it's an automated assistant.</span></li></ol>
{call}{note}</div></div></section>"""


def owner_html(trade, name, short, city):
    """Owner side, preview only: what the site comes with (Front Desk) and the prices Tj approved."""
    ask, wait, safe, log = SAMPLE_CALL[trade]
    fd, plus = PLANS["front_desk"], PLANS["plus"]
    rows = [("This site, rebuilt and hosted", "Yes", "Yes"), ("Your calls answered", "After hours", "Day and night"),
            ("Minutes a month", str(fd[1]), str(plus[1])), ("Text back when a caller hangs up", "Yes", "Yes"),
            ("Calendar booking and review requests", "No", "Yes")]
    body = "".join(f"<tr><th scope=\"row\">{a}</th><td>{b}</td><td>{c}</td></tr>" for a, b, c in rows)
    return f"""<section id="owner" class="owner" aria-labelledby="owh"><div class="wrap">
<p class="okick">For {esc(short)} only. This part comes off when the site goes live.</p>
<h2 id="owh">Never miss the call that comes in after you close</h2>
<p class="olede">This site comes with Front Desk: an AI receptionist that answers your line when you can't, takes the job details and hands them to you. You keep your number and forward it only when you want to.</p>
<div class="two"><div><h3>An after-hours call</h3>
<dl class="ocall"><dt>Assistant</dt><dd>Thanks for calling {esc(name)}. This is the after-hours assistant, and this call may be recorded. What's going on?</dd>
<dt>Caller</dt><dd>{esc(ask)}</dd><dt>Assistant</dt><dd>Sorry to hear it. Can I get your name and the best number to call you back?</dd>
<dt>Caller</dt><dd>Dana. Same number I'm calling from.</dd><dt>Assistant</dt><dd>Thanks, Dana. What's the address or town, and can it wait until morning?</dd>
<dt>Caller</dt><dd>{esc(city)}. {esc(wait)}</dd><dt>Assistant</dt><dd>Got it. {esc(safe)} Someone from {esc(short)} will call you back first thing.</dd></dl>
<div class="olog"><b>What you get next morning</b><span>Dana, {esc(city)}, 11:42 pm, 2 min</span><span>{esc(log)}</span><span>Emergency: no. Call back: first thing.</span></div>
<p class="ofine">An example we wrote to show how it works. Not a real call. It never quotes prices, diagnoses or promises a time.</p></div>
<div><h3>Two plans</h3><table class="oplans"><thead><tr><td></td><th scope="col">Front Desk</th><th scope="col">Front Desk Plus</th></tr></thead>
<tbody><tr class="oprice"><th scope="row">A month</th><td>${fd[0]}</td><td>${plus[0]}</td></tr>{body}</tbody></table>
<p class="ofine">${PLANS['setup']} setup, once. Over your minutes: ${PLANS['over']} a minute. Pay for the year and get 12 months for the price of 10. Questions? Reply to the email this came with.</p></div></div>
</div></section>"""


# Shared by trade_build pages and the golden sites. Works with either palette (--acc/--ink here, --cedar/--slate there).
FD_CSS = """.pv a{color:#fff;font-weight:600}
.fd,.owner{--fa:var(--acc,var(--cedar));--fi:var(--ink,var(--slate));--fl:var(--line,#d4dae2)}
.fd{background:#fff;border-top:1px solid var(--fl);border-bottom:1px solid var(--fl)}
.fd p{max-width:52ch}.fdsafe{border-left:4px solid var(--fa);background:#f6f7f9;padding:12px 14px;margin:18px 0 0}
.fdlist{list-style:none;margin:0 0 20px;padding:0;border-top:1px solid var(--fl)}
.fdlist li{display:grid;gap:2px;padding:14px 0;border-bottom:1px solid var(--fl)}.fdlist b{font-size:18px}.fdlist span{color:#4a5668}
.fdnote,.ofine{font-size:15px;color:#4a5668;margin:12px 0 0}
.owner{background:#e9edf1;border-top:6px solid var(--fi);color:#1d232b}
.owner h3{font-size:22px;margin:28px 0 12px}
.okick{font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4a5668;margin:0 0 10px}
.olede{max-width:60ch;font-size:18px}
.ocall{margin:0;display:grid;grid-template-columns:96px 1fr;gap:10px 14px;border-top:1px solid #cfd6de;padding-top:14px}
.ocall dt{font-weight:700;font-size:15px;color:#4a5668}.ocall dd{margin:0}
.olog{display:grid;gap:4px;background:#fff;border:1px solid #cfd6de;border-left:4px solid var(--fa);border-radius:6px;padding:14px 16px;margin-top:18px}
.oplans{width:100%;border-collapse:collapse;background:#fff;border:1px solid #cfd6de;border-radius:6px}
.oplans th,.oplans td{padding:12px;text-align:left;border-bottom:1px solid #e1e6ec;font-size:16px;vertical-align:top}
.oplans thead th{font-size:17px}.oplans tbody th{font-weight:600;color:#3a4250}
.oprice td{font-size:28px;font-weight:800;color:var(--fi)}"""


CSS = """@font-face{font-family:"Libre Franklin";font-weight:100 900;font-display:swap;src:url(%(font)s) format("woff2")}
:root{--ink:%(ink)s;--ink2:#4a5668;--paper:#eef1f4;--line:#d4dae2;--acc:%(acc)s;--acc2:%(acc2)s}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 "Libre Franklin",system-ui,sans-serif;padding-bottom:84px}
a{color:var(--acc);text-underline-offset:3px}
:focus-visible{outline:3px solid var(--acc);outline-offset:3px}
h1,h2,h3{font-weight:800;line-height:1.05;letter-spacing:-.025em;margin:0;text-wrap:balance}
h2{font-size:clamp(30px,7.5vw,46px);margin-bottom:16px}.th{font-size:clamp(28px,7vw,38px)}
.wrap{max-width:1100px;margin:0 auto;padding-left:20px;padding-right:20px}
section{padding:56px 0}
.pv{background:#111a27;color:#e6eae8;font-size:14px;line-height:1.4;padding:9px 20px}.pv b{font-weight:700}
.alertbar{display:block;background:var(--acc);color:#fff;text-align:center;font-size:15px;padding:9px 16px;text-decoration:none;line-height:1.35}
.alertbar b{font-weight:800}
.top{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:6}
.topin{display:flex;align-items:center;gap:10px;min-height:68px}
.mark{display:flex;align-items:center;min-height:48px;text-decoration:none;color:var(--ink)}
.mark img{height:44px;width:auto;max-width:170px;object-fit:contain}
.tmark{font:800 20px/1.05 "Libre Franklin",sans-serif;letter-spacing:-.02em;max-width:15ch}
.tmark small{display:block;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);margin-top:3px;max-width:none}
.nav{display:none}
.hcall{display:inline-flex;align-items:center;gap:6px;min-height:48px;margin-left:auto;color:var(--ink);font-weight:700;text-decoration:none;white-space:nowrap;font-size:16px}
.hcall svg{width:20px;height:20px;color:var(--acc)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 22px;border:0;border-radius:4px;background:var(--acc);color:#fff;font:700 18px/1 "Libre Franklin",sans-serif;text-decoration:none;cursor:pointer;transition:background .2s}
.btn:hover{background:var(--acc2)}.btn svg{width:20px;height:20px;flex:none}
.btn.line{background:transparent;border:2px solid #fff;color:#fff}.btn.line:hover{background:#ffffff1a}
.top .btn{display:none;min-height:48px;font-size:16px}
.hero{background:var(--ink);color:#fff;position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;left:0;right:0;bottom:0;height:46px;background:url("data:image/svg+xml,%%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='46'%%3E%%3Cpath d='M0 0h40v46H0z' fill='%%231f2f45'/%%3E%(tex)s%%3C/svg%%3E") repeat-x;opacity:.9}
.hcopy{position:relative;z-index:1;padding-top:40px;padding-bottom:120px}
.hcopy h1{font-size:clamp(38px,10vw,64px);max-width:14ch}
.lede{font-size:19px;color:#d3d9e3;max-width:38ch;margin:16px 0 0}
.stars{margin:16px 0 0;font-size:16px;color:#e3e8f2}.stars span{color:#ffc93c;letter-spacing:2px;font-size:18px}.stars b{color:#fff;font-size:18px}
.hbtns{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.facts{display:flex;flex-wrap:wrap;gap:6px 18px;margin:18px 0 0;font-size:15.5px;color:#d3d9e3}.facts b{color:#fff}
.mini{display:none}
.trust{position:relative;z-index:2;margin-top:-56px;background:#fff;border-radius:8px;padding:24px 20px;box-shadow:0 20px 40px -24px #00000055}
.trust h2{font-size:clamp(24px,6vw,34px)}
.trust ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px}
.trust li{background:var(--ink);color:#dfe5f1;border-radius:6px;padding:14px;border-top:5px solid var(--acc)}
.trust b{display:block;color:#fff;font-size:17px;margin-bottom:2px}.trust span{font-size:14.5px}
.how{padding:30px 0 0}.how ol{list-style:none;margin:0;padding:0;display:grid;gap:14px;counter-reset:h}
.how li{counter-increment:h;display:grid;grid-template-columns:36px 1fr;gap:12px;align-items:start}
.how li::before{content:counter(h);width:32px;height:32px;border:2px solid var(--acc);color:var(--acc);display:grid;place-items:center;font-weight:800;border-radius:4px}
.how b{display:block;font-size:17px}.how span{color:var(--ink2);font-size:15.5px}
.qband{background:var(--ink);color:#e3e8f2;margin-top:56px}.qband h2{color:#fff}.qband a{color:#fff}
.qgrid{display:grid;gap:24px}.lede2{max-width:40ch;color:#d3daea}
.quote{background:#fff;color:var(--ink);border-radius:8px;padding:22px 20px}
form{display:grid;gap:12px}
label{display:grid;gap:5px;font-weight:600;font-size:16px}
input,select,textarea{font:inherit;font-size:17px;color:var(--ink);background:#fff;border:1.5px solid #8b8f93;border-radius:4px;padding:11px 13px;min-height:50px;width:100%%}
input[type=file]{padding:10px;font-size:15px}
input:focus,select:focus,textarea:focus{border-color:var(--acc);outline:3px solid #0000001f;outline-offset:0}
.formnote{font-size:14.5px;background:#f3f5f8;border:1px solid var(--line);border-radius:4px;padding:9px 12px;margin:0}
.two{display:grid;gap:32px}
.tool{background:#fff;border:1px solid var(--line);border-radius:8px;padding:22px 20px}
.tool>p{margin:0 0 12px;color:var(--ink2)}
.pick{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 14px}
.pick button{min-height:48px;padding:0 16px;border-radius:4px;border:1.5px solid var(--ink);background:transparent;color:var(--ink);font:600 16px "Libre Franklin",sans-serif;cursor:pointer}
.pick button[aria-pressed="true"]{background:var(--ink);color:#fff}
.ans ul{margin:0;padding-left:20px}.ans li{margin:6px 0}.ans .btn{margin-top:14px}
.checks{display:grid}
.checks label{display:flex;gap:12px;align-items:flex-start;font-weight:500;min-height:48px;padding:12px 0;border-bottom:1px solid var(--line);cursor:pointer}
.checks input{width:24px;height:24px;min-height:0;padding:0;margin:1px 0 0;accent-color:var(--acc);flex:none}
.verdict{margin:16px 0 14px;padding:14px 16px;border-radius:6px;background:var(--paper);font-weight:600;font-size:18px}
.verdict small{display:block;font-weight:400;font-size:15px;color:var(--ink2);margin-top:4px}
.fine{font-size:14.5px;color:var(--ink2);margin:12px 0 0}
.alert{background:#fff4e2;border:1px solid #e9c07a;color:#3d2a06;border-radius:6px;padding:14px 16px;margin:16px 0 0}.alert b{display:block}
.steps{counter-reset:s;list-style:none;padding:0;margin:0;border-top:1.5px solid var(--ink)}
.steps li{counter-increment:s;display:grid;grid-template-columns:40px 1fr;gap:12px;padding:16px 0;border-bottom:1px solid var(--line)}
.steps li::before{content:counter(s);width:34px;height:34px;border-radius:4px;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:800}
.steps b{display:block;font-size:18px}.steps p{margin:2px 0 0;color:var(--ink2)}
.steps.plain li{grid-template-columns:1fr}.steps.plain li::before{display:none}
.svc{margin:0;padding:0;list-style:none;display:grid;gap:12px}
.svc li{background:#fff;border:1px solid var(--line);border-left:5px solid var(--acc);border-radius:6px;padding:18px}
.svc h3{font-size:22px;margin-bottom:4px}.svc p{margin:0;color:var(--ink2)}
.faq details{border-bottom:1px solid var(--line)}.faq details:first-child{border-top:1.5px solid var(--ink)}
.faq summary{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:16px;font-weight:700;font-size:18px;cursor:pointer;list-style:none;padding:8px 0}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font-size:26px;font-weight:400;color:var(--acc);flex:none}
.faq details[open] summary::after{content:"\\2212"}
.faq details p{margin:0 0 18px;max-width:62ch;color:var(--ink2)}
.alt{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.towns{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none}
.towns li{background:#e0e5ea;border-radius:4px;padding:6px 12px;font-weight:600;font-size:15.5px}
.towns li:first-child{background:var(--ink);color:#fff}
.final{background:var(--acc);color:#fff;text-align:center}.final h2{color:#fff}
.final p{margin:0 auto;max-width:46ch}.final .hbtns{justify-content:center}
.final .btn{background:#fff;color:var(--ink)}.final .btn.line{background:transparent;color:#fff}
.visit dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:10px 18px}.visit dt{font-weight:700}.visit dd{margin:0}
.ft{background:var(--ink);color:#d8dce3;padding:36px 0 30px;font-size:15.5px}.ft a{color:#fff}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:5;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--ink);border-top:1px solid #ffffff22}
.bar .btn{min-height:54px;font-size:17px;padding:0 10px}.bar .line{border-color:#ffffff88}
@media (min-width:820px){
 body{padding-bottom:0}.bar{display:none}
 .nav{display:flex;gap:4px;margin-left:auto}
 .nav a{display:inline-flex;align-items:center;min-height:48px;padding:0 12px;color:var(--ink);text-decoration:none;font-weight:600;font-size:15.5px;border-radius:4px}
 .nav a:hover{background:var(--paper)}
 .hcall{margin-left:0;padding:0 8px}.top .btn{display:inline-flex}
 .hcopy{display:grid;grid-template-columns:1.2fr 380px;gap:48px;align-items:center;padding-top:72px;padding-bottom:150px}
 .hcopy h1{max-width:16ch}
 .mini{display:grid;gap:10px;background:#fff;color:var(--ink);padding:22px;border-radius:8px;box-shadow:0 18px 40px -22px #000a}
 .mini>b{font-size:24px;font-weight:800}.mini>span{color:var(--ink2);font-size:15px;margin-top:-6px}
 .trust{padding:30px}.trust ul{grid-template-columns:repeat(4,1fr)}
 .how ol{grid-template-columns:repeat(3,1fr);gap:28px}
 .qgrid{grid-template-columns:1fr 1.1fr;align-items:center;gap:56px}
 .two{grid-template-columns:1fr 1fr;gap:48px;align-items:start}
 .svc{grid-template-columns:1fr 1fr}
 .split{display:grid;grid-template-columns:1fr 1.3fr;gap:56px}
 .visit{display:grid;grid-template-columns:1fr 1fr;gap:22px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}"""

JS = """<script>
(function(){var p=document.querySelector(".pick");if(!p)return;var b=p.querySelectorAll("button"),a=document.querySelectorAll(".ans [data-a]");
function show(k){b.forEach(function(x){x.setAttribute("aria-pressed",x.dataset.k===k?"true":"false")});a.forEach(function(x){x.hidden=x.dataset.a!==k})}
b.forEach(function(x){x.addEventListener("click",function(){show(x.dataset.k)})});show(b[0].dataset.k)})();
(function(){var b=document.querySelectorAll("#signs input"),v=document.getElementById("verdict"),k=document.getElementById("vbtn");if(!v)return;
var R=[["Nothing ticked yet.","Tick anything that matches your roof.","Get a quote"],["One sign usually means a repair.","Ask for a repair quote and we'll take a look.","Get a repair quote"],["A few signs. Get an inspection.","You'll know whether to repair now or plan a new roof.","Book an inspection"],["Several signs point to a new roof.","Ask for a replacement quote.","Get a replacement quote"]];
function u(){var n=0;b.forEach(function(x){if(x.checked)n++});var r=n==0?R[0]:n==1?R[1]:n<4?R[2]:R[3];v.innerHTML=r[0]+"<small>"+r[1]+"</small>";k.textContent=r[2]}
b.forEach(function(x){x.addEventListener("change",u)})})();
(function(){document.querySelectorAll("select[name=day]").forEach(function(s){var n=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],d=new Date();
for(var k=1;k<=6;k++){var t=new Date(d.getFullYear(),d.getMonth(),d.getDate()+k),o=document.createElement("option");o.textContent=n[t.getDay()]+", "+m[t.getMonth()]+" "+t.getDate();s.appendChild(o)}})})();
</script>"""


def render(c):
    """c: name, trade, city, phone, email, website, rating, review_count, logo_url, colors, open_247, licensed,
    since, site_text (their own words, for services), towns, font_url, preview (default True),
    front_desk (default True: the after-hours receptionist section, plus the owner panel on previews)."""
    trade = c["trade"]
    if trade not in TRADES:
        raise ValueError(f"trades only: {trade}")
    t = TRADE[trade]
    name = c["name"].strip()
    city = (c.get("city") or "Northwest Arkansas").strip()
    phone = pretty_phone(c.get("phone"))
    tel = tel_of(c.get("phone"))
    acc = accent_from(c.get("colors"))
    cta = t["cta"]
    rating = c.get("rating")
    reviews = c.get("review_count")
    since = c.get("since")
    services = services_for(trade, c.get("site_text"))
    towns = [x for x in (c.get("towns") or []) if x] or [city]
    if city in towns:
        towns = [city] + [x for x in towns if x != city]
    logo = c.get("logo_url") if str(c.get("logo_url") or "").startswith("https://") else ""

    short, _, rest = name.partition(",") if len(name) > 22 else (name, "", "")
    short = short.strip() or name
    mark = (f'<img src="{esc(logo)}" alt="{esc(name)}" referrerpolicy="no-referrer">' if logo
            else f'<span class="tmark">{esc(short)}{f"<small>{esc(rest.strip())}</small>" if rest.strip() else ""}</span>')
    call_icon = f'<a class="hcall" href="tel:{tel}" aria-label="Call {esc(phone)}">{PHONE_SVG}<span>{esc(phone)}</span></a>' if tel else ""
    if c.get("open_247") and tel:
        alert = f'<a class="alertbar" href="tel:{tel}"><b>{esc(t["alert"][0])}</b> 24/7 service. Tap to call {esc(phone)}</a>'
    else:
        alert = f'<a class="alertbar" href="#{t["anchor"]}"><b>{esc(t["alert"][0])}</b> {esc(t["alert"][1])}</a>'
    stars = ""
    if rating:
        count = f" from {int(reviews)} reviews" if reviews else ""
        stars = f'<p class="stars"><span aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <b>{float(rating):.1f}</b> on Google{count}</p>'
    facts = []
    if c.get("open_247"):
        facts.append("<span><b>24/7</b> service</span>")
    if c.get("licensed"):
        facts.append("<span><b>Licensed</b> and insured</span>")
    if since:
        facts.append(f"<span><b>Since {int(since)}</b></span>")

    trust = []
    if rating:
        trust.append((f"{float(rating):.1f} stars on Google", f"From {int(reviews)} reviews." if reviews else "Rated by customers."))
    trust.append((f"Based in {city}", "Local, not a call center."))
    if c.get("open_247"):
        trust.append(("24/7 service", "Day or night."))
    if c.get("licensed"):
        trust.append(("Licensed and insured", "As listed on their own site."))
    if since:
        trust.append((f"Since {int(since)}", f"Working in {city} and nearby towns."))
    trust.append(("Photos welcome", "Send pictures with your request so the first visit counts."))
    if tel:
        trust.append(("Talk to a person", f"Call {phone}."))
    trust = trust[:4]

    jobs = "".join(f"<option>{esc(j)}</option>" for j in t["jobs"])
    svc = "".join(f"<li><h3>{esc(a)}</h3><p>{esc(b)}</p></li>" for a, b in services)
    faq = [("Which towns do you cover?", f"{', '.join(towns[:-1]) + ' and ' + towns[-1] if len(towns) > 1 else towns[0]}. Not on the list? Call and ask."),
           ("How do I get a visit or a quote?",
            f"Call{' ' + phone if tel else ''}, or use the form on this page. Photos help us bring the right parts.")]
    if c.get("open_247"):
        faq.insert(0, ("Are you really open 24/7?", "Yes. Call any time" + (f": {phone}." if tel else ".")))
    if c.get("licensed"):
        faq.append(("Are you licensed and insured?", "Yes, licensed and insured."))
    faq_html = "".join(f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in faq)
    faq_ld = json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}).replace("</", "<\\/")
    biz_type = {"plumbing": "Plumber", "hvac": "HVACBusiness", "roofing": "RoofingContractor"}[trade]
    ld = {"@context": "https://schema.org", "@type": biz_type, "name": name, "telephone": tel or None,
          "url": c.get("website") or None, "areaServed": towns,
          "address": {"@type": "PostalAddress", "addressLocality": city, "addressRegion": "AR", "addressCountry": "US"}}
    ld = json.dumps({k: v for k, v in ld.items() if v}).replace("</", "<\\/")
    source = esc(c.get("source_note") or "their website and Google profile")
    pv = (f'<div class="pv"><b>Concept preview</b> made by Sites by TJ for {esc(name)}. Not the official site. '
          f'Facts come from {source}. <a href="#owner">What it comes with</a></div>') if c.get("preview", True) else ""
    robots = '<meta name="robots" content="noindex,nofollow">' if c.get("preview", True) else ""
    call_btn = f'<a class="btn" href="tel:{tel}">{PHONE_SVG}Call {esc(phone)}</a>' if tel else ""
    css = CSS % {"font": esc(c.get("font_url") or "libre-franklin-latin-wght-normal.woff2"), "ink": INK, "acc": acc,
                 "acc2": darker(acc), "tex": TEXTURE[trade]}
    contact = []
    if tel:
        contact.append(f'<dt>Phone</dt><dd><a href="tel:{tel}">{esc(phone)}</a></dd>')
    if c.get("email"):
        contact.append(f'<dt>Email</dt><dd><a href="mailto:{esc(c["email"])}">{esc(c["email"])}</a></dd>')
    contact.append(f"<dt>Based in</dt><dd>{esc(city)}, Arkansas</dd>")
    if c.get("open_247"):
        contact.append("<dt>Hours</dt><dd>24/7 service</dd>")
    title = f"{name} | {t['headline'].format(city=city).rstrip('.')}, AR"
    lede = t["lede"].format(city=city)
    if since:
        lede += f" Serving the area since {int(since)}."

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(lede)}">
{robots}
<meta name="theme-color" content="#ffffff">
<link rel="preload" href="{esc(c.get('font_url') or 'libre-franklin-latin-wght-normal.woff2')}" as="font" type="font/woff2" crossorigin>
<style>
{css}
{FD_CSS}
</style>
<script type="application/ld+json">{ld}</script>
<script type="application/ld+json">{faq_ld}</script>
</head>
<body>
{pv}
{alert}
<header class="top"><div class="wrap topin">
 <a class="mark" href="#top">{mark}</a>
 <nav class="nav" aria-label="Sections"><a href="#{t['anchor']}">{'Quick checks' if trade == 'hvac' else 'What to do first'}</a><a href="#services">The work</a><a href="#area">Area</a></nav>
 {call_icon}
 <a class="btn" href="#book">{esc(cta)}</a>
</div></header>
<div class="hero" id="top"><div class="wrap hcopy"><div>
 <h1>{esc(t['headline'].format(city=city))}</h1>
 <p class="lede">{esc(lede)}</p>
 {stars}
 <div class="hbtns">{call_btn}<a class="btn line" href="#book">{esc(cta)}</a></div>
 {f'<p class="facts">{"".join(facts)}</p>' if facts else ''}
</div>
<form class="mini" action="#book" onsubmit="event.preventDefault();document.querySelector('#book input[name=name]').value=this.n.value;document.querySelector('#book input[name=phone]').value=this.p.value;document.querySelector('#book').scrollIntoView({{behavior:'smooth'}})">
 <b>{esc(cta)}</b><span>We call you back to set a time.</span>
 <label>Name<input name="n" autocomplete="name" required></label>
 <label>Phone<input name="p" type="tel" autocomplete="tel" required></label>
 <button class="btn" type="submit">Next: the details</button>
</form></div></div>
<div class="wrap"><div class="trust" aria-labelledby="trh">
 <h2 id="trh">Why {esc(city)} calls {esc(short)}</h2>
 <ul>{''.join(f'<li><b>{esc(a)}</b><span>{esc(b)}</span></li>' for a, b in trust)}</ul>
</div></div>
<main>
<div class="how" aria-label="What happens next"><div class="wrap"><ol>{''.join(f'<li><div><b>{esc(a)}</b><span>{esc(b)}</span></div></li>' for a, b in t['how'])}</ol></div></div>
<section class="qband"><div class="wrap qgrid"><div><h2>{esc(cta)}</h2><p class="lede2">Tell us what's going on and we'll call you back.</p>{f'<p class="lede2"><b>Need us now?</b> Call <a href="tel:{tel}">{esc(phone)}</a>.</p>' if tel else ''}</div>
 <div class="quote" id="book">
  <form onsubmit="event.preventDefault();this.querySelector('.formnote').textContent='Preview only: this form is not connected yet.{(' Please call ' + esc(phone) + '.') if tel else ''}'">
   <p class="formnote">Preview only. This form is not connected yet.</p>
   <label>Name<input name="name" autocomplete="name" required></label>
   <label>Phone<input name="phone" type="tel" autocomplete="tel" required></label>
   <label>What do you need?<select name="job">{jobs}</select></label>
   <label>Town (optional)<input name="town" autocomplete="address-level2"></label>
   <label>Day (optional)<select name="day"><option>As soon as possible</option></select></label>
   <label>Photos (optional)<input name="photos" type="file" accept="image/*" multiple></label>
   <button class="btn" type="submit">Request a call back</button>
  </form>
 </div>
</div></section>
{tool_html(trade, tel, phone, cta)}
<section id="services" class="alt"><div class="wrap split">
 <div><h2>The work</h2><p>{esc(t['word'].capitalize())} for homes around {esc(city)}.</p></div>
 <ul class="svc">{svc}</ul>
</div></section>
<section id="faq"><div class="wrap split"><div><h2>Questions</h2><p>Ask anything else when you call.</p></div><div class="faq">{faq_html}</div></div></section>
<section id="area" class="alt"><div class="wrap"><h2>Where we work</h2><ul class="towns">{''.join(f'<li>{esc(x)}</li>' for x in towns)}</ul></div></section>
{after_hours_html(trade, short, tel, phone, c.get('open_247'), c.get('preview', True)) if c.get('front_desk', True) else ''}
<section class="final"><div class="wrap"><h2>{esc(t['final'])}</h2><p>Call or send a few details.</p><div class="hbtns"><a class="btn" href="#book">{esc(cta)}</a>{f'<a class="btn line" href="tel:{tel}">Call {esc(phone)}</a>' if tel else ''}</div></div></section>
<section id="visit"><div class="wrap visit"><div><h2>Get in touch</h2><dl>{''.join(contact)}</dl></div><div>{call_btn}</div></div></section>
{owner_html(trade, name, short, city) if c.get('preview', True) and c.get('front_desk', True) else ''}
</main>
<div class="ft"><div class="wrap">{esc(name)} · {esc(city)}, AR{f' · <a href="tel:{tel}">{esc(phone)}</a>' if tel else ''}</div></div>
<div class="bar">{f'<a class="btn" href="tel:{tel}">{PHONE_SVG}Call</a>' if tel else ''}<a class="btn line" href="#book">{esc(cta)}</a></div>
{JS}
</body>
</html>
"""


def audit(page, c=None):
    """Site bar checks a script can do on the HTML. Empty list = pass."""
    problems = []
    low = page.lower()
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", low, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    for w in BANNED:
        if w in text:
            problems.append(f"banned or placeholder text: {w!r}")
    for r in re.findall(r"border-radius:\s*(\d+)px", low):
        if int(r) > 8:
            problems.append(f"rounded corner {r}px (max 8, buttons 4)")
    for sel, r in re.findall(r"\.(btn|pick button)[^{]*\{[^}]*border-radius:(\d+)px", low):
        if int(r) != 4:
            problems.append(f".{sel} radius {r}px, buttons are 4px")
    if "999px" in low or "border-radius:50%" in low:
        problems.append("pill or circle shapes")
    if "background-clip:text" in low or re.search(r"(purple|indigo|violet|#8b5cf6|#6366f1)", low):
        problems.append("gradient text or purple")
    if re.search(r"font-family:[^;]*(inter|poppins|montserrat)", low):
        problems.append("default AI font")
    if "!" in text.replace("<!doctype", ""):
        problems.append("exclamation mark in copy")
    if 'name="viewport"' not in low:
        problems.append("no viewport tag")
    if c is not None:
        if c.get("phone") and 'href="tel:' not in low:
            problems.append("no tap-to-call")
        if c.get("preview", True) and "noindex" not in low:
            problems.append("preview is indexable")
        if c["name"].lower() not in html.unescape(text):
            problems.append("business name missing")
    return problems


if __name__ == "__main__":
    content = json.loads(open(sys.argv[1]).read())
    page = render(content)
    bad = audit(page, content)
    open(sys.argv[2], "w").write(page)
    print("\n".join(bad) or "audit ok")
    sys.exit(1 if bad else 0)
