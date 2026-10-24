# Jarvis page: design rules

Redesign 2026-10-24. TJ: the old page "looks vibe coded and just off"; he wants a professional, premium look he's proud to show off.

## What the pros do (researched 2026-10-24)
- **Neutral base, one accent.** Linear's 2024 redesign cut how much of its brand blue fed the theme "for a more neutral, timeless look", built themes from three inputs (base, accent, contrast), raised text contrast, and used one type family (Inter, with Inter Display for headings). Source: [How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui).
- **The "alive" cue is small and tied to real state.** ChatGPT moved voice out of its full-screen blue orb and into the normal chat ([TechCrunch, 2025-11-25](https://techcrunch.com/2025/11/25/chatgpts-voice-mode-is-no-longer-a-separate-interface/)). Gemini Live shrank its waveform into a compact strip so the answer gets the screen ([Android Central](https://www.androidcentral.com/apps-software/ai/i-barely-use-chatbot-after-trying-new-gemini-live)).
- **Tap targets 48dp on Android, 44pt on iPhone.** Source: [Android accessibility key steps](https://developer.android.com/develop/ui/compose/accessibility/key-steps), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/).
- **Chat apps:** slim top bar, the conversation leads, composer pinned to the bottom with the mic inside it, history behind an icon. Secondary things go in bottom sheets on a phone. (ChatGPT, Claude and Gemini apps; from use, not a cited spec.)
- **AI-made / vibe-coded tells:** neon or cyan glow on black, glowing borders, glass panels, decorative grid backgrounds, all-caps letter-spaced labels, pill buttons, purple gradients, glow blobs, identical icon cards. Sources: [impeccable.style/slop](https://impeccable.style/slop), money/sites/PREMIUM.md "No AI tells" and its sources. These are design-critique consensus, not measured data.

## How the old page differed
| Old | Pros | New |
| --- | --- | --- |
| Chakra Petch display font, letter-spaced ALL CAPS on every label and button | one neutral sans, sentence case | system font (Roboto on Android), sentence case everywhere |
| Neon cyan with text glow, scanlines, grid, chamfered glass panels | neutral greys, one accent, hierarchy from size and weight | graphite greys, one steel-blue accent, flat 8px panels, hairlines |
| Four boxed text buttons in the header plus a big clock | slim top bar, icons for secondary tools | name + status line, four 44px icon buttons |
| Underlined COMMS/JOBS/BRAIN tabs | segmented control | Chat / Jobs / Brain segmented control |
| Pill suggestion chips | 4 to 8px corners | 2x2 suggestion tiles |
| JOB, input and mic as three separate boxes | one composer bar | one composer: Job toggle, input, round mic |
| Centered dialogs with boxed caps buttons | bottom sheets on a phone, one primary button | sheets with a grabber, Done is the one accent button |
| Brain spills behind every panel | content leads | brain lives in a band at the top and fades out above the content |

## The centrepiece: a data dial (round 2, 2026-10-24)
TJ: "better but not best... I want the center to be a premium looking mind, something interesting based on professional data." The arc reactor became an instrument dial drawn only from live data, read outside in, like a watch face or an observability gauge:
- Outer ring: the notes by kind (hub, rules, log, list, week, personal), each arc in proportion.
- Radial bars: one per note, as long as its links; a note lights white while a question touches it. They move with the voice.
- Bezel: 60 ticks; a sweep runs round it while Jarvis thinks.
- Inner rings: jobs (done green, running amber, needs you red) and lessons (filed, waiting amber).
- Centre: the note count, or a live waveform while Jarvis talks or listens.
- Under it, a four-number readout (notes, links, jobs, lessons) is the legend. The old cores stay in Show off.

## The factory: a Starnet-scale station (round 3, 2026-10-24)
TJ: "factory isn't premium or up to par"; base it on real professional work "like Starnet", the "large Starnet models, not the small demo".
- **Reference:** Starnet's full station render ([repo](https://github.com/androoAGI/starnet), image `.github/media/station-iso.png`, branch feat/harness-backend; looked up 2026-10-24). What it does: one big multi-room hull in space, 2:1 isometric, gunmetal walls lit by rows of amber windows, teal screens, small white crew, a hazard-striped landing pad, solar wings, a planet's limb behind. Its rule: "the interface must never assert state the harness cannot prove."
- **Cutaway:** tall walls at the back, low walls in front so every room stays visible. This is the walls-down view of management sims like The Sims and Two Point Hospital (from memory, not looked up).
- **What we built (hud/factory.js):** the same crew and simulation, redrawn as an isometric station: Find and build bay, Deals bay, Lab with plant beds, Command (your throne), Hangar with a launch pad, and four rooms round the core (Servers, Briefing, Storage, Lounge). Drawn in vector so it stays sharp at any zoom. All art is ours, drawn in code; Starnet's sprites and name are not licensed, so none are copied.
- **Honest state (Starnet's rule):** the core's dots are the real notes; jobs, links and lessons come from Jarvis. Degen shows as switched off (it is, since 2026-10-23) and its fake paper-trade bubbles are gone. The footer says plainly that crew motion is a loop.
- **Chrome:** warm black, one amber accent (Starnet's own brand colour family), mono for data, system font for text, 44px icon buttons, bottom-sheet cards, corner brackets like Starnet's cards.
- **The assistant view** stays modeled on shipped assistants: ChatGPT and Gemini Live for voice in the chat, Linear for the neutral-plus-one-accent theme (sources above).

## The Jarvis home, round 4 (2026-10-24)
TJ loved the station and asked for the screen that leads into it to use better colours, feel more like Jarvis, and work as one solo product.
- **One palette across the product:** the Station palette from the factory. Warm black and warm greys, **teal for Jarvis himself** (the dial, his status, the mic; a nod to the arc reactor and the factory's screens), and **amber for actions** (Done, Cards, the factory card). Starnet uses the same two colours: amber light and teal screens. The old steel-blue look is still in Settings as "Steel".
- **More Jarvis:** a J.A.R.V.I.S. wordmark in mono (as in the films' on-screen titles, from memory), a greeting by name and time of day ("Good evening, TJ"), "At your service" when idle, and the online state as a teal light next to the name.
- **The factory as a destination:** the small header icon is now a card under the dial with a live window onto the station and its real counts. This follows the home-screen "live tile" pattern (Android widgets, Apple Live Activities; from memory).
- Fix: the brain's draw loop could start before voice.js loaded, which stopped the dial from drawing at all. It now starts once every script has loaded.

## Round 5 (2026-10-24): Iron Man HUD, a factory worth watching, real briefs
TJ: "make it look like something Iron Man would use", the factory "more intricate", "scientifically dopamine producing" to watch, without using much, and the briefs must show our real demos with brand names out.

**Home, the "Mark" look (default).** Built on how Cantina Creative made the Iron Man and Avengers HUDs: a dark, near-black field, one cool cyan for data, a warm amber for things that need you, red only for alarms, thin lines, corner brackets and small telemetry, with the eye drawn to one centre object ([Pro Video Coalition](https://www.provideocoalition.com/cantina-creative-on-designing-huds-for-movies-and-real-life/amp/), [CGW, Iron Man 3](https://www.cgw.com/Press-Center/Web-Exclusives/2013/Cantina-Creative-Gives-Iron-Man-3-a-Heads-Up-.aspx), [HUDs+GUIs, The Avengers](https://www.hudsandguis.com/2013/05/15/the-avengers/)). So: a segmented bezel and 72 ticks around the brain core, Rajdhani for HUD numbers and labels, a live telemetry block (location, Central time, link, memory, system), corner brackets on the frame, a cyan ring mic. The earlier looks stay under Settings as "Station" and "Steel".

**Factory, made to be watched.** Each piece maps to a finding:
- Feeder belts, inserter arms, crates sliding in and out, two maintenance bots on laps: constant visible motion and variety, the Factorio/shapez "watch the line run" loop (game reviews, weak source).
- A progress ring on every crate at a desk: the goal-gradient effect, people speed up and stay engaged as a goal gets close (Kivetz, Urminsky & Zheng 2006, *J. Marketing Research* 43:39-58, [PDF](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf)).
- A "✓" pop on each finished stage and "+1 sent" at the sender, plus a running "sent this visit" count: frequent small wins (Amabile & Kramer 2011, "The Power of Small Wins", *HBR* 89(5):70-80).
- About 1 in 10 leads is a gold "hot lead" with its own glint, trail and pop: dopamine tracks reward prediction error, so rare, unpredictable rewards hold attention more than steady ones (Schultz, Dayan & Montague 1997, *Science* 275:1593).
- Short pops and squash on events: "Juice it or lose it" (Jonasson & Purho 2012, talk; from memory).

**Cheap to watch.** All client-side: no Claude calls, no network, no polling. Factory renders at 30 fps and stops when the tab is hidden; the home card runs at 12 fps; the brain stops drawing while the factory is open.

**Briefs (Station page).** The three job cards now show the golden trade demos (money/sites/golden/) as de-branded screenshots: logos swapped for text wordmarks, real photos hidden, names "Example Heating & Air / Roofing / Plumbing", phone (479) 555-0142. Emails are the three-sentence flaw email ending with the $299 setup + $149/month offer, and each brief explains Front Desk.

## Round 6 (2026-10-24): the Workshop, real 3D
TJ: rounds 1-5 still read as a website. He wanted a real-3D, full-screen look that "changes the entire look of the computer", researched against creators who post their own Jarvis UIs, shown as screenshots first. Research and mockup: /mnt/project-files/jarvis-hud/workshop-mockup/ (creator-comparison.md, creator-research.md). TJ approved it with three changes: brief approvals under the factory feed on the home page, fewer labels, and no AI-looking fonts.

- **Hologram (hud/src/workshop.js, three.js 0.169 from jsdelivr).** A lit projector, a beam, and a globe of the real notes with links curved inward; drag turns it, tap opens a note, the core follows Jarvis's voice state. Full-screen button gives an ambient mode with the panels hidden. All on the device: no Claude calls, stops when the tab is hidden, the factory or Show off is open, or night mode is on.
- **System font only.** No mono, no letter-spaced caps, plain "Jarvis" wordmark: those were the AI tells TJ named.
- **Fewer details.** Brain to-dos show two lines each; the full text lives in the note.
- **Briefs on home.** Under the factory feed: read through the Render connector (read-only), Approve writes `approvals/<id>` and queues a job for Jarvis backend.
- **Phone.** Hologram on top, then Chat / Jobs / Brain tabs; the feed and briefs lead Chat. The voice-state line sits on a dark plate so the beam can't wash it out.

## Kept, and why
- The 3D brain and its core: it is the one thing no other assistant has, so it stays as the signature, calmer (no grid, softer bloom, no angle readout, faint ring text).
- Show off, the flight, factory, night mode, voices and looks all work as before. Show off keeps its full effects; it's opt-in.
- Nothing was cut.

## The rules (follow these on every change)
- Colors: `--bg`, `--surface`, `--surface-2`, `--ink`, `--dim`, `--mute`, hairlines `--faint`/`--line`. `--arc` (teal) is Jarvis; `--amber` is for actions. Status colors (`--ok`, `--gold`, `--red`) are only for state.
- Type: system font; 17px for Jarvis's spoken line, 15px body, 13 to 12.5px meta. Weights 400, 500, 600 only. No caps labels, no letter-spacing.
- Shape: 6px controls, 8px panels and tiles, 12px sheet tops. Round only the mic. No pills, glows, gradients, glass or scanlines.
- Taps: 44px minimum. Spacing in 4px steps.
- Motion: 150 to 250ms ease-out, only to show state; honor reduced motion.
