"""Render cron: python3 money/agency/api/cron.py send

Calls the API's /send, which reads the inbox for replies and bounces (stopping their follow-ups), then sends approved
emails inside the weekday window, under the cap, when not paused.
Needs API_URL and OPERATOR_TOKEN. Standard library only, so the cron needs no install.
"""
import json
import os
import sys
import urllib.error
import urllib.request

ROUTES = {"send": "/send"}


def main(job):
    base, token = os.environ.get("API_URL", "").rstrip("/"), os.environ.get("OPERATOR_TOKEN", "")
    if job not in ROUTES or not base or not token:
        sys.exit("usage: cron.py send  (needs API_URL and OPERATOR_TOKEN)")
    req = urllib.request.Request(base + ROUTES[job], data=b"{}", method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"{job}: API said {e.code} {e.read().decode(errors='replace')[:200]}")
    except urllib.error.URLError as e:
        sys.exit(f"{job}: can't reach the API ({e.reason})")
    print(job, json.dumps({k: out[k] for k in ("sent", "dry_run", "detail") if k in out}))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
