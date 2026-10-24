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

-- Step 5: Stripe (test mode until TJ goes live). Annual = 2 months free.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing text NOT NULL DEFAULT 'monthly' CHECK (billing IN ('monthly','annual'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS checkout_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS checkout_session_id text;
CREATE TABLE IF NOT EXISTS stripe_events (     -- each webhook event applied once
  id          text PRIMARY KEY,
  type        text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS overage_charges (   -- $0.25/min over the plan, billed once per client per month
  id                     serial PRIMARY KEY,
  client_id              int NOT NULL REFERENCES clients(id),
  month                  text NOT NULL,        -- YYYY-MM, Central
  minutes                int NOT NULL,
  over_minutes           int NOT NULL,
  amount_cents           int NOT NULL,
  stripe_invoice_item_id text,
  stripe_invoice_id      text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, month)
);

-- Step 7: AI receptionist (Vapi). Front Desk answers after hours; Plus answers 24/7. Missed-call text-back is a stub.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS open_hour smallint NOT NULL DEFAULT 7 CHECK (open_hour BETWEEN 0 AND 23);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS close_hour smallint NOT NULL DEFAULT 17 CHECK (close_hour BETWEEN 1 AND 24);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS open_saturday boolean NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS textback_enabled boolean NOT NULL DEFAULT false;  -- the shop asked for it
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS ended_reason text;
CREATE TABLE IF NOT EXISTS textbacks (          -- one text to a caller the receptionist missed; never cold texts
  id         serial PRIMARY KEY,
  client_id  int NOT NULL REFERENCES clients(id),
  call_id    int UNIQUE REFERENCES receptionist_calls(id),
  to_number  text NOT NULL,
  body       text NOT NULL,
  status     text NOT NULL CHECK (status IN ('stub','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS textbacks_number ON textbacks (to_number, created_at);
CREATE TABLE IF NOT EXISTS sms_optouts (        -- replied STOP: never text this number again
  number     text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Follow-ups: three after the first email (days 3, 7, 14), approved with it, stopped by any reply, bounce or opt-out
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_kind_check;
ALTER TABLE emails ADD CONSTRAINT emails_kind_check CHECK (kind IN ('first','follow_up_1','follow_up_2','follow_up_3'));
CREATE INDEX IF NOT EXISTS emails_provider_id ON emails (provider_id) WHERE provider_id IS NOT NULL;

-- Step 9 (2026-10-24): what the demos sell. Caller details, owner notices (emergency heads-up, new booking, next-morning
-- summary), Plus booking with a calendar feed, Plus review requests, and the client's live site. Sends are stubs until
-- NOTIFY=smtp; texts are stubs until an SMS provider with A2P 10DLC, on TJ's word.
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS caller_number text;    -- caller id, 10 digits
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS caller_name text;
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS callback_number text;
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS town text;
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS problem text;
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS emergency boolean NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_email text;              -- where summaries go; empty = clients.email
ALTER TABLE clients ADD COLUMN IF NOT EXISTS summary_hour smallint NOT NULL DEFAULT 6 CHECK (summary_hour BETWEEN 4 AND 11);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS booking jsonb;                  -- Plus: {"windows":[8,10,13,15],"length":2,...}; null = off
ALTER TABLE clients ADD COLUMN IF NOT EXISTS calendar_token text UNIQUE;     -- /cal/{token}.ics, the owner's calendar feed
ALTER TABLE clients ADD COLUMN IF NOT EXISTS review_url text;                -- the shop's Google "write a review" link
CREATE TABLE IF NOT EXISTS owner_notices (     -- every email to a client owner, sent or stubbed
  id          serial PRIMARY KEY,
  client_id   int NOT NULL REFERENCES clients(id),
  kind        text NOT NULL CHECK (kind IN ('emergency','booking','web_request','summary')),
  day         date,                            -- summaries: the Central date it covers up to; one per client per day
  period_end  timestamptz,                     -- summaries: calls before this are covered
  to_email    text NOT NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  status      text NOT NULL CHECK (status IN ('stub','sent','failed')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS owner_notices_summary_day ON owner_notices (client_id, day) WHERE kind = 'summary';
CREATE TABLE IF NOT EXISTS bookings (          -- Plus: a visit window the receptionist booked from the shop's openings
  id              serial PRIMARY KEY,
  client_id       int NOT NULL REFERENCES clients(id),
  vapi_call_id    text,
  window_start    timestamptz NOT NULL,
  window_end      timestamptz NOT NULL,
  customer_name   text NOT NULL,
  callback_number text NOT NULL,
  address         text,
  problem         text,
  ok_to_text      boolean NOT NULL DEFAULT false, -- the caller said yes on the call to texts about this visit
  customer_email  text,
  status          text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled','done')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_client_window ON bookings (client_id, window_start);
CREATE TABLE IF NOT EXISTS review_requests (   -- Plus: one ask after a finished job; everyone is asked, no filtering
  id              serial PRIMARY KEY,
  client_id       int NOT NULL REFERENCES clients(id),
  booking_id      int UNIQUE REFERENCES bookings(id),
  customer_name   text NOT NULL,
  to_number       text,
  to_email        text,
  channel         text NOT NULL CHECK (channel IN ('email','sms')),
  body            text NOT NULL,
  send_after      timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','stub','sent','skipped','failed')),
  detail          text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_requests_due ON review_requests (status, send_after);
CREATE TABLE IF NOT EXISTS client_sites (      -- the live site: same builder as the preview, no owner panel, indexable
  client_id    int PRIMARY KEY REFERENCES clients(id),
  slug         text UNIQUE NOT NULL,           -- /s/{slug}
  domain       text UNIQUE,                    -- their own domain once it points here (added on Render by TJ)
  html         text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_requests (     -- the live site's "request a call back" form
  id          serial PRIMARY KEY,
  client_id   int NOT NULL REFERENCES clients(id),
  name        text NOT NULL,
  phone       text NOT NULL,
  job         text,
  town        text,
  day         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_requests_client ON site_requests (client_id, created_at);
CREATE TABLE IF NOT EXISTS site_request_photos (
  token        text PRIMARY KEY,               -- unguessable; /p/{token}
  request_id   int NOT NULL REFERENCES site_requests(id),
  content_type text NOT NULL,
  data         bytea NOT NULL
);
-- Accuracy pass (2026-10-24): one log for the whole line, TJ's corrections, receptionist go-live checklist
CREATE TABLE IF NOT EXISTS events (            -- every step writes one row: what ran, for whom, passed or failed, why
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  step        text NOT NULL,                   -- flaw, mockup, draft, approve, skip, edit, send, inbox, stripe, receptionist, call_review, golive
  ok          boolean NOT NULL,
  reason      text,
  prospect_id text,
  email_id    int,
  client_id   int,
  detail      jsonb
);
CREATE INDEX IF NOT EXISTS events_step_at ON events (step, at DESC);
CREATE INDEX IF NOT EXISTS events_failed ON events (at DESC) WHERE NOT ok;
CREATE TABLE IF NOT EXISTS corrections (       -- TJ skipped or edited a draft: each one can become a test case
  id             serial PRIMARY KEY,
  email_id       int,
  prospect_id    text NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('skip','edit')),
  reason         text NOT NULL CHECK (reason IN ('wrong_flaw','weak_mockup','tone','wrong_shop','bad_fact','not_a_fit','edited','other')),
  note           text,
  before_subject text,
  before_body    text,
  after_subject  text,
  after_body     text,
  flaw           text,                         -- what the flaw finder said at the time
  signals        jsonb,                        -- what it saw, so a wrong flaw can be replayed in the evals
  frozen         boolean NOT NULL DEFAULT false, -- already copied into evals/cases.json
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS test_call_at timestamptz;          -- a call reached Clients through Vapi
ALTER TABLE clients ADD COLUMN IF NOT EXISTS forwarding_confirmed_at timestamptz; -- TJ called the shop's own line after hours and it reached us
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hours_confirmed_at timestamptz;    -- the shop OK'd the hours we saved
ALTER TABLE clients ADD COLUMN IF NOT EXISTS live_at timestamptz;               -- all three done and paying
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS reviewed_at timestamptz; -- TJ listened to it
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS review_ok boolean;
ALTER TABLE receptionist_calls ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_status_check;
ALTER TABLE emails ADD CONSTRAINT emails_status_check CHECK (status IN
  ('draft','approved','sending','sent','failed','bounced','replied','cancelled'));  -- sending: claimed by one run; failed: address refused
CREATE INDEX IF NOT EXISTS emails_due ON emails (status, send_after);
CREATE INDEX IF NOT EXISTS emails_sent_at ON emails (sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospects_email ON prospects (lower(email));
CREATE INDEX IF NOT EXISTS mockups_prospect ON mockups (prospect_id);
CREATE INDEX IF NOT EXISTS shots_prospect ON shots (prospect_id);
CREATE UNIQUE INDEX IF NOT EXISTS clients_vapi_assistant ON clients (vapi_assistant_id) WHERE vapi_assistant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_receptionist_number ON clients (right(regexp_replace(receptionist_number, '\D', '', 'g'), 10))
  WHERE receptionist_number IS NOT NULL;  -- one shop per receptionist number, so calls can't land on the wrong client

-- Founding clients (TJ, 2026-10-24): the first 5 shops to pay keep today's prices for as long as they stay
ALTER TABLE clients ADD COLUMN IF NOT EXISTS founding_no smallint CHECK (founding_no BETWEEN 1 AND 5);
CREATE UNIQUE INDEX IF NOT EXISTS clients_founding_no ON clients (founding_no) WHERE founding_no IS NOT NULL;

-- Cost tracker (2026-10-24): every Claude call we pay for, so margin per client is measured, not guessed
CREATE TABLE IF NOT EXISTS ai_usage (
  id            serial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  step          text NOT NULL,            -- draft, ...
  model         text NOT NULL,
  input_tokens  int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cost_cents    numeric(10,4) NOT NULL DEFAULT 0,
  prospect_id   text,
  client_id     int REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS ai_usage_at ON ai_usage (at);
