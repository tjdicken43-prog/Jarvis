---
type: playbook
---
# Fixing things remotely

So nobody drives to the gym. Phone with Tailscale on, then SSH into the Pi. Part of [[SecurityAI]].

| What you're told | What to do |
|---|---|
| Check-in screen couldn't be read | Text staff: unlock the PC, leave the check-in screen open. |
| Visit Log hidden | Staff: close the member account, go back to the Visit Log. |
| Screen changed after an update | `node screen-reader.js --teach`, someone scans once. |
| Recorder got a new address | Nothing. The Pi finds it again by itself. |
| Recorder rejected the password | Get the new password, run `node setup-camera.js`. |
| Pi offline | Staff unplug and replug it. Still off: the internet changed; a cable fixes it. |
| Pi won't start | Swap in the spare card. |
| New version acting up | `node update.js --undo` puts the old one back. |
