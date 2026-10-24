# Money engines

Code for TJ's money engines. Plans: project files `video-research/` (playbook, money engines). Brain note: [[Sites by TJ]].

| Part | What it does | Runs |
|---|---|---|
| `sites/` | One template → a shop site from `shops/<slug>/content.json`. `python3 money/sites/build.py` writes `sites/out/`. Previews carry a "concept preview" bar and noindex. | by hand / job runner |
| `sites/audit.py` | Auditor script: the script half of SITE_BAR.md plus the pitch email rules and the do-not-email list. PASS or FAIL per file. | Money agent, before a shop is marked built |
| `prospects/scan.py` | Finds independent shops in Bentonville–Fayetteville (OpenStreetMap), audits their websites, scores them 0–10. | GitHub Actions `money-prospects`, Mondays 6am Central |
| `fomo/paper.py` | Meme coin **paper** trader, two strategies, Fomo's fees modeled. No wallet, no real money. | GitHub Actions `money-fomo-paper`, by hand only (schedule off 2026-10-23, TJ: wasted usage) |
| `AGENT.md` | What the daily "Money agent" scheduled task does each run. Edit it to change the agent. | scheduled task, 5:47am Central |
| `LANES.md`, `lanes/` | Extra revenue lanes run like a small government: each has a monthly wallet and shuts down when it's empty or a month loses money (TJ, 2026-10-24). `budget.py lanes` reports them. First lane: `lanes/etsy-digital/LANE.md`. | Monday tidy-up, job runner |
| `fomo/rugcheck.py` | Green/yellow/red check on one token before TJ buys by hand. | GitHub Actions `money-rugcheck` (run with a token address) |

Bot output goes to the `money-data` branch (`prospects/nwa.md`, `fomo/summary.md`, `rugcheck/<token>.md`), not to main.
The cloud sessions can't reach these data hosts, so the bots run on GitHub's runners. Tests: `python3 money/test/test_paper.py`, `python3 money/test/test_scan.py`.

Rules: never auto-send email; never trade inside Fomo (its terms ban bots); real-money trading needs TJ's go and a line in [[Decisions]].
