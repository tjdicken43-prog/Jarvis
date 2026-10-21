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
