"""Budget guard for the business card. Rules: money/BUDGET.md.

The card limit is the real hard stop; this script is the agents' rulebook check before anything
is bought, and the source of the HUD's Budget sheet. No network, no card data.

  python3 money/budget/budget.py status [--date YYYY-MM-DD] [--json]
  python3 money/budget/budget.py check SERVICE AMOUNT [--recurring] [--date YYYY-MM-DD]
      exit 0 = runs through (a recurring business bill of $25 or less, reserve safe)
      exit 2 = ask TJ: put it in the tracker for his Approve button (over $25, or a one-off)
      exit 1 = no: before payday or it would dip into the $25 reserve; even TJ's button can't
  python3 money/budget/budget.py lint                                       exit 1 = ledger is broken
"""
import calendar
import csv
import json
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
KINDS = {"refill", "charge", "refund"}


def m(x):
    return "$" + f"{float(x):.2f}"


def load(config=HERE / "budget.json", ledger=HERE / "ledger.csv"):
    cfg = json.loads(Path(config).read_text(encoding="utf-8"))
    with open(ledger, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return cfg, rows


def lint(cfg, rows):
    """Every problem with the ledger, as plain sentences. Empty list = clean."""
    bad = []
    for i, r in enumerate(rows, start=2):
        try:
            date.fromisoformat(r["date"])
        except (ValueError, TypeError):
            bad.append(f"line {i}: date must be YYYY-MM-DD")
        if r.get("kind") not in KINDS:
            bad.append(f"line {i}: kind must be one of {sorted(KINDS)}")
        try:
            if float(r["amount"]) <= 0:
                bad.append(f"line {i}: amount must be positive (kind says which way it goes)")
        except (ValueError, TypeError):
            bad.append(f"line {i}: amount is not a number")
        if r.get("kind") == "charge" and not (r.get("approved_by") or "").strip():
            bad.append(f"line {i}: every charge needs approved_by (TJ, or the recurring line it matches)")
        if r.get("kind") == "charge" and r.get("service") not in cfg["caps_30d"]:
            bad.append(f"line {i}: {r.get('service')} has no cap in budget.json")
    return bad


def add_month(d):
    y, m = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def refills(cfg, until):
    d, step = date.fromisoformat(cfg["refill"]["first"]), timedelta(days=cfg["refill"]["every_days"])
    while d <= until:
        yield d
        d += step


def refill_amount(cfg, d):
    """The first refill can differ from the rest (TJ, 2026-10-24: $175 on 2026-10-27, then $100 every two weeks)."""
    r = cfg["refill"]
    return r.get("first_amount", r["amount"]) if d.isoformat() == r["first"] else r["amount"]


def next_refill(cfg, today):
    d, step = date.fromisoformat(cfg["refill"]["first"]), timedelta(days=cfg["refill"]["every_days"])
    while d <= today:
        d += step
    return d


def due(cfg, start, end):
    """Recurring and planned charges falling in [start, end)."""
    out = []
    for r in cfg.get("recurring", []):
        d = date.fromisoformat(r["monthly_from"])
        while d < end:
            if d >= start:
                out.append({"date": d.isoformat(), "service": r["service"], "amount": r["amount"], "note": r.get("note", "")})
            d = add_month(d)
    for p in cfg.get("planned", []):
        d = date.fromisoformat(p["date"])
        if start <= d < end:
            out.append({"date": p["date"], "service": p["service"], "amount": p["amount"], "note": p.get("note", "")})
    return sorted(out, key=lambda x: x["date"])


def unpaid(items, rows, today):
    """Drop forecast items already paid: a logged charge for that service from 5 days before it was due up to today."""
    left = []
    used = set()
    for c in items:
        d = date.fromisoformat(c["date"])
        hit = next((i for i, r in enumerate(rows) if i not in used and r["kind"] == "charge" and r["service"] == c["service"]
                    and d - timedelta(days=5) <= date.fromisoformat(r["date"]) <= today), None)
        if hit is None:
            left.append(c)
        else:
            used.add(hit)
    return left


def balance(cfg, rows, today):
    """Money left on the card today. A refill counts on its date even before TJ logs it, since he raises the limit that day."""
    logged = {r["date"] for r in rows if r["kind"] == "refill"}
    bal = sum(refill_amount(cfg, d) for d in refills(cfg, today) if d.isoformat() not in logged)
    for r in rows:
        if date.fromisoformat(r["date"]) > today:
            continue
        amt = float(r["amount"])
        bal += -amt if r["kind"] == "charge" else amt
    return round(bal, 2)


def spent_30d(rows, service, today):
    since = today - timedelta(days=30)
    return round(sum(float(r["amount"]) * (1 if r["kind"] == "charge" else -1)
                     for r in rows if r["service"] == service and r["kind"] in ("charge", "refund")
                     and since < date.fromisoformat(r["date"]) <= today), 2)


def status(cfg, rows, today):
    floor, nxt = cfg["floor"], next_refill(cfg, today)
    bal = balance(cfg, rows, today)
    # look back a full period so a charge that should have hit but was never logged stays counted and gets flagged
    coming = unpaid(due(cfg, today - timedelta(days=cfg["refill"]["every_days"]), nxt), rows, today)
    committed = round(sum(c["amount"] for c in coming), 2)
    after = nxt + timedelta(days=cfg["refill"]["every_days"])
    next_period = due(cfg, nxt, after)
    next_need = round(sum(c["amount"] for c in next_period), 2)
    headroom = round(bal - committed - floor, 2)
    services = []
    for s, cap in cfg["caps_30d"].items():
        spent = spent_30d(rows, s, today)
        services.append({"service": s, "spent_30d": spent, "cap": cap, "left": round(cap - spent, 2)})
    alerts = []
    if bal <= 0 and today < date.fromisoformat(cfg["refill"]["first"]):
        alerts.append(f"No money on the card until {cfg['refill']['first']}. Nothing gets bought before then.")
    elif bal < floor:
        alerts.append(f"Below the {m(floor)} floor: all spending is frozen until {nxt.isoformat()}.")
    elif headroom < 0:
        alerts.append(f"Charges due before {nxt.isoformat()} ({m(committed)}) would take the card under {m(floor)}. Cut or pause one now.")
    if next_need > refill_amount(cfg, nxt) - floor:
        alerts.append(f"The next two weeks need {m(next_need)}, more than the {m(refill_amount(cfg, nxt) - floor)} a refill can safely cover.")
    for c in coming:
        if c["date"] < today.isoformat():
            alerts.append(f"{c['service']} {m(c['amount'])} was due {c['date']} but isn't in the ledger. Check the card and log it.")
    for s in services:
        if s["spent_30d"] >= cfg["warn_at_cap"] * s["cap"] > 0:
            alerts.append(f"{s['service']} has used {m(s['spent_30d'])} of its {m(s['cap'])} cap.")
    return {
        "as_of": today.isoformat(), "balance": bal, "floor": floor, "refill": refill_amount(cfg, nxt),
        "next_refill": nxt.isoformat(), "days_to_refill": (nxt - today).days,
        "committed": committed, "headroom": max(headroom, 0), "coming": coming,
        "next_period": next_period, "next_period_need": next_need,
        "services": services, "alerts": alerts,
        "frozen": bal < floor or headroom < 0,
        "recent": [r for r in rows if r["kind"] != "refill"][-8:][::-1],
    }


def check(cfg, rows, service, amount, today, recurring_bill=False):
    """("auto" | "ask" | "no", reasons). TJ's rule, 2026-10-24.

    auto: a recurring business bill of $25 or less (a recurring line in budget.json, or a new one flagged
          --recurring), the service's 30 days staying inside its cap (never over $25), reserve safe. Pay and log approved_by=recurring.
    ask:  over $25, or a one-off. Goes to TJ's Approve button in the tracker.
    no:   before payday, or it would take the card under the floor. Nobody overrides that from the page.
    """
    st = status(cfg, rows, today)
    hard, soft = [], []
    if st["balance"] <= 0 and today < date.fromisoformat(cfg["refill"]["first"]):
        hard.append(f"No money on the card until {cfg['refill']['first']}.")
    if amount <= 0:
        hard.append("amount must be positive")
    # buying something already forecast replaces that line instead of adding to it
    match = next((c for c in st["coming"] if c["service"] == service), None)
    committed = st["committed"] - (min(match["amount"], amount) if match else 0)
    left = round(st["balance"] - committed - amount, 2)
    if left < st["floor"]:
        hard.append(f"That leaves {m(left)} after charges due before "
                    f"{st['next_refill']}, under the {m(st['floor'])} reserve.")
    # TJ can raise the run-through limit for one service (2026-10-24: Render up to $35 a month)
    limit = cfg.get("ask_over_by_service", {}).get(service, cfg.get("ask_over", 25))
    recurring = recurring_bill or service in {r["service"] for r in cfg.get("recurring", [])}
    spent = spent_30d(rows, service, today)
    if not recurring:
        soft.append(f"{service} isn't a recurring bill, so it's a one-off. Needs TJ's OK.")
    elif amount > limit:
        soft.append(f"{m(amount)} is over {m(limit)}. Needs TJ's OK.")
    else:
        # a known line keeps its own 30-day cap (it matches the limit set on the service itself)
        cap = min(cfg["caps_30d"].get(service, limit), limit)
        if spent + amount > cap:
            soft.append(f"{service} would hit {m(spent + amount)} in 30 days, over its {m(cap)} cap. Needs TJ's OK.")
    if hard:
        return "no", hard + soft
    return ("ask", soft) if soft else ("auto", [])


def main(argv):
    args = list(argv)
    today = date.today()
    if "--date" in args:
        i = args.index("--date"); today = date.fromisoformat(args[i + 1]); del args[i:i + 2]
    cfg, rows = load()
    cmd = args[0] if args else "status"
    problems = lint(cfg, rows)
    if cmd == "lint":
        print("\n".join(problems) or "Ledger OK")
        return 1 if problems else 0
    if problems:
        print("Ledger is broken, fix it before anything else:\n" + "\n".join(problems))
        return 1
    if cmd == "check":
        rec = "--recurring" in args
        args = [a for a in args if a != "--recurring"]
        verdict, why = check(cfg, rows, args[1], float(args[2]), today, rec)
        head = {"auto": "Runs through (recurring, $" + f"{cfg.get('ask_over', 25):g}" + " or less, reserve safe)",
                "ask": "Ask TJ: add it to the tracker for his Approve button",
                "no": "Do not buy"}[verdict]
        print(head + "".join("\n- " + w for w in why))
        return {"auto": 0, "no": 1, "ask": 2}[verdict]
    st = status(cfg, rows, today)
    if "--json" in args:
        print(json.dumps(st, indent=1))
        return 0
    print(f"Card {m(st['balance'])} | floor {m(st['floor'])} | safe to spend {m(st['headroom'])} | refill in {st['days_to_refill']} days ({st['next_refill']})")
    for c in st["coming"]:
        print(f"  due {c['date']}  {c['service']}  {m(c['amount'])}")
    for a in st["alerts"]:
        print("! " + a)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
