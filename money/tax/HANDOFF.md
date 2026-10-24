# Handoff: tax savings tracking (paused 2026-10-24 at TJ's usage limit)

TJ approved (2026-10-24): a separate free savings account just for taxes; each Stripe payout, move all sales tax + 25% of profit the day it lands; Jarvis tracks the pot vs what's due and warns when short; Approve opens IRS Direct Pay / ATAP (bank ACH).

Done on this branch (tested: agency api tests pass):
- agency-api `payments` table (schema.sql) filled from Stripe `invoice.paid` (billing.record_payment), setup line split out.
- `GET /payments?since=YYYY-MM-DD` (operator) returns rows in income.csv shape.
- Gym price $149 + $79 in Pricing.md, Decisions.md, tax.json.

Left to do:
1. tax.py `import FILE.json`: merge /payments rows into income.csv (dedupe on note = invoice id; blank cost = tax.json item cost).
2. money/tax/pot.csv (date, amount, note) + status: pot balance = moved - paid.csv; expected set-aside per income row; "to move" and a shortfall alert when the pot is under filings due in 45 days.
3. Taxes sheet: Tax pot cell + "I moved it" (writes taxpot/<id> {amount, date}; Jarvis copies into pot.csv). Test in hud/test/tax.test.mjs.
4. TJ's list in To do.md: open the account (free business savings, e.g. at his bank or Relay (check)); auto-transfer rule 25% of every Stripe deposit to Tax savings (sheet shows top-ups for gym payments, ~30% need); link the account in IRS Direct Pay and ATAP.
5. Gym-security: price $149 + $79 on site, agreement and Stripe. Needs TJ's push OK for that session.
6. PR, merge. No page republish unless needed.
