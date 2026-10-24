# Jarvis HUD

A talking front end for the brain. Home is the Workshop (round 6, `src/workshop.js`): a 3D hologram of the notes over a lit projector, built in three.js. The core follows Jarvis's voice state, the notes light up when a question touches them, and the full-screen button turns the whole screen into the hologram.

## Run it
- Voice in on the phone: claude.ai never gives a page the microphone, and Android's in-app browser has no speech recognition. So the ◉ button opens the keyboard: tap the keyboard's mic, talk, and Jarvis sends it 1.8 seconds after you stop. Voice out uses Jarvis's own built-in British voice (`vendor/jarvis-voice.js`, an eSpeak engine plus a light studio filter), so it works even in the Claude app. Republish that file with the page.
- Anywhere, phone included: TJ's private link https://claude.ai/artifact/6BgK9h8LVgz3ondg1QqzSP. In there Jarvis thinks with TJ's Claude account (no key). If the mic button is blocked, tap the text box and use the keyboard's mic key.
- On a computer: serve the folder (`python3 -m http.server -d hud`) and open http://localhost:8000 in Chrome or Edge; the 3D hologram is an ES module, which a double-clicked file can't load. The private link above needs nothing. Voice input needs Chrome or Edge.
- Talk: press the ◉ button (or the space bar) and speak. Or type: / or Ctrl+K jumps to Ask, F toggles full screen.
- Tap a dot to read that note.

## Jobs
Tap JOB (or just ask for something big) and the page queues it. The "Jarvis job runner" scheduled task in Claude Code does it and writes the answer back to the JOBS panel. The page wakes the runner straight away; it also runs every 3 hours, 6:15am to 9:15pm Central.

## Two modes
- **Notes only (free):** no key needed. Jarvis finds the matching note and reads out the lines that fit.
- **Claude (paid, cheap):** SETUP → paste an Anthropic API key. The key stays in that browser only, never in the repo. Opus 5.5 is roughly 1 cent a question; Haiku 5.5 is a fraction of a cent.

## Where the code lives
`hud/index.html` is only the page's markup. Open just the file a change touches:
- `DESIGN.md` the design rules (colors, type, shapes, sources); read it before any visual change
- `src/style.css` the look; `src/core.js` start-up, clock, brain panel, tabs
- `src/scene.js` the 3D brain, camera, 4D layer, cores; `src/showoff.js` Show off and its flight; `src/frame.js` drawing each frame, note reader
- `src/voice.js` comms log, sounds, voice out and in; `src/memory.js` notes search, saved chats and lessons, NEW notes
- `src/jobs.js` jobs, morning brief, reminders, memory panel, factory, past chats; `src/think.js` thinking, settings, night mode, start-up line

The pieces share one global scope, in that order. `build_brain.py --artifact` joins them back into one style and one script.

## After the notes change
Run `python3 hud/build_brain.py` to repack them into `brain.js`.
- Brain map: drag to spin it, tap a note for ASK, TEACH or JOB. Store docs used: `memory/touches` (which notes TJ opens), `memory/seen` (notes he has been debriefed on; anything else shows as NEW). LEARN NOW wakes the job runner, which also files lessons into the notes.
- Voices and looks live in SETTINGS. The voice bundle carries British (en-rp) and American (en-us) eSpeak voices.
- Memory store: `chats/<time>` (whole chats, CHATS button reopens them), `lessons/<id>` (one record per "For the brain" line; the older `memory/lessons` list is still read), `memory/touches`, `memory/seen`, `memory/runner` (when the page last woke Jarvis backend, and the runner's `lockAt` while a run is working). Store reads come back frozen: copy before changing.
- Jobs: the page waits 25 seconds after the last JOB before waking the runner, and skips the wake if a run is already working or holds the lock; the runner keeps checking the queue until it's empty.
- Runner (scheduled task "Jarvis job runner", every 3 hours 6:15am to 9:15pm Central): it first does a cheap check and ends with "Nothing to do." when nothing is queued or unfiled, takes `memory/runner.lockAt` so only one run works at a time, and republishes the page only when a job changed it or a new note was made.
- Morning brief: the 6:15am runner pass writes `briefs/<YYYY-MM-DD>` ({say, lines[], made}); the page shows it once per day when opened. BRIEF ME shows it, or builds one live from today's Google Calendar (`list_events`) when there's none.
- Reminders: when Jarvis's reply has `REMIND: YYYY-MM-DDTHH:MM | text` (Central), the page calls Google Calendar `create_event` (15 minutes, pop-up at 0 minutes, time zone America/Chicago). If that fails it queues a job instead.
- MEMORY: lists Personal note bullets and the last 25 lessons. WRONG saves a lesson with `correction: true` and the item's note; the runner fixes the note.
- Capabilities: db (owner only), sample, mcp: Claude Code Remote `fire_trigger`, Google Calendar `list_events` and `create_event`. Budget sheet (wallet icon): numbers from money/budget, packed into brain.js by build_brain.py, so refresh the page after the ledger changes. Approve/Decline asks live in the page store as spend/<id>. Checks: `node hud/test/budget.test.mjs`, `node hud/test/memory.test.mjs` and `node hud/test/assistant.test.mjs`.
- Show off look (SETTINGS > Look): 5D penteract, warp stars, scan plane, systems orbiting the core, a guided tour, and a cinema mode after 14 seconds untouched. Cinema is a camera flight through the brain to four tiny worlds (jobs, learning, notes, voice) with animated workers and live numbers; a tap ends it. SETTINGS > SHOW ME OFF runs it at once with spoken narration; NIGHT MODE pauses drawing and plays Web Audio noise (rain, waves, brown) with a fade-out timer. It drops its glow pass by itself on a slow phone.
