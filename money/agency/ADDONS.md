# Agency add-ons (lane C)

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
