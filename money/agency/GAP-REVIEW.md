# Front Desk vs the pros: gap review (2026-10-25)

Scope: our Front Desk ($149) and Plus ($249) against Smith.ai, Rosie, Goodcall, Ruby and the field-service tools trades already use (Jobber AI Receptionist, Housecall Pro AI Team, ServiceTitan). Prices untouched.

**How sure:** the competitor lines come from one round of web searches on 2026-10-25, mostly vendor and review-site pages, so they are marketing claims and prices disagree between sources. Our own state is read from the code. Legal points are not legal advice. Anything marked (memory) is not looked up.

## What the competitors have that matters to a plumber

- **Smith.ai**: AI first, hands off to human receptionists when asked or needed, warm-transfers qualified leads live, texts. About $95-98/mo for 30 calls on the AI tier (sources disagree). No documented emergency escalation found.
- **Rosie**: from $49/mo, English and Spanish on all plans, spam screening, texts a booking link. Minutes allowance disagrees by source.
- **Goodcall**: per-agent pricing capped by unique callers a month ($59-79, sources disagree). Bilingual: unknown.
- **Ruby**: live humans, about $250/mo for 50 minutes. Not an AI rival, it is the price anchor.
- **Jobber / Housecall Pro / ServiceTitan**: their own AI answers and books straight onto the dispatch board. This is the real threat to Plus once a shop uses one of them.
- **Trade-specific AI tools**: urgency keywords (burst pipe, gas smell, no heat), on-call alert within about 90 seconds (vendor claim), and "integration" that is often only an emailed request. Test depth before trusting any claim.

## The nine areas

| # | Area | Pros do | We had | Now |
|---|---|---|---|---|
| 1 | Calls | Fast answer, warm transfer of urgent calls, spam filter, ask-again when unsure, Spanish | Takes messages, spam outcome, safety script, urgent email | **Built:** warm transfer to the owner's cell on emergencies, "never guess, ask again, pass the question on" rule. **Open:** Spanish, live test |
| 2 | Texts | Missed-call text-back, booking confirmation, STOP/HELP | Stub that recorded texts | **Built:** Twilio sender + signed inbound STOP/START/HELP, off until `TEXTBACK=twilio`. Needs 10DLC (Tj) |
| 3 | Setup | Live in a day, owner edits hours and scripts | Go-live checklist, hours via API | **Open:** owner cannot edit anything themselves (TJ does it). Fine for 5 founding clients |
| 4 | Owner app | Call log, recordings, transcripts, morning summary on a phone | Emails and a calendar feed, no recordings stored | **Built:** recording link + transcript saved per call and returned by `/clients/{id}/calls`. **Open:** an owner-facing page (needs a mockup first) |
| 5 | Booking | Two-way sync with Google, Jobber, Housecall Pro | `.ics` feed (one-way, subscribe) | **Open:** needs Google OAuth app or Jobber/HCP partner access (Tj accounts). Feed stays |
| 6 | Websites and SEO | Fast pages, Google Business Profile, review flow | Rebuilt site, bar-audited, review asks (Plus) | **Open:** GBP setup is manual; speed score not measured per client site (can add, no spend) |
| 7 | Trust and legal | Recording disclosure, privacy page, uptime, a backup | "This call may be recorded" in the greeting, AI disclosure, TCPA answer-only | **Open:** backup if Vapi is down; privacy page; lawyer glance (Tj) |
| 8 | Billing and support | Month-to-month, clear cancel, response promise | Stripe, cancel turns the line off | **Open:** write the support promise and cancel terms on the offer page (wording is Tj's) |
| 9 | Proof | Case studies, reviews, a demo line | Demo pages | **Open:** a demo number a prospect can call (Vapi number, small cost, Tj) |

## Pro tips worth copying (mostly from memory, marked where not looked up)

1. **Answer inside two rings, greet in one sentence, say it is recorded.** Done in the greeting.
2. **Transfer only true emergencies**, and always have the "no answer" path: the call goes back to taking a message and the urgent email still fires. Done. A transfer that rings out while the caller waits is worse than no transfer.
3. **Warm over blind.** The owner hears who is calling before the caller is connected. Vapi mode `warm-transfer-experimental` is the one documented as working with Vapi numbers; the Twilio-only warm modes apply if the number is on Twilio. Forum reports say fallback on no-answer is flaky (looked up, unverified), so the live test must include an unanswered transfer.
4. **Ask for the callback number and read it back.** Already in the prompt. Pros also capture it from caller ID as a fallback, which we do.
5. **Never quote prices or promise arrival times.** Already in the prompt. Windows, not times, for booking.
6. **Text-back inside 15 minutes, once, with STOP language.** Done in code; real sending waits for 10DLC.
7. **Weekly 10-minute call review in month one.** The `/calls/to-review` list does this; now with recordings and transcripts attached.
8. **Test with real accents and noise.** Do 10 test calls on Tuesday: shop noise, a mumbled address, a Spanish speaker, a wrong number, a salesperson, an emergency.

## Built in this pass (all tested: test_frontdesk, test_api, test_quality green)

- `receptionist.py`: `transfer_call` tool (needs `owner_cell`), uncertainty rule in both prompts, recordings and transcripts saved.
- `sms.py` + `/sms/inbound`: Twilio send, one try only, signature check, STOP/START/HELP. `TEXTBACK=stub` stays the default; `/health` shows `sms` and `transfer_mode`.
- Set the owner's cell: `POST /clients/{id}/receptionist` with `owner_cell`. Blank clears it.

## Tj's list (money, accounts, legal, or only Tj can confirm)

1. **Tuesday, free:** run the 10 test calls above on the live Vapi number; include an emergency with the owner's cell set, one answered and one left to ring out. Tell Jarvis what happened.
2. **10DLC:** register a brand and campaign with Twilio (sole proprietor fee about $4.50 one-time per Twilio, other fees per month; look up current prices in the console before paying, over $25 total needs your tap). Approval can take about a week. Then set the three `TWILIO_*` vars and `TEXTBACK=twilio` on Render.
3. **Spanish:** decide if you want it. Needs a test call to judge the voice (Vapi docs: transcriber language `multi` on Nova-3 detects Spanish; voice quality and delay are the unknown).
4. **Demo number:** buy a Vapi number for prospects to call (small monthly cost).
5. **Calendar sync:** say if you want Google Calendar two-way first (needs a Google Cloud OAuth app, free but a login only you can create) or Jobber/Housecall Pro partner access later.
6. **Legal:** the lawyer glance on privacy notice and call-recording wording. Arkansas allows one-party consent (looked up), but callers can be out of state, so keep the greeting.
7. **Terms page:** your wording for cancel terms and a support response promise.

## Next builds (no spend), if you want them

Owner page with calls, recordings and transcripts (mockup first), a Vapi-down fallback (forward to the owner's cell), per-client site speed check, and Google Business Profile checklist.
