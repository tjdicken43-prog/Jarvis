# Lane: Apify actor (Local Trade Business Finder)

TJ picked this as lane B on 2026-10-25 (research: https://claude.ai/artifact/8hxLLeZq4CV98HYoM69Rju). Rules: money/LANES.md (wallet $40 a month, 60-day first term, shutdown rule). A free side bet: Apify brings the buyers and bills them, we keep 80% of revenue minus compute. Most actors earn near zero; the research found no published median. Expected cost to try is the build, already done.

## What is built (2026-10-25)
`main.py` is a Python Apify actor made from the NWA prospect scout (money/prospects/scan.py). Input: an area box, trades (plumber, hvac, roofer, electrician, painter, carpenter, landscaper), optional "only businesses with no website listed", a result cap. Output: name, trade, phone, website, address, coordinates, OpenStreetMap id, attribution.
- **Public data only.** OpenStreetMap through the Overpass API, ODbL, attribution on every row. It does not fetch the businesses' websites, scrape social pages or collect emails, so there is no terms-of-service question with other sites and no personal data beyond what OSM lists for a business.
- It refuses boxes over 4 square degrees and unknown trades, and retries Overpass politely.
- `.actor/` has the Apify config and input schema, `README.md` is the store listing text, `Dockerfile` and `requirements.txt` build it.
- Test: `python3 money/test/test_apify_actor.py` (no network).

## Still needed from TJ (flagged, after payday)
1. An Apify account on the **free plan** (apify.com, TJ's email and login).
2. An Apify API token, set as `APIFY_TOKEN` in the cloud environment (never in a note), so Jarvis can push with `apify push` and set the pay-per-result price.
3. The Store publish step in the Apify console (the first publish asks for a profile and a payout method). TJ's hands, bank info.
Price (checked 2026-10-25, replaces the old $0.01 to $0.02 guess): similar Google Maps lead actors charge about $1 to $6 per 1,000 results, so $0.01 a row ($10 per 1,000) would be 2 to 10 times the market. Start at $3 per 1,000 rows. Use pay-per-event, not rental (rental actors were retired 2026-10-01) so the actor can also be found by AI agents. See money/PLAYBOOK-A-B-C.md. A paid Apify plan is a wallet service (`apify`) only if the actor earns.

## Judged on
Days 1 to 60: runs by other users, store views. From month 2: Apify payouts booked in `money/lanes/sales.csv` (lane `apify`, net of Apify's 20%) must cover wallet use, which starts at $0.
