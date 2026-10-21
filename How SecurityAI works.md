---
type: system
---
# How SecurityAI works

Part of [[SecurityAI]].

## At the gym
1. **Camera.** The gym's own entrance camera, read from its recorder (NVR). Nothing new on the wall.
2. **Raspberry Pi.** Sits by the recorder. Watches for movement at the door during watched hours (default 9 PM to 5 AM) and counts people in each entry.
3. **Front-desk reader.** A splitter copies the check-in PC's screen to the Pi through a USB capture stick, so the Pi sees each scan without installing anything on the gym's computers. See [[Front-desk reader]].

## On the website
4. Each entry is matched with the scans at the desk. Two people on one scan is flagged.
5. The gym page shows last night with problems first; alerts go out by email or phone notification; a morning report sums up the night.
6. Staff answer each flag: Tailgate, Shared code, or It was fine. Answers feed the monthly report.

## Privacy, in one line
No video stored. Photos deleted after 48 hours; confirmed tailgates kept 35 days. Member numbers are scrambled on the Pi and never sent as text. No facial recognition.

## When something breaks
The Pi fixes most things by itself; the rest is in [[Fixing things remotely]].
