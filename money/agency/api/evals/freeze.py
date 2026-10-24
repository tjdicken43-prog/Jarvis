"""Turn TJ's corrections into test cases, so a mistake he caught once can't come back unnoticed.

  DATABASE_URL=... python3 money/agency/api/evals/freeze.py     # then commit evals/tj.json

- "Wrong flaw" skips become flaw cases: the same signals must never pick that flaw again.
- "Says something untrue" skips become email cases: the checks must catch something in that draft.
Tone skips and edits aren't graded by code; the drafter already learns from TJ's rewrites (outreach.tj_examples).
Each correction is frozen once (corrections.frozen).
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import db  # noqa: E402

KEEP = ("name", "trade", "city", "phone", "website", "flaw", "mockup_url", "site_state")


def main():
    path = HERE / "tj.json"
    cases = json.loads(path.read_text()) if path.exists() else {}
    added = 0
    with db.connect() as c:
        rows = c.execute("""SELECT k.*, row_to_json(p.*) AS p FROM corrections k JOIN prospects p ON p.id = k.prospect_id
                            WHERE NOT k.frozen AND k.reason IN ('wrong_flaw', 'bad_fact') ORDER BY k.id""").fetchall()
        for r in rows:
            name = f"TJ {r['created_at']:%Y-%m-%d} #{r['id']} {r['p']['name']}: {r['reason']}" + (f" ({r['note']})" if r["note"] else "")
            if r["reason"] == "wrong_flaw" and r["signals"] and r["flaw"]:
                cases.setdefault("flaw", []).append({"name": name, "signals": r["signals"], "expect_not": r["flaw"]})
            elif r["reason"] == "bad_fact" and r["before_body"]:
                p = {k: r["p"].get(k) for k in KEEP}
                p["facts"] = {k: (r["p"].get("facts") or {}).get(k) for k in ("site_text", "towns", "since", "signals")}
                cases.setdefault("email", []).append({"name": name, "subject": r["before_subject"], "body": r["before_body"],
                                                      "prospect": p, "expect": [""]})  # [""] = any problem at all
            else:
                continue
            c.execute("UPDATE corrections SET frozen = true WHERE id = %s", (r["id"],))
            added += 1
        path.write_text(json.dumps(cases, indent=1, default=str, ensure_ascii=False) + "\n")
        c.commit()
    print(f"froze {added} correction(s) into {path.name}; run evals/run.py, fix what misses, commit both")


if __name__ == "__main__":
    main()
