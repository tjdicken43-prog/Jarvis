"""Two-way calendar sync (Plus with booking on). Provider-agnostic; Google first, Jobber and Housecall Pro stubbed.

Two directions, both run by the 15-minute cron (/frontdesk/run) and never during a live call:
- in:  the shop's busy times (a dentist appointment, a job they booked themselves) are copied into calendar_busy,
       and openings() skips them. A booking whose event the owner deleted in their own calendar is marked cancelled.
- out: each new booking is written to the shop's calendar as an event (sync_status pending -> synced, or failed and
       retried next run, at most RETRIES times, then TJ gets one email).
The .ics feed keeps working either way; a shop with no sync still sees bookings in its phone calendar.

Off until GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and CALENDAR_KEY are set (config.calendar_sync()). The shop connects
by opening the link /clients/{id}/calendar/connect returns (Google's own consent screen; we ask for the calendar
scope only). The refresh token is encrypted with CALENDAR_KEY before it touches the database and never leaves the API.

Google endpoints follow developers.google.com/calendar/api/v3 as of 2026-10 (check on the first real connect).
"""
import datetime as dt
import hashlib
import hmac
import json
import urllib.error
import urllib.parse
import urllib.request

import config
import events
import notices

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_API = "https://www.googleapis.com/calendar/v3"
SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy"
RETRIES = 3          # failed pushes per booking before TJ is told
BUSY_DAYS = 22       # covers the longest booking horizon (days_ahead max 21)
TIMEOUT = 10


class CalendarError(Exception):
    pass


class NotConfigured(CalendarError):
    pass


# Encryption of the refresh token at rest

def fernet():
    if not config.CALENDAR_KEY:
        raise NotConfigured("set CALENDAR_KEY first (python3 -c 'from cryptography.fernet import Fernet; "
                            "print(Fernet.generate_key().decode())')")
    from cryptography.fernet import Fernet
    return Fernet(config.CALENDAR_KEY.encode())


def seal(secret):
    return fernet().encrypt(secret.encode()).decode()


def unseal(token):
    return fernet().decrypt(token.encode()).decode()


# OAuth state: signed with the operator token so a stranger can't attach their calendar to someone's shop

def state_for(client_id):
    mac = hmac.new(config.OPERATOR_TOKEN.encode(), f"cal:{client_id}".encode(), hashlib.sha256).hexdigest()[:24]
    return f"{client_id}.{mac}"


def client_of_state(state):
    cid, _, mac = (state or "").partition(".")
    if not cid.isdigit() or not config.OPERATOR_TOKEN or not hmac.compare_digest(state_for(int(cid)), state or ""):
        return None
    return int(cid)


def redirect_uri():
    return config.PUBLIC_URL + "/calendar/google/callback"


def http(method, url, body=None, token=None, form=False):
    data = None
    headers = {"Accept": "application/json"}
    if body is not None and form:
        data, headers["Content-Type"] = urllib.parse.urlencode(body).encode(), "application/x-www-form-urlencoded"
    elif body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=headers),
                                    timeout=TIMEOUT) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise CalendarError(f"{e.code} {e.read().decode(errors='replace')[:200]}")
    except urllib.error.URLError as e:
        raise CalendarError(str(e.reason))


class Google:
    name = "google"

    @staticmethod
    def connect_url(client_id):
        if config.calendar_sync() != "google":
            raise NotConfigured("Google sync is off: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and CALENDAR_KEY")
        return GOOGLE_AUTH + "?" + urllib.parse.urlencode({
            "client_id": config.GOOGLE_CLIENT_ID, "redirect_uri": redirect_uri(), "response_type": "code",
            "scope": SCOPE, "access_type": "offline", "prompt": "consent", "state": state_for(client_id)})

    @staticmethod
    def exchange(code):
        out = http("POST", GOOGLE_TOKEN, {"code": code, "client_id": config.GOOGLE_CLIENT_ID,
                                          "client_secret": config.GOOGLE_CLIENT_SECRET,
                                          "redirect_uri": redirect_uri(), "grant_type": "authorization_code"}, form=True)
        if not out.get("refresh_token"):
            raise CalendarError("Google sent no refresh token; connect again (the consent screen must be accepted)")
        return out["refresh_token"]

    @staticmethod
    def access(secret):
        return http("POST", GOOGLE_TOKEN, {"refresh_token": secret, "client_id": config.GOOGLE_CLIENT_ID,
                                           "client_secret": config.GOOGLE_CLIENT_SECRET,
                                           "grant_type": "refresh_token"}, form=True)["access_token"]

    @staticmethod
    def busy(token, cal, start, end):
        out = http("POST", GOOGLE_API + "/freeBusy", {"timeMin": start.isoformat(), "timeMax": end.isoformat(),
                                                      "items": [{"id": cal}]}, token)
        blocks = ((out.get("calendars") or {}).get(cal) or {}).get("busy") or []
        return [(dt.datetime.fromisoformat(b["start"].replace("Z", "+00:00")),
                 dt.datetime.fromisoformat(b["end"].replace("Z", "+00:00"))) for b in blocks]

    @staticmethod
    def push(token, cal, b, c):
        ev = {"summary": f"Visit: {b['customer_name']}", "location": b["address"] or "",
              "description": "\n".join(x for x in (b["problem"], f"Call back: {notices.pretty(b['callback_number'])}",
                                                   "Booked by Front Desk") if x),
              "start": {"dateTime": b["window_start"].isoformat()}, "end": {"dateTime": b["window_end"].isoformat()},
              # our own id (hex is valid base32hex), so a push that timed out after Google saved it isn't made twice
              "id": hashlib.sha1(f"frontdesk:{c['id']}:{b['id']}".encode()).hexdigest()}
        try:
            return http("POST", f"{GOOGLE_API}/calendars/{urllib.parse.quote(cal)}/events", ev, token)["id"]
        except CalendarError as e:
            if str(e).startswith("409"):
                return ev["id"]  # already there from an earlier try
            raise

    @staticmethod
    def gone(token, cal, external_id):
        """True when the owner deleted or cancelled the event in their own calendar."""
        try:
            ev = http("GET", f"{GOOGLE_API}/calendars/{urllib.parse.quote(cal)}/events/{external_id}", token=token)
        except CalendarError as e:
            if str(e).startswith(("404", "410")):
                return True
            raise
        return ev.get("status") == "cancelled"


class Stub:
    """Jobber and Housecall Pro: their APIs need partner approval (TJ's account). Same shape, refuses politely."""
    def __init__(self, name):
        self.name = name

    def connect_url(self, client_id):
        raise NotConfigured(f"{self.name} sync isn't built yet: it needs {self.name} partner API access")


PROVIDERS = {"google": Google, "jobber": Stub("Jobber"), "housecall": Stub("Housecall Pro")}


def provider(name):
    if name not in PROVIDERS:
        raise CalendarError("provider must be google, jobber or housecall")
    return PROVIDERS[name]


def save_connection(conn, client_id, name, secret, calendar_id="primary"):
    conn.execute("UPDATE clients SET calendar = %s, calendar_secret = %s WHERE id = %s",
                 (json.dumps({"provider": name, "calendar_id": calendar_id,
                              "connected_at": dt.datetime.now(dt.timezone.utc).isoformat()}), seal(secret), client_id))
    conn.execute("""UPDATE bookings SET sync_status = 'pending' WHERE client_id = %s AND status = 'booked'
                    AND window_start > now() AND sync_status IS NULL""", (client_id,))


def disconnect(conn, client_id):
    conn.execute("UPDATE clients SET calendar = NULL, calendar_secret = NULL WHERE id = %s", (client_id,))
    conn.execute("DELETE FROM calendar_busy WHERE client_id = %s", (client_id,))
    conn.execute("UPDATE bookings SET sync_status = NULL WHERE client_id = %s AND sync_status IN ('pending', 'failed')",
                 (client_id,))


def covered(s, e, intervals):
    """True when [s, e) is fully covered by the sorted intervals (Google merges back-to-back events into one block)."""
    at = s
    for a, b in intervals:
        if a > at:
            break
        at = max(at, b)
        if at >= e:
            return True
    return at >= e


def tries_of(note):
    head = (note or "").split(":", 1)[0]
    return int(head) if head.isdigit() else 0


def sync_client(conn, c, now=None, api=None):
    """One shop, both directions. api is the provider class (tests pass a fake). Returns counts; raises nothing."""
    now = now or dt.datetime.now(dt.timezone.utc)
    cal = c["calendar"] or {}
    api = api or PROVIDERS.get(cal.get("provider"))
    out = {"client_id": c["id"], "busy": 0, "pushed": 0, "failed": 0, "removed": 0}
    try:
        token = api.access(unseal(c["calendar_secret"]))
        blocks = api.busy(token, cal.get("calendar_id", "primary"), now, now + dt.timedelta(days=BUSY_DAYS))
    except Exception as e:  # noqa: BLE001  (a dead token or Google outage must not stop the other shops)
        events.log("calendar", False, f"read: {str(e)[:200]}", client_id=c["id"])
        out["error"] = str(e)[:200]
        return out
    # our own pushed visits show as busy too; openings() already counts them per window, so drop what they cover
    ours = [(r["window_start"], r["window_end"]) for r in conn.execute(
        """SELECT window_start, window_end FROM bookings WHERE client_id = %s AND status = 'booked'
           AND external_id IS NOT NULL ORDER BY window_start""", (c["id"],)).fetchall()]
    conn.execute("DELETE FROM calendar_busy WHERE client_id = %s", (c["id"],))
    for s, e in blocks:
        if not covered(s, e, ours):
            conn.execute("INSERT INTO calendar_busy (client_id, starts_at, ends_at) VALUES (%s,%s,%s)", (c["id"], s, e))
            out["busy"] += 1
    conn.commit()
    for b in conn.execute("""SELECT * FROM bookings WHERE client_id = %s AND sync_status IN ('pending', 'failed')
                             AND status = 'booked' AND coalesce(sync_error, '') NOT LIKE 'gave up%%'""",
                          (c["id"],)).fetchall():
        try:
            ext = api.push(token, cal.get("calendar_id", "primary"), b, c)
            conn.execute("UPDATE bookings SET external_id = %s, sync_status = 'synced', sync_error = NULL WHERE id = %s",
                         (ext, b["id"]))
            out["pushed"] += 1
        except Exception as e:  # noqa: BLE001
            tries = tries_of(b["sync_error"]) + 1
            note = f"{tries}: {str(e)[:200]}" if tries < RETRIES else f"gave up after {tries}: {str(e)[:180]}"
            conn.execute("UPDATE bookings SET sync_status = 'failed', sync_error = %s WHERE id = %s", (note, b["id"]))
            out["failed"] += 1
            if tries >= RETRIES:
                notices.operator(f"Calendar sync failed for {c['business_name']}",
                                 f"Booking {b['id']} didn't reach their calendar after {tries} tries: {str(e)[:200]}. "
                                 "It's still in their email and calendar feed.")
        conn.commit()
    for b in conn.execute("""SELECT * FROM bookings WHERE client_id = %s AND status = 'booked' AND sync_status = 'synced'
                             AND window_start > %s""", (c["id"], now)).fetchall():
        try:
            if api.gone(token, cal.get("calendar_id", "primary"), b["external_id"]):
                conn.execute("""UPDATE bookings SET status = 'cancelled', sync_status = 'removed', updated_at = now()
                                WHERE id = %s""", (b["id"],))
                out["removed"] += 1
        except Exception:  # noqa: BLE001  (try again next run)
            pass
    conn.commit()
    events.log("calendar", True, f"busy {out['busy']}, pushed {out['pushed']}, removed {out['removed']}",
               client_id=c["id"])
    return out


def sync_all(conn, now=None):
    if config.calendar_sync() == "off":
        return []
    rows = conn.execute("""SELECT * FROM clients WHERE calendar IS NOT NULL AND calendar_secret IS NOT NULL
                           AND status IN ('active', 'past_due') AND booking IS NOT NULL""").fetchall()
    return [sync_client(conn, c, now) for c in rows if (c["calendar"] or {}).get("provider") == "google"]


def mark_pending(conn, booking_id, c):
    """A new booking on a synced shop waits for the next run (never pushed inside the live call)."""
    if c.get("calendar"):
        conn.execute("UPDATE bookings SET sync_status = 'pending' WHERE id = %s", (booking_id,))
