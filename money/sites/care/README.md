# Site Care: the monthly improvement check

Tj, 2026-10-31: take the "Improvement Agent" idea, keep what's useful, and run it **monthly**, not nonstop, so it doesn't burn usage. It is also a client package (`agency/ADDONS.md`, Site Care, $39/mo **proposed**: Tj sets the price).

## Which sites
| Site | Folder | Changes need |
|---|---|---|
| Trade template (every auto mockup and live client site) | `sites/trade-template/` | Tj's full-access rule: do it, log it |
| Golden sites (One Call, John's, It's Plumbing) | `sites/<slug>/` | Full access (they're our previews, not clients yet) |
| Tradesheet tools site (`money/lanes/trade-tools/site/`) | `sites/tradesheet/` | Full access |
| Each paying client's live site | `sites/<client-slug>/` (add at go-live) | **The client's yes first**, via an approval request |

## The monthly run (first Money agent run of each month, see `money/AGENT.md` section 4)
1. **Assess.** `python3 money/sites/care/care.py PAGE.html` (add `--live` for a client's live page). Then the by-hand checks below. Write new findings into that site's `BACKLOG.md`. Skip what's already there.
2. **Research.** Only for the top item. Two sources at least, and always weigh "do nothing". If nothing is worth proposing, write "Checked, nothing worth changing" with what was checked in `CHANGELOG.md` and stop.
3. **Plan.** Steps, files, effort, risk, rollback, and how we'll know it worked.
4. **Sufficiency check.** Two options compared (one is "do nothing")? Risks known? Could someone else do it without guessing? Is it the highest-value item on the backlog? Any no: research more, or wait until next month.
5. **Propose or do.** Client site: one approval request in the `APPROVAL.md` format, sent to the owner (via Tj until the dashboard has it). Internal site: do it, test it, and open a PR.
6. **After.** Do exactly what was approved, verify it, log it in `CHANGELOG.md`, and move the item to Done in `BACKLOG.md`.

One proposal a month per site, at most. Blocked (no login, no photos, no facts)? Say so in Tj's brief that day. Don't wait for the next month.

## By-hand checks (a Sonnet sub-agent, about 10 minutes a site)
- **Speed:** Lighthouse mobile 90+ on performance, accessibility, best practices and SEO (SEO is 60 on previews because of noindex).
- **Phones:** no sideways scroll at 375 and 390 px, and every tap target 48 px or more.
- **Facts vs Google (AEO):** the name, phone, hours, towns and rating on the page match their Google Business Profile today. AI answer engines and Google both drop a business whose facts disagree.
- **AI search (AEO):** each FAQ answer stands on its own in 1 to 2 plain sentences that name the town and the job, written so ChatGPT, Gemini or Google's AI answers can quote it. Ask one of them "who fixes [job] in [town]" and note whether the business comes up (just note it, no tracking tool).
- **Standards drift:** anything new in Google Search Central, schema.org or WCAG since last month that touches these pages. If so, that becomes a backlog item.
- **The bar:** `money/SITE_BAR.md` and `money/sites/PREMIUM.md` still pass. No AI tells, no pill buttons, and the golden-ratio spacing kept.

## Left out on purpose
- **Running nonstop.** It runs monthly.
- **Analytics and competitor tracking.** They turn on per client once the site is live and has 30 days of calls. Until then there is nothing to measure.
- **A separate BACKLOG and CHANGELOG for the whole repo.** Each site has its own.
