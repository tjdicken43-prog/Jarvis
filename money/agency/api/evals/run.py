"""Frozen test set: run before any change to the flaw finder, the drafter, the checks or the inbox reader.

  python3 money/agency/api/evals/run.py          # code-graded cases, free, no database; exit 1 on any miss
  python3 money/agency/api/evals/run.py --live   # also has Claude draft each "draft" case and grades it (costs cents)

cases.json holds hand-checked cases; calls.json holds the receptionist's (dates callers say, callback numbers,
urgency, and the prompt contract every shop's assistant must keep, whatever its profile); real_shops.json holds real NWA shops captured by capture.py; tj.json holds
TJ's own corrections, frozen by freeze.py. A miss prints the case and what came back. Never edit a case to make it
pass: fix the code, or ask TJ if the case itself is wrong.
"""
import datetime as dt
import email
import email.policy
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import booking  # noqa: E402
import flaws  # noqa: E402
import followups  # noqa: E402
import outreach  # noqa: E402
import receptionist  # noqa: E402
import shopcfg  # noqa: E402
from mailer import CENTRAL  # noqa: E402

SHOP = {"id": 1, "business_name": "Test Plumbing", "trade": "plumbing", "plan": "front_desk", "status": "active",
        "open_hour": 7, "close_hour": 17, "open_saturday": False, "owner_cell": None, "booking": None, "profile": {}}


def load():
    cases = {}
    for f in ("cases.json", "calls.json", "real_shops.json", "tj.json"):
        p = HERE / f
        if p.exists():
            for group, items in json.loads(p.read_text()).items():
                cases.setdefault(group, []).extend(dict(c, file=f) for c in items)
    return cases


def flaw_case(c):
    got = list(flaws.pick(c["signals"], dt.date.fromisoformat(c.get("today", "2026-10-24"))))
    if "expect_not" in c:
        return got[0] != c["expect_not"], got
    return got == c["expect"], got


def email_case(c):
    got = outreach.preflight(c["subject"], c["body"], c["prospect"], c.get("kind", "first"))
    if c["expect"] == "pass":
        return got == [], got
    return all(any(w in g for g in got) for w in c["expect"]), got


def draft_case(c, live=False):
    p = c["prospect"]
    subject, body = outreach.claude_draft(p) if live else outreach.template_draft(p)
    got = outreach.preflight(subject, body, p)
    return got == [], {"problems": got, "body": body}


def reply_case(c):
    got = followups.kind_of_reply(c["text"])
    return got == c["expect"], got


def bounce_case(c):
    msg = email.message_from_bytes(c["raw"].encode(), policy=email.policy.default)
    from email.utils import parseaddr
    got = followups.is_bounce(msg, parseaddr(msg.get("From", ""))[1].lower())
    return got == c["expect"], got


def callday_case(c):
    got = booking.parse_day(c["said"], dt.datetime.fromisoformat(c["now"]).replace(tzinfo=CENTRAL))
    got = got.isoformat() if got else None
    return got == c["expect"], got


def callback_case(c):
    got = receptionist.callback(c["said"], c["caller"])
    return got == c["expect"], got


def urgency_case(c):
    shop = dict(SHOP, trade=c["trade"], profile=shopcfg.validate(c.get("profile", {})))
    got = receptionist.urgency(shop, c["sd"], c.get("summary"))
    return got == c["expect"], got


def prompt_case(c):
    shop = dict(SHOP, **{k: v for k, v in c["client"].items() if k != "profile"})
    shop["profile"] = shopcfg.validate(c["client"].get("profile", {}), shop["trade"])
    a = receptionist.assistant(shop)
    text = "\n".join([a["firstMessage"], a["model"]["messages"][0]["content"]]
                     + [t["function"]["name"] for t in a["model"].get("tools", [])])
    missing = [w for w in c.get("must", []) if w not in text] + [f"NOT {w}" for w in c.get("must_not", []) if w in text]
    return not missing, missing


RUN = {"callday": callday_case, "callback": callback_case, "urgency": urgency_case, "prompt": prompt_case,
       "flaw": flaw_case, "email": email_case, "draft": draft_case, "reply": reply_case, "bounce": bounce_case}


def main(live=False):
    cases, misses, total = load(), [], 0
    for group, items in cases.items():
        passed = 0
        for c in items:
            ok, got = (draft_case(c, live) if group == "draft" else RUN[group](c))
            passed += ok
            if not ok:
                misses.append((group, c.get("name"), c["file"], got))
        total += len(items)
        print(f"{group:7} {passed}/{len(items)}")
    for m in misses:
        print("MISS", *m)
    print(f"total   {total - len(misses)}/{total}")
    return 1 if misses else 0


if __name__ == "__main__":
    sys.exit(main("--live" in sys.argv))
