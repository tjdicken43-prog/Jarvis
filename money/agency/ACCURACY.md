# Accuracy pass (2026-10-24), handoff

Branch `claude/project-thread-463607`. Plan page: https://claude.ai/artifact/HLXwNiWB6r1hpjWUtpJsb2

## Done and tested (API)
All three suites pass (`tests/test_api.py`, `tests/test_quality.py`, `tests/test_frontdesk.py`); `evals/run.py` 91/91.
- `quality.py`: handoff contracts per stage, grounding check on AI first emails (numbers, links, phones, towns, claims,
  must name the flaw), stale-flaw age, MX check. `events.py`: one log, 3 fails in a row stop a step (send also pauses).
- Approve re-checks a flaw older than 7 days (fixed -> cancelled, changed -> Redraft). `/emails/{id}/redraft`.
- Skip needs a reason; edits saved before/after (`corrections`); drafter copies TJ's last 3 rewrites for tone.
- Warm-up ramp (`mailer.RAMP`): day 1-7 none, day 8+ 3/day, 15+ 5, 22+ 10, 29+ 20. Set `/settings/warmup` first.
- Gap fixes: send lock + 'sending' claim, permanent SMTP refusals don't block the queue, free-mail domains, https
  PUBLIC_URL required, inbox (Outlook quotes, our footer, long replies, real bounces only, bad message skipped, IMAP
  timeout), yes-shops stop follow-ups, receptionist only for paying clients + turned off on cancel, unique number,
  mockups 404 after opt-out + random slugs, overage claimed first with Stripe idempotency keys, GET unsubscribe is a
  button, duplicate shops get one sequence, for-sale pages and bot walls read correctly (found by real-shop evals).
- Go-live: `/clients/{id}/golive`, `/clients/{id}/live`, `/calls/to-review`, `/calls/{id}/review`.
- Evals: `evals/cases.json` (hand-made), `evals/real_shops.json` (21 real NWA shops, checked by eye from screenshots,
  TJ to confirm), `evals/capture.py`, `evals/freeze.py` (TJ's corrections -> `tj.json`).

## Left (next session)
1. Dashboard: `components/QualityControls.tsx` is written; wired so far: skip reasons + Redraft on Queue cards.
   Still to wire: StoppedSteps + WarmupForm + cap on the Queue health strip, Bounced/Failed/Stuck tabs, ConfirmButton
   on Send approved / Resume sending / Bounced / Do-not-email Add, a `/log` page (events + corrections + approve-as-drafted %),
   GoLiveChecklist + CallReviewList on `clients/[id]`. Premium look, no AI tells (TJ, 2026-10-24). Run `npx tsc --noEmit`.
2. CI: add `python3 money/agency/api/tests/test_quality.py` and `python3 money/agency/api/evals/run.py` to money-tests.yml.
3. README: document the ramp, skip reasons, log, go-live. Then PR, test, merge.
Not touched: Stripe async payments (bank debits) stay pending; mention to TJ.
