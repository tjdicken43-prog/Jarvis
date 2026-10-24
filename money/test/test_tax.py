"""Offline test of the tax module: set-aside math, sales tax per item, quarterly and monthly filings, the real files are clean."""
import copy, importlib.util, json, pathlib
from datetime import date

HERE = pathlib.Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("tax", HERE / "tax" / "tax.py")
t = importlib.util.module_from_spec(spec); spec.loader.exec_module(t)
CFG = json.loads((HERE / "tax" / "tax.json").read_text())
D = date.fromisoformat

def inc(d, item, amount, cost=0):
    return {"date": d, "client": "x", "item": item, "amount": str(amount), "cost": str(cost), "sales_tax": "", "note": ""}

# brackets: 10% then 12%
assert round(t.brackets(20000, CFG["federal"]["brackets"]), 2) == 1240 + 912
# no profit, no tax; under $400 of SE earnings, no SE tax
assert t.income_tax(CFG, 0) == {"se": 0, "fed_income": 0, "federal": 0, "arkansas": 0}
assert t.income_tax(CFG, 300)["se"] == 0
# $10k profit, no wages: SE tax 15.3% of 92.35%, income tax 0 (under the standard deduction)
x = t.income_tax(CFG, 10000)
assert abs(x["se"] - 10000 * 0.9235 * 0.153) < 0.01 and x["fed_income"] == 0, x
# with wages the same profit costs more (bracket stacking)
w = copy.deepcopy(CFG); w["w2_wages"] = 30000
assert t.income_tax(w, 10000)["fed_income"] > 0 and t.income_tax(w, 10000)["arkansas"] > 0

# sales tax only on taxable items, at 9.5%
assert t.sales_tax(CFG, inc("2027-01-05", "monitoring", 200)) == 19.0
assert t.sales_tax(CFG, inc("2027-01-05", "receptionist", 149)) == 0
s = t.setaside(CFG, "hardware", 275, 25)
assert s == {"item": "hardware", "price": 275, "sales_tax": 26.12, "charge": 301.12, "income_setaside": 0, "move": 26.12}, s

# nothing logged: no filings, CPA + permit alerts
st = t.status(CFG, [], [], [], D("2026-10-24"))
assert st["filings"] == [] and "CPA" in st["alerts"][0] and "permit" in st["alerts"][1], st

# first income in November: Q4 federal + Arkansas filings due Jan 15 2027; earlier quarters skipped
rows = [inc("2026-11-03", "setup", 299), inc("2026-11-03", "receptionist", 149, 60), inc("2026-12-03", "receptionist", 149, 60)]
st = t.status(CFG, rows, [], [], D("2026-12-20"))
ids = [f["id"] for f in st["filings"]]
assert ids == ["fed-2026-Q4", "bentonville-registry-2026", "ar-2026-Q4"] or ids == ["bentonville-registry-2026", "fed-2026-Q4", "ar-2026-Q4"], ids
fed = next(f for f in st["filings"] if f["id"] == "fed-2026-Q4")
assert fed["due"] == "2027-01-15" and fed["amount"] == t.income_tax(CFG, 477)["federal"] and fed["pay_url"].startswith("https://www.irs.gov/")
assert any("doesn't require" in n for n in fed["numbers"])  # under $1,000 for the year
assert st["soon"] == [] and t.status(CFG, rows, [], [], D("2027-01-08"))["soon"] == ["fed-2026-Q4", "ar-2026-Q4"]
# yearly deadlines: Done closes this year's, next year's shows from its reminder date; 1099s only with contractors
done = [{"date": "2026-12-01", "filing": "bentonville-registry-2026", "amount": "0", "note": "renewed"}]
assert "bentonville-registry-2026" not in [f["id"] for f in t.status(CFG, rows, done, [], D("2026-12-20"))["filings"]]
assert "bentonville-registry-2027" not in [f["id"] for f in t.status(CFG, rows, done, [], D("2027-10-20"))["filings"]]
assert "bentonville-registry-2027" in [f["id"] for f in t.status(CFG, rows, done, [], D("2027-11-02"))["filings"]]
assert not any(f["id"].startswith("1099") for f in t.status(CFG, rows, [], [], D("2027-01-20"))["filings"])
c2 = copy.deepcopy(CFG); c2["has_contractors"] = True
assert any(f["id"] == "1099-nec-2027" and f["due"] == "2027-02-01" for f in t.status(c2, rows, [], [], D("2027-01-20"))["filings"])  # Jan 31 2027 is a Sunday

# paying a filing closes it; the next quarter only owes the new profit
cfg = copy.deepcopy(CFG); cfg["sales_tax"]["permit_from"] = "2027-01-01"; cfg["w2_wages"] = 30000
fed = next(f for f in t.status(cfg, rows, [], [], D("2026-12-20"))["filings"] if f["id"] == "fed-2026-Q4")
rows += [inc("2027-01-10", "monitoring", 200, 10), inc("2027-01-10", "hardware", 275, 275), inc("2027-02-10", "monitoring", 200, 10)]
paid = [{"date": "2027-01-14", "filing": "fed-2026-Q4", "amount": str(fed["amount"]), "note": ""}]
st = t.status(cfg, rows, paid, [], D("2027-02-25"))
ids = [f["id"] for f in st["filings"]]
assert "fed-2026-Q4" not in ids and "ar-2026-Q4" in ids, ids  # Arkansas one is late and stays open
assert any("Arkansas estimate 2026 Q4" in a for a in st["alerts"]), st["alerts"]
assert not any(f["id"].endswith("2027-Q2") for f in st["filings"])  # quarters that haven't started don't show
jan = next(f for f in st["filings"] if f["id"] == "sales-2027-01")
assert jan["due"] == "2027-02-22" and jan["amount"] == 45.12, jan  # Feb 20 2027 is a Saturday
assert next(f for f in st["filings"] if f["id"] == "sales-2027-02")["amount"] == 19.0
q1 = next(f for f in st["filings"] if f["id"] == "fed-2027-Q1")
assert q1["amount"] == t.income_tax(cfg, 380)["federal"] and q1["due"] == "2027-04-15"

# card spending lowers profit
ledger = [{"date": "2027-01-02", "kind": "charge", "service": "render", "amount": "80", "approved_by": "TJ", "note": ""}]
assert t.status(cfg, rows, paid, ledger, D("2027-02-25"))["profit_ytd"] == 300

# LLC franchise tax shows up the May after it's formed
cfg["llc_formed"] = "2026-11-15"
st = t.status(cfg, rows, paid, [], D("2027-04-25"))
assert any(f["id"] == "franchise-2027" and f["due"] == "2027-05-03" for f in st["filings"])  # May 1 2027 is a Saturday

# tax savings: what should be in it vs what is, and a warning when it can't cover what's due soon
c3 = copy.deepcopy(CFG); c3["sales_tax"]["permit_from"] = "2027-01-01"
r3 = [inc("2027-01-10", "monitoring", 200, 10), inc("2027-01-10", "setup", 299)]
st = t.status(c3, r3, [], [], D("2027-02-10"))
tp = st["pot"]
assert tp["expected"] == 19 + 47.5 + 74.75 and tp["to_move"] == tp["expected"] and tp["balance"] == 0, tp
assert st["alerts"][0].startswith("Tax savings has $0.00 but $19.00 is due"), st["alerts"]
assert tp["due_45"] == 19.0, tp  # January sales tax, due Feb 22
pot = [{"date": "2027-01-11", "amount": "141.25", "note": ""}]
st = t.status(c3, r3, [], [], D("2027-02-10"), pot)
assert st["pot"]["to_move"] == 0 and st["pot"]["short"] == 0 and not any("tax savings" in a for a in st["alerts"]), st
paid = [{"date": "2027-02-15", "filing": "sales-2027-01", "amount": "19", "note": ""}]
assert t.status(c3, r3, paid, [], D("2027-02-16"), pot)["pot"]["balance"] == 122.25
# importing /payments rows: deduped, usual cost filled in
pay = [{"date": "2027-03-01", "client": "A", "item": "receptionist", "amount": 149, "sales_tax": 0, "note": "in_1"},
       {"date": "2027-03-01", "client": "A", "item": "setup", "amount": 299, "sales_tax": 0, "note": "in_1"}]
new = t.import_payments(CFG, [], pay)
assert len(new) == 2 and new[0]["cost"] == "60.00" and t.lint(CFG, new, []) == []
assert t.import_payments(CFG, new, pay) == []

# the real files
cfg, income, paid, ledger = t.load()
assert t.lint(cfg, income, paid) == [], t.lint(cfg, income, paid)
assert t.lint(cfg, [inc("bad", "nope", -1)], [{"date": "2027-01-01", "filing": "", "amount": "x"}])
print("tax ok")
