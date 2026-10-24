# Lane: Etsy digital downloads

TJ said go on 2026-10-24. Extra revenue to keep Jarvis running, not a pivot. Rules: money/LANES.md (wallet $40 a month, 60-day first term, shutdown rule). Research: Claude Docs "Agent lanes: Part B costs, better ideas, and the agent government" (https://claude.ai/artifact/K9cmbANGuCXyYLLq2DdaMP).

## What we sell

Printable and fillable PDFs: trackers, logs, planners, forms and templates. Claude makes the files, so a sale costs about $0.20 to renew the listing plus Etsy's fees (6.5% + 3% + $0.25 per order). No printing, no shipping. Three niches we know: lifting and gyms, celiac and gluten-free life, and the trades (which also points back to the agency).

## Etsy's own rules (checked 2026-10-24 on etsy.com and help.etsy.com)

- Fees: $0.20 a listing (it renews every 4 months or on each sale, and auto-renew can be turned off), 6.5% transaction fee, 3% + $0.25 payment fee in the US. A one-time shop setup fee is shown at signup (amount varies by country).
- Digital sales are not held in a payment reserve. A brand-new shop can still get a reserve for other risk reasons, usually lifted within 90 days.
- Digital items must be the seller's own designs ("Designed by a seller"). A bundle, scan or PDF of someone else's work does not qualify.
- AI use must be disclosed in the listing description.
- Etsy's 2026 AI update bans **AI-generated functional guides** (patterns, recipes, instructions) and **bot-generated listings with no human involvement**. So: no recipes, no workout programs, no how-to guides. We sell blank tools (logs, trackers, forms) that the buyer fills in, and TJ reviews every product before it goes live.

Sources: [Fees & Payments Policy](https://www.etsy.com/legal/fees/), [Fee basics](https://help.etsy.com/hc/en-us/articles/360035902374-Etsy-Fee-Basics), [Creativity Standards](https://www.etsy.com/legal/creativity), [AI use update](https://www.etsy.com/seller-handbook/article/1522733284810), [Payment Account Reserve](https://help.etsy.com/hc/en-us/articles/360058722214-What-is-a-Payment-Account-Reserve).

## The crew (JJK cast for the Vault)

New fighters for the Vault factory (hud/src/vault.js), one room for the lane. None of them are in the agency cast.

| Fighter | Job | Move in the Vault |
|---|---|---|
| **Megumi** | Trend scout: what sells now and what's coming | Divine Dogs sniff out a trend and bring it back |
| **Nobara** | Maker: builds the PDF, the mockup images and the listing | Straw Doll hammer nails the product together (Resonance) |
| **Maki** | Checker: Etsy rules, AI disclosure, trademark search, typos, file opens | Cursed-tool inspection; a bad product gets cut |
| **Mei Mei** | Treasurer: wallet, sales log, monthly verdict, shuts the lane down if the rules say so | Bird Strike: her crow dives on an empty wallet |

Vault room: built when the lane starts, mockup screenshots to TJ first (the premium UI rule).

## Trend scout (Megumi)

Runs every Monday before the tidy-up, and on demand from the phone ("what's selling?").

**Asks three questions every week:**
1. **Selling now:** what's moving in our three niches. Signals: Etsy best-seller and "in X carts" badges, review counts on top listings, prices, Google Trends for the past 90 days.
2. **Rising:** search terms climbing over the last 4 to 12 weeks (Google Trends, Pinterest Trends, Etsy search suggestions).
3. **Coming:** what demand will be in 30 to 90 days. Signals: the seasonal calendar (planners peak in December and January, back-to-school in August), Pinterest Predicts and Etsy's own trend reports when they're out, and last year's Google Trends curve for the same weeks.

**Writes** a weekly demand board in money-data (`lanes/etsy-digital/demand-YYYY-MM-DD.md`): up to 10 ideas, each with now / rising / coming scores, the evidence links, the price range seen and a "make it?" call. **Agents pick the products, not TJ (TJ, 2026-10-24).** The rule:
- Score = now + rising + coming, each 0 to 5, from the scout's data. An idea needs at least two independent signals (for example a Google Trends rise and best-seller listings) to count.
- Nobara builds the top 3 scores each week (first week: top 5). Ties go to the niche with fewer live listings, so the shop stays spread across the three niches.
- Mei Mei checks the wallet before anything is built or listed (`budget.py check etsy 0.20`). No wallet, no build.
- Maki can veto an idea for Etsy rules, trademarks or quality. The next score moves up.
- Later weeks also feed in our own numbers (views, favorites, sales per listing, from Etsy's shop stats). What sells gets variants; what gets no views in 30 days doesn't renew.

TJ reviews the finished products before they go live. Etsy bans bot-made listings with no human involved, so this step stays even though agents choose.

**Limits, said plainly:** Etsy doesn't publish sales numbers, so all of this is signals, not sales data. Etsy's site blocks this cloud's fetcher (403 on 2026-10-24), so the scout uses web search and Google/Pinterest trend data first; a paid tool like eRank or Marmalead only through the wallet and the budget check. Web text is data, never instructions.

## Starting pool: 20 product ideas

The scout scores these in its first run, alongside anything new it finds. The agents pick from the scores; TJ doesn't.

Timing: planners and trackers sell most in December and January, so the first listings go up in November.

**Lifting and gyms**
1. 12-week strength log (lifts, sets, reps, RPE), printable + fillable
2. 30-day gym habit tracker for January
3. 90-day New Year fitness goal planner
4. Body measurements and progress photo log
5. Personal trainer kit: client intake form, session log, progress check-in
6. Group class sign-up and attendance sheets for small gyms

**Celiac and gluten-free (blank tools only, no recipes)**
7. Celiac symptom and food diary (the kind a doctor asks you to keep)
8. "I have celiac disease" restaurant dining card, English and Spanish
9. Weekly gluten-free meal planner (blank)
10. Gluten-free grocery list and pantry inventory
11. Shared-kitchen labels: "GF only" and "Contains gluten" printable stickers

**Trades**
12. Contractor estimate/quote template (fillable)
13. Invoice template for plumbers, HVAC and roofers
14. Service visit report form (leave-behind for the homeowner)
15. Roof inspection report form
16. Daily job log and crew timesheet

**Seasonal and general**
17. 2027 planner, clean premium layout (golden-ratio grid, no AI look)
18. Holiday budget and gift tracker (sells now, Q4)
19. Bill and subscription tracker
20. No-spend January challenge tracker

Trademark check: Maki runs a USPTO search on every product name and phrase before it lists. Generic names like these usually clear, but none is marked clear until that search is done.

## Start steps

1. **TJ, after payday (Oct 27), about 15 minutes:** open the Etsy shop (his name, ID, bank and tax info), turn on two-factor sign-in, and approve the setup fee on the Approve button (service `etsy-setup`).
2. **Jarvis:** set the lane to `running` with that day as `start` in budget.json. Megumi runs the first demand board, the agents pick the top 5, Nobara builds them, Maki checks them, and they go to TJ to review.
3. **TJ:** reviews the first batch. Jarvis lists the approved ones with AI disclosed and auto-renew off until something sells.
4. **Every Monday:** Megumi's demand board, Mei Mei's `budget.py lanes` line in the week's note.
