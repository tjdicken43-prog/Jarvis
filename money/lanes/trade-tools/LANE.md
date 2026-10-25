# Lane: Tradesheet (free tools for trades, paid tier later)

TJ picked this as lane A on 2026-10-25 from the income research (Claude Doc "Is there a better AI income lane than Etsy?", https://claude.ai/artifact/8hxLLeZq4CV98HYoM69Rju). Rules: money/LANES.md (wallet $40 a month, 60-day first term, shutdown rule). Trades only: plumbers, HVAC, roofers. It pays two ways: paid tier subscribers, and plumbers and roofers who find a tool and then see Front Desk (the agency).

## What is built (2026-10-25)
A static site in `site/`: no framework, no build step, no tracking, nothing sent anywhere.
- Roofing material calculator, HVAC size check (rough, says it is not Manual J), estimate maker (print or save as PDF, saves to the browser).
- A Front Desk page with the real prices from money/agency/api/billing.py, and a quiet Front Desk block on each tool page.
- `assets/calc.js` holds all the math. Test: `node money/test/test_trade_tools.js` runs the math checks, plus the site bar on every page (banned words, no gradients or pills, titles, descriptions, links, no exclamation marks).
- Looks: paper and ink with one rust accent, square corners, system fonts, golden-ratio proportions (tool columns 1 : 1.618, line height 1.618, 55/89 px spacing). Mockup shots live in the Jarvis project files under `lanes/trade-tools/`.

## What it deliberately does not do yet
- **No city or trade clone pages.** Google's scaled-content rules target many thin pages made to rank. Each tool page carries its own explanation, worked example and FAQ. More pages come only when search impressions show a page is wanted, and each new page must add something real (a local code detail, a different calculation), never a copy with the town swapped.
- **No paid tier yet.** Free tools first. The paid tier (about $9 a month, from the research's $9 to $19) would sell saved quotes across devices, a logo on the estimate, invoice numbering and PDF export. It needs accounts and Stripe, so it waits for TJ's word and a month of search data.
- **No ads, no paid traffic.** The research case that this model copies lost money on ads before search worked.

## Launch checklist (waits for payday 2026-10-27, flagged for TJ)
1. Domain (one-off, about $12): `python3 money/budget/budget.py check trade-tools-setup 12`, then TJ's Approve button. Name "Tradesheet" is a working name: search the USPTO and the domain registrar first (checked: not yet).
2. Host free on Cloudflare Pages (Cloudflare MCP is connected) from `money/lanes/trade-tools/site`. Needs TJ's OK on the project and the domain's DNS.
3. Set `contact` in `site/assets/config.js` to a mailbox from the Workspace TJ sets up on payday. Until then the contact buttons stay hidden.
4. Add `canonical`, `sitemap.xml` and `robots.txt` with the real domain, and the privacy line (there is no data collection, the footer says so). Submit to Google Search Console (TJ's login).
5. Set `status: running` and `start` in budget.json. Day 1 of the 60-day first term.

## Judged on
Days 1 to 60: search impressions, tool uses (no analytics are installed, so use Search Console only), clicks to Front Desk. From month 2 the money rule applies: subscriber sales logged to `money/lanes/sales.csv` (lane `trade-tools`) must cover the wallet use. Surplus follows the main-card rule in LANES.md.
