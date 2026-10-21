# Jarvis HUD

A talking, glowing front end for the brain. A core in the middle pulses when Jarvis listens, thinks or talks; the notes float around it as a live map of the brain, and light up when a question touches them.

## Run it
- On a computer: open `hud/index.html` in Chrome or Edge (double-click works). Voice input needs Chrome or Edge.
- Talk: press the ◉ button (or the space bar) and speak. Or type.
- Tap a dot to read that note.

## Two modes
- **Notes only (free):** no key needed. Jarvis finds the matching note and reads out the lines that fit.
- **Claude (paid, cheap):** SETUP → paste an Anthropic API key. The key stays in that browser only, never in the repo. Opus 5.5 is roughly 1 cent a question; Haiku 5.5 is a fraction of a cent.

## After the notes change
Run `python3 hud/build_brain.py` to repack them into `brain.js`.
