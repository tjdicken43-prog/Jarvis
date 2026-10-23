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
| 5. Clients + Leads views (`web/app/clients`, `web/app/leads`) | done |
| 6. Stripe checkout, webhook, overage (`api/billing.py`), TEST mode only | done, not deployed |
| 7. AI receptionist (`api/receptionist.py`): Vapi assistant per client, call webhook, missed-call text-back stub | done, dry run until Vapi key |
| 8. Render: `render.yaml` (Docker API with Chromium, dashboard, Postgres, send cron), `/health`, `/healthz` | done, not deployed |

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

Test (wipes the database it is pointed at): `TEST_DATABASE_URL=... python3 money/agency/api/tests/test_api.py`
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
4. **Unsubscribe** (`/u/{token}`, GET or one-click POST): adds the address to `suppressions` forever, marks the shop
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
   `POST /clients/<id>/receptionist` builds the assistant: answers as "the after-hours assistant", says the call may be
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

## Tuesday checklist (in order; keys go on Render, never here)

1. **Cold domain** (~$12/yr), not TJ's main one. **Google Workspace Business Starter** on it, one inbox for TJ.
2. **DNS** on the cold domain (Workspace admin shows each value): MX for Workspace; SPF TXT
   `v=spf1 include:_spf.google.com ~all`; DKIM (Admin > Apps > Gmail > Authenticate email, add the
   `google._domainkey` TXT, then press Start authentication); DMARC TXT on `_dmarc`: `v=DMARC1; p=none; rua=mailto:<that inbox>`.
3. **Warm-up starts now**, 2-3 weeks: TJ sends a few real emails a day from that inbox and gets replies. `MAILER` stays
   `stub` until it's done.
4. **Mailing address**: PO box or virtual mailbox, for the CAN-SPAM footer.
5. **Render**: New > Blueprint > this repo, Blueprint path `money/agency/render.yaml`. Type in when asked:
   `DASHBOARD_PASSWORD`, `MAILING_ADDRESS`, `ANTHROPIC_API_KEY` (console.anthropic.com, set a monthly limit), leave the
   rest empty. After the first deploy, set `PUBLIC_URL` (agency-api's https address) on agency-api and `API_URL` (the
   same address) on agency-dashboard and agency-send. Open `<PUBLIC_URL>/health`: `db: true`, `browser: chromium`.
6. **Load the shops**: the two commands under "Load the database" above, with Render's external database URL.
7. **Stripe (test)**: `STRIPE_SECRET_KEY` = sk_test_ key on agency-api. Add endpoint `<PUBLIC_URL>/stripe/webhook`
   with the four events listed above, paste its signing secret into `STRIPE_WEBHOOK_SECRET`.
8. **Vapi**: sign up, put the private key in `VAPI_API_KEY` on agency-api (`VAPI_WEBHOOK_SECRET` is generated). Buy a
   number only when the first shop pays. Test: set up a receptionist for a test client, call it, check Clients.
9. **Workspace app password** (2-Step Verification on first): `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL`.
10. **After warm-up**: `MAILER=smtp`, then unpause in the dashboard. That last tap is TJ's.

| Set | Turns on |
|---|---|
| `ANTHROPIC_API_KEY` | Claude drafts instead of the template |
| `MAILER=smtp`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL` | Real sending from the cold-domain inbox |
| `MAILING_ADDRESS` | CAN-SPAM footer; nothing sends without it |
| `PUBLIC_URL` | Working unsubscribe links, Vapi and Stripe webhooks |
| `STRIPE_SECRET_KEY` (sk_test_), `STRIPE_WEBHOOK_SECRET` | Test checkout links and the webhook; live waits on TJ |
| `VAPI_API_KEY` | Receptionist set-up creates real Vapi assistants |
| Unpause in the dashboard | The last switch, TJ's tap |
