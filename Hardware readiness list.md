---
type: list
started: 2026-10-21
---
# Hardware readiness list

What [[SecurityAI]] needs before the first nights at [[J Street Gym]]. Since 2026-10-24 the kit is the used N100 mini PC from the Gym-security repo's shopping guide (about $130 for the PC; full kit sold to the gym at cost, about $275, first month free). The old Raspberry Pi list is under History. See [[Install a new gym]] and [[Front-desk reader]].

## Now
- The parts list and prices live in the Gym-security shopping guide (Gym-security PRs #6 and #7). Walk-test the first unit before a gym gets one.
- TJ has a computer since 2026-10-23, so the laptop step is covered.
- Render disk so data survives deploys: in place. Render shows a 1 GB disk at /var/data on the paid plan (checked 2026-10-24).

Nothing gets bought without TJ's OK (Approve button for anything over $25).

## History
Raspberry Pi plan from 2026-10-21, replaced by the mini PC. Prices were estimates from memory and were never checked.
### Per gym (about $150 to $190 without the UPS)
- Raspberry Pi 5, 2GB is plenty: about $50 to $60
- Official 27W USB-C power supply: about $12
- Case: about $10
- Two high-endurance 32GB microSD cards (one in the Pi, one spare): about $10 to $15 each
- USB microSD card reader: about $8
- Powered HDMI splitter, 1 in 2 out: about $15 to $25
- USB HDMI capture stick, 1080p: about $12 to $20
- Two short HDMI cables (plus a DisplayPort to HDMI adapter if the desk PC uses DisplayPort): about $10 to $15
- Network cable to the gym's router (better than Wi-Fi): about $8
- Power strip: about $10
- Optional: mini UPS if the gym loses power often: about $40 to $60

### For TJ
- A laptop: needed to write the memory card and type the setup commands, and later for Claude in Chrome. A basic or used one, about $250 to $450. Could an Android phone with a USB card reader write the card instead? Unconfirmed.

### Online, not hardware
- Render disk so data survives deploys: needs a paid Render plan (render.yaml says the free tier can't mount a disk). Starter is roughly $7 a month. Without it the admin page Storage line warns that each deploy wipes data.

