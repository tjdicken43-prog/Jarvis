"""Offline test of the budget guard: the floor holds, caps hold, unknown services need TJ, the real ledger is clean."""
import csv, importlib.util, io, json, pathlib, sys, tempfile
from datetime import date

HERE = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("budget", HERE / "budget" / "budget.py")
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)

CFG = {"refill": {"amount": 150, "every_days": 14, "first": "2026-10-27"}, "floor": 25, "warn_at_cap": 0.8,
       "caps_30d": {"anthropic-api": 20, "render": 10, "domains": 15},
       "recurring": [{"service": "anthropic-api", "amount": 20, "monthly_from": "2026-10-27"},
                     {"service": "render", "amount": 7.25, "monthly_from": "2026-11-01"}],
       "planned": [{"service": "domains", "amount": 12, "date": "2026-10-27"}]}
D = date.fromisoformat

def row(d, kind, service, amount, by="TJ"):
    return {"date": d, "kind": kind, "service": service, "amount": str(amount), "approved_by": by, "note": ""}

# before payday: nothing to spend, everything refused
st = b.status(CFG, [], D("2026-10-24"))
assert st["balance"] == 0 and st["frozen"] and "Nothing gets bought" in st["alerts"][0], st
assert st["days_to_refill"] == 3 and st["next_refill"] == "2026-10-27"
v, why = b.check(CFG, [], "domains", 12, D("2026-10-24"))
assert v == "no" and "No money" in why[0] and "reserve" in why[1], why

# payday: refill counts even before TJ logs it; forecast covers the two weeks
st = b.status(CFG, [], D("2026-10-27"))
assert st["balance"] == 150 and st["committed"] == 39.25 and st["headroom"] == 85.75, st
# recurring inside its cap runs through; a planned one-off still asks TJ (not counted twice either way)
assert b.check(CFG, [], "anthropic-api", 20, D("2026-10-27")) == ("auto", [])
v, why = b.check(CFG, [], "domains", 12, D("2026-10-27"))
assert v == "ask" and "one-off" in why[0], why

# paying a forecast line removes it from the forecast (no double count)
rows = [row("2026-10-27", "charge", "domains", 12), row("2026-10-27", "charge", "anthropic-api", 20, "recurring")]
st = b.status(CFG, rows, D("2026-10-28"))
assert st["balance"] == 118 and st["committed"] == 7.25 and st["headroom"] == 85.75, st

# a logged refill is not counted twice
assert b.balance(CFG, [row("2026-10-27", "refill", "card", 150)], D("2026-10-28")) == 150

# cap: anthropic already at $20 in 30 days
v, why = b.check(CFG, rows, "anthropic-api", 5, D("2026-10-29"))
assert v == "ask" and "over its $20.00 cap" in why[0], why
assert any("anthropic-api has used" in a for a in st["alerts"]), st["alerts"]

# new rule (TJ, 2026-10-24): a one-off needs TJ, a recurring bill of $25 or less runs, over $25 asks
v, why = b.check(CFG, rows, "vercel", 1, D("2026-10-29"))
assert v == "ask" and "one-off" in why[0], why
assert b.check(CFG, rows, "vercel", 20, D("2026-10-29"), recurring_bill=True) == ("auto", [])
v, why = b.check(CFG, rows, "vercel", 26, D("2026-10-29"), recurring_bill=True)
assert v == "ask" and "over $25.00" in why[0], why
assert b.check(CFG, rows + [row("2026-10-28", "charge", "vercel", 20)], "vercel", 10, D("2026-10-29"), recurring_bill=True)[0] == "ask"

# floor: a buy that would leave under $25 after what's due is refused, even inside caps
big = dict(CFG, caps_30d=dict(CFG["caps_30d"], other=500))
v, why = b.check(big, rows, "other", 90, D("2026-10-29"))
assert v == "no" and "reserve" in why[0], why  # the reserve beats any approval
assert b.check(big, rows, "other", 80, D("2026-10-29"))[0] == "ask"

# recurring that would cross the floor warns ahead of time
heavy = dict(CFG, recurring=CFG["recurring"] + [{"service": "render", "amount": 120, "monthly_from": "2026-11-05"}])
st = b.status(heavy, rows, D("2026-10-29"))
assert st["frozen"] and any("Cut or pause" in a for a in st["alerts"]), st["alerts"]

# next refill rolls over after payday, carryover kept
st = b.status(CFG, rows, D("2026-11-10"))
assert st["next_refill"] == "2026-11-24" and st["balance"] == 268 and st["committed"] == 7.25, st
assert any("render $7.25 was due 2026-11-01 but isn't in the ledger" in a for a in st["alerts"]), st["alerts"]

# lint catches unapproved charges, bad kinds, negative amounts, uncapped services
bad = b.lint(CFG, [row("2026-10-27", "charge", "domains", 12, ""), row("x", "spend", "domains", -1),
                   row("2026-10-27", "charge", "vercel", 3)])
assert len(bad) == 5, bad

# the real files are clean and the CLI works
cfg, real = b.load()
assert b.lint(cfg, real) == [], b.lint(cfg, real)
assert b.main(["status", "--date", "2026-10-24", "--json"]) == 0
assert b.main(["check", "domains", "12", "--date", "2026-10-24"]) == 1
assert b.main(["check", "anthropic-api", "20", "--date", "2026-10-27"]) == 0
assert b.main(["check", "vercel", "5", "--date", "2026-10-27"]) == 2
# lanes (TJ, 2026-10-24): a lane spends only its wallet; 60-day first term, then a losing month shuts it
LC = dict(CFG, caps_30d=dict(CFG["caps_30d"], etsy=40), lanes={"etsy-digital": {
    "status": "running", "start": "2026-11-03", "allowance_30d": 40, "first_term_days": 60, "services": ["etsy"]}})
sale = lambda d, amt: {"date": d, "lane": "etsy-digital", "amount": str(amt), "note": ""}
r = b.lane_report(LC, [], [], "etsy-digital", D("2026-11-10"))
assert r["verdict"] == "first term" and r["left"] == 40 and r["period"] == 1, r
spend = [row("2026-11-04", "charge", "etsy", 30, "recurring")]
r = b.lane_report(LC, spend, [], "etsy-digital", D("2026-11-20"))
assert r["verdict"] == "first term" and r["left"] == 10, r  # month 1 loses money but isn't judged on it
spend.append(row("2026-11-05", "charge", "etsy", 10, "recurring"))
assert b.lane_report(LC, spend, [], "etsy-digital", D("2026-11-20"))["verdict"] == "shut"  # wallet empty
m2 = [row("2026-12-05", "charge", "etsy", 20, "recurring")]
assert b.lane_report(LC, m2, [sale("2026-12-10", 25)], "etsy-digital", D("2027-01-05"))["verdict"] == "keep"
r = b.lane_report(LC, m2, [sale("2026-12-10", 5)], "etsy-digital", D("2027-01-05"))
assert r["verdict"] == "shut" and "Month 2" in r["why"], r
assert b.lane_report(dict(LC, lanes={"etsy-digital": dict(LC["lanes"]["etsy-digital"], status="planned")}),
                     [], [], "etsy-digital", D("2026-11-10"))["verdict"] == "planned"
# the wallet is enforced in check(), and a planned or shut lane can't spend at all
b.load_sales = lambda *a: []
assert b.check(LC, [], "etsy", 5, D("2026-11-10"), recurring_bill=True) == ("auto", [])
v, why = b.check(LC, spend[:1], "etsy", 15, D("2026-11-10"), recurring_bill=True)
assert v == "no" and "left in its wallet" in why[0], why
v, why = b.check(dict(LC, lanes={"etsy-digital": dict(LC["lanes"]["etsy-digital"], status="shut")}), [], "etsy", 1,
                 D("2026-11-10"), recurring_bill=True)
assert v == "no" and "shut" in why[0], why
assert b.main(["lanes", "--date", "2026-10-24"]) == 0
# surplus (TJ, 2026-10-25): wallet stays $40; profit - tax - $40 goes to the card, taxes first
s1 = b.lane_surplus(LC, [row("2026-11-04", "charge", "etsy", 20, "recurring")], [sale("2026-11-10", 220)], "etsy-digital", 1, 25)
assert (s1["profit"], s1["tax"], s1["surplus"], s1["to_card"]) == (200, 50, 110, 110), s1  # 200 - 50 tax - 40 kept
assert b.lane_surplus(LC, [], [sale("2026-11-10", 50)], "etsy-digital", 1, 25)["surplus"] == 0  # 50 - 12.5 tax < 40 kept
assert b.lane_surplus(LC, [], [sale("2026-12-10", 300)], "etsy-digital", 1, 25)["made"] == 0  # month 2 sale isn't month 1
done = [row("2026-12-04", "topup", "etsy-digital", 100, "TJ")]; done[0]["note"] = "etsy-digital month 1 surplus"
s2 = b.lane_surplus(LC, done, [sale("2026-11-10", 220)], "etsy-digital", 1, 25)
assert s2["credited"] == 100 and s2["to_card"] == round(s2["surplus"] - 100, 2), s2
# only closed months, only running lanes
assert b.lane_surpluses(LC, [], [sale("2026-11-10", 220)], D("2026-11-20"), 25) == []
assert len(b.lane_surpluses(LC, [], [sale("2026-11-10", 220)], D("2026-12-04"), 25)) == 1
# a top-up credit raises the card balance and passes lint
assert b.balance(CFG, [row("2026-10-28", "topup", "etsy-digital", 50, "TJ")], D("2026-10-28")) == b.balance(CFG, [], D("2026-10-28")) + 50
assert any("approved_by" in w for w in b.lint(CFG, [row("2026-10-28", "topup", "etsy-digital", 50, "")]))
print("budget: all checks passed")
