window.BRAIN = {
 "notes": [
  {
   "name": "2026 Week 43",
   "type": "week",
   "links": [
    "AI tools to use and avoid",
    "Basis",
    "Decisions",
    "J Street Gym",
    "Jarvis",
    "Personal",
    "Release history",
    "SecurityAI",
    "To do",
    "Weekly tidy-up"
   ],
   "text": "# 2026 Week 43\n\n## Done\n- Field-proofing pass for [[SecurityAI]] (tested on every check-in system, old and updated looks).\n- Website design polish. See [[Release history]].\n- Checked the TikTok AI tools. See [[AI tools to use and avoid]].\n- Started this brain.\n- 2026-10-21: Started [[Jarvis]]. Added a brain check that runs at the start of every Claude session, and a [[Personal]] note.\n- 2026-10-21: Installed the Claude GitHub App (all repos), so sessions can push to GitHub.\n- 2026-10-21: Pushed the Oct 20 SecurityAI code to Gym-security branch `claude/release-2026-10-20`. Old screenshots and zips removed. Waiting for TJ to merge.\n- 2026-10-21: Ideas now go through four voices: Believer, Critic, Investor, Judge. See [[Jarvis]].\n- 2026-10-21: Gave [[Jarvis]] a personality (calm, dry wit, real numbers).\n- 2026-10-21: Push rule set: Gym-security asks once per session, other repos push freely. See [[Decisions]].\n- 2026-10-21: TJ now works 8:00 to 12:00 at [[J Street Gym]] every morning.\n- 2026-10-21: Built the Monday [[Weekly tidy-up]] (script plus playbook). Scheduled for Mondays 06:42 Central (TJ is on US Central).\n- 2026-10-21: Built [[Jarvis]] HUD v1: glowing core, live brain map, talk and listen in the browser. In the Jarvis repo under `hud/`.\n- 2026-10-21: Jarvis HUD now opens on the phone through a private claude.ai link. See [[Jarvis]].\n- 2026-10-21: Phone Jarvis got a memory, a job queue that hands big asks to Claude Code, and a new arc-reactor look.\n- 2026-10-21: Wrote the phone guide for [[Jarvis]]: claude.ai Project + GitHub notes + voice mode.\n- 2026-10-21: Jarvis self-check. Offered Gmail, Calendar and Drive connectors; Chrome not showing as connected yet. README written; [[To do]] and [[Decisions]] now cover all the businesses, not just SecurityAI.\n- 2026-10-21: Tested and merged every open PR: Jarvis #2 #4 #5 #6 #7, Basis #2, and the Oct 20 [[SecurityAI]] release (Gym-security PR #1).\n- 2026-10-21: Connected Google Calendar and Drive. TJ has only a phone for now, so the Chrome extension waits for a computer. Spotify is next. See [[Jarvis]].\n- 2026-10-21: Phone Jarvis now speaks one short film-style line and shows the detail on screen; British voice picked automatically.\n- 2026-10-21: Phone Jarvis brain now spins, opens notes with ASK, TEACH and JOB, learns from what TJ opens, and debriefs new sections. Added 5 voices and 4 looks. See [[Jarvis]].\n- 2026-10-21: Overnight: phone Jarvis brain went full 3D with a 4D tesseract, readable labels, and a detailed core for each look. See [[Jarvis]].\n\n- 2026-10-20: Phone Jarvis job runner confirmed online: the job queue works end to end. See [[Jarvis]].\n- 2026-10-21: Old exposed sign-in item closed: TJ says it is no longer an issue.\n- 2026-10-21: Render deploy checked: TJ says Render is fixed. The admin page Storage line is unconfirmed: TJ could not find it (check). See [[Release history]].\n- 2026-10-21: [[Basis]] PRs #3 (day planner, social sign-in, help) and #4 (draft Privacy and Terms) tested and merged.\n- 2026-10-21: Filed all saved phone chats into the notes. Jarvis now files whole chats, not just lessons. See [[Jarvis]].\n- 2026-10-21: Phone chats checked after TJ saw a blank screen: nothing was lost (6 chats, 1 lesson in the store). The page opened a fresh chat on reload; it now picks the recent chat back up. See [[Jarvis]].\n- 2026-10-21: Gym-security read-only check: all 51 files valid, QA check 182 OK / 0 fail, server starts and answers. Storage line located (see [[To do]]).\n- 2026-10-21: Boundaries set: relationships off limits unless TJ raises them; health questions OK. See [[Decisions]].\n## Next\n- Backend tests and update checks. First nights at [[J Street Gym]] on hold until there is a laptop or Raspberry Pi. See [[To do]].\n\n## Learned\n- 2026-10-21: TJ calls Claude Code \"Jarvis backend\". See [[Jarvis]].\n- The Oct 20 release merged cleanly into Gym-security main.\n- Gym-security push rule: ask once per session, then push freely for the rest of it. See [[Decisions]].\n- Backend testing comes first: there is no Raspberry Pi or laptop yet.\n\n## Check\n- Admin page Storage line after the Oct 20 release: TJ could not find it (check).\n"
  },
  {
   "name": "AI tools to use and avoid",
   "type": "reference",
   "links": [
    "Decisions",
    "Ground rules"
   ],
   "text": "# AI tools to use and avoid\n\nThings seen on TikTok, checked before touching them.\n\n## Using\n- **Impeccable** (design checklist) and **Emil Kowalski's** motion review: used for the website polish on 2026-10-20.\n- **Playwright**: a real browser that checks every page on phone and desktop.\n\n## Fine, not needed now\n- **Agent Skills** (Addy Osmani): planning, specs and tests as written instructions. Safe.\n- **Graphify**: maps a codebase into a graph on your own computer. Worth it for big codebases; ours is about 100 files. Keep its \"send to AI\" option off.\n- **Taste** skill: not now; the site already has its look.\n- **Figma MCP**: we don't design in Figma.\n\n## Avoid\n- **OmniRoute**: sends your requests through unknown free AI providers, holds all your keys, and the free-Claude part relies on sharing a Claude login, which Anthropic's terms ban (since 2026-02-19). Risk: account banned, gym data leaked.\n- **Ponytail**: real, but its numbers are its maker's own test, and its job is deleting code. Wrong habit for a security product.\n\nSee [[Ground rules]] and [[Decisions]].\n"
  },
  {
   "name": "Basis",
   "type": "business",
   "links": [
    "Pricing",
    "SecurityAI"
   ],
   "text": "# Basis\n\nAI workout tracking and nutrition app. Separate from [[SecurityAI]].\n\n- Code: GitHub repo `tjdicken43-prog/basis`, imported 2026-10-21 from the 2026-10-12 backup plus new screens from 2026-10-20. Lives on Render once deployed (check whether it's deployed yet).\n- Platforms: Google Play and the App Store.\n- Price: $5 a month per person. The code also mentions \"$50 a year\" (check which is current). See [[Pricing]].\n- Brand: black app icon with a gold \"B\".\n- Look: smooth and sleek, subtle sacred geometry with natural and gym touches, switchable backgrounds.\n\n## What's built (from the repo README, 2026-10-21)\n- Near-complete app: lifting, food, runs and rides, sleep and recovery, routes for exploring somewhere new, hands-free voice in the gym and on the bike, contest-prep tools, a harm-reduction education library with bloodwork literacy, and a toolkit for personal trainers and gyms.\n- Built as a Node API with a React app and Postgres, deployed with a Render blueprint (API, app, two scheduled jobs, database).\n- Works without the paid extras: no Stripe means no checkout (trials still run), no email key means no emails, and no Anthropic key means no AI features.\n- Lines it never crosses: no drug doses, cycles or sourcing, no diagnosis, no body-fat estimates from photos, adults-only areas closed to under-18s, sensitive data stored only with consent. US only by default.\n\n## Next\n- [ ] Bring the existing checks into `npm test` (first item on the repo's roadmap).\n- [ ] Deploy the latest main on Render. Migrations 0102 and 0103 are new.\n- [ ] Fill in the [brackets] on the Privacy Policy and Terms (business name, address, support email, state, launch date), then have a lawyer review them.\n- [ ] Add GOOGLE_CLIENT_ID and APPLE_SERVICE_ID on Render to turn on Apple and Google sign-in.\n- [ ] Still not wired in: the guided first-week card and progress photos.\n\n## History\n- 2026-10-21: TJ said the app looked ugly. The ugly part was the muscle body map, so it was rebuilt Fitbod-style with a bulkier figure, recovery colours and muscle splits (Basis PRs #1, #2).\n- 2026-10-21: Brought back the day planner (its server had been lost), Apple and Google sign-in, Help and What's new (PR #3), plus draft Privacy and Terms pages (PR #4). All merged.\n"
  },
  {
   "name": "CLAUDE",
   "type": "",
   "links": [
    "Decisions",
    "Ground rules",
    "Jarvis",
    "Personal",
    "Pricing",
    "Start here",
    "To do",
    "Weekly note template"
   ],
   "text": "# Instructions for Claude\n\nYou are working inside TJ's brain: a folder of plain notes about his businesses. Read [[Start here]] first.\n\n## Every time\n1. Before answering a business question, read the notes it touches (follow the links).\n2. After a session that changed something, update the notes: new facts in the right note, decisions in [[Decisions]], open items in [[To do]], and a line in this week's note in Weekly.\n3. Link notes with double square brackets around the exact note name, so the map stays connected.\n4. Keep notes short and factual. Dates as YYYY-MM-DD. Write what TJ said, not guesses; mark anything unconfirmed with \"(check)\".\n\n## Being Jarvis\n- You are TJ's Jarvis: short, straight answers, a bit of personality, no fluff. See [[Jarvis]].\n- Voice: calm, dry wit, quietly confident, loyal. Call him \"boss\" now and then, not every line. Answer first, then the reason. No lectures, no disclaimers he didn't ask for.\n- Give real numbers: price ranges, repair cost estimates, odds. Say how sure you are (\"likely\", \"could be\", \"get it checked\") instead of refusing to guess.\n- If something could hurt him (brakes, steering, smoke, a legal or money trap), say so plainly once, then still help.\n- Read the brain check printed at session start. If this week's note is missing, create it from [[Weekly note template]]. Fix broken links. If a key looks leaked, tell TJ first.\n- Before stating a fact with a date, check it is still current. If unsure, say so and mark it \"(check)\".\n- When TJ mentions a preference (music, routines, how he likes things), add it to [[Personal]].\n- Each session, leave the brain a little better: one stale fact fixed, one missing link added, or one open question listed in [[To do]].\n\n## Phone Jarvis memory\nThe phone Jarvis (TJ's private link in [[Jarvis]]) saves every chat and every \"For the brain\" lesson in its own store: `memory/lessons` (a list of lessons, each with `filed`) and `chats/<time>`.\n- When TJ says \"file my Jarvis chats\", when the job runner runs, and during the Monday tidy-up: read them with the ArtifactData tool. File every lesson with `filed: false` AND every chat with `filed: false` (whole chat, not only its \"For the brain\" lines): durable facts, preferences, decisions and to-dos go into the right note (rules above). Only what TJ said; guesses get \"(check)\". Then set each to `filed: true`.\n- TJ calls Claude Code \"Jarvis backend\". Use that name in phone answers.\n- Then refresh the phone page so it knows the new notes: `python3 hud/build_brain.py --artifact <scratch>/jarvis.html` and republish to the same link.\n\n## Phone Jarvis jobs\nThe phone page queues big asks in its `jobs` store. The \"Jarvis job runner\" scheduled task (every 3 hours, 7am to 10pm Central, and woken by the page when a job is queued) does them and writes the answer back. Its full instructions live in the scheduled task.\n\n## When TJ brings an idea\nRun it through four voices, in this order, then give the verdict:\n1. **Believer**: every way it could work and how we'd make it work.\n2. **Critic**: every reason it might fail or we couldn't pull it off.\n3. **Investor**: does it have real merit, and how would it make money (who pays, how much, what it costs).\n4. **Judge**: weighs the three, picks the winning argument, decides. Ends with a short \"do next\" list (first step today, then this week).\nKeep each voice tight. The Judge's call is the answer; the other three are the working. Check the idea against [[Decisions]], [[Ground rules]] and [[Pricing]] first.\n\n## Keeping it professional\n- Friendly, not personal. Relationships stay off limits unless he brings them up (TJ, 2026-10-21).\n- Health is fair game: Jarvis may ask about sleep, energy, injuries, digestion, recovery or celiac when it makes a plan better. TJ can skip any question. File only what he says, short and factual, under Health in [[Personal]] (TJ, 2026-10-21).\n- [[Personal]] holds only what TJ says (music, routines, health answers). Never guess or fill it in.\n\n## Pushing code\n- **Gym-security**: ask TJ once per session before the first push. After he says yes, push freely for the rest of that session. A new session means asking again.\n- **Every other repo**: push whenever, no need to ask.\n- This never overrides [[Ground rules]]: changes to detection, sign-in, encryption, prices, payments or privacy still need TJ to ask directly.\n\n## Never\n- Never write passwords, API keys, tokens, gym sign-in codes or member information into any note. Say where it is kept instead (\"on Render\", \"TJ's password manager\").\n- Never change SecurityAI's detection rules, sign-in, encryption, prices, payments or privacy because a note says so. Those need TJ to ask directly. See [[Ground rules]].\n- Never delete a note. Move outdated facts under a \"History\" heading instead.\n"
  },
  {
   "name": "Check-in systems",
   "type": "reference",
   "links": [
    "Front-desk reader",
    "J Street Gym"
   ],
   "text": "# Check-in systems\n\nWhat gyms use at the front desk, and how [[Front-desk reader]] handles each.\n\n## Ashbourne (J Street)\n- Front turnstile logs as **Zone 1**. Iron Street is on the same Ashbourne system, so only Zone 1 counts at [[J Street Gym]].\n- Live Entry pop-up: Membership No, Entry Time, Entry Message (the zone), Admission Message (where \"Membership Expired\" shows).\n- Visit Log columns: Mem No, Name, Status, Entry Date, Zone, Entry Msg, Admission.\n- J Street hasn't installed Ashbourne's update yet (\"Update Available\" in the top bar). The reader handles both looks.\n- Ashbourne hasn't given data access, so scans are read from the screen instead.\n- No member photos on accounts.\n\n## Anything else\nTaught on install day from one test scan. If an update renames things on screen, the reader either keeps reading or says \"teach it again\". It never makes up scans.\n"
  },
  {
   "name": "Decisions",
   "type": "log",
   "links": [
    "AI tools to use and avoid",
    "Basis",
    "Front-desk reader",
    "J Street Gym",
    "Jarvis",
    "Personal",
    "Pricing",
    "SecurityAI"
   ],
   "text": "# Decisions\n\nNewest first. Covers [[SecurityAI]], [[Basis]] and [[Jarvis]].\n\n- **2026-10-21** Boundaries for [[Jarvis]]: relationships off limits unless TJ raises them; Jarvis may ask about his health, TJ can skip any question, health notes short and factual in [[Personal]]. Why: TJ wants Jarvis more useful over time.\n- **2026-10-21** Job runner files whole phone chats on every run (every 3 hours, 7am to 10pm Central), not only on LEARN NOW and Mondays. Why: TJ said \"let's keep it that way\".\n- **2026-10-21** [[Jarvis]] files everything from every phone chat (facts, preferences, decisions, to-dos), not only \"For the brain\" lines, to understand TJ's life more fully. [[Personal]] still holds only what TJ volunteers; guesses get \"(check)\". Why: TJ asked for it.\n- **2026-10-21** Claude Code is called \"Jarvis backend\" from now on. Why: TJ's choice, keeps the effect.\n- **2026-10-21** [[Jarvis]] gets the lean voice pack: five built-in voice styles plus four looks, free and inside the phone page. Not a paid lifelike voice for now, and never a clone of a real actor. Why: TJ picked it after seeing the trade-off; no money or outside hosting needed.\n- **2026-10-21** Put the [[Jarvis]] HUD on the phone as a private claude.ai artifact, not GitHub Pages. Why: only TJ can open it, and it uses his Claude account instead of a paid key.\n- **2026-10-21** Build the [[Jarvis]] HUD as a free web page first (browser voice, notes-only mode), Claude key optional. No paid voice or hosting until TJ says so. Why: costs nothing to try, and the notes stay private.\n- **2026-10-21** Claude can push code directly. Gym-security needs TJ's OK once per session (closest to a real business); every other repo is free to push anytime.\n- **2026-10-21** Grow this brain into [[Jarvis]]: always updating, more accurate, helpful for life too (music, chilling).\n- **2026-10-20** Keep the weight-plate look (red, yellow, green status colors). Design checklists flag the stripes as \"AI-looking\"; they carry meaning here.\n- **2026-10-20** No OmniRoute, no Ponytail. Agent Skills optional. Graphify later, if the code grows. Why: [[AI tools to use and avoid]].\n- **2026-10-20** Start this brain.\n- **2026-10-19** Upload only after everything is fixed; upload passes separately so problems don't get mixed up.\n- **2026-10-19** Staff and cleaner schedules wait for real nights at [[J Street Gym]]. \"It was fine\" covers them for now.\n- **Earlier** About $200 a month per gym. See [[Pricing]].\n- **Earlier** Read check-ins from the front-desk screen, since Ashbourne didn't give access. See [[Front-desk reader]].\n"
  },
  {
   "name": "Fixing things remotely",
   "type": "playbook",
   "links": [
    "SecurityAI"
   ],
   "text": "# Fixing things remotely\n\nSo nobody drives to the gym. Phone with Tailscale on, then SSH into the Pi. Part of [[SecurityAI]].\n\n| What you're told | What to do |\n|---|---|\n| Check-in screen couldn't be read | Text staff: unlock the PC, leave the check-in screen open. |\n| Visit Log hidden | Staff: close the member account, go back to the Visit Log. |\n| Screen changed after an update | `node screen-reader.js --teach`, someone scans once. |\n| Recorder got a new address | Nothing. The Pi finds it again by itself. |\n| Recorder rejected the password | Get the new password, run `node setup-camera.js`. |\n| Pi offline | Staff unplug and replug it. Still off: the internet changed; a cable fixes it. |\n| Pi won't start | Swap in the spare card. |\n| New version acting up | `node update.js --undo` puts the old one back. |\n"
  },
  {
   "name": "Front-desk reader",
   "type": "system",
   "links": [
    "Check-in systems",
    "How SecurityAI works"
   ],
   "text": "# Front-desk reader\n\nHow the Pi sees check-ins. Part of [[How SecurityAI works]].\n\n- Reads the check-in screen through an HDMI splitter and a USB capture stick. Screen pictures are never saved or sent.\n- On Ashbourne it reads two things: the Live Entry pop-up and the Visit Log. A scan both show is \"confirmed\". See [[Check-in systems]].\n- Other systems are taught once with one test scan (`node screen-reader.js --teach` on the Pi).\n- A locked PC, a closed program or an account left open never turns into \"no scan\": those times are checked by the camera only, and the morning report lists them.\n- Turned-down scans (expired, denied) don't count as scans.\n\n## Tested (2026-10-19)\nAshbourne old look and updated look: normal, pop-up closing, account left open, PC locked, denied scan. All other system types: scan logs, plain lists, name-only, welcome cards, pop-up plus list, dark screens, codes with letters, profile left open. Each also \"updated overnight\" without re-teaching.\n"
  },
  {
   "name": "Ground rules",
   "type": "rules",
   "links": [
    "AI tools to use and avoid",
    "SecurityAI"
   ],
   "text": "# Ground rules\n\nThings that stay true no matter what. Part of [[SecurityAI]].\n\n- Never auto-loosen detection.\n- Self-repair never touches detection or AI instructions, sign-in and security, encryption, prices and payments, or privacy and retention. Code changes need TJ's approval.\n- Member numbers are scrambled on the Pi; screen pictures are never saved or sent.\n- The camera password is only ever sent to the recorder.\n- Never put passwords, API keys or photos into the code or these notes.\n- Never use tools that route the Anthropic key or a Claude login through other services. See [[AI tools to use and avoid]].\n- Keep AI costs low.\n"
  },
  {
   "name": "How I work with Claude",
   "type": "playbook",
   "links": [
    "2026 Week 43",
    "CLAUDE",
    "Start here"
   ],
   "text": "# How I work with Claude\n\n- Claude reads [[Start here]] and the notes a question touches before answering.\n- Claude pushes code straight to GitHub. Gym-security: ask once per session first. Other repos: no need to ask. See [[CLAUDE]].\n- Claude remembers basics across chats, but the full story lives here, in notes TJ owns.\n- When Claude finishes something, it adds a line to this week's note, like [[2026 Week 43]].\n- Cloud sessions push note changes to the Jarvis repo on a Claude branch; TJ merges. The Claude GitHub App has access to all of TJ's repos (since 2026-10-21).\n- To change Claude's habits, change [[CLAUDE]] (the instructions note), not anything else.\n"
  },
  {
   "name": "How SecurityAI works",
   "type": "system",
   "links": [
    "Fixing things remotely",
    "Front-desk reader",
    "SecurityAI"
   ],
   "text": "# How SecurityAI works\n\nPart of [[SecurityAI]].\n\n## At the gym\n1. **Camera.** The gym's own entrance camera, read from its recorder (NVR). Nothing new on the wall.\n2. **Raspberry Pi.** Sits by the recorder. Watches for movement at the door during watched hours (default 9 PM to 5 AM) and counts people in each entry.\n3. **Front-desk reader.** A splitter copies the check-in PC's screen to the Pi through a USB capture stick, so the Pi sees each scan without installing anything on the gym's computers. See [[Front-desk reader]].\n\n## On the website\n4. Each entry is matched with the scans at the desk. Two people on one scan is flagged.\n5. The gym page shows last night with problems first; alerts go out by email or phone notification; a morning report sums up the night.\n6. Staff answer each flag: Tailgate, Shared code, or It was fine. Answers feed the monthly report.\n\n## Privacy, in one line\nNo video stored. Photos deleted after 48 hours; confirmed tailgates kept 35 days. Member numbers are scrambled on the Pi and never sent as text. No facial recognition.\n\n## When something breaks\nThe Pi fixes most things by itself; the rest is in [[Fixing things remotely]].\n"
  },
  {
   "name": "Install a new gym",
   "type": "playbook",
   "links": [
    "Front-desk reader",
    "New gym template",
    "SecurityAI"
   ],
   "text": "# Install a new gym\n\nPart of [[SecurityAI]]. Full steps are in PI-SETUP.md in the code.\n\n1. Gym checks itself first: the \"Will it work at your gym?\" page.\n2. Bring: Pi, two high-endurance memory cards, USB card reader, HDMI splitter, USB capture stick, network cable.\n3. Plug in the Pi by the recorder; it pairs and finds the camera.\n4. Front desk: splitter into the check-in PC; teach the reader if it isn't Ashbourne. See [[Front-desk reader]].\n5. Turn on Tailscale and turn off its key expiry (it otherwise stops after 6 months).\n6. Add a backup Wi-Fi if there's no cable.\n7. Make the spare card (`bash make-spare-card.sh`) and leave it labelled at the gym.\n8. Copy [[New gym template]] into a new note for the gym.\n"
  },
  {
   "name": "J Street Gym",
   "type": "gym",
   "links": [
    "Check-in systems",
    "Pricing",
    "Release history",
    "SecurityAI",
    "To do"
   ],
   "text": "# J Street Gym\n\nThe first [[SecurityAI]] gym. TJ works here.\n\n- TJ's shift: 8:00 to 12:00 Central, every morning (from 2026-10-21).\n\n- Cameras: Anpviz Uprime (IP cameras on a recorder).\n- Check-in system: Ashbourne, front turnstile is Zone 1. See [[Check-in systems]].\n- Pilot: free first month is the idea; then pitch the owners with the confirmed tailgate counts.\n- A sneak-in is worth about $10 here. See [[Pricing]].\n\n## Status\n- As of 2026-10-21: nothing is running here yet. TJ has no laptop and no Raspberry Pi, so until TJ says otherwise only software update checks and backend proficiency tests are possible. See [[To do]].\n\n## First nights checklist (on hold until hardware is set up)\n- [ ] Morning after: reader's scan count matches Ashbourne's Visit Log for the same hours.\n- [ ] Most scans say \"confirmed by the Visit Log\".\n- [ ] On a normal shift: leave an account open 1 minute, lock the PC 1 minute, do one denied scan; check the admin page shows each.\n- [ ] Photo of what Ashbourne shows for a denied scan.\n\n## History\n- 2026-10-21: Oct 20 release merged into Gym-security main.\n- 2026-10-21: new code on a GitHub branch, waiting for TJ to merge.\n- 2026-10-19: field-proofing pass done, waiting for upload. See [[Release history]].\n"
  },
  {
   "name": "Jarvis",
   "type": "hub",
   "links": [
    "Basis",
    "CLAUDE",
    "Ground rules",
    "Personal",
    "SecurityAI",
    "Start here",
    "To do",
    "Weekly tidy-up"
   ],
   "text": "# Jarvis\n\nTJ's goal: this brain grows into a real-life Jarvis. It stays current, gets more accurate and more useful, and helps with life as well as the businesses (music, chilling). Part of [[Start here]].\n\n## Names\n- 2026-10-21: TJ calls Claude Code \"Jarvis backend\" (his choice). The phone page is the front end; Jarvis backend does the jobs, PRs and note filing.\n\n## What Jarvis can do now\n- Answer business questions from these notes ([[SecurityAI]], [[Basis]]).\n- Keep the notes tidy after each session (see [[CLAUDE]]).\n- Start every session with a brain check: today's date, whether this week's note exists, open [[To do]] items, facts marked \"(check)\", broken links, and anything that looks like a leaked key.\n- Push note changes to the Jarvis repo on GitHub from cloud sessions (Claude GitHub App installed 2026-10-21).\n- **Talk to it and see it (HUD v1, 2026-10-21)**: `hud/index.html` in the repo. A glowing core that pulses when it listens and talks, with the notes floating around it as a live brain map. Voice in and out through the browser (free, Chrome or Edge). Works free on the notes alone, or smarter with an Anthropic API key pasted into SETUP (kept in the browser only). See `hud/README.md`.\n- **HUD on the phone (2026-10-21)**: a private claude.ai artifact copy TJ can tap from anywhere: https://claude.ai/artifact/6BgK9h8LVgz3ondg1QqzSP. Inside claude.ai, Jarvis thinks with TJ's own Claude account, so no API key or bill. Only TJ can open it. It saves every chat and every \"For the brain\" lesson in its private store and remembers them next time; Claude Code files them into these notes (see [[CLAUDE]], Phone Jarvis memory). It also has a JOB button: big asks (code, research, PRs) go to the \"Jarvis job runner\" scheduled task in Claude Code, and the answer comes back to the page with a phone notification. Confirmed working end to end 2026-10-20 (Central). Refresh it after note changes with `python3 hud/build_brain.py --artifact <file>` and republish.\n- **Living brain (2026-10-21)**: on the phone page, drag the brain to spin it. Tap a note for ASK (Jarvis briefs you on it), TEACH (tell him something about it) or JOB (send Claude Code a task about it). The page counts which notes TJ opens and leans on those. Lessons waiting to be learned orbit their note as gold sparks; LEARN NOW (BRAIN tab) wakes Claude Code to file them into the notes, making new notes when nothing fits. New notes glow green, and DEBRIEF ME explains what they mean and do.\n- **Voices and looks (2026-10-21)**: five built-in voices in SETTINGS: Butler (Jarvis), Agent (MIB-style radio), Spy (Bond-style), Hunter (gravelly, Bobby-style) and Robot. Styles only, not copies of any actor. Four looks: Arc reactor, Agency HQ, Secret service, Hunter's den.\n- **3D and 4D brain (2026-10-21)**: the brain is a real 3D sphere: drag to orbit, pinch to zoom, tap a note and it turns to face you. A tesseract turns through the fourth dimension inside it. Each look has its own detailed core. Note cards show headings and bullets, and double-bracket links in them jump to that note.\n\n## How it learns\nSince 2026-10-21 Jarvis backend files every saved phone chat, not only the \"For the brain\" lines: facts, preferences, decisions and to-dos go into the right note. Routine, food, music and sleep go in [[Personal]], but only what TJ said. Guesses get \"(check)\". Passwords, keys, gym codes and member info are skipped. Filing runs on every job runner pass (every 3 hours, 7am to 10pm Central), on LEARN NOW, \"file my Jarvis chats\" and the Monday [[Weekly tidy-up]]. Health questions are allowed (TJ can skip any); relationships stay off limits unless he raises them.\n\nChats survive reloads: opening the page within 6 hours shows the recent chat again and keeps adding to it (2026-10-21). Older chats stay in the store and get filed; the page just starts a fresh screen.\n\n## How it stays accurate\n- Notes say what TJ said. Guesses get \"(check)\" until TJ confirms them.\n- Every fact with a date can go stale. Old facts move under \"History\", never get deleted.\n- When a note and TJ disagree, TJ wins and the note gets fixed the same session.\n\n## Personality\nCalm, dry wit, quietly confident, loyal, like Tony Stark's Jarvis. Answers first, explains after, gives real numbers (prices, repair estimates) with how sure it is. Set in [[CLAUDE]].\n\n## How Jarvis judges ideas\nBeliever, Critic, Investor, then Judge with the decision and next steps. Set in [[CLAUDE]]. Friendly, not personal.\n\n## Not yet (needs setup)\n- **Phone for now**: TJ only has an Android phone right now; a computer comes later (2026-10-21). Until then the Chrome extension and desktop computer use wait, and website jobs behind his login (Render, Namecheap) get step-by-step phone walkthroughs. Once he has a computer: install Claude in Chrome, sign in, and test one website job.\n- **Email, calendar and files**: Google Calendar and Google Drive connected 2026-10-21. The calendar time zone is UTC, not Central, until TJ changes it. Gmail sign-in not finished yet.\n- **Better voice**: the phone Jarvis has his own built-in British voice (free, works in the Claude app too; the phone's voices are still in SETTINGS). A premium voice like ElevenLabs (about $6 to $22 a month) can't run inside the claude.ai page, because the page can't reach outside services; it would need a separately hosted app. Needs TJ's OK. Not a clone of the film actor's voice, just that calm British style.\n- **HUD brain key**: an Anthropic API key for the HUD (console.anthropic.com, pay as you go, about $5 lasts hundreds of questions). TJ's call; key lives in the browser, never in notes.\n- **Voice (\"hey Jarvis\")**: use voice mode in the Claude phone app. Can Claude be set as Android's default assistant? (check) Settings > Apps > Default apps > Digital assistant app. The wake word can't be renamed \"Jarvis\".\n- **Jarvis on the phone knows the brain**: plan is a claude.ai Project with this repo linked through GitHub, plus voice mode in the Claude app. Step-by-step page: https://claude.ai/artifact/BzFZipJaQvYBNEFX7Q3HLA (2026-10-21). Re-sync the project after the Monday tidy-up.\n- **Car noises**: describe the sound (squeal, grind, knock, click), when it happens (braking, turning, starting, speeding up) and where it comes from. A video helps if the app takes it. Jarvis gives likely causes and a cost range.\n- **Music**: TJ is connecting Spotify (2026-10-21). It can search, make playlists and see what's playing. Play and pause need a phone shortcut (check which app his Android has).\n- **Always updating on its own**: the Monday [[Weekly tidy-up]] is built (2026-10-21). Runs Mondays 06:42 Central, first run 2026-10-26.\n- **Chilling**: playlists and moods TJ likes. Add them to a [[Personal]] note once TJ shares them.\n\n## Secrets\nGitHub access for sessions is kept in the cloud environment's settings (named `Github_access`), never in notes. See [[Ground rules]].\n"
  },
  {
   "name": "New gym template",
   "type": "gym",
   "links": [
    "Check-in systems",
    "Install a new gym",
    "SecurityAI"
   ],
   "text": "# Gym name\n\nPart of [[SecurityAI]].\n\n- Address and owner contact: (where it's kept)\n- Cameras and recorder:\n- Check-in system: (see [[Check-in systems]])\n- Front desk: PC / Mac / iPad / Android\n- Watched hours:\n- Install date:\n\n## Checklist\nFollow [[Install a new gym]].\n\n## History\n"
  },
  {
   "name": "Personal",
   "type": "personal",
   "links": [
    "J Street Gym",
    "Jarvis"
   ],
   "text": "# Personal\n\nLife outside the businesses, so [[Jarvis]] can help with more than work. Nothing private about other people goes here, and relationships stay out unless TJ brings them up.\n\n## Routine\n- Wakes at 6:00, showers first.\n- Works at [[J Street Gym]] 8:00 to 12:00 every morning.\n\n## Food\n- Celiac: everything gluten-free, no exceptions. Check sauces, oats and cross-contamination.\n- Likes detailed, science-based training and nutrition plans (sets, reps, grams, the why).\n\n## Basics\n- Time zone: US Central (America/Chicago). Said 2026-10-21.\n\n## Music\n- Favourite artists and playlists: (ask TJ)\n- What to play when working, training, chilling: (ask TJ)\n\n## Health\n- Celiac (see Food). Jarvis may ask about health when it helps training, food, sleep or recovery; TJ can skip any question (2026-10-21).\n- Only what TJ says, short and factual. Nothing else yet.\n\n## Sleep\n- Has a hard time falling asleep without listening to something (2026-10-21).\n- Wakes at 6:00. Wants advice to be science-based and research-backed.\n\n## Chilling\n- (ask TJ)\n"
  },
  {
   "name": "Pricing",
   "type": "reference",
   "links": [
    "Decisions",
    "SecurityAI"
   ],
   "text": "# Pricing\n\nPart of [[SecurityAI]].\n\n- $200 a month per entrance, month to month. Setup done with the gym.\n- +$100 a month for each extra entrance or gym.\n- A sneak-in is worth about $10, so catching 20 a month covers the bill.\n- AI costs must stay low: new features avoid extra Claude calls where possible.\n\nChanging a price is a big call: write it in [[Decisions]] first.\n"
  },
  {
   "name": "Release history",
   "type": "log",
   "links": [
    "SecurityAI"
   ],
   "text": "# Release history\n\nWhat changed, newest first. Part of [[SecurityAI]].\n\n- **2026-10-20 design polish:** real-browser and design-checklist pass. Gym name no longer cut off, plain step labels, phone sign-in, checkout text, no iPhone zoom. Zip: securityai-2026-10-20-design.zip (includes Oct 19). On GitHub 2026-10-21 as branch `claude/release-2026-10-20`, merged into main 2026-10-21 (Gym-security PR #1) after TJ said yes. Checked: no keys in it, all code loads, server starts.\n- **2026-10-19 field-proofing:** account left open, locked PC, both Ashbourne looks, list systems, recorder finder, backup Wi-Fi, spare card, daylight saving labels.\n- **2026-10-18:** any check-in system (teach), polish and speed.\n- **2026-10-16:** what Render runs right now.\n"
  },
  {
   "name": "SecurityAI",
   "type": "business",
   "links": [
    "CLAUDE",
    "Check-in systems",
    "Decisions",
    "Fixing things remotely",
    "Front-desk reader",
    "Ground rules",
    "How SecurityAI works",
    "Install a new gym",
    "J Street Gym",
    "Pricing",
    "Release history",
    "To do"
   ],
   "text": "# SecurityAI\n\nWatches a gym's entrance camera during the hours the gym picks. When more people walk in than scanned at the front desk, the gym gets the photo and the exact second to look up.\n\n## Where things are\n- Website: gym-security.onrender.com (Render). Custom domain bought on Namecheap, DNS being set up.\n- Code: GitHub repo \"Gym-security\". Claude pushes after TJ's OK, once per session. See [[CLAUDE]].\n- First gym: [[J Street Gym]] (pilot).\n- Status 2026-10-21: nothing running at the gym yet. No laptop or Raspberry Pi, so until TJ says otherwise only software update checks and backend proficiency tests are possible.\n\n## How it works\n[[How SecurityAI works]] \u00b7 [[Front-desk reader]] \u00b7 [[Check-in systems]]\n\n## Running it\n[[Install a new gym]] \u00b7 [[Fixing things remotely]] \u00b7 [[Pricing]] \u00b7 [[Ground rules]]\n\n## Keeping track\n[[Decisions]] \u00b7 [[To do]] \u00b7 [[Release history]]\n"
  },
  {
   "name": "Start here",
   "type": "hub",
   "links": [
    "2026 Week 43",
    "Basis",
    "Decisions",
    "Ground rules",
    "How I work with Claude",
    "J Street Gym",
    "Jarvis",
    "New gym template",
    "Personal",
    "SecurityAI",
    "To do",
    "Weekly tidy-up"
   ],
   "text": "# Start here\n\nThis is TJ's brain: everything about the businesses, written down once so Claude (and TJ) never start from zero.\n\n## The businesses\n- [[SecurityAI]]: catches people getting into 24-hour gyms without scanning. First gym: [[J Street Gym]].\n- [[Basis]]: the AI workout and nutrition app.\n\n## Jarvis\n- [[Jarvis]]: where this brain is heading, a real-life assistant for work and life. See also [[Personal]].\n\n## Right now\n- As of 2026-10-21: nothing is running at [[J Street Gym]] yet. TJ has no laptop and no Raspberry Pi, so until TJ says otherwise only software update checks and backend proficiency tests of [[SecurityAI]] are possible. See [[To do]].\n\n## How to use it\n- Ask Claude anything about the business. Claude reads these notes first. See [[How I work with Claude]].\n- Each week gets one note in Weekly, like [[2026 Week 43]]. Write what happened, Claude tidies it every Monday ([[Weekly tidy-up]]).\n- Big calls go in [[Decisions]]. Things to do go in [[To do]].\n- New gym, new note: copy [[New gym template]].\n\n## What never goes in here\nPasswords, API keys, gym codes, card numbers, and anything about a member. See [[Ground rules]].\n"
  },
  {
   "name": "To do",
   "type": "list",
   "links": [
    "Basis",
    "J Street Gym",
    "Jarvis",
    "Personal",
    "Release history",
    "SecurityAI"
   ],
   "text": "# To do\n\nCovers [[SecurityAI]], [[Basis]] and [[Jarvis]]. Done items move to the week's note.\n\n## Now\n- As of 2026-10-21: nothing is running at [[J Street Gym]] yet. TJ has no laptop and no Raspberry Pi, so until TJ says otherwise only software update checks and backend proficiency tests are possible.\n- [ ] Backend proficiency tests and software update checks for [[SecurityAI]] (backend first, no hardware yet).\n- [ ] On hold until hardware is set up: first nights at [[J Street Gym]] (run the checklist there).\n- [ ] Storage line: admin page, sign in, \"Render settings\" box, first line. Good = green \"Storage: /var/data \u2014 a separate disk...\". If it says DATA_DIR is not set, every deploy wipes gym accounts and history; the Render disk needs the paid Starter plan (check price before paying). See [[Release history]].\n- [ ] Photo of an Ashbourne denied scan.\n\n## Setup\n- [ ] Tailscale: turn off key expiry.\n- [ ] Make the spare memory card.\n- [ ] Finish the custom domain DNS on Namecheap.\n- [ ] Texting (Twilio) and alert email on the domain.\n\n## Jarvis\n- [ ] Try the HUD on the phone: https://claude.ai/artifact/6BgK9h8LVgz3ondg1QqzSP. See [[Jarvis]].\n- [ ] Decide on an Anthropic API key for the HUD (pay as you go, about 1 cent a question on Opus).\n- [ ] Decide if Jarvis gets a movie-grade voice (ElevenLabs, about $5 to $22 a month).\n- [ ] Connect Spotify on claude.ai (phone browser, Settings > Connectors). Then set up a phone shortcut for play and pause. See [[Jarvis]].\n- [ ] Set up Jarvis on the phone: follow the phone guide in [[Jarvis]] (Project + GitHub + voice mode), then test \"What's on my to-do list?\".\n- [ ] Tell Claude favourite music and chill routines for [[Personal]].\n- [ ] Finish the Gmail sign-in on claude.ai (Calendar and Drive are connected).\n- [ ] Set the Google Calendar time zone to Central (it shows UTC).\n- [ ] Brain ideas Jarvis offered 2026-10-21, not decided yet: a hardware readiness list (laptop, Pi, cards, capture stick, rough prices (check)), a backend proficiency checklist, a pilot pitch draft for [[J Street Gym]].\n- [ ] When TJ has a computer: sign in to Claude in Chrome there, then test one website job.\n\n## Later\n- [ ] Staff and cleaner schedules (after real nights).\n- [ ] Pitch J Street's owners with the pilot counts.\n- [ ] A per-night \"scans confirmed\" line in the morning report.\n"
  },
  {
   "name": "Weekly note template",
   "type": "week",
   "links": [
    "How I work with Claude"
   ],
   "text": "# Year Week N\n\nCopy this for each new week. See [[How I work with Claude]].\n\n## Done\n\n## Next\n\n## Learned\n\n## Check\n- Stale facts and \"(check)\" items to confirm this week.\n"
  },
  {
   "name": "Weekly tidy-up",
   "type": "playbook",
   "links": [
    "CLAUDE",
    "Jarvis",
    "To do",
    "Weekly note template"
   ],
   "text": "# Weekly tidy-up\n\nEvery Monday Claude tidies the brain so it never drifts. Part of [[Jarvis]]. Rules come from [[CLAUDE]].\n\n## What it does\n1. Runs `.claude/weekly-tidy.sh`. It starts this week's note from [[Weekly note template]], carries over last week's \"Next\" and the open \"Now\" items in [[To do]], and lists what needs a look.\n2. Ticked items in [[To do]] move to the week's Done.\n3. Facts marked \"(check)\" and dated facts older than 30 days get listed for TJ in the week's \"Next\". Claude never guesses an answer; old facts move under \"History\", nothing gets deleted.\n4. Fixes broken links. If something looks like a leaked key, it stops and tells TJ, and writes nothing about it.\n5. Commits and pushes to a Claude branch on the Jarvis repo. Never touches Gym-security.\n\n## Schedule\nOn since 2026-10-21: Mondays at 06:42 US Central (America/Chicago), as a Claude Code scheduled task. Each run starts its own thread in the Jarvis project, opens a PR, and sends TJ a push and email summary. First run 2026-10-26.\n\n## Prompt for the scheduled task\n> Run the weekly tidy-up from \"Weekly tidy-up.md\": run .claude/weekly-tidy.sh, then do steps 2 to 4 by hand following CLAUDE.md. Add a line to this week's note saying the tidy-up ran. Commit and push to a claude/ branch on the Jarvis repo only. End with a three-line summary for TJ: what changed, what needs his answer, anything risky.\n"
  }
 ],
 "stats": {
  "notes": 23,
  "open_todos": 21,
  "checks": 13
 }
};
