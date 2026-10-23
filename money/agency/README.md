# Trades agency (plumbing, HVAC, roofing)

Sells trade shops a rebuilt site + an AI receptionist that answers after-hours calls. Architecture and prices:
Claude Doc "Trades MVP: schema and folder structure" (https://claude.ai/artifact/F9ok16rfkVkvQw5wBz5d3x). Brain note: [[Sites by TJ]].

Prices (2026-10-23): $299 setup + $149/mo Front Desk (300 min) or $249/mo Front Desk Plus (800 min, 24/7); $0.25/min over.

| Step | Status |
|---|---|
| 1. `api/schema.sql` + `api/import_coldlist.py` (scout data -> Postgres) | done |
| 2. FastAPI server on Render | next |
| 3. Outreach Agent (flaw + Claude draft + mockup from `money/sites/build.py`) | |
| 4. Next.js Approval Queue (`web/`), nothing sends without TJ's tap | |
| 5. Stripe checkout | |

Load the database:

    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f money/agency/api/schema.sql
    python3 money/agency/api/import_coldlist.py <money-data prospects dir> | psql "$DATABASE_URL" -v ON_ERROR_STOP=1

Re-running is safe. Once loaded, Postgres owns lead statuses; opt-outs in suppress.csv always win. Keys live on Render, never here.
