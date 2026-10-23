# Design loop: Jarvis improves himself and the factory

Run this when a job says "design pass per hud/DESIGN_LOOP.md" (the IMPROVE button inside the factory queues it).
Modeled on Starnet's perfectionist loop: look, pick the few things that matter most, fix them, prove it, ship it.

## 1. Look (evidence first)
- Build the page: `python3 hud/build_brain.py`.
- Screenshot at phone size (390x844, 2x) with Playwright (`/opt/pw-browsers/chromium`):
  1. Jarvis home (arc look), 2. Show off flight parked at the factory gate, 3. the factory overlay (FACTORY button),
  4. the factory zoomed in on a busy station, 5. a note card. Stitch them into one image before viewing (saves tokens).
- Note the frame time (`frameMs`) and any page errors.

## 2. Critique (one line each, max 8)
Judge like a senior game artist and a phone UX designer. Check, in order:
- Breaks: errors, overlap, text cut off, horizontal scroll, buttons under 40px tall.
- Readability on a phone: can TJ tell what each station does in 5 seconds?
- Life: does something move everywhere you look? Do the workers look like they're working?
- Detail and depth: lighting, shadows, layers, alien-tech feel. No flat empty areas.
- Truth: every number on screen is real or clearly marked as show.

## 3. Fix the top 3
- Pick the 3 changes with the biggest visible win for the least code. Usually one for Jarvis, one for the factory, one either.
- Edit `hud/factory.js` (the factory, shared with the Station page) and/or the Jarvis page in `hud/src/` (see hud/README.md for which file holds what).
- Keep the style: our own pixel art drawn in code, no outside images, no Starnet name, logo or sprites.
- Never touch sign-in, keys, payments, sending, or the job/lesson stores.

## 4. Prove
- `node hud/test/memory.test.mjs` and `node hud/test/assistant.test.mjs` pass.
- New screenshots of the same 5 views: no errors, `scrollWidth` 390, before vs after is clearly better.
- Frame time is no worse than before (Show off drops to low power on slow phones; keep it that way).

## 5. Ship
- Branch, commit, PR, merge (Jarvis repo: push freely).
- Republish Jarvis: `python3 hud/build_brain.py --artifact <scratch>/jarvis.html`, same link, `vendor/jarvis-voice.js` as a supporting file.
- If factory.js changed, refresh the Jarvis Station page too (same link; factory.js is inlined there).
- Write one line in this week's note and answer the job: the 3 changes in plain words, plus the next 3 you'd do.

## Limits
- One pass per job, 3 fixes max. Skip the pass if weekly usage is over 90%; say so instead.
- Log each pass under "Design passes" in [[Jarvis]] style: date, what changed, what's next.
