# Trades agency (plumbing, HVAC, roofing)

Sells trade shops a rebuilt site + an AI receptionist that answers after-hours calls. Architecture and prices:
Claude Doc "Trades MVP: schema and folder structure" (https://claude.ai/artifact/F9ok16rfkVkvQw5wBz5d3x). Brain note: [[Sites by TJ]].

Prices (2026-10-23): $299 setup + $149/mo Front Desk (300 min) or $249/mo Front Desk Plus (800 min, 24/7); $0.25/min over.

| Step | Status |
|---|---|
| 1. `api/schema.sql` + `api/import_coldlist.py` (scout data -> Postgres) | done |
| 2. FastAPI server (`api/main.py`), Render blueprint (`render.yaml`) | done, not deployed |
| 3. Outreach Agent (`api/outreach.py`: scout flaw + Claude draft + mockup link) | drafts done; Playwright flaw finder and build.py mockups next |
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

## How an email gets out

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
