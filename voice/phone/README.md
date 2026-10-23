# Phone Jarvis (real two-way calls)

TJ calls a number and talks with Jarvis like a chat (TJ chose this 2026-10-23). Runs on Vapi: it hears him (Deepgram), thinks (Claude Haiku 5.5 with the brain notes as its prompt) and talks back (Vapi voice "Dan", British male, not an actor clone).

## Cost (checked 2026-10-23, docs.vapi.ai/pricing)
- Vapi: 5 cents a minute, plus speech, voice and model at cost. All in, about 8 to 12 cents a minute (check after the first calls).
- New accounts get $10 free credit, no card. That is roughly 80 to 120 minutes of calls.
- One free Vapi number (US area code), inbound only. Calls are capped at 20 minutes.

## Set up (TJ, on the phone, about 10 minutes)
1. Sign up at dashboard.vapi.ai (Google sign-in works). No card needed.
2. Assistants > Create assistant > Blank. Name it Jarvis.
   - Model: Anthropic, Claude Haiku 5.5. First message: "Jarvis here, boss. What do you need?"
   - System prompt: paste all of `jarvis-phone-prompt.txt`.
   - Voice: Vapi, Dan. Transcriber: Deepgram, Nova 3, English.
   - Max call length: 1200 seconds. Publish.
3. Phone Numbers > Create > Free Vapi number, area code 479. Set its inbound assistant to Jarvis.
4. Save the number in contacts as "Jarvis". Call it.

Easier option: add the Vapi private key to the cloud environment as `VAPI_API_KEY` (Project settings > Environment). Then Jarvis backend runs `python3 voice/phone/create_assistant.py` for step 2 and keeps the prompt fresh when the notes change. Never put the key in a note.

## Who can use it
Personal.md is left out of the phone prompt. Set `JARVIS_PHONE_PASSPHRASE` next to `VAPI_API_KEY` (never in a note) and the prompt asks for it before sharing any notes. Later: reject calls not from TJ's cell in Vapi itself (caller ID can be faked, so keep the passphrase too).

## Keep it fresh
After note changes: `python3 voice/phone/build_phone_prompt.py`, then paste the new prompt (or run `create_assistant.py` with `VAPI_ASSISTANT_ID` set to update it).

## What calls can and can't do yet
- Can: talk, answer from the notes, think through ideas, plan.
- Can't yet: do work on its own. Asks are said back as "Job for the backend: ..." so they show in the call record. Jarvis backend can only pick them up once `VAPI_API_KEY` is in the environment (next step).
- Later: Jarvis calling TJ needs an outbound number (a Bird number over SIP, or a Vapi number at $2 a month). The 12 alert clips in `voice/calls` stay for quick alerts.
