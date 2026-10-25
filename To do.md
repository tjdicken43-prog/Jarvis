---
type: list
---
# To do

Covers [[SecurityAI]], [[Basis]], [[Jarvis]] and [[Sites by TJ]]. Done items move to the week's note.

**Rule (TJ, 2026-10-24):** the sections for TJ hold only what needs his hands, his money (over $25 or one-off, per money/BUDGET.md), his login, or his decision. Anything Jarvis can do on his own, he does right away, or puts under "Jarvis is on it" with what it waits for. The page counts only TJ's items.

## Now
- [ ] Make the Jarvis and Gym-security repos private: GitHub > repo > Settings > General > Danger zone > Change visibility. Checked 2026-10-24: both still public, and the brain (including [[Personal]]) is readable by anyone.
- [ ] Set the Google Calendar time zone to Central: Calendar app > Settings > General > Time zone. Checked 2026-10-24: still UTC. Reminders already fire at the right time; this fixes how times look.
- [ ] Finish the custom domain DNS on Namecheap for [[SecurityAI]] (needs TJ's Namecheap login).
- [ ] Photo of an Ashbourne denied scan.
- [ ] Score the 3 golden sites (HVAC, roofing, plumbing) and get two other people to score them; each needs 8+ before any outreach, per money/SITE_BAR.md. See [[Sites by TJ]].
- [ ] Send the Arkansas DFA tax question (draft is in your Gmail Drafts, to Sales.tax@dfa.arkansas.gov). Keep their reply.
- [ ] Tell Jarvis about how much J Street pays you a year, so the tax estimate counts your bracket right.
- [ ] Read and say what to change: [[Backend proficiency checklist]], [[J Street pilot pitch]], and the 35-day line in [[Gym service agreement]].

## Tuesday 2026-10-27 (payday)
- [ ] Follow the ordered "Tuesday checklist" in money/agency/README.md and money/BUDGET.md, in one sitting: make the business card (Privacy.com), set the Anthropic workspace limit to $20 with auto-reload off, buy the outreach domain + Google Workspace Business Starter, then the DNS records Jarvis gives (SPF, DKIM, DMARC p=none, Postmaster Tools), resume agency-db and agency-api on Render, add OPERATOR_TOKEN in Project settings, sign up at Vapi (free) and add VAPI_API_KEY. Jarvis does every step after the keys are in (warm-up start date, Stripe test, receptionist setup, ledger lines).

- [ ] Open the Etsy shop for the digital downloads lane: etsy.com/sell, your name, ID, bank and tax info, turn on two-factor sign-in, then approve the setup fee on the Approve button (service etsy-setup). The agents pick the products from the trend scout's data; you only review the finished ones before they list. See money/LANES.md.

- [ ] Income lanes A and B, after payday (money/lanes/trade-tools/LANE.md, money/lanes/apify-actor/LANE.md): approve the Tradesheet domain (about $12, service trade-tools-setup) on the Approve button, say yes to the Cloudflare Pages project; make a free Apify account and put its token in the cloud environment as APIFY_TOKEN, then do the Store publish step in the Apify console (profile and payout need your login and bank info). Say yes or change the add-on prices in money/agency/ADDONS.md ($49 replies, $39 posts, $79 both; proposed ladder also Quote Assistant $49 to $79, lead pages $99 to $199, Lead Boost ads $400 to $600).

## When a client says yes
- [ ] Open a free business savings account named "Tax savings" (at your bank, or one with percentage auto-transfer rules such as Relay (check)).
- [ ] In that bank: auto-transfer rule "25% of every deposit from Stripe goes to Tax savings". If the bank only does fixed amounts, skip it and use the Taxes sheet's "I moved it" button instead.
- [ ] Link Tax savings as the bank account in IRS Direct Pay (nothing to save, you type it each time) and in ATAP (Arkansas: add it as a bank account under your profile).
- [ ] One CPA visit before the first quarterly payment (likely 2027-01-15), about $150 to $300 (check). Bring money/TAX.md.
- [ ] Before the first gym invoice or kit sale: Arkansas sales tax permit on ATAP (atap.arkansas.gov), $50 one time. Then tell Jarvis the permit date.
- [ ] File an Arkansas LLC at sos.arkansas.gov ($45, then $150 franchise tax every May 1; TJ can be his own registered agent). Over $25, so the Approve button.
- [ ] Get 2 free insurance quotes: technology E&O + general liability (typical $80-200/mo together). Buy only when the first gym agrees to pay.
- [ ] Lawyer glance at [[Gym service agreement]] and [[Camera privacy notice]] before any gym signs.
- [ ] Buy the gym kit from the Gym-security shopping guide (used N100 mini PC, about $130; kit at cost about $275), then run the first nights at [[J Street Gym]] with the checklist.
- [ ] Pitch J Street's owners with the pilot counts. Draft: [[J Street pilot pitch]].

## Whenever you like
- [ ] Connect Spotify on claude.ai (Settings > Connectors). Jarvis then sets up the play and pause shortcut steps. See [[Jarvis]].
- [ ] Tell Jarvis your favourite music and chill routines for [[Personal]].
- [ ] Sign in to Claude in Chrome on the computer, then let Jarvis test one website job.

## Jarvis is on it
Not TJ's to do. Each line says what it waits for; the job runner and the Monday [[Weekly tidy-up]] pick them up.
- Backend proficiency tests and update checks for [[SecurityAI]] after each Gym-security release, with the [[Backend proficiency checklist]] (first run 2026-10-21, all passed). Includes confirming the admin Storage line: Render shows a 1 GB disk at /var/data on the paid plan (checked 2026-10-24).
- After the first real nights: a per-night "scans confirmed" line in the morning report, and staff and cleaner schedules. Waits on hardware, then TJ's push OK for Gym-security.
- After the first month of bills: check the cost estimates in money/agency/api/costs.py (hosting $21/mo, Vapi 13 cents a minute) against the real bills and fix them.
- Before switching on the 15% matchmaker: look up the Arkansas rules.
- Once the outreach domain exists: move mockups to <slug>.<cold domain>.
- Taxes: log each client payment in money/tax/income.csv (waits on the first Stripe payment), copy paid filings from the page store into paid.csv, refresh the Taxes sheet. Once the first gym is close: add "plus Arkansas sales tax" to gym quotes and Stripe invoices (waits on TJ's gym price call).
- Etsy digital lane: set it to running, run the trend scout's first demand board, let the agents pick and build the top 5 for TJ's review, build the Vault room (Dragon Ball Z crew: Bulma, Goku, Gohan, Piccolo, Trunks, Dende, Whis, Vegeta; mockup first), and start the Monday trend scout. Waits on TJ opening the shop. Money rules: money/LANES.md.
- Missed-call and review texts stay stubs until TJ picks an SMS provider with 10DLC (his call, after the first paying shop). Then set NOTIFY=smtp on Render and do a real test call to check Vapi's tool fields.
