"""Settings from environment variables. Keys live on Render, never in the repo.

With no keys set everything still runs: drafts come from a plain template and the mailer is a stub that
sends nothing. Tuesday's keys switch on the real parts (see README).
"""
import os


def env(name, default=""):
    return os.environ.get(name, default).strip()


DATABASE_URL = env("DATABASE_URL")
OPERATOR_TOKEN = env("OPERATOR_TOKEN")            # the dashboard sends this; every route but /u/ and /health needs it
PUBLIC_URL = env("PUBLIC_URL", "http://localhost:8000").rstrip("/")   # where /u/{token} unsubscribe links point

ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY")
DRAFT_MODEL = env("DRAFT_MODEL", "claude-haiku-5-5")

MAILER = env("MAILER", "stub")                    # stub | smtp (Google Workspace)
SMTP_HOST = env("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(env("SMTP_PORT", "587"))
SMTP_USER = env("SMTP_USER")
SMTP_PASSWORD = env("SMTP_PASSWORD")              # Workspace app password (also reads replies and bounces over IMAP)
IMAP_HOST = env("IMAP_HOST", "imap.gmail.com")
FROM_EMAIL = env("FROM_EMAIL")                    # on the separate cold domain, never TJ's own Gmail
FROM_NAME = env("FROM_NAME", "TJ")
SENDER_BUSINESS = env("SENDER_BUSINESS", "Sites by TJ")
MAILING_ADDRESS = env("MAILING_ADDRESS")          # CAN-SPAM: real postal address or PO box; nothing sends without it

DAILY_SEND_CAP = int(env("DAILY_SEND_CAP", "30"))  # ceiling; the warm-up ramp in mailer.py sets the real cap each day
SEND_WINDOW = (int(env("SEND_HOUR_START", "9")), int(env("SEND_HOUR_END", "11")))  # weekdays, Central
MIN_RATING = float(env("MIN_RATING", "2.8"))      # Checker skips shops under 2.8 stars
FLAW_MAX_AGE_DAYS = int(env("FLAW_MAX_AGE_DAYS", "7"))   # older than this at approve time: look at their site again
SEND_FLAW_MAX_AGE_DAYS = int(env("SEND_FLAW_MAX_AGE_DAYS", "14"))  # a first email never goes out on an older check
REPEAT_FAILS = int(env("REPEAT_FAILS", "3"))    # this many failures in a row stops that step until TJ looks
CHROMIUM_PATH = env("CHROMIUM_PATH")              # flaw finder: a Chromium build when Playwright's own isn't installed

STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY")      # sk_test_... until TJ goes live
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET")  # whsec_... from the Stripe webhook endpoint
STRIPE_ALLOW_LIVE = env("STRIPE_ALLOW_LIVE") == "yes"  # a live key does nothing without this, set only on TJ's word
CHECKOUT_SUCCESS_URL = env("CHECKOUT_SUCCESS_URL", PUBLIC_URL + "/paid")
CHECKOUT_CANCEL_URL = env("CHECKOUT_CANCEL_URL", PUBLIC_URL + "/paid?cancelled=1")

VAPI_API_KEY = env("VAPI_API_KEY")                # Vapi private key: empty = receptionist set-up is a dry run
VAPI_WEBHOOK_SECRET = env("VAPI_WEBHOOK_SECRET")  # Vapi sends it as X-Vapi-Secret; empty = webhook refuses calls
RECEPTIONIST_MODEL = env("RECEPTIONIST_MODEL", "claude-haiku-5-5")
TEXTBACK = env("TEXTBACK", "stub")                # stub | twilio. twilio sends real texts: set only after 10DLC is approved, on TJ's word
TWILIO_ACCOUNT_SID = env("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = env("TWILIO_AUTH_TOKEN")      # also checks the signature on inbound texts (STOP, HELP)
TWILIO_FROM = env("TWILIO_FROM")                  # the 10DLC-registered number, E.164
TRANSFER_MODE = env("TRANSFER_MODE", "warm-transfer-experimental")  # Vapi transferPlan.mode; check on the first live test call
NOTIFY = env("NOTIFY", "stub")                    # stub | smtp: owner emails (emergency heads-up, bookings, summaries)
NOTIFY_FROM_EMAIL = env("NOTIFY_FROM_EMAIL") or FROM_EMAIL  # client mail; can be a different inbox from cold email


def drafter():
    return "claude" if ANTHROPIC_API_KEY else "stub"


def mailer():
    return "smtp" if MAILER == "smtp" and SMTP_USER and SMTP_PASSWORD and FROM_EMAIL else "stub"


def stripe_mode():
    """off (no key), test, live (only with STRIPE_ALLOW_LIVE=yes) or blocked (live key without it)."""
    k = STRIPE_SECRET_KEY
    if not k:
        return "off"
    if k.startswith(("sk_test_", "rk_test_")):
        return "test"
    return "live" if STRIPE_ALLOW_LIVE and k.startswith(("sk_live_", "rk_live_")) else "blocked"


def notifier():
    """Owner emails go out only with NOTIFY=smtp and the Workspace login. They skip the cold-email pause and window."""
    return "smtp" if NOTIFY == "smtp" and SMTP_USER and SMTP_PASSWORD and NOTIFY_FROM_EMAIL else "stub"


def sms():
    """twilio only when TEXTBACK=twilio and all three Twilio settings are present; otherwise texts are recorded, never sent."""
    return "twilio" if TEXTBACK == "twilio" and TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM else "stub"


def receptionist():
    return "vapi" if VAPI_API_KEY else "stub"

# Cost tracker (2026-10-24). Estimates until real bills come in: check them against Render and Vapi once a month.
HOSTING_CENTS_MONTH = int(env("HOSTING_CENTS_MONTH", "2100"))      # Render: Postgres $6 + two starter services $7 + cron $1 (check)
VAPI_EST_CENTS_PER_MIN = float(env("VAPI_EST_CENTS_PER_MIN", "13"))  # only for calls Vapi sent no cost for (check)
STRIPE_FEE_PCT = float(env("STRIPE_FEE_PCT", "2.9"))               # Stripe card fee: 2.9% + 30 cents a charge (check)
STRIPE_FEE_CENTS = int(env("STRIPE_FEE_CENTS", "30"))
