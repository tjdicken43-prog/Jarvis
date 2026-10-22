#!/usr/bin/env python3
"""Rug check for one token before TJ buys it by hand in Fomo.

  python3 money/fomo/rugcheck.py --chain solana --token <address> --out DIR
Writes DIR/<token>.md with GREEN / YELLOW / RED and the reasons in plain words.
Data: DexScreener (all chains) and RugCheck (Solana only). A green light means
"no obvious trap found", never "safe".
"""
import argparse
import datetime as dt
import json
import pathlib
import urllib.request

UA = "SitesByTJ-rugcheck/1.0"


def get(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception as ex:
        print("fetch failed", url, ex)
        return None


def check(chain, token):
    red, yellow, good = [], [], []
    pairs = get(f"https://api.dexscreener.com/token-pairs/v1/{chain}/{token}") or []
    if not isinstance(pairs, list) or not pairs:
        return "RED", ["No trading pool found on DexScreener: can't price or sell it reliably."], [], {}
    p = max(pairs, key=lambda x: (x.get("liquidity") or {}).get("usd") or 0)
    liq = (p.get("liquidity") or {}).get("usd") or 0
    fdv = p.get("fdv") or p.get("marketCap") or 0
    age_h = (dt.datetime.utcnow().timestamp() * 1000 - (p.get("pairCreatedAt") or 0)) / 3_600_000
    tx = (p.get("txns") or {}).get("h1") or {}
    buys, sells = tx.get("buys") or 0, tx.get("sells") or 0
    sym = (p.get("baseToken") or {}).get("symbol", "?")
    info = dict(symbol=sym, liquidity=liq, fdv=fdv, age_hours=round(age_h, 1), buys_1h=buys, sells_1h=sells,
                url=p.get("url"), price_change=p.get("priceChange"))

    if liq < 10_000:
        red.append(f"Pool is tiny (${liq:,.0f}). A $50 sell moves the price hard, and it can be drained fast.")
    elif liq < 40_000:
        yellow.append(f"Thin pool (${liq:,.0f}). Expect bad fills.")
    else:
        good.append(f"Pool ${liq:,.0f}.")
    if age_h < 1:
        red.append(f"Only {age_h * 60:.0f} minutes old. Most rugs happen in the first hours.")
    elif age_h < 24:
        yellow.append(f"Less than a day old ({age_h:.1f} h).")
    if buys and sells == 0:
        red.append("Buys but zero sells in the last hour: classic honeypot sign (you may not be able to sell).")
    elif sells and buys / sells > 6:
        yellow.append(f"Very one-sided buying ({buys} buys / {sells} sells): could be bots pumping it.")
    if fdv and liq and fdv / liq > 50:
        yellow.append(f"Valuation ${fdv:,.0f} is {fdv / liq:.0f}x the pool: price is easy to crash.")

    if chain == "solana":
        rc = get(f"https://api.rugcheck.xyz/v1/tokens/{token}/report/summary")
        if rc:
            info["rugcheck"] = {k: rc.get(k) for k in ("score", "score_normalised", "risks") if k in rc}
            for r in rc.get("risks") or []:
                level = (r.get("level") or "").lower()
                text = f"RugCheck: {r.get('name')}{(' (' + r['description'] + ')') if r.get('description') else ''}"
                (red if level == "danger" else yellow).append(text)
        else:
            yellow.append("RugCheck didn't answer, so mint/freeze authority and holder spread weren't checked.")
    else:
        yellow.append("Not on Solana: mint authority and top holders weren't checked automatically.")

    verdict = "RED" if red else ("YELLOW" if yellow else "GREEN")
    return verdict, red + yellow, good, info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chain", default="solana")
    ap.add_argument("--token", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    verdict, issues, good, info = check(a.chain, a.token.strip())
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    lines = [f"# Rug check: {info.get('symbol', a.token)} ({a.chain})", "",
             f"**{verdict}**. Checked {dt.datetime.utcnow().isoformat(timespec='minutes')}Z.", ""]
    lines += [f"- {x}" for x in issues] or ["- No obvious trap found. Still a meme coin: size it to lose."]
    lines += [f"- {x}" for x in good]
    if info.get("url"):
        lines += ["", f"Chart: {info['url']}"]
    lines += ["", "```json", json.dumps(info, indent=1, default=str), "```"]
    (out / f"{a.token.strip()}.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
