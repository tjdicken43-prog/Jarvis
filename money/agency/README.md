# Trades agency (plumbing, HVAC, roofing)

Sells trade shops a rebuilt site + an AI receptionist that answers after-hours calls. Architecture and prices:
Claude Doc "Trades MVP: schema and folder structure" (https://claude.ai/artifact/F9ok16rfkVkvQw5wBz5d3x). Brain note: [[Sites by TJ]].

Prices (2026-10-23): $299 setup + $149/mo Front Desk (300 min) or $249/mo Front Desk Plus (800 min, 24/7); $0.25/min over.

| Step | Status |
|---|---|
| 1. `api/schema.sql` + `api/import_coldlist.py` (scout data -> Postgres) | done |
| 2. FastAPI server (`api/main.py`), Render blueprint (`render.yaml`) | done, not deployed |
| 3. Outreach Agent: flaw finder (`api/flaws.py`), mockups (`api/mockup.py` + `../sites/trade_build.py`), drafts (`api/outreach.py`) | done |
| 4. Next.js Approval Queue (`web/`), nothing sends without TJ's tap | done |
| 4b. Follow-ups (`api/followups.py`): days 3, 7, 14, same thread, stop on reply/bounce/opt-out | done, stub until Tuesday's keys |
| 5. Clients + Leads views (`web/app/clients`, `web/app/leads`) | done |
| 6. Stripe checkout, webhook, overage (`api/billing.py`), TEST mode only | done, not deployed |
| 7. AI receptionist (`api/receptionist.py`): Vapi assistant per client, call webhook, missed-call text-back stub | done, dry run until Vapi key |
| 8. Render: `render.yaml` (Docker API with Chromium, dashboard, Postgres, send cron), `/health`, `/healthz` | done, not deployed |
| 9. What the demos sell: caller details, urgent alert, morning summary (`api/notices.py`), Plus booking + calendar feed (`api/booking.py`), Plus review asks (`api/reviews.py`), live site + working quote form (`api/sites.py`), client page (`web/app/clients/[id]`) | done, emails stub until `NOTIFY=smtp`, texts stub |

Load the database:

    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f money/agency/api/schema.sql
    python3 money/agency/api/import_coldlist.py <money-data prospects dir> | psql "$DATABASE_URL" -v ON_ERROR_STOP=1

Re-running is safe. Once loaded, Postgres owns lead statuses; opt-outs in suppress.csv always win. Keys live on Render, never here.

## Run it

    pip install -r money/agency/api/requirements.txt
    export DATABASE_URL=... OPERATOR_TOKEN=...      # names in .env.example
    python3 money/agency/api/migrate.py
    uvicorn main:app --app-dir money/agency/api      # API on :8000
    cd money/agency/web && npm ci && API_URL=http://localhost:8000 OPERATOR_TOKEN=... npm run dev

Test (wipes the database it is pointed at): `TEST_DATABASE_URL=... python3 money/agency/api/tests/test_api.py`, then
`tests/test_frontdesk.py` the same way.
Mockup builder test: `python3 money/test/test_trade_build.py`. Flaw finder needs `CHROMIUM_PATH` if Playwright's own Chromium isn't installed.
Render image: `docker build -f money/agency/api/Dockerfile -t agency-api .` from the repo root; `/health` shows `"browser": "chromium"`.

## How an email gets out

0. **Prepare** (`POST /outreach/prepare`, the "Find flaws and draft" button): for up to 5 shops not drafted yet.
   - **Flaw finder** opens their site in Chromium at 390 px like a customer's phone and picks ONE true flaw, worst
     first: down or parked, not mobile-friendly (no viewport tag or sideways scroll), no tap-to-call, phone number not
     on the first screen, slower than 4 s, no https, footer 3+ years old. Saves it with a screenshot
     (`/shots/<token>.png`) and the facts their own site states (logo link, brand colors, 24/7, licensed and insured,
     "since" year, NWA towns, services). No clear flaw, or a site that blocks us: no email. Without Chromium it falls
     back to one HTTP check (no screenshot, no phone-visibility check).
   - **Mockup**: `money/sites/trade_build.py` builds the option C trade page (golden sites + trade kit tools, square
     4px buttons, one font, their color darkened to pass AA, their logo linked from their site, never copied here).
     Only given facts appear: no invented reviews, years, licenses or prices. It must pass the site bar audit
     (banned words, placeholders, radius, fonts, tap-to-call, noindex) or no mockup link is saved. Served at
     `/m/<slug>` with noindex. Pages and screenshots live in Postgres, never in the repo.
   - Then the drafter below runs for the shops that got a mockup.
   One shop at a time: `POST /prospects/<id>/check`, `POST /prospects/<id>/mockup`.
1. **Draft** (`POST /outreach/draft`): shops with status checked/built, an email, a flaw and 2.8+ stars. Anyone on the
   do-not-email list (email or domain) is skipped and marked unsubscribed. Claude Haiku writes 3 sentences when
   `ANTHROPIC_API_KEY` is set, a plain template otherwise. Pre-flight rejects placeholders, prices that aren't ours,
   a missing preview link and anything over 80 words.
2. **Approve** in the queue: re-checks the list, then queues for the next send window (weekdays 9-11am Central).
   Undo works until it sends.
3. **Send** (`POST /send`): only if sending isn't paused (it starts paused), `MAILING_ADDRESS` is set, it's inside
   the window, under the daily cap (5 to start), and no one at that domain got mail in 24 hours. Re-checks the list
   again. Adds the footer (TJ, Sites by TJ, postal address, unsubscribe link) and one-click unsubscribe headers.
   Stops on the first error. `MAILER=stub` runs all of this and sends nothing.
4. **Follow-ups** (`api/followups.py`, no AI): three short ones on days 3, 7 and 14 after the first email, each a new
   angle (after-hours calls, no work on their end, a polite close), never "just bumping this". They are approved with
   the first email: its card shows them before TJ taps, and when the first one really sends they queue in the same
   thread (`Re:` subject, `In-Reply-To`/`References`). Each waits for its day and the next window, counts against the
   cap, gets the same footer, and can be undone, edited or skipped on the Approved tab.
   **Stops:** every `/send` first reads the Workspace inbox over IMAP (read only; same app password). A reply stops the
   sequence and marks the shop replied (TJ answers it himself); "stop", "unsubscribe", "not interested" and the like
   above the quote = do-not-email list; a bounce = do-not-email list. Out-of-office replies don't stop anything. If the
   inbox can't be read, follow-ups wait and first emails can still go. With the stub mailer TJ marks replies and
   bounces by hand on the Sent tab (`POST /prospects/<id>/replied` or `/bounced`).
5. **Unsubscribe** (`/u/{token}`, GET or one-click POST): adds the address to `suppressions` forever, marks the shop
   unsubscribed, cancels anything pending.

## Getting paid (Stripe, test mode)

1. **Add the client** on Clients (from a prospect id or by hand; trades only). It starts "waiting on payment".
2. **Make checkout link**: pick Front Desk or Plus, monthly or annual (pay 10 months for 12). The link charges the
   plan plus the $299 setup on the first invoice. TJ sends it himself.
3. **Webhook** (`POST /stripe/webhook`, signed with `STRIPE_WEBHOOK_SECRET`): `checkout.session.completed` marks the
   client active and the shop won; `invoice.payment_failed` = past due, `invoice.paid` = active again,
   `customer.subscription.deleted` = cancelled. Each event applies once; live-mode events are ignored in test mode.
   In Stripe, point the endpoint at `<PUBLIC_URL>/stripe/webhook` with those four events.
4. **Overage** (`POST /billing/overage`, early each month, default last month): minutes over the plan at $0.25,
   once per client per month. Monthly clients get it on their next invoice; annual clients get their own invoice.
   Without a Stripe key it's a dry run. Minutes come from `receptionist_calls` (the Vapi webhook fills it, not built).

Only `sk_test_` keys work. A live key is refused unless `STRIPE_ALLOW_LIVE=yes`, which is set only on TJ's word.
Leads (matchmaker) are display only until the Arkansas license question is checked: no matching, no charging.

## AI receptionist (Vapi)

1. **Set up** on Clients (Receptionist section): the shop's hours (Central), text-back on or off, and its Vapi number.
   `POST /clients/<id>/receptionist` builds the assistant: answers as "the automated after-hours assistant", says the call may be
   recorded, takes name, callback number, town, problem and urgency. Never quotes prices, books slots or claims to be
   a person. Gas smell or CO alarm: get out, call 911 or the gas company. Without `VAPI_API_KEY` it's a dry run;
   with it, it creates (then updates) the assistant on Vapi. It never places calls.
2. **The shop forwards its line** to the Vapi number: after hours on Front Desk, all day on Plus. In Vapi, attach the
   number to the assistant.
3. **Every call** ends with Vapi posting an end-of-call report to `<PUBLIC_URL>/vapi/webhook` (header `X-Vapi-Secret`
   = `VAPI_WEBHOOK_SECRET`). It becomes a row in `receptionist_calls` (once per call): seconds, after hours or not,
   outcome, summary, cost. Clients shows calls, after-hours and missed counts and minutes against the plan, and
   overage billing reads the same rows. `GET /clients/<id>/calls` lists them.
4. **Missed-call text-back** (stub, sends nothing): a caller who hangs up within 20 seconds can get ONE text, only if
   the shop turned it on, the client is paying, the call was in the last 15 minutes, the number didn't reply STOP
   (`POST /sms/optouts`), and we haven't texted them in 7 days. It names the shop and says "Reply STOP to opt out".
   We only ever answer people who called. Never cold texts or calls (TCPA). Real sending needs an SMS provider with
   A2P 10DLC registration, on TJ's word.
5. **Each shop's own assistant** (2026-10-25, [PRO-PASS.md](PRO-PASS.md)): `POST /clients/{id}/profile` sets greeting,
   tone, services, towns, fees it may say, FAQ, extra questions, Spanish, voice, per-day hours, holidays and transfer;
   `GET` shows the exact prompt. Owner page (`OWNER_PAGE=on`), Google two-way calendar, the demo line and the Vapi
   fallback are there too. Tests: `tests/test_pro.py`.

## What Front Desk hands the owner (step 9)

Modeled on running products: answering services (Smith.ai, Ruby) page the on-call person for urgent calls and email call
notes; field-service tools (Housecall Pro, Jobber) book fixed arrival windows; review tools (Podium, NiceJob) send one
ask after the job. Open each client from Clients to see all of it.

1. **Caller details**: every call saves name, callback number, town, what's wrong and emergency yes/no (Vapi's
   structured data), plus the caller id.
2. **Urgent heads-up**: a caller who says it can't wait emails the owner that minute (not spam, paying clients only).
3. **Morning summary**: each paying client gets one email a day at its summary hour (default 6am Central): urgent
   calls, messages to call back, website requests, hang-ups (with text-back status), spam count, today's bookings.
   A quiet night says "no calls, the line is on". Covers everything since the last summary, so nothing falls between.
4. **Plus booking** (Clients > client > Booking): the shop picks visit windows (default 8-10, 10-12, 1-3, 3-5 on open
   days), jobs per window, soonest (default 3 hours out). The assistant gets two tools, `check_openings` and
   `book_visit` (answered on `/vapi/webhook`), offers at most two openings, never books emergencies, reads the window
   back, asks if texts are OK. Two callers can't take the last spot (row lock). The owner gets an email per booking and
   a calendar feed `/cal/<token>.ics` to subscribe to on their phone (Google Calendar or iPhone), no Google sign-in.
5. **Plus review asks**: marking a visit "Job done" queues one ask with the shop's Google review link, sent 2 hours
   later between 10am and 7pm Central. Email if we have it, else a text only if they said yes on the call (texts stay
   stubs). Everyone gets the same ask: no filtering by how happy they are (Google policy, FTC review rule
   2024-10-21), no rewards, one ask per customer per 6 months, opt-outs and the do-not-email list win.
6. **Live site** (Clients > client > Website): rebuilds their preview without the preview parts (no concept bar, no
   owner panel, indexable), passes the same audit, serves at `/s/<slug>` and at their own domain once it points here.
   The quote form works: name, phone, job, town, day and up to 3 photos (5 MB each) are saved, the owner is emailed at
   once with photo links (`/p/<token>`), a hidden field drops bots, 20 an hour per site max.
7. **Cron**: `agency-send` now runs every 15 minutes, `cron.py send frontdesk`. Cold email still only goes out in the
   weekday 9-11am window; `/frontdesk/run` sends summaries and review asks that are due.

`NOTIFY=stub` saves every owner email and review ask (see them on the client page) and sends nothing. `NOTIFY=smtp`
sends from the Workspace inbox (`NOTIFY_FROM_EMAIL`, default `FROM_EMAIL`). Vapi tool and structured-data field names
follow docs.vapi.ai as of 2026-10: check with Tuesday's real test call.

## Accuracy: how the factory checks itself (2026-10-24)

Details and what's left: `ACCURACY.md`. Plan: https://claude.ai/artifact/HLXwNiWB6r1hpjWUtpJsb2
- **Handoff contracts** (`api/quality.py`): a shop can't be drafted, approved or sent with a missing piece (fresh
  flaw check, screenshot, https preview). A site that blocked our checker is held for a look by hand.
- **Evidence, not memory:** approve re-checks a flaw older than 7 days. Fixed = draft cancelled; changed = Redraft.
  A first email never sends on a check older than 14 days.
- **Grounding:** every number, year, link, phone, town and claim in a Claude draft must come from their own site or
  our record, and it must name the flaw we found. Ratings, reviews, competitors and guarantees are never claimed.
  TJ's own edits aren't blocked; he sees a "Check:" note instead.
- **One log** (`events`, Log page): every step writes a row. The same step failing 3 times in a row stops it
  (sending also pauses) until TJ resumes it on the Queue.
- **TJ's corrections:** Skip needs a reason; edits are saved before and after. The drafter copies the tone of his
  last 3 rewrites. `evals/freeze.py` turns "wrong flaw" and "untrue" skips into test cases.
- **Frozen test set:** `python3 money/agency/api/evals/run.py` (CI runs it). Real NWA shops (`real_shops.json`,
  checked by eye from screenshots), hand-made traps (`cases.json`), TJ's corrections (`tj.json`). Never edit a case to
  make it pass.
- **Warm-up ramp:** set the warm-up start date on the Queue. Days 1-7 nothing cold, then 3 a day, 5 from day 15,
  10 from day 22, 20 from day 29 (`DAILY_SEND_CAP` is the ceiling). One run sends at a time; free-mail addresses count
  per address, not per domain; a refused address goes on the list and the rest keep going.
- **Go-live** (client page): paid, receptionist built, a real test call landed, forwarding works after hours, the shop
  OK'd the hours. Then up to 3 calls a week to listen to in the first month.

## Founding clients and what each client costs (2026-10-24)

- **Founding offer (TJ):** the first 5 shops to pay keep today's prices ($299 setup, $149 / $249 a month, $0.25/min
  over) for as long as they stay. The spot is claimed when Stripe says they paid (`billing.claim_founding`, numbered
  1 to 5). A later price rise never reaches them; a cut does. Preview owner panels and the day-7 follow-up mention it
  only while spots are open; old previews drop the line once all 5 are taken.
- **Cost tracker:** Clients page, "What each client costs": revenue, receptionist (Vapi's own cost per call, or
  `VAPI_EST_CENTS_PER_MIN` when it sent none), a share of the Render bill (`HOSTING_CENTS_MONTH`), Claude calls tied to
  the client, Stripe's fee, and the margin. `GET /costs?month=YYYY-MM` gives the same. Every Claude call we pay for is
  a row in `ai_usage`. Check the two estimates against the real Render and Vapi bills once a month.
- **Cost trim:** a shop whose email domain can't take mail is now held before the Chromium visit and mockup build
  (same outcome as before, minus the wasted run). Full audit: project file `cost-trim/2026-10-24-cost-audit.md`.

## Tuesday checklist (in order; keys go on Render, never here)

Checked 2026-10-25: the four agency services already exist on Render (made from this blueprint 2026-10-24) and are
suspended. Resume them; don't make a new Blueprint. Tj's own copy with links and ticks is the Launch List page.

1. **Card first** (money/BUDGET.md "TJ's card setup"): Privacy.com cards per service (Render $35, Anthropic $20,
   Workspace $9, a single-use one for the domain), Anthropic workspace limit $20 with auto-reload off.
2. **Cold domain** (~$12/yr), not TJ's main one. **Google Workspace Business Starter** on it, one inbox for TJ.
3. **DNS** on the cold domain (Workspace admin shows each value): MX for Workspace; SPF TXT
   `v=spf1 include:_spf.google.com ~all`; DKIM (Admin > Apps > Gmail > Authenticate email, add the
   `google._domainkey` TXT, then press Start authentication); DMARC TXT on `_dmarc`: `v=DMARC1; p=none; rua=mailto:<that inbox>`.
   Google Postmaster Tools. **Warm-up starts now**, 2-3 weeks of real emails by hand; `MAILER` stays `stub`.
4. **Mailing address**: PO box or virtual mailbox, for the CAN-SPAM footer.
5. **Render: resume** agency-db first, then agency-api, agency-dashboard, agency-send. The deploy runs `migrate.py`
   (tested 2026-10-25 on a fresh database and on an upgrade from the 10-24 schema). Open
   `https://agency-api-kmkw.onrender.com/health`: `db: true`, `browser: chromium`, `public_url_ok: true`. If the Queue
   is empty, load the shops with the two commands under "Load the database" (Render's external database URL).
6. **agency-api environment**: `MAILING_ADDRESS`, `OPERATOR_EMAIL` (Tj's alerts), check `PUBLIC_URL` =
   `https://agency-api-kmkw.onrender.com` and `API_URL` (same address) on agency-dashboard and agency-send. Leave
   `MAILER`, `NOTIFY`, `TEXTBACK` on stub and `OWNER_PAGE` off. New `DASHBOARD_PASSWORD` on agency-dashboard.
7. **OPERATOR_TOKEN** from agency-api into Project settings > Environment, so phone Jarvis can approve drafts.
8. **Workspace app password** (2-Step Verification on first): `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL`. The same
   password reads replies and bounces over IMAP (`imap.gmail.com`; IMAP must be allowed in the Workspace admin (check)).
9. **Warm-up date** on the Queue (`/settings/warmup`): cold email starts day 8 at 3 a day.
10. **Vapi**: `/health` says `receptionist: vapi` (`VAPI_API_KEY` was added 2026-10-24, unverified). Prepaid credit only.
    Set up a test client and make the 10 test calls in GAP-REVIEW.md (noise, mumbled address, Spanish, wrong number,
    salesperson, emergency with the owner cell set, answered once and left to ring out once).
11. **Stripe (test)**: `STRIPE_SECRET_KEY` = sk_test_ key on agency-api. Add endpoint `<PUBLIC_URL>/stripe/webhook`
    with the four events listed above, paste its signing secret into `STRIPE_WEBHOOK_SECRET`.
12. **After the test calls** (Tj's calls): Spanish yes or no, demo number (then Jarvis runs `POST /demo/receptionist`),
    Google calendar OAuth app or wait for Jobber, Twilio 10DLC, OK the owner page mockup (`OWNER_PAGE=on`).
13. **First shop pays**: `NOTIFY=smtp`. For a client's own domain: add it under agency-api > Settings > Custom Domains,
    the shop adds the CNAME Render shows, then Publish live site with that domain.
14. **After warm-up**: `MAILER=smtp`, then unpause in the dashboard. That last tap is TJ's.

| Set | Turns on |
|---|---|
| `ANTHROPIC_API_KEY` | Claude drafts instead of the template |
| `MAILER=smtp`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL` | Real sending from the cold-domain inbox |
| `MAILING_ADDRESS` | CAN-SPAM footer; nothing sends without it |
| `PUBLIC_URL` | Working unsubscribe links, Vapi and Stripe webhooks |
| `STRIPE_SECRET_KEY` (sk_test_), `STRIPE_WEBHOOK_SECRET` | Test checkout links and the webhook; live waits on TJ |
| `VAPI_API_KEY` | Receptionist set-up creates real Vapi assistants |
| `NOTIFY=smtp` (+ the Workspace login) | Owner emails (urgent, bookings, website requests, morning summary) and Plus review asks really send |
| `OPERATOR_EMAIL` | Tj's alerts: demo-line callers, Vapi down, calendar sync failures |
| `OWNER_PAGE=on` | Owners' own page at `/o/{token}` (after Tj OKs the mockup) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_KEY` | Two-way Google Calendar for Plus shops |
| `DEMO_NUMBER` | Shows the demo line on /health (the number itself is attached on Vapi) |
| `TEXTBACK=twilio` + `TWILIO_*` | Real missed-call texts, only after 10DLC |
| Unpause in the dashboard | The last switch, TJ's tap |
