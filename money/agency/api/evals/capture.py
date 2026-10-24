"""Capture real shops for the frozen test set: open each site like the flaw finder does, save what it saw.

  python3 money/agency/api/evals/capture.py <cold-list.csv> <out-dir> [count]

Writes <out-dir>/captured.json (signals + the flaw picked today) and <out-dir>/<n>.png (first phone screen) so a person
can check each flaw by eye. Only plumbers, HVAC and roofers with a website. Nothing is emailed or stored remotely.
"""
import csv
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import flaws  # noqa: E402

TRADES = {"Plumber": "plumbing", "HVAC": "hvac", "Roofer": "roofing"}
KEEP = ("mode", "status", "final_url", "seconds", "viewport_meta", "scroll_width", "viewport_width", "tel_links",
        "tel_on_first_screen", "phone_on_first_screen", "down", "blocked", "html_len")


def main(src, out, count=20):
    out = pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    rows = [r for r in csv.DictReader(open(src)) if r["trade"] in TRADES and r["website"].strip()]
    per = -(-count // len(TRADES))
    picked = [r for t in TRADES for r in [x for x in rows if x["trade"] == t][:per]][:count]
    cases = []
    for n, r in enumerate(picked, 1):
        try:
            s, shot = flaws.inspect_site(r["website"].strip())
        except Exception as e:
            print(f"{n} {r['name']}: failed {e}", file=sys.stderr)
            continue
        sig = {k: s.get(k) for k in KEEP if k in s}
        sig["text"] = (s.get("text") or "")[:4000]
        flaw, state = flaws.pick(s)
        if shot:
            (out / f"{n}.png").write_bytes(shot)
        cases.append({"n": n, "id": r["id"], "name": r["name"], "trade": TRADES[r["trade"]], "website": r["website"],
                      "signals": sig, "flaw": flaw, "state": state})
        print(f"{n} {r['name']}: {flaw} ({state})", file=sys.stderr)
    (out / "captured.json").write_text(json.dumps(cases, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 20)
