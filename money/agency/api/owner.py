"""The owner's own page: /o/{token}. Calls, recordings, transcripts, upcoming visits, minutes used, and the settings an
owner can safely change (hours, holidays, transfer cell, where the summary goes, services, towns, fees, FAQ).

Phone-first, one plain HTML page with forms, no JavaScript, no login: the token is the key (unguessable, rotatable by
TJ with POST /clients/{id}/owner-link). Off until OWNER_PAGE=on, after TJ OKs the mockup.
Look follows money/sites/PREMIUM.md: ink on paper, one accent, 4px corners, ruled lists, no pills, no AI tells.
"""
import datetime as dt
import html
import secrets

import billing
import config
import notices
import shopcfg
from mailer import CENTRAL

E = html.escape
DAY_NAMES = dict(zip(shopcfg.DAYS, ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")))


def token(conn, c, rotate=False):
    if c.get("owner_token") and not rotate:
        return c["owner_token"]
    t = secrets.token_urlsafe(24)
    conn.execute("UPDATE clients SET owner_token = %s WHERE id = %s", (t, c["id"]))
    return t


def url(t):
    return f"{config.PUBLIC_URL}/o/{t}" if t else None


CSS = """
:root{--ink:#16181d;--sub:#5b616e;--line:#dcdfe4;--paper:#fbfaf7;--card:#fff;--accent:#9a3b1f;--urgent:#b42318;
--ok:#1f6f43;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--ink:#eceae4;--sub:#a3a7b0;--line:#2f333b;--paper:#121417;--card:#1a1d22;
--accent:#e0875f;--urgent:#ff7a6b;--ok:#6fcf97}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);
font:16px/1.5 "Libre Franklin",system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:44rem;margin:0 auto;padding:0 16px 4rem}
header{padding:1.6rem 0 1rem;border-bottom:2px solid var(--ink)}
h1{font-size:1.55rem;line-height:1.2;margin:0;letter-spacing:-.01em}
.status{margin:.35rem 0 0;color:var(--sub);font-size:.95rem}
.status b{color:var(--ok);font-weight:600}
h2{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--sub);margin:2.2rem 0 .4rem;font-weight:600}
.row{border-top:1px solid var(--line);padding:.9rem 0}
.row:last-child{border-bottom:1px solid var(--line)}
.who{font-weight:600}.meta{color:var(--sub);font-size:.9rem}
.urgent .who:before{content:"Urgent";color:var(--urgent);font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;
margin-right:.5rem;border:1px solid var(--urgent);padding:0 .3rem;border-radius:3px}
.done{opacity:.55}
.act{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem}
a.btn,button{font:inherit;font-size:.95rem;min-height:44px;padding:.55rem 1rem;border-radius:4px;border:1px solid var(--ink);
background:var(--card);color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;cursor:pointer}
a.call{background:var(--ink);color:var(--paper)}
details{margin-top:.5rem}summary{cursor:pointer;color:var(--sub);font-size:.9rem}
pre{white-space:pre-wrap;font:inherit;font-size:.9rem;background:var(--card);border:1px solid var(--line);
border-radius:6px;padding:.75rem;margin:.5rem 0 0}
.nums{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.nums div{padding:.8rem 0}.nums div+div{border-left:1px solid var(--line);padding-left:.9rem}
.nums b{display:block;font-size:1.35rem;font-variant-numeric:tabular-nums}.nums span{color:var(--sub);font-size:.85rem}
form.set{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:1rem}
label{display:block;font-size:.9rem;font-weight:600;margin:.9rem 0 .25rem}label:first-child{margin-top:0}
.hint{font-weight:400;color:var(--sub)}
input,textarea,select{font:inherit;width:100%;padding:.55rem .6rem;border:1px solid var(--line);border-radius:4px;
background:var(--paper);color:var(--ink);min-height:44px}
textarea{min-height:5.5rem}
.hours{display:grid;grid-template-columns:3.2rem 1fr 1fr;gap:.4rem .6rem;align-items:center}
.hours span{font-size:.9rem}
.save{margin-top:1.1rem;background:var(--accent);border-color:var(--accent);color:#fff}
.note{border-left:3px solid var(--accent);padding:.5rem .8rem;margin:1rem 0 0;background:var(--card)}
.empty{color:var(--sub);padding:.9rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
footer{margin-top:3rem;color:var(--sub);font-size:.85rem}
"""


def when(t):
    local = t.astimezone(CENTRAL)
    today = dt.datetime.now(dt.timezone.utc).astimezone(CENTRAL).date()
    day = "Today" if local.date() == today else "Yesterday" if local.date() == today - dt.timedelta(days=1) \
        else local.strftime("%a %b %-d")
    return f"{day}, {notices.clock(t)}"


def call_row(t, r):
    num = r["callback_number"] or r["caller_number"]
    cls = "row" + (" urgent" if r["emergency"] else "") + (" done" if r.get("handled_at") else "")
    label = {"message": "Message", "booked": "Booked a visit", "hung_up": "Hung up", "spam": "Sales call or robocall"}
    out = [f'<div class="{cls}"><div class="who">{E(r["caller_name"] or "Name not given")}'
           f'{", " + E(r["town"]) if r["town"] else ""}</div>',
           f'<div class="meta">{when(r["started_at"])} · {notices.mins(r["seconds"])} · {label.get(r["outcome"], "")}'
           f'{" · Spanish" if r.get("language") == "es" else ""}{" · Voicemail (backup line)" if r.get("source") == "fallback" else ""}</div>']
    if r["problem"] or r["summary"]:
        out.append(f'<div>{E(r["problem"] or r["summary"])}</div>')
    for q, a in (r.get("answers") or {}).items():
        out.append(f'<div class="meta">{E(q)}: {E(a)}</div>')
    acts = []
    if num and r["outcome"] in ("message", "booked", "hung_up"):
        acts.append(f'<a class="btn call" href="tel:+1{E(num)}">Call {E(notices.pretty(num))}</a>')
    if not r.get("handled_at") and r["outcome"] in ("message", "booked", "hung_up"):
        acts.append(f'<form method="post" action="/o/{E(t)}/calls/{r["id"]}/done"><button>Mark called back</button></form>')
    if r["recording_url"]:  # a plain link, not <audio>: the browser's own player is a pill
        acts.append(f'<a class="btn" href="{E(r["recording_url"])}" target="_blank" rel="noopener noreferrer">Play recording</a>')
    if acts:
        out.append('<div class="act">' + "".join(acts) + "</div>")
    if r["transcript"]:
        out.append(f'<details><summary>Read the call</summary><pre>{E(r["transcript"])}</pre></details>')
    return "".join(out) + "</div>"


def visit_row(b):
    from booking import label
    return (f'<div class="row"><div class="who">{E(label(b["window_start"], b["window_end"]))}</div>'
            f'<div>{E(b["customer_name"])}{", " + E(b["address"]) if b["address"] else ""}</div>'
            f'<div class="meta">{E(b["problem"] or "")}</div><div class="act"><a class="btn call" '
            f'href="tel:+1{E(b["callback_number"])}">Call {E(notices.pretty(b["callback_number"]))}</a></div></div>')


def lines(items, fmt):
    return "\n".join(fmt(x) for x in items)


def settings_form(t, c):
    p = c.get("profile") or {}
    w = shopcfg.week(c)
    hours = "".join(
        f'<span>{DAY_NAMES[d]}</span>'
        f'<select name="open_{d}" aria-label="{DAY_NAMES[d]} opens">{options(w[i][0] if w[i] else None, True)}</select>'
        f'<select name="close_{d}" aria-label="{DAY_NAMES[d]} closes">{options(w[i][1] if w[i] else None, False)}</select>'
        for i, d in enumerate(shopcfg.DAYS))
    m = shopcfg.merged(c)
    return f"""<form class="set" method="post" action="/o/{E(t)}/settings">
<label>Office hours <span class="hint">Front Desk answers outside these.</span></label>
<div class="hours">{hours}</div>
<label for="closed">Closed days <span class="hint">holidays, one per line, like 2026-12-25</span></label>
<textarea id="closed" name="closed_dates">{E(chr(10).join(p.get("closed_dates", [])))}</textarea>
<label for="cell">Your cell for emergencies <span class="hint">urgent calls ring here first; blank = message only</span></label>
<input id="cell" name="owner_cell" inputmode="tel" value="{E(notices.pretty(c["owner_cell"]) if c.get("owner_cell") else "")}">
<label for="em">Morning summary goes to</label>
<input id="em" name="notify_email" type="email" value="{E(c.get("notify_email") or c["email"])}">
<label for="hr">Summary time</label>
<select id="hr" name="summary_hour">{"".join(f'<option value="{h}"{" selected" if h == c["summary_hour"] else ""}>{h}am</option>' for h in range(4, 12))}</select>
<label for="sv">What you do <span class="hint">one per line</span></label>
<textarea id="sv" name="services">{E(chr(10).join(m["services"]))}</textarea>
<label for="ns">What you don't do <span class="hint">one per line</span></label>
<textarea id="ns" name="not_services">{E(chr(10).join(m["not_services"]))}</textarea>
<label for="ar">Towns you serve <span class="hint">one per line</span></label>
<textarea id="ar" name="service_area">{E(chr(10).join(m["service_area"]))}</textarea>
<label for="fe">Prices Front Desk may say <span class="hint">one per line, like: Service call | $89. Blank = it never says a price.</span></label>
<textarea id="fe" name="fees">{E(chr(10).join(f["name"] + " | " + f["amount"] for f in m["fees"]))}</textarea>
<label for="fq">Common questions <span class="hint">one per line: question | your answer, word for word</span></label>
<textarea id="fq" name="faq">{E(chr(10).join(f["q"] + " | " + f["a"] for f in m["faq"]))}</textarea>
<button class="save">Save changes</button>
<p class="meta">Changes reach your assistant within a minute.</p>
</form>"""


def options(v, opening):
    hrs = range(0, 24) if opening else range(1, 25)
    return ('<option value="">Closed</option>' if opening else '<option value="">-</option>') + "".join(
        f'<option value="{h}"{" selected" if h == v else ""}>{shopcfg.clock(h)}</option>' for h in hrs)


def page(conn, c, t, note=None, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    calls = conn.execute("""SELECT * FROM receptionist_calls WHERE client_id = %s AND outcome <> 'spam'
                            ORDER BY (emergency AND handled_at IS NULL) DESC, started_at DESC LIMIT 40""",
                         (c["id"],)).fetchall()
    visits = conn.execute("""SELECT * FROM bookings WHERE client_id = %s AND status = 'booked' AND window_end > %s
                             ORDER BY window_start LIMIT 20""", (c["id"], now)).fetchall()
    _, start, end = billing.month_bounds(now=now)
    used = billing.usage(conn, start, end).get(c["id"], {})
    spam = conn.execute("""SELECT count(*) AS n FROM receptionist_calls WHERE client_id = %s AND outcome = 'spam'
                           AND started_at >= %s""", (c["id"], start)).fetchone()["n"]
    open_calls = [r for r in calls if not r.get("handled_at") and r["outcome"] in ("message", "booked", "hung_up")]
    last = calls[0]["started_at"] if calls else None
    state = "after hours" if c["plan"] == "front_desk" else "24/7"
    status = (f'<b>Answering {state}</b> · {"last call " + when(last) if last else "no calls yet"}'
              if c["status"] in ("active", "past_due") and c.get("vapi_assistant_id") else "Not answering yet")
    body = f"""<header><h1>{E(c["business_name"])}</h1><p class="status">{status}</p></header>
{f'<p class="note">{E(note)}</p>' if note else ""}
<h2>To call back ({len(open_calls)})</h2>
{lines([r for r in calls if r in open_calls], lambda r: call_row(t, r)) or '<p class="empty">You are all caught up.</p>'}
{f"<h2>Coming up</h2>{lines(visits, visit_row)}" if c["plan"] == "front_desk_plus" and visits else ""}
<h2>This month</h2>
<div class="nums"><div><b>{used.get("calls", 0)}</b><span>calls</span></div>
<div><b>{used.get("minutes", 0)}</b><span>of {c["included_minutes"]} min</span></div>
<div><b>{spam}</b><span>sales calls ended</span></div></div>
<h2>Earlier calls</h2>
{lines([r for r in calls if r not in open_calls][:20], lambda r: call_row(t, r)) or '<p class="empty">Nothing earlier yet.</p>'}
<h2>Your settings</h2>
{settings_form(t, c)}
<footer>Front Desk by {E(config.SENDER_BUSINESS)}. Keep this link private: anyone with it can see your calls.</footer>"""
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer"><title>{E(c["business_name"])} · Front Desk</title>
<style>{CSS}</style></head><body><main>{body}</main></body></html>"""


HEADERS = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer",
           "X-Frame-Options": "DENY"}


def split_lines(v, n=40):
    return [x.strip() for x in (v or "").splitlines() if x.strip()][:n]


def pairs(v, a, b):
    out = []
    for line in split_lines(v, 20):
        left, sep, right = line.partition("|")
        if not sep:
            raise shopcfg.ProfileError(f'use "|" between the two parts: {line[:40]}')
        out.append({a: left.strip(), b: right.strip()})
    return out


def settings_from_form(c, form):
    """The form, as a profile and the client columns it touches. Raises ProfileError with a plain message."""
    hours = {}
    for d in shopcfg.DAYS:
        o, cl = form.get(f"open_{d}") or "", form.get(f"close_{d}") or ""
        hours[d] = [int(o), int(cl)] if o.isdigit() and cl.isdigit() else None
        if hours[d] and hours[d][1] <= hours[d][0]:
            raise shopcfg.ProfileError(f"{DAY_NAMES[d]}: closing time must be after opening time")
    p = dict(c.get("profile") or {})
    p.update(hours=hours, closed_dates=split_lines(form.get("closed_dates")),
             services=split_lines(form.get("services"), 20), not_services=split_lines(form.get("not_services"), 20),
             service_area=split_lines(form.get("service_area"), 25), fees=pairs(form.get("fees"), "name", "amount"),
             faq=pairs(form.get("faq"), "q", "a"))
    profile = shopcfg.validate(p, c["trade"])
    cell = "".join(ch for ch in form.get("owner_cell") or "" if ch.isdigit())[-10:]
    if form.get("owner_cell", "").strip() and len(cell) != 10:
        raise shopcfg.ProfileError("your cell needs 10 digits")
    email = (form.get("notify_email") or "").strip().lower()
    if email and "@" not in email:
        raise shopcfg.ProfileError("that email doesn't look right")
    hour = form.get("summary_hour") or str(c["summary_hour"])
    if not hour.isdigit() or not 4 <= int(hour) <= 11:
        raise shopcfg.ProfileError("summary time must be 4am to 11am")
    return profile, {"owner_cell": cell or None, "notify_email": email or None, "summary_hour": int(hour)}
