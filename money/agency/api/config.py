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
SMTP_PASSWORD = env("SMTP_PASSWORD")              # Workspace app password
FROM_EMAIL = env("FROM_EMAIL")                    # on the separate cold domain, never TJ's own Gmail
FROM_NAME = env("FROM_NAME", "TJ")
SENDER_BUSINESS = env("SENDER_BUSINESS", "Sites by TJ")
MAILING_ADDRESS = env("MAILING_ADDRESS")          # CAN-SPAM: real postal address or PO box; nothing sends without it

DAILY_SEND_CAP = int(env("DAILY_SEND_CAP", "5"))  # start at 5, raise about 5 a week, max 30
SEND_WINDOW = (int(env("SEND_HOUR_START", "9")), int(env("SEND_HOUR_END", "11")))  # weekdays, Central
MIN_RATING = float(env("MIN_RATING", "2.8"))      # Checker skips shops under 2.8 stars
CHROMIUM_PATH = env("CHROMIUM_PATH")              # flaw finder: a Chromium build when Playwright's own isn't installed

STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY")      # sk_test_... until TJ goes live
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET")  # whsec_... from the Stripe webhook endpoint
STRIPE_ALLOW_LIVE = env("STRIPE_ALLOW_LIVE") == "yes"  # a live key does nothing without this, set only on TJ's word
CHECKOUT_SUCCESS_URL = env("CHECKOUT_SUCCESS_URL", PUBLIC_URL + "/paid")
CHECKOUT_CANCEL_URL = env("CHECKOUT_CANCEL_URL", PUBLIC_URL + "/paid?cancelled=1")


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
