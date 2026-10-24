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
- Evals: `evals/cases.json` (hand-made), `evals/real_shops.json` (21 real NWA shops, checked from screenshots,
  confirmed by TJ 2026-10-24), `evals/capture.py`, `evals/freeze.py` (TJ's corrections -> `tj.json`).

## Dashboard (done, same PR)
Queue: warm-up date + today's cap, stopped-step alert with Resume, Bounced / Refused / Stuck tabs, skip-reason picker,
Redraft, two-step confirm on Send approved, Resume sending, Bounced and Block domain (free-mail domains refused).
Log page: 24h counts per step, approve-as-drafted %, failures, TJ's corrections before/after.
Client page: go-live checklist and "Listen to these" call checks. Phone nav scrolls instead of breaking words.

## Still open
- Stripe async payments (bank debits): a client stays pending until a card payment; not handled.
- Done 2026-10-24: TJ confirmed the 21 real-shop flaws in `evals/real_shops.json`.
