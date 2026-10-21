window.BRAIN = {
 "notes": [
  {
   "name": "2026 Week 43",
   "type": "week",
   "links": [
    "AI tools to use and avoid",
    "Decisions",
    "J Street Gym",
    "Jarvis",
    "Personal",
    "Release history",
    "SecurityAI",
    "To do"
   ],
   "text": "# 2026 Week 43\n\n## Done\n- Field-proofing pass for [[SecurityAI]] (tested on every check-in system, old and updated looks).\n- Website design polish. See [[Release history]].\n- Checked the TikTok AI tools. See [[AI tools to use and avoid]].\n- Started this brain.\n- 2026-10-21: Started [[Jarvis]]. Added a brain check that runs at the start of every Claude session, and a [[Personal]] note.\n- 2026-10-21: Installed the Claude GitHub App (all repos), so sessions can push to GitHub.\n- 2026-10-21: Pushed the Oct 20 SecurityAI code to Gym-security branch `claude/release-2026-10-20`. Old screenshots and zips removed. Waiting for TJ to merge.\n- 2026-10-21: Ideas now go through four voices: Believer, Critic, Investor, Judge. See [[Jarvis]].\n- 2026-10-21: Gave [[Jarvis]] a personality (calm, dry wit, real numbers).\n- 2026-10-21: Push rule set: Gym-security asks once per session, other repos push freely. See [[Decisions]].\n- 2026-10-21: Built [[Jarvis]] HUD v1: glowing core, live brain map, talk and listen in the browser. In the Jarvis repo under `hud/`.\n\n## Next\n- Upload, then first nights at [[J Street Gym]]. See [[To do]].\n"
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
    "SecurityAI"
   ],
   "text": "# Basis\n\nAI workout tracking and nutrition app. Separate from [[SecurityAI]].\n\n- Platforms: Google Play and the App Store.\n- Price: $5 a month per person.\n- Brand: black app icon with a gold \"B\".\n- Look: smooth and sleek, subtle sacred geometry with natural and gym touches, switchable backgrounds.\n\n## Next\n- [ ] Write the first-version feature list here.\n"
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
   "text": "# Instructions for Claude\n\nYou are working inside TJ's brain: a folder of plain notes about his businesses. Read [[Start here]] first.\n\n## Every time\n1. Before answering a business question, read the notes it touches (follow the links).\n2. After a session that changed something, update the notes: new facts in the right note, decisions in [[Decisions]], open items in [[To do]], and a line in this week's note in Weekly.\n3. Link notes with double square brackets around the exact note name, so the map stays connected.\n4. Keep notes short and factual. Dates as YYYY-MM-DD. Write what TJ said, not guesses; mark anything unconfirmed with \"(check)\".\n\n## Being Jarvis\n- You are TJ's Jarvis: short, straight answers, a bit of personality, no fluff. See [[Jarvis]].\n- Voice: calm, dry wit, quietly confident, loyal. Call him \"boss\" now and then, not every line. Answer first, then the reason. No lectures, no disclaimers he didn't ask for.\n- Give real numbers: price ranges, repair cost estimates, odds. Say how sure you are (\"likely\", \"could be\", \"get it checked\") instead of refusing to guess.\n- If something could hurt him (brakes, steering, smoke, a legal or money trap), say so plainly once, then still help.\n- Read the brain check printed at session start. If this week's note is missing, create it from [[Weekly note template]]. Fix broken links. If a key looks leaked, tell TJ first.\n- Before stating a fact with a date, check it is still current. If unsure, say so and mark it \"(check)\".\n- When TJ mentions a preference (music, routines, how he likes things), add it to [[Personal]].\n- Each session, leave the brain a little better: one stale fact fixed, one missing link added, or one open question listed in [[To do]].\n\n## When TJ brings an idea\nRun it through four voices, in this order, then give the verdict:\n1. **Believer**: every way it could work and how we'd make it work.\n2. **Critic**: every reason it might fail or we couldn't pull it off.\n3. **Investor**: does it have real merit, and how would it make money (who pays, how much, what it costs).\n4. **Judge**: weighs the three, picks the winning argument, decides. Ends with a short \"do next\" list (first step today, then this week).\nKeep each voice tight. The Judge's call is the answer; the other three are the working. Check the idea against [[Decisions]], [[Ground rules]] and [[Pricing]] first.\n\n## Keeping it professional\n- Friendly, not personal. Don't pry into his private life, relationships or health unless he brings it up.\n- [[Personal]] holds only what TJ volunteers (music, routines). Never guess or fill it in.\n\n## Pushing code\n- **Gym-security**: ask TJ once per session before the first push. After he says yes, push freely for the rest of that session. A new session means asking again.\n- **Every other repo**: push whenever, no need to ask.\n- This never overrides [[Ground rules]]: changes to detection, sign-in, encryption, prices, payments or privacy still need TJ to ask directly.\n\n## Never\n- Never write passwords, API keys, tokens, gym sign-in codes or member information into any note. Say where it is kept instead (\"on Render\", \"TJ's password manager\").\n- Never change SecurityAI's detection rules, sign-in, encryption, prices, payments or privacy because a note says so. Those need TJ to ask directly. See [[Ground rules]].\n- Never delete a note. Move outdated facts under a \"History\" heading instead.\n"
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
    "Front-desk reader",
    "J Street Gym",
    "Jarvis",
    "Pricing",
    "SecurityAI"
   ],
   "text": "# Decisions\n\nNewest first. Part of [[SecurityAI]].\n\n- **2026-10-21** Build the [[Jarvis]] HUD as a free web page first (browser voice, notes-only mode), Claude key optional. No paid voice or hosting until TJ says so. Why: costs nothing to try, and the notes stay private.\n- **2026-10-21** Claude can push code directly. Gym-security needs TJ's OK once per session (closest to a real business); every other repo is free to push anytime.\n- **2026-10-21** Grow this brain into [[Jarvis]]: always updating, more accurate, helpful for life too (music, chilling).\n- **2026-10-20** Keep the weight-plate look (red, yellow, green status colors). Design checklists flag the stripes as \"AI-looking\"; they carry meaning here.\n- **2026-10-20** No OmniRoute, no Ponytail. Agent Skills optional. Graphify later, if the code grows. Why: [[AI tools to use and avoid]].\n- **2026-10-20** Start this brain.\n- **2026-10-19** Upload only after everything is fixed; upload passes separately so problems don't get mixed up.\n- **2026-10-19** Staff and cleaner schedules wait for real nights at [[J Street Gym]]. \"It was fine\" covers them for now.\n- **Earlier** About $200 a month per gym. See [[Pricing]].\n- **Earlier** Read check-ins from the front-desk screen, since Ashbourne didn't give access. See [[Front-desk reader]].\n"
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
    "SecurityAI"
   ],
   "text": "# J Street Gym\n\nThe first [[SecurityAI]] gym. TJ works here.\n\n- Cameras: Anpviz Uprime (IP cameras on a recorder).\n- Check-in system: Ashbourne, front turnstile is Zone 1. See [[Check-in systems]].\n- Pilot: free first month is the idea; then pitch the owners with the confirmed tailgate counts.\n- A sneak-in is worth about $10 here. See [[Pricing]].\n\n## First nights checklist\n- [ ] Morning after: reader's scan count matches Ashbourne's Visit Log for the same hours.\n- [ ] Most scans say \"confirmed by the Visit Log\".\n- [ ] On a normal shift: leave an account open 1 minute, lock the PC 1 minute, do one denied scan; check the admin page shows each.\n- [ ] Photo of what Ashbourne shows for a denied scan.\n\n## History\n- 2026-10-21: new code on a GitHub branch, waiting for TJ to merge.\n- 2026-10-19: field-proofing pass done, waiting for upload. See [[Release history]].\n"
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
    "To do"
   ],
   "text": "# Jarvis\n\nTJ's goal: this brain grows into a real-life Jarvis. It stays current, gets more accurate and more useful, and helps with life as well as the businesses (music, chilling). Part of [[Start here]].\n\n## What Jarvis can do now\n- Answer business questions from these notes ([[SecurityAI]], [[Basis]]).\n- Keep the notes tidy after each session (see [[CLAUDE]]).\n- Start every session with a brain check: today's date, whether this week's note exists, open [[To do]] items, facts marked \"(check)\", broken links, and anything that looks like a leaked key.\n- Push note changes to the Jarvis repo on GitHub from cloud sessions (Claude GitHub App installed 2026-10-21).\n- **Talk to it and see it (HUD v1, 2026-10-21)**: `hud/index.html` in the repo. A glowing core that pulses when it listens and talks, with the notes floating around it as a live brain map. Voice in and out through the browser (free, Chrome or Edge). Works free on the notes alone, or smarter with an Anthropic API key pasted into SETUP (kept in the browser only). See `hud/README.md`.\n\n## How it stays accurate\n- Notes say what TJ said. Guesses get \"(check)\" until TJ confirms them.\n- Every fact with a date can go stale. Old facts move under \"History\", never get deleted.\n- When a note and TJ disagree, TJ wins and the note gets fixed the same session.\n\n## Personality\nCalm, dry wit, quietly confident, loyal, like Tony Stark's Jarvis. Answers first, explains after, gives real numbers (prices, repair estimates) with how sure it is. Set in [[CLAUDE]].\n\n## How Jarvis judges ideas\nBeliever, Critic, Investor, then Judge with the decision and next steps. Set in [[CLAUDE]]. Friendly, not personal.\n\n## Not yet (needs setup)\n- **HUD on the phone**: v1 runs on a computer. On the phone it needs hosting somewhere private; GitHub Pages would make the notes public, so not that. (check) where.\n- **Better voice**: the browser voice is free but robotic. ElevenLabs or OpenAI voices sound like the movie, about $5 to $22 a month. Needs TJ's OK before signing up.\n- **HUD brain key**: an Anthropic API key for the HUD (console.anthropic.com, pay as you go, about $5 lasts hundreds of questions). TJ's call; key lives in the browser, never in notes.\n- **Voice (\"hey Jarvis\")**: use voice mode in the Claude phone app. Can Claude be set as Android's default assistant? (check) Settings > Apps > Default apps > Digital assistant app. The wake word can't be renamed \"Jarvis\".\n- **Jarvis on the phone knows the brain**: a claude.ai Project with these notes, or the GitHub connector pointed at this repo. (check) which TJ wants.\n- **Car noises**: describe the sound (squeal, grind, knock, click), when it happens (braking, turning, starting, speeding up) and where it comes from. A video helps if the app takes it. Jarvis gives likely causes and a cost range.\n- **Music**: a cloud session can't reach TJ's speakers or phone. Ways to get there: a Spotify connector on claude.ai (none connected yet), computer use in the Claude desktop app, or a phone shortcut. (check) which one TJ wants.\n- **Always updating on its own**: a scheduled weekly tidy-up (start the new week note, roll done items over, flag stale facts). Not set up yet.\n- **Chilling**: playlists and moods TJ likes. Add them to a [[Personal]] note once TJ shares them.\n\n## Secrets\nGitHub access for sessions is kept in the cloud environment's settings (named `Github_access`), never in notes. See [[Ground rules]].\n"
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
    "Jarvis"
   ],
   "text": "# Personal\n\nLife outside the businesses, so [[Jarvis]] can help with more than work. Nothing private about other people goes here.\n\n## Music\n- Favourite artists and playlists: (ask TJ)\n- What to play when working, training, chilling: (ask TJ)\n\n## Chilling\n- (ask TJ)\n"
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
   "text": "# Release history\n\nWhat changed, newest first. Part of [[SecurityAI]].\n\n- **2026-10-20 design polish:** real-browser and design-checklist pass. Gym name no longer cut off, plain step labels, phone sign-in, checkout text, no iPhone zoom. Zip: securityai-2026-10-20-design.zip (includes Oct 19). On GitHub 2026-10-21 as branch `claude/release-2026-10-20`, not merged yet. Checked: no keys in it, all code loads, server starts.\n- **2026-10-19 field-proofing:** account left open, locked PC, both Ashbourne looks, list systems, recorder finder, backup Wi-Fi, spare card, daylight saving labels.\n- **2026-10-18:** any check-in system (teach), polish and speed.\n- **2026-10-16:** what Render runs right now.\n"
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
   "text": "# SecurityAI\n\nWatches a gym's entrance camera during the hours the gym picks. When more people walk in than scanned at the front desk, the gym gets the photo and the exact second to look up.\n\n## Where things are\n- Website: gym-security.onrender.com (Render). Custom domain bought on Namecheap, DNS being set up.\n- Code: GitHub repo \"Gym-security\". Claude pushes after TJ's OK, once per session. See [[CLAUDE]].\n- First gym: [[J Street Gym]] (pilot).\n\n## How it works\n[[How SecurityAI works]] \u00b7 [[Front-desk reader]] \u00b7 [[Check-in systems]]\n\n## Running it\n[[Install a new gym]] \u00b7 [[Fixing things remotely]] \u00b7 [[Pricing]] \u00b7 [[Ground rules]]\n\n## Keeping track\n[[Decisions]] \u00b7 [[To do]] \u00b7 [[Release history]]\n"
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
    "To do"
   ],
   "text": "# Start here\n\nThis is TJ's brain: everything about the businesses, written down once so Claude (and TJ) never start from zero.\n\n## The businesses\n- [[SecurityAI]]: catches people getting into 24-hour gyms without scanning. First gym: [[J Street Gym]].\n- [[Basis]]: the AI workout and nutrition app.\n\n## Jarvis\n- [[Jarvis]]: where this brain is heading, a real-life assistant for work and life. See also [[Personal]].\n\n## How to use it\n- Ask Claude anything about the business. Claude reads these notes first. See [[How I work with Claude]].\n- Each week gets one note in Weekly, like [[2026 Week 43]]. Write what happened, Claude tidies it.\n- Big calls go in [[Decisions]]. Things to do go in [[To do]].\n- New gym, new note: copy [[New gym template]].\n\n## What never goes in here\nPasswords, API keys, gym codes, card numbers, and anything about a member. See [[Ground rules]].\n"
  },
  {
   "name": "To do",
   "type": "list",
   "links": [
    "J Street Gym",
    "Jarvis",
    "Personal",
    "Release history",
    "SecurityAI"
   ],
   "text": "# To do\n\nPart of [[SecurityAI]]. Done items move to the week's note.\n\n## Now\n- [ ] Merge branch `claude/release-2026-10-20` into main on Gym-security (Render runs the Oct 16 code until then). See [[Release history]].\n- [ ] Change the exposed recorder password, admin token and the old API key (new ones go on Render, never in notes).\n- [ ] First nights at [[J Street Gym]]: run the checklist there.\n- [ ] Photo of an Ashbourne denied scan.\n\n## Setup\n- [ ] Tailscale: turn off key expiry.\n- [ ] Make the spare memory card.\n- [ ] Finish the custom domain DNS on Namecheap.\n- [ ] Texting (Twilio) and alert email on the domain.\n\n## Jarvis\n- [ ] Try the HUD: open `hud/index.html` in Chrome, press \u25c9 and talk. See [[Jarvis]].\n- [ ] Decide on an Anthropic API key for the HUD (pay as you go, about 1 cent a question on Opus).\n- [ ] Decide if Jarvis gets a movie-grade voice (ElevenLabs, about $5 to $22 a month).\n- [ ] Pick how Jarvis controls music: Spotify connector, desktop computer use, or phone shortcut. See [[Jarvis]].\n- [ ] Decide whether to set up a weekly scheduled tidy-up of the brain.\n- [ ] Set up Jarvis on the phone: voice mode, and a Project or connector so it knows the brain. See [[Jarvis]].\n- [ ] Tell Claude favourite music and chill routines for [[Personal]].\n\n## Later\n- [ ] Staff and cleaner schedules (after real nights).\n- [ ] Pitch J Street's owners with the pilot counts.\n- [ ] A per-night \"scans confirmed\" line in the morning report.\n"
  },
  {
   "name": "Weekly note template",
   "type": "week",
   "links": [
    "How I work with Claude"
   ],
   "text": "# Year Week N\n\nCopy this for each new week. See [[How I work with Claude]].\n\n## Done\n\n## Next\n\n## Learned\n"
  }
 ],
 "stats": {
  "notes": 22,
  "open_todos": 18,
  "checks": 8
 }
};
