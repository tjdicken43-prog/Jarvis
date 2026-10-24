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

## Kept, and why
- The 3D brain and its core: it is the one thing no other assistant has, so it stays as the signature, calmer (no grid, softer bloom, no angle readout, faint ring text).
- Show off, the flight, factory, night mode, voices and looks all work as before. Show off keeps its full effects; it's opt-in.
- Nothing was cut.

## The rules (follow these on every change)
- Colors: `--bg`, `--surface`, `--surface-2`, `--ink`, `--dim`, `--mute`, hairlines `--faint`/`--line`, one `--arc` accent. Status colors (`--ok`, `--gold`, `--red`) only for state.
- Type: system font; 17px for Jarvis's spoken line, 15px body, 13 to 12.5px meta. Weights 400, 500, 600 only. No caps labels, no letter-spacing.
- Shape: 6px controls, 8px panels and tiles, 12px sheet tops. Round only the mic. No pills, glows, gradients, glass or scanlines.
- Taps: 44px minimum. Spacing in 4px steps.
- Motion: 150 to 250ms ease-out, only to show state; honor reduced motion.
