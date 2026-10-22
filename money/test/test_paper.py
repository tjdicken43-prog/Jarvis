"""Offline test: fake DexScreener answers, check buys, fees, exits and the summary."""
import importlib.util, json, pathlib, sys, tempfile, time

spec = importlib.util.spec_from_file_location("paper", pathlib.Path(__file__).parents[1] / "fomo" / "paper.py")
paper = importlib.util.module_from_spec(spec); spec.loader.exec_module(paper)

now_ms = int(time.time() * 1000)
price = {"v": 1.0, "liq": 100_000}

def pair():
    return {"chainId": "solana", "pairAddress": "PAIR1", "url": "https://dexscreener.com/solana/pair1",
            "baseToken": {"address": "TOK1", "symbol": "TEST"}, "priceUsd": str(price["v"]),
            "liquidity": {"usd": price["liq"]}, "fdv": 2_000_000, "pairCreatedAt": now_ms - 5 * 3_600_000,
            "volume": {"h1": 90_000}, "txns": {"h1": {"buys": 300, "sells": 200}},
            "priceChange": {"h1": 20, "m5": 1}}

def fake_get(path, tries=3):
    if path.startswith("/token-"):
        return [{"chainId": "solana", "tokenAddress": "TOK1"}]
    if path.startswith("/tokens/v1/"):
        return [pair()]
    if path.startswith("/latest/dex/pairs/"):
        return {"pairs": [pair()]}
    return None

paper.get = fake_get
d = pathlib.Path(tempfile.mkdtemp())
paper.run(d)
st = json.loads((d / "state.json").read_text())
sm = st["strategies"]["steady_momentum"]
assert len(sm["open"]) == 1 and sm["cash"] == 900, sm
assert abs(sm["fees"] - 0.95) < 1e-9, sm["fees"]          # $100 buy hits the $0.95 minimum
assert st["strategies"]["fresh_launch"]["open"] == []      # 5h old: too old for fresh_launch

price["v"] = 1.5                                           # +50% -> take profit
paper.run(d)
st = json.loads((d / "state.json").read_text())
sm = st["strategies"]["steady_momentum"]
rows = (d / "trades.csv").read_text().splitlines()
assert any(",SELL," in r and "take profit" in r for r in rows), rows
assert sm["wins"] == 1, sm

price["v"] = 1.0; paper.run(d)                             # cooldown: no re-entry right after selling
st = json.loads((d / "state.json").read_text())
assert st["strategies"]["steady_momentum"]["open"] == []
for b in st["strategies"].values():
    b["cooldown"] = {}
(d / "state.json").write_text(json.dumps(st)); paper.run(d)  # cooldown over -> buys again
price["liq"] = 5_000; paper.run(d)                         # liquidity pulled -> rug exit, a loss
st = json.loads((d / "state.json").read_text())
assert st["strategies"]["steady_momentum"]["losses"] == 1
assert "rug" in (d / "trades.csv").read_text()
assert "steady_momentum" in (d / "summary.md").read_text()
print("paper ok")
