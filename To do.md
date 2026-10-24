---
type: list
---
# To do

Covers [[SecurityAI]], [[Basis]] and [[Jarvis]]. Done items move to the week's note.

## Now
- As of 2026-10-21: nothing is running at [[J Street Gym]] yet. TJ has no laptop and no Raspberry Pi, so until TJ says otherwise only software update checks and backend proficiency tests are possible.
- [ ] Backend proficiency tests and software update checks for [[SecurityAI]]: first run done 2026-10-21, all passed. Repeat each release with the [[Backend proficiency checklist]].
- [ ] On hold until hardware is set up: first nights at [[J Street Gym]] (run the checklist there).
- [ ] Storage line: admin page, sign in, "Render settings" box, first line. Good = green "Storage: /var/data — a separate disk...". If it says DATA_DIR is not set, every deploy wipes gym accounts and history; the Render disk needs the paid Starter plan (check price before paying). See [[Release history]].
- [ ] Photo of an Ashbourne denied scan.
- [ ] [[Sites by TJ]]: TJ sets up Cloudflare (free), Stripe and a business Gmail; walks into the first shop. Jarvis backend builds previews from the Monday prospect list.
- [ ] Jarvis repo is public, so brain notes (including [[Personal]]) are visible to anyone: TJ to decide on making it private (check).

- [ ] Suspend agency-api, agency-dashboard, agency-send and agency-db on Render (dashboard, bulk Suspend). Next day, check Billing "unbilled usage" stays flat (check whether a suspended database still bills storage).
- [ ] Tuesday 2026-10-27: make the business card (Privacy.com, steps in money/BUDGET.md), set the Anthropic workspace limit to $20 with auto-reload off, and log the first charges in money/budget/ledger.csv.

## Setup
- [ ] Tailscale: turn off key expiry.
- [ ] Make the spare memory card.
- [ ] Finish the custom domain DNS on Namecheap.
- [ ] Texting (Twilio) and alert email on the domain.

## Sites by TJ
- [ ] Tuesday, once the cold inbox exists: set the warm-up start date on the Queue (cold email starts day 8, 3 a day).
- [ ] Glance at the 21 real-shop flaws in money/agency/api/evals/real_shops.json and say if any look wrong (check).
- [x] Front Desk pieces the demos sell are built (step 9, 2026-10-24): booking, review asks, morning summary, urgent alert, live site + quote form. Still stubs: real texts (text-back, review texts) wait on an SMS provider with 10DLC (TJ's call). After the first paying shop: set NOTIFY=smtp on Render and do a real test call to check Vapi's tool and structured-data fields (check).
- [ ] Trades MVP (steps 1-8 built: receptionist + Render blueprint done 2026-10-23) needs from TJ on Tue 2026-10-27: follow the ordered "Tuesday checklist" in money/agency/README.md (cold domain + Workspace + DNS, warm-up, mailing address, Render blueprint, Anthropic, Stripe test, Vapi). Chromium on Render: solved with a Docker image (tested locally). Check Arkansas rules before switching on the 15% matchmaker (check). Missed-call text-back stays a stub until an SMS provider with 10DLC registration (TJ's call). Mockups are served from the API for now; move to <slug>.<cold domain> once the domain exists.
- [ ] Before any outreach: 3 golden sites (HVAC, roofing, plumbing) for real NWA businesses must each score 8+ from TJ and two other people, per money/SITE_BAR.md. See [[Sites by TJ]].

## Jarvis
- [ ] Phone Jarvis: sign up at Vapi (free, no card), then either follow voice/phone/README.md or add VAPI_API_KEY in Project settings > Environment so Jarvis backend sets it up. See [[Jarvis]].
- [ ] Open Jarvis, tap FACTORY, then tap IMPROVE once to let Jarvis run his first design pass. See [[Jarvis]].
- [ ] Try the HUD on the phone: https://claude.ai/artifact/6BgK9h8LVgz3ondg1QqzSP. See [[Jarvis]].
- [ ] Decide on an Anthropic API key for the HUD (pay as you go, about 1 cent a question on Opus).
- [ ] Decide if Jarvis gets a movie-grade voice (ElevenLabs, about $5 to $22 a month).
- [ ] Connect Spotify on claude.ai (phone browser, Settings > Connectors). Then set up a phone shortcut for play and pause. See [[Jarvis]].
- [ ] Set up Jarvis on the phone: follow the phone guide in [[Jarvis]] (Project + GitHub + voice mode), then test "What's on my to-do list?".
- [ ] Tell Claude favourite music and chill routines for [[Personal]].
- [ ] Finish the Gmail sign-in on claude.ai (Calendar and Drive are connected).
- [ ] Set the Google Calendar time zone to Central (it shows UTC). Reminders already fire at the right Central time; this fixes how times look in the calendar app and the brief. Calendar app > Settings > General > Time zone.
- [ ] Read the three new notes and say what to change: [[Hardware readiness list]], [[Backend proficiency checklist]], [[J Street pilot pitch]].
- [x] Past-chats list on the phone page: CHATS button reopens any saved chat (2026-10-21). See [[Jarvis]].
- [ ] When TJ has a computer: sign in to Claude in Chrome there, then test one website job.

## Later
- [ ] Staff and cleaner schedules (after real nights).
- [ ] Pitch J Street's owners with the pilot counts. Draft: [[J Street pilot pitch]].
- [ ] A per-night "scans confirmed" line in the morning report.
