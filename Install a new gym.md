---
type: playbook
---
# Install a new gym

Part of [[SecurityAI]]. Full steps are in PI-SETUP.md in the code.

1. Gym checks itself first: the "Will it work at your gym?" page.
2. Bring: Pi, two high-endurance memory cards, USB card reader, HDMI splitter, USB capture stick, network cable.
3. Plug in the Pi by the recorder; it pairs and finds the camera.
4. Front desk: splitter into the check-in PC; teach the reader if it isn't Ashbourne. See [[Front-desk reader]].
5. Turn on Tailscale and turn off its key expiry (it otherwise stops after 6 months).
6. Add a backup Wi-Fi if there's no cable.
7. Make the spare card (`bash make-spare-card.sh`) and leave it labelled at the gym.
8. Copy [[New gym template]] into a new note for the gym.
