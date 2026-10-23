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
| 5. Stripe checkout | |

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

## What Tuesday's keys switch on (set on Render, never here)

| Set | Turns on |
|---|---|
| `ANTHROPIC_API_KEY` | Claude drafts instead of the template |
| `MAILER=smtp`, `SMTP_USER`, `SMTP_PASSWORD` (Workspace app password), `FROM_EMAIL` | Real sending from the cold-domain inbox |
| `MAILING_ADDRESS` | CAN-SPAM footer; nothing sends without it |
| `PUBLIC_URL` | Working unsubscribe links |
| Cold domain DNS: SPF, DKIM, DMARC | Mail lands in inboxes; warm up 2-3 weeks before volume |
| Unpause in the dashboard | The last switch, TJ's tap |
