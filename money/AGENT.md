# Money agent: what each run does

The scheduled task "Money agent" opens this repo and follows this file. Edit this file to change the agent; the task itself only says "follow money/AGENT.md".

**The crew** (each run does them in this order): Checker (`money/agents/checker.md`) → Builder (section 1) → Scribe (section 1b) → Auditor (every card follows the rules) → Keeper (section 3). The **Overseer** (`money/agents/overseer.md`) is a separate daily task that checks all of them. The Scout is the weekly GitHub bot.

Read first: [[Sites by TJ]] (prices, rules), `money/README.md`. Ground rules always win. Never send email, never post, never trade real money, never put keys or passwords in the repo.

## 0a. One run at a time
Before anything else, read `runs/<today, Central>.json` on money-data. If it has `started` less than 2 hours old and no `finished`, another run is working: stop with "Another run has it." Otherwise write `{"started": <now ISO>}` and push money-data; at the end (even after a failure) add `"finished": <now ISO>` and push.

## Statuses and the do-not-email list
- Lead statuses live in `prospects/status.json` on money-data (`{"<id>": "<status>"}`). Agents write only there; the Monday Scout reads it and never rewrites it. Don't edit statuses in `nwa.json`.
- `prospects/suppress.csv` (`email,domain,date,reason`) is the permanent do-not-email list. Add a row (email AND domain) the same day anyone opts out, says stop or asks not to be contacted, and set their status to `unsubscribed`. Never remove a row. Nobody on it gets built, written to or sent to, under any id.

## 0. Get the bot output
The cloud session can't reach the data hosts, so the bots run on GitHub Actions and write to the `money-data` branch:
`git fetch origin money-data && git worktree add /tmp/md origin/money-data` (or read files with the GitHub tools).
- `prospects/nwa.json` and `nwa.md`: scored NWA shops.
- `rugcheck/<token>.md`: rug checks.
If a bot's last run failed (GitHub tools: list workflow runs), read its log and fix the code on a branch, test, PR, merge.

## 1. Sites: build up to 10 previews a week
1. **Pick from the cold list** (`prospects/cold-list.csv` on money-data; refreshed every Monday). Take `status: new` rows from the top of "Trades & home services" first (they pay monthly), then "Shops & food". Skip anything already in `money/sites/shops/`.
2. **Checker first** (follow `money/agents/checker.md`). TJ never checks leads; the Checker does. Build only leads with `verdict: pass` in `prospects/checked/`, using the facts it gathered.
3. Write `money/sites/shops/<slug>/content.json`. The sample shop's file shows the format.
   - Use only true public facts. Leave out anything you can't confirm.
   - **Reviews:** only short real quotes from public reviews, credited "First name L. · Google". If you can't quote reliably, leave reviews out. Never invent one.
   - Pick colors from their sign or logo if you can see them; otherwise use a calm palette that suits the trade.
4. Run `python3 money/sites/build.py <slug>`, screenshot it at phone size with Playwright, and fix anything ugly.
5. Write `money/sites/shops/<slug>/pitch.md`:
   - Why this shop (score and site problems in plain words).
   - The walk-in lines.
   - An email draft (playbook template, under 80 words, CAN-SPAM footer with "[mailing address]").
   - The two follow-ups.
   - Price to quote: launch $299 while fewer than 3 clients, else Starter $499.
6. Set the shop's status to `built` in `prospects/status.json` on money-data (key is the `id`; ids start with `node/`, `way/` or `overture/`) and push money-data. Statuses: new, checked, skip, no-email, built, approved, emailed, replied, won, lost, unsubscribed.
7. Commit the shops on a branch, open a PR, wait for `money-tests` to pass, merge. Jarvis is TJ's own repo: merging is fine.
8. Previews TJ can show:
   - Until Cloudflare is set up, publish each preview as a private Artifact so TJ can show it on his phone. List the links in the brief.
   - Once a Cloudflare Pages project is connected (see [[Sites by TJ]]), the merged site goes live at its preview link.

## 1b. Pitch angle by site problem (Scribe)
- **DOWN**: "Your site isn't loading for customers right now ([what we saw]). Here's a working version: [preview]." Only if a normal browser confirms it.
- **DATED**: point to one visible thing (old year, no tap-to-call, not phone-friendly), then the preview.
- **WEAK**: lead with what they'd gain (calls from the phone, hours, reviews), then the preview.
- Trades and home services also get the Front Desk line ("never lose a caller"); food and shops get the one-time price.
- Every email: under 80 words, one question, real mailing address, opt-out line. Nothing is sent until TJ approves it.

## 2. Rug checks
- The paper-trading bot is off (TJ, 2026-10-23: wasted usage). Don't report a paper P&L.
- **Rug check asks from TJ:** run the `money-rugcheck` workflow with the token address and chain, wait about 1 minute, then read `rugcheck/<token>.md` and answer with its verdict in plain words.

## 3. Report
- Rewrite the brain note "Money board.md" (create it if missing; link [[Sites by TJ]]): the top 5 shops to visit this week (name, trade, city, why, phone), preview links, and the latest rug checks. Keep it under 40 lines. Then refresh the phone page (CLAUDE.md, "Phone Jarvis memory" step) so TJ sees it in Jarvis.
- Add a line to this week's note in Weekly with what was built and anything TJ must do.
- Update [[Sites by TJ]] Clients when TJ says a shop said yes.
- Brief TJ only on what he needs:
  - New previews to show (links + one line each).
  - Replies to send.
  - Problems.
