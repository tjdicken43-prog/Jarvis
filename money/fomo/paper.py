#!/usr/bin/env python3
"""Meme coin PAPER trader. No real money, no wallet, never touches the Fomo app.

Runs on GitHub Actions every 15 minutes:
  python3 money/fomo/paper.py --state DIR
Reads/writes DIR/state.json, DIR/trades.csv, DIR/summary.md.

Market data: DexScreener public API. Costs are modeled on Fomo's spot fees
(0.5% per side, about $0.95 minimum on small trades) plus price impact from
pool liquidity, so paper results are not flattered.
Each strategy has its own paper bankroll, so they can be compared.
"""
import argparse
import csv
import datetime as dt
import json
import pathlib
import time
import urllib.request

API = "https://api.dexscreener.com"
UA = "SitesByTJ-paper-bot/1.0"
CHAINS = ("solana", "base", "bsc")  # chains Fomo trades that DexScreener lists

FEE_PCT = 0.005
FEE_MIN = 0.95

STRATEGIES = {
    # Momentum on tokens that have survived a while and still have real buyers.
    "steady_momentum": dict(
        bankroll=1000, size=100, max_open=5,
        min_liq=40_000, max_fdv=25_000_000, min_age_h=3, max_age_h=96,
        min_vol_h1=40_000, min_buy_ratio=1.15, h1_change=(5, 60), m5_min=0,
        take_profit=0.40, stop_loss=-0.25, max_hold_h=24,
    ),
    # The degen one: very new launches with heavy buying. Expect most to fail.
    "fresh_launch": dict(
        bankroll=1000, size=50, max_open=5,
        min_liq=15_000, max_fdv=5_000_000, min_age_h=0.25, max_age_h=3,
        min_vol_h1=25_000, min_buy_ratio=1.4, h1_change=(10, 300), m5_min=2,
        take_profit=1.00, stop_loss=-0.35, max_hold_h=6,
    ),
}


def get(path, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(API + path, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except Exception as ex:
            print("get retry", path, ex)
            time.sleep(2 * (i + 1))
    return None


def fee(usd):
    return max(FEE_MIN, usd * FEE_PCT)


def impact(usd, liq):
    """Rough constant-product price impact for a buy or sell of usd into a pool of liq (both sides)."""
    if not liq or liq <= 0:
        return 0.5
    return min(0.5, 2 * usd / liq)


def candidates():
    seen = {}
    for path in ("/token-boosts/latest/v1", "/token-profiles/latest/v1", "/token-boosts/top/v1"):
        data = get(path) or []
        for t in data if isinstance(data, list) else []:
            ch, addr = t.get("chainId"), t.get("tokenAddress")
            if ch in CHAINS and addr:
                seen.setdefault(ch, set()).add(addr)
    pairs = []
    for ch, addrs in seen.items():
        addrs = sorted(addrs)
        for i in range(0, len(addrs), 30):
            data = get(f"/tokens/v1/{ch}/{','.join(addrs[i:i + 30])}") or []
            pairs.extend(data if isinstance(data, list) else [])
    best = {}
    for p in pairs:  # keep the deepest pool per token
        key = (p.get("chainId"), (p.get("baseToken") or {}).get("address"))
        liq = (p.get("liquidity") or {}).get("usd") or 0
        if key[1] and liq >= ((best.get(key) or {}).get("liquidity") or {}).get("usd", 0):
            best[key] = p
    return list(best.values())


def quote(chain, pair_address):
    data = get(f"/latest/dex/pairs/{chain}/{pair_address}") or {}
    ps = data.get("pairs") or ([data["pair"]] if data.get("pair") else [])
    return ps[0] if ps else None


def facts(p, now_ms):
    liq = (p.get("liquidity") or {}).get("usd") or 0
    tx = (p.get("txns") or {}).get("h1") or {}
    buys, sells = tx.get("buys") or 0, tx.get("sells") or 0
    created = p.get("pairCreatedAt") or now_ms
    return dict(
        liq=liq,
        fdv=p.get("fdv") or p.get("marketCap") or 0,
        age_h=(now_ms - created) / 3_600_000,
        vol_h1=(p.get("volume") or {}).get("h1") or 0,
        buy_ratio=buys / max(1, sells),
        h1=(p.get("priceChange") or {}).get("h1") or 0,
        m5=(p.get("priceChange") or {}).get("m5") or 0,
        price=float(p.get("priceUsd") or 0),
    )


def passes(f, s):
    return (
        f["price"] > 0
        and f["liq"] >= s["min_liq"]
        and 0 < f["fdv"] <= s["max_fdv"]
        and s["min_age_h"] <= f["age_h"] <= s["max_age_h"]
        and f["vol_h1"] >= s["min_vol_h1"]
        and f["buy_ratio"] >= s["min_buy_ratio"]
        and s["h1_change"][0] <= f["h1"] <= s["h1_change"][1]
        and f["m5"] >= s["m5_min"]
    )


def load(state_dir):
    p = state_dir / "state.json"
    if p.exists():
        st = json.loads(p.read_text())
    else:
        st = {"started": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z", "strategies": {}}
    for name, s in STRATEGIES.items():
        st["strategies"].setdefault(name, {"cash": s["bankroll"], "open": [], "peak": s["bankroll"], "max_dd": 0.0,
                                           "wins": 0, "losses": 0, "fees": 0.0})
    return st


def log_trade(state_dir, row):
    path = state_dir / "trades.csv"
    new = not path.exists()
    with path.open("a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(row))
        if new:
            w.writeheader()
        w.writerow(row)


def run(state_dir):
    now = dt.datetime.utcnow()
    now_ms = int(now.timestamp() * 1000)
    st = load(state_dir)
    cands = candidates()
    print(f"{len(cands)} candidate tokens")
    marks = {}

    for name, s in STRATEGIES.items():
        book = st["strategies"][name]
        still = []
        for pos in book["open"]:
            q = quote(pos["chain"], pos["pair"])
            if not q:
                pos["misses"] = pos.get("misses", 0) + 1
                if pos["misses"] < 4:
                    still.append(pos)
                    continue
                price, liq, reason = 0.0, 0, "pair vanished (treated as total loss)"
            else:
                f = facts(q, now_ms)
                price, liq = f["price"], f["liq"]
                reason = None
            held_h = (now_ms - pos["opened_ms"]) / 3_600_000
            change = (price / pos["entry"] - 1) if pos["entry"] else -1
            if reason is None:
                if liq < 0.2 * pos["entry_liq"]:
                    reason = "liquidity pulled (rug)"
                elif change >= s["take_profit"]:
                    reason = "take profit"
                elif change <= s["stop_loss"]:
                    reason = "stop loss"
                elif held_h >= s["max_hold_h"]:
                    reason = "time stop"
            if not reason:
                marks[(name, pos["symbol"])] = pos["qty"] * price
                still.append(pos)
                continue
            gross = pos["qty"] * price * (1 - impact(pos["qty"] * price, liq))
            f_out = fee(gross) if gross > 0 else 0
            proceeds = max(0.0, gross - f_out)
            pnl = proceeds - pos["cost"]
            book["cash"] += proceeds
            book["fees"] += f_out
            book["wins" if pnl > 0 else "losses"] += 1
            book.setdefault("cooldown", {})[pos["token"]] = now_ms
            log_trade(state_dir, dict(time=now.isoformat(timespec="seconds"), strategy=name, side="SELL",
                                      chain=pos["chain"], symbol=pos["symbol"], token=pos["token"],
                                      usd=round(proceeds, 2), pnl=round(pnl, 2), reason=reason,
                                      held_h=round(held_h, 1)))
        book["open"] = still

        cool = {t: ms for t, ms in book.get("cooldown", {}).items() if now_ms - ms < 6 * 3_600_000}
        book["cooldown"] = cool  # don't buy back a token within 6 hours of selling it
        held = {p["token"] for p in book["open"]} | set(cool)
        for p in sorted(cands, key=lambda p: -((p.get("volume") or {}).get("h1") or 0)):
            if len(book["open"]) >= s["max_open"] or book["cash"] < s["size"]:
                break
            token = (p.get("baseToken") or {}).get("address")
            if token in held:
                continue
            f = facts(p, now_ms)
            if not passes(f, s):
                continue
            usd = s["size"]
            f_in = fee(usd)
            spend = usd - f_in
            fill = f["price"] * (1 + impact(spend, f["liq"]))
            qty = spend / fill
            book["cash"] -= usd
            book["fees"] += f_in
            pos = dict(chain=p["chainId"], pair=p.get("pairAddress"), token=token,
                       symbol=(p.get("baseToken") or {}).get("symbol", "?"), entry=fill, qty=qty, cost=usd,
                       entry_liq=f["liq"], opened_ms=now_ms, url=p.get("url"))
            book["open"].append(pos)
            held.add(token)
            marks[(name, pos["symbol"])] = qty * f["price"]
            log_trade(state_dir, dict(time=now.isoformat(timespec="seconds"), strategy=name, side="BUY",
                                      chain=pos["chain"], symbol=pos["symbol"], token=token, usd=usd, pnl="",
                                      reason=f"liq ${f['liq']:,.0f}, vol1h ${f['vol_h1']:,.0f}, "
                                             f"1h {f['h1']:+.0f}%, buys/sells {f['buy_ratio']:.2f}",
                                      held_h=0))

        equity = book["cash"] + sum(v for (n, _), v in marks.items() if n == name)
        book["equity"] = round(equity, 2)
        book["peak"] = max(book["peak"], equity)
        book["max_dd"] = max(book["max_dd"], 1 - equity / book["peak"]) if book["peak"] else 0

    st["updated"] = now.isoformat(timespec="seconds") + "Z"
    (state_dir / "state.json").write_text(json.dumps(st, indent=1))
    write_summary(state_dir, st)


def write_summary(state_dir, st):
    lines = ["# Meme coin paper trading (no real money)", "",
             f"Started {st['started']}. Updated {st['updated']}. Fees modeled on Fomo: 0.5% per side, $0.95 minimum, "
             "plus price impact. Data: DexScreener.", "",
             "| Strategy | Start | Now | P&L | Win/loss | Fees paid | Worst drop | Open |", "|---|---|---|---|---|---|---|---|"]
    for name, b in st["strategies"].items():
        start = STRATEGIES[name]["bankroll"]
        eq = b.get("equity", b["cash"])
        lines.append(f"| {name} | ${start:,.0f} | ${eq:,.2f} | {eq - start:+,.2f} ({(eq / start - 1) * 100:+.1f}%) | "
                     f"{b['wins']}/{b['losses']} | ${b['fees']:,.2f} | {b['max_dd'] * 100:.1f}% | {len(b['open'])} |")
    lines += ["", "Go/no-go after 30 days: positive after fees over 100+ closed trades AND worst drop under 30%.",
              "Paper results overstate real ones (real fills are worse, rugs are faster)."]
    (state_dir / "summary.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    a = ap.parse_args()
    d = pathlib.Path(a.state)
    d.mkdir(parents=True, exist_ok=True)
    run(d)
