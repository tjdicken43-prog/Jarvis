# Jarvis HUD

A talking, glowing front end for the brain. A core in the middle pulses when Jarvis listens, thinks or talks; the notes float around it as a live map of the brain, and light up when a question touches them.

## Run it
- Voice in on the phone: claude.ai never gives a page the microphone, and Android's in-app browser has no speech recognition. So the ◉ button opens the keyboard: tap the keyboard's mic, talk, and Jarvis sends it 1.8 seconds after you stop. Voice out uses Jarvis's own built-in British voice (`vendor/jarvis-voice.js`, an eSpeak engine plus a light studio filter), so it works even in the Claude app. Republish that file with the page.
- Anywhere, phone included: TJ's private link https://claude.ai/artifact/6BgK9h8LVgz3ondg1QqzSP. In there Jarvis thinks with TJ's Claude account (no key). If the mic button is blocked, tap the text box and use the keyboard's mic key.
- On a computer: open `hud/index.html` in Chrome or Edge (double-click works). Voice input needs Chrome or Edge.
- Talk: press the ◉ button (or the space bar) and speak. Or type.
- Tap a dot to read that note.

## Jobs
Tap JOB (or just ask for something big) and the page queues it. The "Jarvis job runner" scheduled task in Claude Code does it and writes the answer back to the JOBS panel. The page wakes the runner straight away; it also runs every 3 hours, 7am to 10pm Central.

## Two modes
- **Notes only (free):** no key needed. Jarvis finds the matching note and reads out the lines that fit.
- **Claude (paid, cheap):** SETUP → paste an Anthropic API key. The key stays in that browser only, never in the repo. Opus 5.5 is roughly 1 cent a question; Haiku 5.5 is a fraction of a cent.

## After the notes change
Run `python3 hud/build_brain.py` to repack them into `brain.js`.
- Brain map: drag to spin it, tap a note for ASK, TEACH or JOB. Store docs used: `memory/touches` (which notes TJ opens), `memory/seen` (notes he has been debriefed on; anything else shows as NEW). LEARN NOW wakes the job runner, which also files lessons into the notes.
- Voices and looks live in SETTINGS. The voice bundle carries British (en-rp) and American (en-us) eSpeak voices.
- Memory store: `chats/<time>` (whole chats, CHATS button reopens them), `lessons/<id>` (one record per "For the brain" line; the older `memory/lessons` list is still read), `memory/touches`, `memory/seen`, `memory/runner` (when the page last woke Jarvis backend, and the runner's `lockAt` while a run is working). Store reads come back frozen: copy before changing.
- Jobs: the page waits 25 seconds after the last JOB before waking the runner, and skips the wake if a run is already working or holds the lock; the runner keeps checking the queue until it's empty.
- Runner (scheduled task "Jarvis job runner", every 3 hours 7am to 10pm Central): it first does a cheap check and ends with "Nothing to do." when nothing is queued or unfiled, takes `memory/runner.lockAt` so only one run works at a time, and republishes the page only when a job changed it or a new note was made.
- Show off look (SETTINGS > Look): 5D penteract, warp stars, scan plane, systems orbiting the core, a guided tour, and a cinema mode after 14 seconds untouched. Cinema is a camera flight through the brain to four tiny worlds (jobs, learning, notes, voice) with animated workers and live numbers; a tap ends it. It drops its glow pass by itself on a slow phone.
