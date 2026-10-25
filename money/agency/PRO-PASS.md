# Front Desk pro pass (2026-10-25)

Two jobs from Tj: build what GAP-REVIEW.md said separated us from the pros, then review this setup the way a senior
engineer he paid would, for speed, accuracy and per-customer fit. Prices untouched. Nothing here spends money; every
paid or account-bound part is behind a switch that is off.

**How sure:** the code is tested here (5 suites + 130/130 evals). Vapi, Google and Deepgram field names come from their
docs as I remember them (2026-10) and are marked (check); the first live test call on Tuesday is the real proof.

## Part 1: the gaps, now built

| Gap | Built | Switch / Tj step |
|---|---|---|
| Spanish | `languages: ["en","es"]` in a shop's profile: Deepgram `multi` transcriber, "answer only in Spanish" rule, "Para español" in the greeting, details still written in English, call row says `language` | Per shop. Judge the voice on a test call; `VOICE_ES` swaps it without a deploy |
| Owner page | `/o/{token}`: calls to call back (urgent first), tap-to-call, Play recording, transcript, Mark called back, upcoming visits, minutes used, and settings the owner can change (hours per day, holidays, emergency cell, summary email and time, services, towns, fees, FAQ). No JavaScript, no login, link rotatable | `OWNER_PAGE=on` after Tj OKs the mockup: /mnt/project-files/front-desk-pro/ |
| Two-way calendar | `calendars.py`, provider-agnostic. Google: OAuth connect link, busy times block openings, new bookings pushed as events, an event the owner deletes cancels the booking, 3 retries then one email to Tj. Jobber and Housecall Pro: same shape, stubbed (need partner API access). Refresh tokens encrypted at rest | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_KEY`. The .ics feed keeps working either way |
| Vapi-down fallback | Vapi phone number gets `fallbackDestination` = the owner's cell (never the shop line: it forwards to us and would loop). Watchdog pings Vapi every cron run; 2 misses in a row email Tj once, and again when it's back | `FALLBACK=owner` (default), `OPERATOR_EMAIL` |
| Demo line | `demo.py`: a made-up Plus shop (Ozark Ridge Plumbing) with booking and Spanish, 5-minute cap, pretend bookings (nothing saved), never billed. Each caller is logged in `demo_calls` and Tj gets an email: they called us first, so it's a warm lead | `POST /demo/receptionist`, then Tj buys the number and sets `DEMO_NUMBER` |

## Part 2: what a paid senior engineer would change, by customer impact

Built (top items):

1. **Every shop is fully customizable without code** (`shopcfg.py`, `clients.profile`). Greeting, tone (warm/brisk/formal),
   services and not-services, towns, fees it may say word for word, FAQ answered word for word, up to 3 extra intake
   questions (answers saved per call), extra emergency words, languages, voice, hours per day, holidays, transfer on or
   off. `GET /clients/{id}/profile` shows the exact prompt and greeting the assistant gets. What never changes per shop:
   safety step, no guessing, AI and recording disclosure, no diagnosis, no arrival times. Owner text can't break the
   prompt (one line each, capped, `{{ }}` stripped).
2. **A caller never waits on our email server.** Booking and urgent emails used to send over SMTP inside the live tool
   call (seconds of dead air). Now they're queued and sent right after Vapi gets its answer, with the cron as backup.
   Calendar pushes also never run inside a call.
3. **Pooled database connections** (`DB_POOL=5`). Each tool call used to open a fresh Postgres connection (TCP + TLS +
   auth, tens of ms on Render) while the caller waits. Index on `vapi_assistant_id` for the per-call client lookup.
4. **Faster, safer turn-taking** (`startSpeakingPlan`): quick replies on normal speech, a longer wait on numbers so the
   assistant doesn't cut in while someone reads a phone number (check).
5. **Town names heard right**: Deepgram keyterms with the shop's name, its towns and 16 NWA towns (check). A wrong town
   sends a truck to the wrong place.
6. **Fewer missed emergencies**: if the call analysis leaves "emergency" out but the problem says "burst pipe", "no
   heat", "gas smell" (trade list + the shop's own words), the owner still gets the urgent email, worded "usually urgent".
   If the caller said it can wait, that's trusted.
7. **Callback numbers**: callers often say 7 digits; we used to drop that and fall back to caller ID. Now the caller ID's
   area code (479 if none) is added. Read-back is now in groups of 3-3-4.
8. **Dates callers actually say**: "next Tuesday", "this Friday", "October 30th", "10/29", "the 3rd", "mañana", "el
   jueves". Before, only weekday names, today, tomorrow and ISO dates worked; "next month" used to mean Monday.
9. **Per-day hours and holidays** drive after-hours tagging, the hours the assistant reads out, and booking windows (no
   3pm window on a Saturday that closes at noon).
10. **Accuracy you can measure**: `evals/calls.json` (39 code-graded receptionist cases: dates, callbacks, urgency, and a
    prompt contract every profile must keep) runs with the old evals, 130/130. `evals/calls_live.py --live` runs 8
    simulated calls (gas smell, price shopper, fee set, mumbled number, arrival-time push, salesperson, Spanish, out of
    area) with Claude as the caller, graded by code. Costs about 1-2 cents each; run it before any prompt change.

Not built, in priority order (no spend unless noted):

1. **Mid-call urgent alert**: the urgent email fires when the call ends (usually seconds later). A `flag_urgent` tool
   would alert mid-call; worth it once texts to the owner work (10DLC).
2. **Owner text alerts** for urgent calls and bookings: needs Twilio 10DLC (Tj).
3. **Quiet hours for transfers** (e.g. no 2am transfer unless gas or flooding): needs time-of-day in the prompt (check
   Vapi's date variables) or a server-side transfer decision.
4. **Spam screening before the AI answers** (known robocall numbers): costs per lookup; today the assistant ends sales
   calls, and they're shown, not billed differently.
5. **Dashboard screen for profiles**: TJ edits with the API or the owner page for now; a dashboard form needs a mockup.
6. **Per-client site speed check and Google Business Profile checklist** (from GAP-REVIEW).
7. **Prompt caching / model choice**: Haiku is right for latency now; re-check once real call logs show where it slips.

## New settings

`OPERATOR_EMAIL`, `OWNER_PAGE` (off), `FALLBACK` (owner), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_KEY`,
`DEMO_NUMBER`, `DEMO_BUSINESS`, `VOICE`, `VOICE_ES`, `DB_POOL` (5). All in render.yaml; none costs money while empty.

## New routes

`GET/POST /clients/{id}/profile`, `POST /clients/{id}/owner-link[?rotate=true]`, `GET /o/{token}`,
`POST /o/{token}/settings`, `POST /o/{token}/calls/{id}/done`, `POST /clients/{id}/calendar/connect`,
`GET /calendar/google/callback`, `DELETE /clients/{id}/calendar`, `POST /demo/receptionist`, `GET /demo/calls`.
`/frontdesk/run` now also sends queued emails, syncs calendars and checks Vapi. `/health` shows every new switch.
