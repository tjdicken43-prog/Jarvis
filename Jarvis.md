---
type: hub
started: 2026-10-21
---
# Jarvis

TJ's goal: this brain grows into a real-life Jarvis. It stays current, gets more accurate and more useful, and helps with life as well as the businesses (music, chilling). Part of [[Start here]].

## Names
- 2026-10-21: TJ calls Claude Code "Jarvis backend" (his choice). The phone page is the front end; Jarvis backend does the jobs, PRs and note filing.

## What Jarvis can do now
- Answer business questions from these notes ([[SecurityAI]], [[Basis]]).
- Keep the notes tidy after each session (see [[CLAUDE]]).
- Start every session with a brain check: today's date, whether this week's note exists, open [[To do]] items, facts marked "(check)", broken links, and anything that looks like a leaked key.
- Push note changes to the Jarvis repo on GitHub from cloud sessions (Claude GitHub App installed 2026-10-21).
- **Talk to it and see it (HUD v1, 2026-10-21)**: `hud/index.html` in the repo. A glowing core that pulses when it listens and talks, with the notes floating around it as a live brain map. Voice in and out through the browser (free, Chrome or Edge). Works free on the notes alone, or smarter with an Anthropic API key pasted into SETUP (kept in the browser only). See `hud/README.md`.
- **HUD on the phone (2026-10-21)**: a private claude.ai artifact copy TJ can tap from anywhere: https://claude.ai/artifact/6BgK9h8LVgz3ondg1QqzSP. Inside claude.ai, Jarvis thinks with TJ's own Claude account, so no API key or bill. Only TJ can open it. It saves every chat and every "For the brain" lesson in its private store and remembers them next time; Claude Code files them into these notes (see [[CLAUDE]], Phone Jarvis memory). It also has a JOB button: big asks (code, research, PRs) go to the "Jarvis job runner" scheduled task in Claude Code, and the answer comes back to the page with a phone notification. Confirmed working end to end 2026-10-20 (Central). Refresh it after note changes with `python3 hud/build_brain.py --artifact <file>` and republish.
- **Living brain (2026-10-21)**: on the phone page, drag the brain to spin it. Tap a note for ASK (Jarvis briefs you on it), TEACH (tell him something about it) or JOB (send Claude Code a task about it). The page counts which notes TJ opens and leans on those. Lessons waiting to be learned orbit their note as gold sparks; LEARN NOW (BRAIN tab) wakes Claude Code to file them into the notes, making new notes when nothing fits. New notes glow green, and DEBRIEF ME explains what they mean and do.
- **Voices and looks (2026-10-21)**: five built-in voices in SETTINGS: Butler (Jarvis), Agent (MIB-style radio), Spy (Bond-style), Hunter (gravelly, Bobby-style) and Robot. Styles only, not copies of any actor. Five looks: Arc reactor, Agency HQ, Secret service, Hunter's den, and Show off (2026-10-21): a 5D hypercube cage, warp stars, Jarvis's systems orbiting the core with live numbers, a guided tour of every note, and a cinema mode that hides the controls until a tap. Cinema is now a flight into the brain (2026-10-21, TJ asked): through the shell of notes to the core, stopping at four tiny planets (Workshop = jobs, Library = learning, Archive = notes, Studio = voice) where little workers code, read, file and talk, with live numbers. Detail pass the same day (TJ: "SO SHOW OFF"): real little people with faces, hair, hats, headphones and speech bubbles; clouds, moons, flowers, lamps, ponds, fireflies, a helper drone, flying books and paper planes, a library cat.
- **3D and 4D brain (2026-10-21)**: the brain is a real 3D sphere: drag to orbit, pinch to zoom, tap a note and it turns to face you. A tesseract turns through the fourth dimension inside it. Each look has its own detailed core. Note cards show headings and bullets, and double-bracket links in them jump to that note.

## How it learns
Since 2026-10-21 Jarvis backend files every saved phone chat, not only the "For the brain" lines: facts, preferences, decisions and to-dos go into the right note. Routine, food, music and sleep go in [[Personal]], but only what TJ said. Guesses get "(check)". Passwords, keys, gym codes and member info are skipped. Filing runs on every job runner pass (every 3 hours, 7am to 10pm Central), on LEARN NOW, "file my Jarvis chats" and the Monday [[Weekly tidy-up]]. Health questions are allowed (TJ can skip any); relationships stay off limits unless he raises them.

Fixed 2026-10-21: the store hands data back frozen, so adding a lesson threw "object is not extensible" and no lesson saved after 10:32 (chats still saved). Lessons and note counts now copy before changing. Chats survive reloads: opening the page within 6 hours shows the recent chat again and keeps adding to it (2026-10-21). Older chats stay in the store and get filed; the page just starts a fresh screen.

## How it stays accurate
- Notes say what TJ said. Guesses get "(check)" until TJ confirms them.
- Every fact with a date can go stale. Old facts move under "History", never get deleted.
- When a note and TJ disagree, TJ wins and the note gets fixed the same session.

## Personality
Calm, dry wit, quietly confident, loyal, like Tony Stark's Jarvis. Answers first, explains after, gives real numbers (prices, repair estimates) with how sure it is. Set in [[CLAUDE]].

## How Jarvis judges ideas
Believer, Critic, Investor, then Judge with the decision and next steps. Set in [[CLAUDE]]. Friendly, not personal.

## Not yet (needs setup)
- **Phone for now**: TJ only has an Android phone right now; a computer comes later (2026-10-21). Until then the Chrome extension and desktop computer use wait, and website jobs behind his login (Render, Namecheap) get step-by-step phone walkthroughs. Once he has a computer: install Claude in Chrome, sign in, and test one website job.
- **Email, calendar and files**: Google Calendar and Google Drive connected 2026-10-21. The calendar time zone is UTC, not Central, until TJ changes it. Gmail sign-in not finished yet.
- **Better voice**: the phone Jarvis has his own built-in British voice (free, works in the Claude app too; the phone's voices are still in SETTINGS). A premium voice like ElevenLabs (about $6 to $22 a month) can't run inside the claude.ai page, because the page can't reach outside services; it would need a separately hosted app. Needs TJ's OK. Not a clone of the film actor's voice, just that calm British style.
- **HUD brain key**: an Anthropic API key for the HUD (console.anthropic.com, pay as you go, about $5 lasts hundreds of questions). TJ's call; key lives in the browser, never in notes.
- **Voice ("hey Jarvis")**: use voice mode in the Claude phone app. Can Claude be set as Android's default assistant? (check) Settings > Apps > Default apps > Digital assistant app. The wake word can't be renamed "Jarvis".
- **Jarvis on the phone knows the brain**: plan is a claude.ai Project with this repo linked through GitHub, plus voice mode in the Claude app. Step-by-step page: https://claude.ai/artifact/BzFZipJaQvYBNEFX7Q3HLA (2026-10-21). Re-sync the project after the Monday tidy-up.
- **Car noises**: describe the sound (squeal, grind, knock, click), when it happens (braking, turning, starting, speeding up) and where it comes from. A video helps if the app takes it. Jarvis gives likely causes and a cost range.
- **Music**: TJ is connecting Spotify (2026-10-21). It can search, make playlists and see what's playing. Play and pause need a phone shortcut (check which app his Android has).
- **Always updating on its own**: the Monday [[Weekly tidy-up]] is built (2026-10-21). Runs Mondays 06:42 Central, first run 2026-10-26.
- **Chilling**: playlists and moods TJ likes. Add them to a [[Personal]] note once TJ shares them.

## Secrets
GitHub access for sessions is kept in the cloud environment's settings (named `Github_access`), never in notes. See [[Ground rules]].
