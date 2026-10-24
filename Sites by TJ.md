---
type: business
status: starting
---
# Sites by TJ

Websites for local shops in Bentonville and NWA. Started 2026-10-22. See [[Decisions]], [[To do]].

- Model: find busy shops with no or weak sites, build a preview, show the owner (in person first), sell the site plus a care plan.
- Area: Bentonville, Rogers, Bella Vista, Centerton, Lowell, Springdale, Fayetteville.
- Plans (project files): video-research/2026-10-22-sites-by-tj-playbook.md and 2026-10-22-money-engines.md.
- Code: `money/` in this repo. Prospect list and bot output on the `money-data` branch.

## Trades offer (2026-10-23, current)
- Trades only: plumbing, HVAC, roofing. Sell a rebuilt site + AI receptionist, not a website.
- Front Desk: $299 setup + $149/mo (site, hosting, after-hours receptionist, 300 min, missed-call text-back).
- Front Desk Plus: $299 setup + $249/mo (24/7, 800 min, calendar booking, review requests). Over the minutes: $0.25/min.
- Our cost per client about $29 to $58/mo (Plus $41 to $129), fixed about $60/mo (check). See [[Decisions]].
- Code: money/agency/ (step 1 schema + import, PR #62; step 2 API + email drafts + Approval Queue dashboard, PR #64; step 3 flaw finder + auto mockups, 2026-10-23). Not deployed yet. Sending starts paused, cap 5 a day, weekdays 9-11am Central, from the Google Workspace inbox on the cold domain.
- Flaw finder (money/agency/api/flaws.py): opens each shop's site in Chromium at phone size and picks one true flaw (down, not mobile-friendly, no tap-to-call, phone hidden, slow, no https, old footer), with a screenshot. No clear flaw = no email.
- Demos sell Front Desk (2026-10-24): every golden site and auto mockup has a "Calling after hours?" section and, on previews, an owner panel with a sample call and the two plans.
- Auto mockups (money/sites/trade_build.py): option C preview per shop from their own site's facts (logo linked, brand color, 24/7, towns, services they name, Google stars), checked against the site bar, served at the API's /m/<slug> with noindex. One button in the Approval Queue runs check, mockup and draft.

## History
### Prices (set 2026-10-22, TJ said "competitive")
- Launch price, first 3 clients: $299 + care plan, for a review and portfolio use.
- Starter: $499, one-page site, live in 7 days.
- Business: $999, up to 5 pages + Google Business Profile tune-up.
- Care: $49/month: hosting, security, up to 30 min of changes, monthly site health report.
- Care Plus: $89/month: Care + weekly Google post + review reply drafts.
- No money down: $99/month for 12 months, care included.
- Why: local agencies start around $2,500 (CodeWCG Bentonville page); DIY Squarespace is $12–25/month and Wix $17–39/month and the owner does the work.

## Rules
- Quality bar (TJ, 2026-10-23): every site must pass money/SITE_BAR.md before anyone sees it: nothing that looks AI-made, custom to the business, fast and clean on a phone, better than the best local competitor. No outreach until 3 golden sites score 8+.
- Domain is always in the client's name.
- Never auto-send email. CAN-SPAM: real postal address, opt-out, honest subject.
- No fake reviews or testimonials. Previews use the shop's public facts, their own photos only (never stock people), "concept preview" bar, noindex, removed after 14 days.

## Arkansas (checked 2026-10-22)
- Web hosting isn't a taxable service in Arkansas (DFA legal opinion 20180219, via Aprio). Web design: likely not taxable (not on the list of taxable services) (check with DFA).
- Digital books and video sold as downloads are taxable in Arkansas.
- Business name: file an assumed name with the Benton County Clerk; fee varies by county (check).
- Bentonville city business license: (check).

## Clients
None yet.
