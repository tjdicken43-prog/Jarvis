---
type: playbook
started: 2026-10-21
---
# Weekly tidy-up

Every Monday Claude tidies the brain so it never drifts. Part of [[Jarvis]]. Rules come from [[CLAUDE]].

## What it does
1. Runs `.claude/weekly-tidy.sh`. It starts this week's note from [[Weekly note template]], carries over last week's "Next" and the open "Now" items in [[To do]], and lists what needs a look.
2. Ticked items in [[To do]] move to the week's Done.
3. Facts marked "(check)" and dated facts older than 30 days get listed for TJ in the week's "Next". Claude never guesses an answer; old facts move under "History", nothing gets deleted.
4. Fixes broken links. If something looks like a leaked key, it stops and tells TJ, and writes nothing about it.
5. Commits and pushes to a Claude branch on the Jarvis repo. Never touches Gym-security.

## Schedule
Not running yet: waiting for TJ to pick the time and time zone (check). Proposed: Mondays 07:00 TJ's time, as a Claude Code scheduled task on this repo.

## Prompt for the scheduled task
> Run the weekly tidy-up from "Weekly tidy-up.md": run .claude/weekly-tidy.sh, then do steps 2 to 4 by hand following CLAUDE.md. Add a line to this week's note saying the tidy-up ran. Commit and push to a claude/ branch on the Jarvis repo only. End with a three-line summary for TJ: what changed, what needs his answer, anything risky.
