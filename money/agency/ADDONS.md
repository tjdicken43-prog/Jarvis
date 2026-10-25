# Agency add-ons and package ladder (lane C, plus D and E)

TJ picked this on 2026-10-25. It is not a separate wallet lane: it adds revenue per client to the agency, so it runs under the agency's rules and money/BUDGET.md. Code: `api/addons.py`, test: `python3 money/test/test_addons.py`.

| Add-on | Proposed price | What the client gets |
|---|---|---|
| Review replies | $49/mo | A drafted reply to every new Google review within a day, for the owner's OK |
| Weekly Google post | $39/mo | One drafted Business Profile post a week: a seasonal tip and a call to action |
| Both | $79/mo | Same as the two together, $9 less (Care Plus on the Sites by TJ sheet was $89 with a site care plan; this is separate) |

**Prices are proposed, not live.** TJ says them in chat before billing.py or Stripe change. Nothing in `addons.py` charges anyone.

## How it works
- Drafts only. Nothing posts to Google. The owner (or TJ, with the owner's OK) copies an approved draft into the Business Profile. Google's Business Profile API needs an access application, so posting stays manual at first.
- Claude writes replies when `ANTHROPIC_API_KEY` is set (same key and model as outreach drafts). Every draft passes checks first: at most 70 words, no offers or claims (free, discount, refund, license, 24/7, guarantee), no numbers that aren't in the review or the shop's phone, low ratings must carry the shop's phone number, no arguing. A draft that fails falls back to a plain template; a template that fails raises an error instead of reaching the owner.
- Weekly posts are one plain, true seasonal tip per trade and season (12 of them, no numbers or claims) plus the shop's phone. Claude may vary them later; the tips are the safe floor.
- Rules behind it: Google's review policy and the FTC consumer review rule (in force 2024-10-21): reply to everyone, never offer anything in return for a review, never write the customer's review, never filter who gets asked (reviews.py already holds that).

## Cost and margin
A reply or post draft is a few hundred tokens on Haiku: well under a cent each, so under $1 a client a month at 20 reviews and 4 posts. The work that costs time is the owner's approval. Revenue is $39 to $79 a month a client on top of $149 or $249.

## Still needed
1. TJ's yes on the prices.
2. An approval step in the dashboard (a list of drafts with Approve and Copy) and `addon` plan rows in `clients`, once the first client wants one. Not built: UI needs a mockup first, and there are no clients yet.
3. Review feed: Google reviews come into the system by TJ or the owner pasting them at first. The Business Profile API is the later step.

## Package ladder (TJ, 2026-10-25): D and E offered as options
TJ: offer lead gen and AI helpers as optional packages so no prospect lacks a fitting one. Trades that already have the site and Front Desk are the likeliest buyers once they see calls coming in. **All prices below are PROPOSED estimates (research thread, not checked against local competitors). Nothing is billed, built or promised; TJ confirms prices in chat first.** Existing prices ($299 setup, $149 Front Desk, $249 Plus) are unchanged.

| Rung | Proposed | What | Offer when |
|---|---|---|---|
| Front Desk | $149/mo (live) | Site, receptionist, 300 min | First pitch |
| Front Desk Plus | $249/mo (live) | 24/7, 800 min, booking | First pitch |
| Review replies / Weekly post / Both (lane C) | $49 / $39 / $79 | Drafts for the owner's OK | After month 1 |
| **Quote Assistant (E)** | $49 to $79/mo | Owner types job details, gets a clear written estimate or quote draft in their own words and prices. Owner reviews every one. No auto-send | Month 2, or to any shop that says quoting eats their evenings |
| **Local lead pages (D, lite)** | $99 to $199/mo | One real page per service and town the shop actually serves, with call tracking. Not city-clone spam (Google scaled-content policy), not true rank-and-rent | Month 3, once Google Business Profile is in order |
| **Lead Boost (D, ads)** | $400 to $600/mo management | Google Ads for the shop. Client pays Google directly, budget $500/mo or more, tracked calls feed Front Desk. Report each month | After 4+ weeks of call data show what works |

Rules for D and E:
- Trades only (plumbing, HVAC, roofing). Offers go in the reply to a shop that wrote back, or in the dashboard to a paying client. No AI cold calls or texts (TCPA): unchanged.
- True rank-and-rent (own the site, rent the leads) is skipped: add-on D covers it with less risk (TJ's research thread, 2026-10-25).
- Never promise rankings or lead counts. Say "we track every call so you see what the ads bring".
- Lead Boost needs a human check on every ad and budget change; Jarvis drafts, TJ or the owner approves. Ad spend never touches the business card.
- E's quote drafts follow the review-reply rules: no invented prices, licenses or guarantees; owner sends.
- Selling E and D needs no new code today. Build the first piece only when a client says yes (UI mockup first, premium rule: no pill buttons).

How a professional runs and prices these (LSA first, setup checklist, tiers, concierge-first for E): see PLAYBOOK-D-E.md. Its Lead Boost tiers ($350 / $500 / 15% of spend) replace the flat $400 to $600 above if TJ agrees.

## Still needed for D and E
1. TJ's yes or changes on the proposed prices.
2. A competitor price check in Bentonville and NWA before the first quote (Jarvis can do this after payday).
3. When the first client says yes: Google Ads access under the client's account, a call-tracking number (costs money, goes through money/BUDGET.md), and a mockup of the dashboard rows.
