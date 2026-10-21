---
type: hub
started: 2026-10-21
---
# Jarvis

TJ's goal: this brain grows into a real-life Jarvis. It stays current, gets more accurate and more useful, and helps with life as well as the businesses (music, chilling). Part of [[Start here]].

## What Jarvis can do now
- Answer business questions from these notes ([[SecurityAI]], [[Basis]]).
- Keep the notes tidy after each session (see [[CLAUDE]]).
- Start every session with a brain check: today's date, whether this week's note exists, open [[To do]] items, facts marked "(check)", broken links, and anything that looks like a leaked key.
- Push note changes to the Jarvis repo on GitHub from cloud sessions (Claude GitHub App installed 2026-10-21).
- **Talk to it and see it (HUD v1, 2026-10-21)**: `hud/index.html` in the repo. A glowing core that pulses when it listens and talks, with the notes floating around it as a live brain map. Voice in and out through the browser (free, Chrome or Edge). Works free on the notes alone, or smarter with an Anthropic API key pasted into SETUP (kept in the browser only). See `hud/README.md`.
- **HUD on the phone (2026-10-21)**: a private claude.ai artifact copy TJ can tap from anywhere: https://claude.ai/artifact/6BgK9h8LVgz3ondg1QqzSP. Inside claude.ai, Jarvis thinks with TJ's own Claude account, so no API key or bill. Only TJ can open it. Refresh it after note changes with `python3 hud/build_brain.py --artifact <file>` and republish.

## How it stays accurate
- Notes say what TJ said. Guesses get "(check)" until TJ confirms them.
- Every fact with a date can go stale. Old facts move under "History", never get deleted.
- When a note and TJ disagree, TJ wins and the note gets fixed the same session.

## Personality
Calm, dry wit, quietly confident, loyal, like Tony Stark's Jarvis. Answers first, explains after, gives real numbers (prices, repair estimates) with how sure it is. Set in [[CLAUDE]].

## How Jarvis judges ideas
Believer, Critic, Investor, then Judge with the decision and next steps. Set in [[CLAUDE]]. Friendly, not personal.

## Not yet (needs setup)
- **Better voice**: the browser voice is free but robotic. ElevenLabs or OpenAI voices sound like the movie, about $5 to $22 a month. Needs TJ's OK before signing up.
- **HUD brain key**: an Anthropic API key for the HUD (console.anthropic.com, pay as you go, about $5 lasts hundreds of questions). TJ's call; key lives in the browser, never in notes.
- **Voice ("hey Jarvis")**: use voice mode in the Claude phone app. Can Claude be set as Android's default assistant? (check) Settings > Apps > Default apps > Digital assistant app. The wake word can't be renamed "Jarvis".
- **Jarvis on the phone knows the brain**: a claude.ai Project with these notes, or the GitHub connector pointed at this repo. (check) which TJ wants.
- **Car noises**: describe the sound (squeal, grind, knock, click), when it happens (braking, turning, starting, speeding up) and where it comes from. A video helps if the app takes it. Jarvis gives likely causes and a cost range.
- **Music**: a cloud session can't reach TJ's speakers or phone. Ways to get there: a Spotify connector on claude.ai (none connected yet), computer use in the Claude desktop app, or a phone shortcut. (check) which one TJ wants.
- **Always updating on its own**: a scheduled weekly tidy-up (start the new week note, roll done items over, flag stale facts). Not set up yet.
- **Chilling**: playlists and moods TJ likes. Add them to a [[Personal]] note once TJ shares them.

## Secrets
GitHub access for sessions is kept in the cloud environment's settings (named `Github_access`), never in notes. See [[Ground rules]].
