"""Offline test of the Auditor script: what must pass passes, what must fail fails."""
import importlib.util, json, pathlib, subprocess, sys, tempfile

HERE = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("audit", HERE / "sites" / "audit.py")
audit = importlib.util.module_from_spec(spec); spec.loader.exec_module(audit)

GOOD = """<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width">
<meta name="robots" content="noindex,nofollow"><style>.h{background:#123}</style></head><body>
<div class="pv">Concept preview made by Sites by TJ</div>
<h1>Same-day AC repair in Rogers and Bentonville</h1><h2>What we fix</h2><h2>Hours</h2>
<p>Call before 10 and we're usually there by lunch. Licensed in Arkansas.</p>
<a href="tel:+14795550100">Call (479) 273-0100</a></body></html>"""

def page(**swap):
    s = GOOD
    for a, b in swap.items():
        s = s.replace(a.replace("_", " "), b)
    return s

assert audit.audit_page(GOOD) == [], audit.audit_page(GOOD)

def fails(p, want):
    got = audit.audit_page(p)
    assert any(want in f for f in got), (want, got)

fails(GOOD.replace("Licensed", "We elevate your comfort. Licensed"), "AI words: elevate")
fails(GOOD.replace("Licensed", "Your trusted partner. Licensed"), "your trusted partner")
fails(GOOD.replace("Licensed", "Lorem ipsum. Licensed"), "placeholders: Lorem")
fails(GOOD.replace("Licensed", "Call 555-0100. Licensed"), "placeholders")
fails(GOOD.replace("by lunch.", "by lunch!"), "exclamation")
fails(GOOD.replace("Licensed", "Fast — fair — local — honest — Licensed"), "em dashes")
fails(GOOD.replace(".h{", ".t{background-clip: text}.h{"), "gradient text")
fails(GOOD.replace("<h2>Hours</h2>", "<h2>Hours ❄</h2>"), "emoji")
fails(GOOD.replace("<h2>Hours</h2>", "<h2>Quality. Service. Trust.</h2>"), "slogan")
fails(GOOD.replace('href="tel:+14795550100"', 'href="#"'), "tap-to-call")
fails(GOOD.replace('<meta name="viewport" content="width=device-width">', ""), "viewport")
fails(GOOD.replace('<meta name="robots" content="noindex,nofollow">', ""), "noindex")
q = GOOD.replace("Same-day AC repair in Rogers and Bentonville", "Hot?").replace("What we fix", "Broken?").replace("Hours", "Open?")
fails(q, "every heading is a question")
# Words that only contain a banned word are fine; script and style text is ignored.
assert audit.audit_page(GOOD.replace("Licensed", "Elevation surveys, unlocked doors fixed. Licensed")) == [], audit.audit_page(GOOD.replace("Licensed", "Elevation surveys. Licensed"))
assert audit.audit_page(GOOD.replace("</body>", "<script>if(!x){}</script></body>")) == []

PITCH = """# Ozark HVAC

## Why this shop
Score 8, site down.

## Email
Subject: your site isn't loading

Hi Dana, your site wasn't loading for me on Tuesday, so I built a working version: [preview].
It has tap-to-call and your hours up top. Want me to send the link to keep?

TJ, Sites by TJ
--
[mailing address]
Not interested? Reply stop and I won't email again.

## Follow-up 1
Hi Dana, any thoughts? Is this a bad time? Should I call?
"""
assert audit.audit_pitch(PITCH) == [], audit.audit_pitch(PITCH)
long = PITCH.replace("It has tap-to-call", "It has tap-to-call " + "and more " * 40)
assert any("words" in f for f in audit.audit_pitch(long)), audit.audit_pitch(long)
assert any("questions" in f for f in audit.audit_pitch(PITCH.replace("keep?", "keep? Today?")))
assert any("opt-out" in f for f in audit.audit_pitch(PITCH.replace("Reply stop and I won't email again.", "")))
assert any("address" in f for f in audit.audit_pitch(PITCH.replace("[mailing address]", "")))
assert audit.audit_pitch(PITCH.replace("[mailing address]", "PO Box 12, Bentonville, AR 72712")) == []
assert audit.audit_pitch("# x\n## Why\nhi") == ["no '## Email' section"]

assert audit.audit_content({"reviews": [{"quote": "Great", "who": "Sam K.", "source": "Google"}]}) == []
assert audit.audit_content({"reviews": [{"quote": "Great", "who": "", "source": "Google"}]})
assert audit.audit_content({"preview": False, "sample_note": "made up"})

with tempfile.TemporaryDirectory() as d:
    d = pathlib.Path(d)
    (d / "suppress.csv").write_text("email,domain,date,reason\nowner@ozarkhvac.com,ozarkhvac.com,2026-10-23,said stop\n")
    shop = d / "ozark-hvac"; shop.mkdir()
    (shop / "pitch.md").write_text(PITCH.replace("Score 8", "Score 8, owner@ozarkhvac.com"))
    (shop / "content.json").write_text(json.dumps({"reviews": []}))
    sup = audit.load_suppress(d / "suppress.csv")
    assert audit.audit_file(shop / "pitch.md", sup) == ["on the do-not-email list: owner@ozarkhvac.com, ozarkhvac.com"]
    assert audit.audit_file(shop / "pitch.md") == []
    cli = [sys.executable, str(HERE / "sites" / "audit.py")]
    r = subprocess.run(cli + ["--suppress", str(d / "suppress.csv"), str(shop)], capture_output=True, text=True)
    assert r.returncode == 1 and "FAIL" in r.stdout and "PASS" in r.stdout, r
    assert subprocess.run(cli + [str(shop)], capture_output=True).returncode == 0

# The made-up sample shop must never pass: it has 555 numbers and example reviews.
subprocess.run([sys.executable, str(HERE / "sites" / "build.py"), "sample-ozark-ridge-auto"], check=True, capture_output=True)
assert any("placeholders" in f for f in audit.audit_page((HERE / "sites" / "out" / "sample-ozark-ridge-auto" / "index.html").read_text()))
print("audit ok")
