-- Trades agency database (plumbing, HVAC, roofing). Plain SQL, run once:
--   psql "$DATABASE_URL" -f money/agency/api/schema.sql
-- Prices: $299 setup + $149/mo Front Desk or $249/mo Front Desk Plus (2026-10-23).

-- Prospects: one row per trade business. id = scout id (node/..., way/..., overture/...)
CREATE TABLE IF NOT EXISTS prospects (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  trade         text NOT NULL CHECK (trade IN ('plumbing','hvac','roofing')),
  city          text,
  phone         text,
  email         text,
  website       text,
  rating        numeric(2,1),            -- Google stars; Checker skips < 2.8
  review_count  int,
  site_state    text CHECK (site_state IN ('DOWN','DATED','WEAK','OK')),
  flaw          text,                    -- the one weakness named in the email
  flaw_evidence text,                    -- link or screenshot path
  score         int,
  facts         jsonb,                   -- Checker output: services, hours, area, colors
  mockup_slug   text UNIQUE,
  mockup_url    text,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN
                ('new','checked','skip','no-email','built','approved','emailed',
                 'replied','won','lost','unsubscribed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospects_status_trade ON prospects (status, trade);

-- Do-not-email list. Checked before every draft and every send. Rows are never deleted.
CREATE TABLE IF NOT EXISTS suppressions (
  id         serial PRIMARY KEY,
  email      text,
  domain     text,
  reason     text NOT NULL,              -- unsubscribed, asked to stop, bounced
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR domain IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS suppressions_email ON suppressions (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS suppressions_domain ON suppressions (lower(domain)) WHERE domain IS NOT NULL;

-- Emails: drafts, the approval queue, and what was sent
CREATE TABLE IF NOT EXISTS emails (
  id            serial PRIMARY KEY,
  prospect_id   text NOT NULL REFERENCES prospects(id),
  kind          text NOT NULL CHECK (kind IN ('first','follow_up_1','follow_up_2')),
  subject       text NOT NULL,
  body          text NOT NULL,           -- 3 sentences; address + unsubscribe footer added at send time
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN
                ('draft','approved','sent','bounced','replied','cancelled')),
  edited        boolean NOT NULL DEFAULT false,
  unsub_token   text UNIQUE NOT NULL,    -- for the one-click unsubscribe link
  approved_at   timestamptz,
  send_after    timestamptz,             -- follow-ups wait their turn
  sent_at       timestamptz,
  provider_id   text,                    -- SendGrid message id
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, kind)
);
CREATE INDEX IF NOT EXISTS emails_status ON emails (status);

-- Clients: paid the $299 setup, on $149 or $249 a month
CREATE TABLE IF NOT EXISTS clients (
  id                     serial PRIMARY KEY,
  prospect_id            text UNIQUE REFERENCES prospects(id),
  business_name          text NOT NULL,
  contact_name           text,
  email                  text NOT NULL,
  phone                  text,
  trade                  text NOT NULL CHECK (trade IN ('plumbing','hvac','roofing')),
  plan                   text NOT NULL DEFAULT 'front_desk' CHECK (plan IN ('front_desk','front_desk_plus')),
  setup_cents            int NOT NULL DEFAULT 29900,
  monthly_cents          int NOT NULL DEFAULT 14900,  -- 24900 on Plus
  included_minutes       int NOT NULL DEFAULT 300,    -- 800 on Plus; over that $0.25/min
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  status                 text NOT NULL DEFAULT 'pending' CHECK (status IN
                         ('pending','active','past_due','cancelled')),
  site_url               text,
  receptionist_number    text,           -- Vapi number customers call after hours
  vapi_assistant_id      text,
  started_at             timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Receptionist usage: one row per call, from the Vapi webhook
CREATE TABLE IF NOT EXISTS receptionist_calls (
  id           serial PRIMARY KEY,
  client_id    int NOT NULL REFERENCES clients(id),
  vapi_call_id text UNIQUE,
  started_at   timestamptz NOT NULL,
  seconds      int NOT NULL DEFAULT 0,
  after_hours  boolean NOT NULL DEFAULT true,
  outcome      text CHECK (outcome IN ('booked','message','spam','hung_up')),
  summary      text,
  cost_cents   int
);
CREATE INDEX IF NOT EXISTS receptionist_calls_client ON receptionist_calls (client_id, started_at);

-- Leads: homeowners who need trade work (matchmaker, switched on later)
CREATE TABLE IF NOT EXISTS leads (
  id                serial PRIMARY KEY,
  customer_name     text NOT NULL,
  phone             text,
  email             text,
  zip               text NOT NULL,
  trade             text NOT NULL CHECK (trade IN ('plumbing','hvac','roofing')),
  job_description   text NOT NULL,
  urgency           text CHECK (urgency IN ('emergency','this_week','flexible')),
  consent_at        timestamptz NOT NULL,  -- they agreed to be passed to a contractor
  source            text,
  status            text NOT NULL DEFAULT 'new' CHECK (status IN
                    ('new','matched','accepted','won','lost','paid')),
  matched_client_id int REFERENCES clients(id),
  job_value_cents   int,
  commission_pct    numeric(4,1) NOT NULL DEFAULT 15.0,
  commission_cents  int,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_status_trade ON leads (status, trade);

-- Operator switches (step 2): {"paused": true} stops every send until TJ flips it back
CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES ('paused', 'true') ON CONFLICT DO NOTHING;

-- Step 3: flaw finder screenshots (first screen on a phone) and auto mockups. Served by the API, never in the repo.
CREATE TABLE IF NOT EXISTS shots (
  token       text PRIMARY KEY,           -- unguessable; /shots/{token}.png
  prospect_id text NOT NULL REFERENCES prospects(id),
  png         bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mockups (
  slug        text PRIMARY KEY,           -- /m/{slug}
  prospect_id text NOT NULL REFERENCES prospects(id),
  html        text NOT NULL,
  built_at    timestamptz NOT NULL DEFAULT now()
);
