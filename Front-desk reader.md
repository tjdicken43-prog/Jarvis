---
type: system
---
# Front-desk reader

How the Pi sees check-ins. Part of [[How SecurityAI works]].

- Reads the check-in screen through an HDMI splitter and a USB capture stick. Screen pictures are never saved or sent.
- On Ashbourne it reads two things: the Live Entry pop-up and the Visit Log. A scan both show is "confirmed". See [[Check-in systems]].
- Other systems are taught once with one test scan (`node screen-reader.js --teach` on the Pi).
- A locked PC, a closed program or an account left open never turns into "no scan": those times are checked by the camera only, and the morning report lists them.
- Turned-down scans (expired, denied) don't count as scans.

## Tested (2026-10-19)
Ashbourne old look and updated look: normal, pop-up closing, account left open, PC locked, denied scan. All other system types: scan logs, plain lists, name-only, welcome cards, pop-up plus list, dark screens, codes with letters, profile left open. Each also "updated overnight" without re-teaching.
