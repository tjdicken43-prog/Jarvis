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

# unknown service needs TJ
v, why = b.check(CFG, rows, "vercel", 1, D("2026-10-29"))
assert v == "ask" and "is new" in why[0], why

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
print("budget: all checks passed")
