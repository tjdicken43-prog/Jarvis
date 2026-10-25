"""Text messages through Twilio, behind TEXTBACK=twilio. Until then every text is recorded and nothing is sent.

Only ever used to answer someone who called or texted us first (TCPA); the missed-call text-back in receptionist.py
is the one caller today. Carriers want A2P 10DLC registration before business texts flow, and a STOP/HELP reply
that works: inbound() handles both. Twilio also blocks STOP replies on its own, ours is the second lock.
Twilio field names follow their REST docs as of 2026-10 (check on the first live text).
"""
import base64
import hashlib
import hmac
import json
import re
import urllib.error
import urllib.parse
import urllib.request

import config

STOP_WORDS = {"stop", "stopall", "unsubscribe", "cancel", "end", "quit"}
START_WORDS = {"start", "unstop", "yes"}
HELP_TEXT = "Front Desk call-back texts. Reply STOP to opt out. Questions: {email}"


class SmsError(Exception):
    pass


def e164(number):
    d = re.sub(r"\D", "", number or "")[-10:]
    if len(d) != 10:
        raise SmsError("number needs 10 digits")
    return "+1" + d


def send(to, body):
    """One text. Returns Twilio's message sid. Raises SmsError; never retries (a double text is worse than a missed one)."""
    sid = config.TWILIO_ACCOUNT_SID
    data = urllib.parse.urlencode({"To": e164(to), "From": config.TWILIO_FROM, "Body": body}).encode()
    req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=data,
                                 headers={"Authorization": "Basic " + base64.b64encode(
                                     f"{sid}:{config.TWILIO_AUTH_TOKEN}".encode()).decode()})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r).get("sid")
    except urllib.error.HTTPError as e:
        raise SmsError(f"{e.code} {e.read().decode(errors='replace')[:200]}")
    except urllib.error.URLError as e:
        raise SmsError(str(e.reason))


def signature_ok(url, params, header):
    """Twilio signs the full URL plus every POST field (sorted by name) with the auth token, HMAC-SHA1, base64."""
    if not config.TWILIO_AUTH_TOKEN or not header:
        return False
    text = url + "".join(k + params[k] for k in sorted(params))
    mac = base64.b64encode(hmac.new(config.TWILIO_AUTH_TOKEN.encode(), text.encode(), hashlib.sha1).digest()).decode()
    return hmac.compare_digest(mac, header)


def reply_xml(text=None):
    if not text:
        return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{esc}</Message></Response>'


def inbound(conn, params, receptionist):
    """An inbound text. STOP words opt the number out for good, START lifts it, HELP answers; anything else is ignored
    (the shop's own line is where people talk to the shop). Returns the TwiML to send back."""
    num = receptionist.digits(params.get("From"))
    word = re.sub(r"[^a-z]", "", (params.get("Body") or "").strip().lower())
    if not num:
        return reply_xml()
    if word in STOP_WORDS:
        receptionist.opt_out(conn, num)
        return reply_xml("You're opted out and won't get more texts. Reply START to turn them back on.")
    if word in START_WORDS:
        conn.execute("DELETE FROM sms_optouts WHERE number = %s", (num,))
        conn.commit()
        return reply_xml("You're back on. Reply STOP any time to opt out.")
    if word == "help":
        return reply_xml(HELP_TEXT.format(email=config.NOTIFY_FROM_EMAIL or "reply to this number's owner"))
    return reply_xml()
