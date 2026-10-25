"""Tax set-aside and filings for TJ's businesses. Rules and sources: money/TAX.md.

Jarvis can't file or pay. This works out what to set aside from each payment, what each filing
owes and when, and hands TJ one Approve per filing with the numbers and the payment page.
Estimates only: a CPA checks the method once before the first quarterly payment. No network.

  python3 money/tax/tax.py status [--date YYYY-MM-DD] [--json]
  python3 money/tax/tax.py setaside ITEM AMOUNT      how much of one payment goes to the tax account
  python3 money/tax/tax.py import FILE.json          add the agency API's GET /payments rows to income.csv (skips ones already in)
  python3 money/tax/tax.py etsy-import               add the Etsy lane's money/lanes/sales.csv rows (net of Etsy fees and refunds) to income.csv
  python3 money/tax/tax.py moved AMOUNT [--date D]   log money TJ moved into tax savings (pot.csv; negative = took out)
  python3 money/tax/tax.py lint                      exit 1 = income.csv, paid.csv or pot.csv is broken
"""
import csv
import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def m(x):
    return "$" + f"{float(x):,.2f}"


def load(config=HERE / "tax.json", income=HERE / "income.csv", paid=HERE / "paid.csv",
         ledger=ROOT / "money" / "budget" / "ledger.csv"):
    cfg = json.loads(Path(config).read_text(encoding="utf-8"))
    read = lambda p: list(csv.DictReader(open(p, newline="", encoding="utf-8"))) if Path(p).exists() else []
    return cfg, read(income), read(paid), read(ledger)


def import_etsy(income, sales, lane="etsy-digital"):
    """New income rows from the Etsy lane's sales.csv (booked net of Etsy fees and refunds, so cost stays 0). Deduped on
    date + amount + note + which repeat of that line it is; Etsy already collected any sales tax, so sales_tax is 0."""
    have = {r.get("note") for r in income}
    seen, new = {}, []
    for r in sales:
        if r["lane"] != lane:
            continue
        key = f"sales.csv:{r['date']}|{float(r['amount']):.2f}|{r.get('note', '')}"
        seen[key] = seen.get(key, 0) + 1
        note = f"{key}#{seen[key]}"
        if note in have:
            continue
        new.append({"date": r["date"], "client": "Etsy", "item": "etsy", "amount": f"{float(r['amount']):.2f}", "cost": "0.00",
                    "sales_tax": "0.00", "note": note})
    return new


def load_pot(pot=HERE / "pot.csv"):
    """Money moved into the tax savings account (positive) or taken out for anything but a filing (negative)."""
    return list(csv.DictReader(open(pot, newline="", encoding="utf-8"))) if Path(pot).exists() else []


def import_payments(cfg, income, items):
    """New income rows from GET /payments: one per invoice line, deduped on invoice id + item. Blank cost = the item's usual cost."""
    have = {(r.get("note"), r["item"]) for r in income}
    new = []
    for p in items:
        if (p["note"], p["item"]) in have or p["item"] not in cfg["items"]:
            continue
        cost = p.get("cost")
        if cost in (None, ""):
            cost = cfg["items"][p["item"]].get("cost", 0)
        new.append({"date": p["date"], "client": p.get("client", ""), "item": p["item"], "amount": f"{float(p['amount']):.2f}",
                    "cost": f"{float(cost):.2f}", "sales_tax": f"{float(p.get('sales_tax') or 0):.2f}", "note": p["note"]})
        have.add((p["note"], p["item"]))
    return new


def pot_status(cfg, rows, paid, pot, filings, pct, today):
    """The tax savings account: what should be in it, what is, and whether it covers what's due in the next 45 days."""
    moved = round(sum(float(r["amount"]) for r in pot), 2)
    paid_out = round(sum(float(r["amount"]) for r in paid), 2)
    # income share at today's rate, plus the sales tax each row actually carried
    expected = round(sum(setaside(cfg, r["item"], float(r["amount"]), pct)["income_setaside"] + sales_tax(cfg, r) for r in rows), 2)
    due = round(sum(max(f["amount"] - f["paid"], 0) for f in filings
                    if date.fromisoformat(f["due"]) - today <= timedelta(days=45)), 2)
    balance = round(moved - paid_out, 2)
    return {"moved": moved, "balance": balance, "expected": expected, "to_move": round(max(expected - moved, 0), 2),
            "extra": round(max(moved - expected, 0), 2), "due_45": due, "short": round(max(due - balance, 0), 2)}


def lint(cfg, income, paid):
    bad = []
    for i, r in enumerate(income, start=2):
        try:
            date.fromisoformat(r["date"])
        except (ValueError, TypeError):
            bad.append(f"income.csv line {i}: date must be YYYY-MM-DD")
        if r.get("item") not in cfg["items"]:
            bad.append(f"income.csv line {i}: item must be one of {sorted(cfg['items'])}")
        for k in ("amount", "cost"):
            try:
                if float(r.get(k) or 0) < 0 and not (k == "amount" and r.get("item") == "etsy"):  # a refund month can net below 0
                    bad.append(f"income.csv line {i}: {k} can't be negative")
            except ValueError:
                bad.append(f"income.csv line {i}: {k} is not a number")
    for i, r in enumerate(paid, start=2):
        try:
            date.fromisoformat(r["date"]); float(r["amount"])
        except (ValueError, TypeError, KeyError):
            bad.append(f"paid.csv line {i}: needs date YYYY-MM-DD and a number amount")
        if not (r.get("filing") or "").strip():  # a deadline marked done goes in with amount 0
            bad.append(f"paid.csv line {i}: filing id missing (like fed-2027-Q1)")
    return bad


def workday(d):
    """Due dates that land on a weekend move to Monday (IRS and Arkansas both do this; holidays: see TAX.md)."""
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def brackets(x, table):
    """Tax on x from [[upto, rate], ...] with the last upto null."""
    tax, low = 0.0, 0.0
    for upto, rate in table:
        top = x if upto is None else min(x, upto)
        if top > low:
            tax += (top - low) * rate
        if upto is None or x <= upto:
            break
        low = upto
    return tax


def income_tax(cfg, profit):
    """Federal (income + self-employment) and Arkansas tax caused by `profit` of business income on top of TJ's wages."""
    f, a = cfg["federal"], cfg["arkansas"]
    wages = float(cfg.get("w2_wages") or 0)
    p = max(profit, 0)
    se_base = p * f["se_base_share"]
    se = 0.0
    if se_base >= 400:
        se = max(min(se_base, f["ss_wage_base"] - wages), 0) * f["ss_rate"] + se_base * f["medicare_rate"]
    half = se / 2
    before = max(wages - f["standard_deduction"], 0)
    taxable = max(wages + p - half - f["standard_deduction"], 0)
    qbi = min(f["qbi_rate"] * max(p - half, 0), f["qbi_rate"] * taxable)
    fed_income = brackets(taxable - qbi, f["brackets"]) - brackets(before, f["brackets"])
    ar_before = max(wages - a["standard_deduction"], 0)
    ar = brackets(max(wages + p - a["standard_deduction"], 0), a["brackets"]) - brackets(ar_before, a["brackets"])
    return {"se": round(se, 2), "fed_income": round(max(fed_income, 0), 2), "federal": round(se + max(fed_income, 0), 2),
            "arkansas": round(max(ar, 0), 2)}


def sales_tax(cfg, r):
    """Sales tax on one income row: the item's own rule times the Bentonville combined rate."""
    if r.get("sales_tax") not in (None, ""):
        return float(r["sales_tax"])
    return round(float(r["amount"]) * cfg["sales_tax"]["combined"], 2) if cfg["items"][r["item"]]["taxable"] else 0.0


def setaside_pct(cfg, profit_year, days_in):
    """Share of each payment's profit to move to the tax account: the real rate at this year's pace, never under the floor."""
    pace = profit_year * 365 / max(days_in, 30)
    t = income_tax(cfg, pace)
    rate = (t["federal"] + t["arkansas"]) / pace if pace > 0 else 0
    return max(cfg["setaside"]["min_pct"], math.ceil(rate * 100 / 5) * 5)


def setaside(cfg, item, amount, pct):
    it = cfg["items"][item]
    tax = round(amount * cfg["sales_tax"]["combined"], 2) if it["taxable"] else 0.0
    profit = max(amount - float(it.get("cost", 0)), 0)
    keep = round(profit * pct / 100, 2)
    return {"item": item, "price": amount, "sales_tax": tax, "charge": round(amount + tax, 2),
            "income_setaside": keep, "move": round(tax + keep, 2)}


def quarters(year):
    """IRS estimate periods (not calendar quarters) and their due dates; Arkansas AR1000ES uses the same dates."""
    return [("Q1", date(year, 1, 1), date(year, 3, 31), date(year, 4, 15)),
            ("Q2", date(year, 4, 1), date(year, 5, 31), date(year, 6, 15)),
            ("Q3", date(year, 6, 1), date(year, 8, 31), date(year, 9, 15)),
            ("Q4", date(year, 9, 1), date(year, 12, 31), date(year + 1, 1, 15))]


def months(start, end):
    d = date(start.year, start.month, 1)
    while d <= end:
        nxt = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
        yield d, nxt - timedelta(days=1)
        d = nxt


def status(cfg, income, paid, ledger, today, pot=()):
    """Everything the Tax sheet shows. Filings are only built once there's income (or a sales tax permit)."""
    st_cfg = cfg["sales_tax"]
    paid_by = {}
    for r in paid:
        paid_by[r["filing"]] = round(paid_by.get(r["filing"], 0) + float(r["amount"]), 2)
    rows = sorted(income, key=lambda r: r["date"])
    year = today.year
    first = date.fromisoformat(rows[0]["date"]) if rows else None

    def profit(start, end):
        inc = sum(float(r["amount"]) - float(r.get("cost") or 0) for r in rows if start <= date.fromisoformat(r["date"]) <= end)
        spent = sum(float(r["amount"]) * (1 if r["kind"] == "charge" else -1) for r in ledger
                    if r["kind"] in ("charge", "refund") and start <= date.fromisoformat(r["date"]) <= end)
        return round(inc - spent, 2)

    filings = []
    years = sorted({date.fromisoformat(r["date"]).year for r in rows} | ({year} if rows else set()))
    for y in years:
        prior = 0.0
        prior_ar = 0.0
        for q, start, end, due in quarters(y):
            if (first and end < first and y == first.year) or start > today:
                continue
            due = workday(due)
            ytd = profit(date(y, 1, 1), min(end, today))
            t = income_tax(cfg, ytd)
            for kind, need, prev, cfgk in (("fed", t["federal"], prior, "federal"), ("ar", t["arkansas"], prior_ar, "arkansas")):
                fid = f"{kind}-{y}-{q}"
                owe = round(max(need - prev, 0), 2)
                c = cfg[cfgk]
                filings.append({
                    "id": fid, "kind": kind, "title": f"{c['form_name']} {y} {q}", "form": c["form"],
                    "period": f"{start.isoformat()} to {end.isoformat()}", "due": due.isoformat(),
                    "amount": owe, "paid": paid_by.get(fid, 0.0), "pay_url": c["pay_url"], "how": c["how"],
                    "numbers": [f"Business profit this year so far: {m(ytd)}",
                                (f"Self-employment tax {m(t['se'])} + income tax {m(t['fed_income'])} = {m(t['federal'])} for the year so far"
                                 if kind == "fed" else f"Arkansas tax on that profit: {m(t['arkansas'])} for the year so far"),
                                f"Already paid this year: {m(prev)}", f"Pay now: {m(owe)}",
                                f"Payment type: {c['payment_type']}, tax year {y}"],
                })
                if kind == "fed" and need < c["required_over"]:
                    filings[-1]["numbers"].append(f"Under {m(c['required_over'])} for the year so far, so the IRS doesn't require it yet. Paying keeps April easy.")
            # pay as you go: each quarter pays the tax on profit to date minus what earlier quarters covered
            prior, prior_ar = max(prior, t["federal"]), max(prior_ar, t["arkansas"])
    for f in filings:
        f["done"] = f["paid"] >= f["amount"] > 0 or (f["amount"] == 0 and date.fromisoformat(f["due"]) < today)

    if st_cfg.get("permit_from"):
        pfrom = date.fromisoformat(st_cfg["permit_from"])
        freq = st_cfg.get("frequency", "monthly")
        step = {"monthly": 1, "quarterly": 3, "annual": 12}[freq]
        for ms, me in months(pfrom, today):
            if (ms.month - 1) % step:
                continue
            pe = ms
            for _ in range(step):
                pe = date(pe.year + (pe.month == 12), pe.month % 12 + 1, 1)
            pe -= timedelta(days=1)
            if pe.year > ms.year:
                pe = date(ms.year, 12, 31)
            if pe < pfrom:
                continue
            due = workday(date(pe.year + (pe.month == 12), pe.month % 12 + 1, st_cfg["due_day"]))
            own = [r for r in rows if ms <= date.fromisoformat(r["date"]) <= pe and not cfg["items"][r["item"]].get("marketplace")]
            market = round(sum(float(r["amount"]) for r in rows if ms <= date.fromisoformat(r["date"]) <= pe
                               and cfg["items"][r["item"]].get("marketplace")), 2)
            gross = round(sum(float(r["amount"]) for r in own), 2)
            taxable = round(sum(float(r["amount"]) for r in own if cfg["items"][r["item"]]["taxable"]), 2)
            owe = round(sum(sales_tax(cfg, r) for r in own), 2)
            fid = f"sales-{ms.isoformat()[:7]}"
            filings.append({
                "id": fid, "kind": "sales", "title": f"Arkansas sales tax {ms.strftime('%b %Y')}" + (" quarter" if step == 3 else ""),
                "form": st_cfg["form"], "period": f"{ms.isoformat()} to {pe.isoformat()}", "due": due.isoformat(),
                "amount": owe, "paid": paid_by.get(fid, 0.0), "pay_url": st_cfg["pay_url"], "how": st_cfg["how"],
                "numbers": [f"Gross receipts: {m(gross)}", f"Taxable sales: {m(taxable)}", f"Exempt (not taxable in Arkansas): {m(gross - taxable)}",
                            f"Tax at {st_cfg['combined'] * 100:g}% ({st_cfg['where']}): {m(owe)}",
                            *([f"Etsy marketplace sales {m(market)}: Etsy collects and remits the tax, so they are not on this return."] if market else []),
                            "File even if it's $0, or the state charges a late fee."],
                "zero_return": True,
            })
            filings[-1]["done"] = fid in paid_by and paid_by[fid] >= owe

    llc = cfg.get("llc_formed")
    if llc:
        fy = date.fromisoformat(llc).year + 1
        for y in range(fy, today.year + 2):
            fid = f"franchise-{y}"
            filings.append({"id": fid, "kind": "franchise", "title": f"Arkansas LLC franchise tax {y}", "form": cfg["franchise"]["form"],
                            "period": f"{y - 1}", "due": workday(date(y, 5, 1)).isoformat(), "amount": cfg["franchise"]["amount"],
                            "paid": paid_by.get(fid, 0.0), "pay_url": cfg["franchise"]["pay_url"], "how": cfg["franchise"]["how"],
                            "numbers": [f"Flat {m(cfg['franchise']['amount'])} a year for an LLC"],
                            "done": paid_by.get(fid, 0.0) >= cfg["franchise"]["amount"]})

    # other yearly deadlines: no money math, just the steps, the link and a Done tap
    on = {"always": True, "contractors": bool(cfg.get("has_contractors")), "income": bool(rows),
          "insurance": bool(cfg.get("insurance_renews"))}
    for d in cfg.get("deadlines", []):
        if not on.get(d["when"]):
            continue
        if d.get("date_key"):
            due = date.fromisoformat(cfg[d["date_key"]])
            due = due.replace(year=today.year) if due.replace(year=today.year) >= today else due.replace(year=today.year + 1)
            start = due - timedelta(days=30)
        else:
            due = date(today.year, d["month"], d["day"])
            if due < today:
                due = due.replace(year=today.year + 1)
            mo, dy = map(int, d["remind_from"].split("-"))
            start = date(due.year - (mo > d["month"]), mo, dy)
        due = workday(due)
        fid = f"{d['id']}-{due.year}"
        filings.append({"id": fid, "kind": "task", "title": d["title"], "form": "Deadline", "period": f"from {start.isoformat()}",
                        "due": due.isoformat(), "amount": 0, "paid": 0, "pay_url": d["url"], "how": d["how"], "numbers": d["steps"],
                        "done": fid in paid_by, "start": start.isoformat()})

    filings.sort(key=lambda f: f["due"])
    open_ = [f for f in filings if not f["done"] and f.get("start", "") <= today.isoformat()]
    soon = [f for f in open_ if date.fromisoformat(f["due"]) - today <= timedelta(days=cfg["remind_days"])]
    late = [f for f in open_ if date.fromisoformat(f["due"]) < today and f["amount"] > f["paid"]]

    ytd = profit(date(year, 1, 1), today)
    pct = setaside_pct(cfg, ytd, (today - max(date(year, 1, 1), first or today)).days + 1)
    t = income_tax(cfg, ytd)
    tax_collected = round(sum(sales_tax(cfg, r) for r in rows if date.fromisoformat(r["date"]).year == year), 2)
    income_paid = sum(v for k, v in paid_by.items() if k.startswith(("fed-", "ar-")) and f"-{year}-" in k)
    alerts = []
    if not cfg.get("cpa_checked"):
        alerts.append("Have a CPA check these numbers once before the first quarterly payment. One visit, about $150 to $300 (check).")
    if not st_cfg.get("permit_from") and any(cfg["items"][r["item"]]["taxable"] for r in rows):
        alerts.append("A taxable sale is logged but there's no Arkansas sales tax permit yet. Register on ATAP before the next invoice.")
    elif not st_cfg.get("permit_from"):
        alerts.append("Before the first gym invoice or hardware sale: register for an Arkansas sales tax permit on ATAP ($50, one time).")
    if any(r["item"] == "etsy" for r in rows):
        e = round(sum(float(r["amount"]) for r in rows if r["item"] == "etsy" and r["date"][:4] == str(year)), 2)
        alerts.append(f"Etsy income {year} so far: {m(e)} net of Etsy fees. It's in the profit above, so it's in your income and self-employment estimates.")
    if cfg.get("w2_wages") is None:
        alerts.append("Tell Jarvis about how much J Street pays you a year, so the federal number counts your bracket right.")
    for f in late:
        alerts.append(f"{f['title']} was due {f['due']}. Pay it now; late interest grows daily.")
    tp = pot_status(cfg, rows, paid, pot, open_, pct, today)
    if tp["short"] > 0:
        alerts.insert(0, f"Tax savings has {m(tp['balance'])} but {m(tp['due_45'])} is due in the next 45 days. Move {m(tp['short'])} in now.")
    elif tp["to_move"] >= 1:
        alerts.insert(0, f"Move {m(tp['to_move'])} into tax savings to catch up with what's come in.")
    return {
        "pot": tp,
        "as_of": today.isoformat(), "year": year, "profit_ytd": ytd, "setaside_pct": pct,
        "owed_ytd": round(t["federal"] + t["arkansas"] + tax_collected, 2),
        "income_tax_ytd": t, "sales_tax_ytd": tax_collected, "income_tax_paid": round(income_paid, 2),
        "examples": [setaside(cfg, k, v["price"], pct) for k, v in cfg["items"].items() if v.get("price")],
        "items": [{"item": k, "label": v["label"], "taxable": v["taxable"], "why": v["why"]} for k, v in cfg["items"].items()],
        "rate": st_cfg["combined"], "rate_where": st_cfg["where"],
        "filings": open_[:12], "soon": [f["id"] for f in soon], "alerts": alerts,
        "cpa_checked": bool(cfg.get("cpa_checked")), "income_rows": len(rows),
    }


def main(argv):
    args = list(argv)
    today = date.today()
    if "--date" in args:
        i = args.index("--date"); today = date.fromisoformat(args[i + 1]); del args[i:i + 2]
    cfg, income, paid, ledger = load()
    pot = load_pot()
    cmd = args[0] if args else "status"
    problems = lint(cfg, income, paid)
    for i, r in enumerate(pot, start=2):
        try:
            date.fromisoformat(r["date"]); float(r["amount"])
        except (ValueError, TypeError, KeyError):
            problems.append(f"pot.csv line {i}: needs date YYYY-MM-DD and a number amount")
    if cmd == "lint":
        print("\n".join(problems) or "Tax files OK")
        return 1 if problems else 0
    if problems:
        print("Tax files are broken, fix them first:\n" + "\n".join(problems))
        return 1
    if cmd == "import":
        new = import_payments(cfg, income, json.loads(Path(args[1]).read_text(encoding="utf-8"))["items"])
        if new:
            with open(HERE / "income.csv", "a", newline="", encoding="utf-8") as f:
                csv.DictWriter(f, fieldnames=list(new[0])).writerows(new)
        print(f"Added {len(new)} income rows")
        return 0
    if cmd == "etsy-import":
        sp = ROOT / "money" / "lanes" / "sales.csv"
        sales = list(csv.DictReader(open(sp, newline="", encoding="utf-8"))) if sp.exists() else []
        new = import_etsy(income, sales)
        if new:
            with open(HERE / "income.csv", "a", newline="", encoding="utf-8") as f:
                csv.DictWriter(f, fieldnames=list(new[0])).writerows(new)
        print(f"Added {len(new)} Etsy income rows")
        return 0
    if cmd == "moved":
        amount = float(args[1])
        with open(HERE / "pot.csv", "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow([today.isoformat(), f"{amount:.2f}", " ".join(args[2:]) or "moved to tax savings"])
        pot = load_pot()
    st = status(cfg, income, paid, ledger, today, pot)
    if cmd == "setaside":
        s = setaside(cfg, args[1], float(args[2]), st["setaside_pct"])
        print(f"Charge {m(s['charge'])} ({m(s['price'])} + {m(s['sales_tax'])} sales tax). "
              f"Move {m(s['move'])} to the tax account ({m(s['sales_tax'])} sales tax + {m(s['income_setaside'])}, {st['setaside_pct']}% of profit).")
        return 0
    if "--json" in args:
        print(json.dumps(st, indent=1))
        return 0
    tp = st["pot"]
    print(f"Tax savings {m(tp['balance'])} | should have moved {m(tp['expected'])}, moved {m(tp['moved'])} | due in 45 days {m(tp['due_45'])}")
    print(f"Profit {st['year']} so far {m(st['profit_ytd'])} | set aside {st['setaside_pct']}% of profit + all sales tax | owed so far {m(st['owed_ytd'])}")
    for f in st["filings"]:
        print(f"  due {f['due']}  {f['title']}  {m(f['amount'])}" + ("  (soon)" if f["id"] in st["soon"] else ""))
    for a in st["alerts"]:
        print("! " + a)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
