---
type: reference
checked: 2026-10-20
---
# AI tools to use and avoid

Things seen on TikTok, checked before touching them.

## Using
- **Impeccable** (design checklist) and **Emil Kowalski's** motion review: used for the website polish on 2026-10-20.
- **Playwright**: a real browser that checks every page on phone and desktop.

## Checked 2026-10-21 (TJ's TikToks)
- **Impeccable** design skill: copied into the Jarvis repo (`.claude/skills/impeccable`), guidance only; its helper program needs a computer (`npx impeccable install`). Used for the Show off look.
- **Playwright**: already used for page checks. **Claude in Chrome**: waits for TJ's computer.
- **claude-mem** (memory plugin): skip. Needs a background service on a computer, and this brain plus project memory already carry context between sessions.
- **task-observer**, **Find Skills**: skip for now; extra steps every session cost usage.
- **Perplexity**, **Firecrawl**, **Higgsfield** connectors: each needs a paid account or API key. Web search and fetch cover research today. Higgsfield (AI video and images) only if TJ wants marketing videos. TJ's call before any sign-up.

## Fine, not needed now
- **Agent Skills** (Addy Osmani): planning, specs and tests as written instructions. Safe.
- **Graphify**: maps a codebase into a graph on your own computer. Worth it for big codebases; ours is about 100 files. Keep its "send to AI" option off.
- **Taste** skill: not now; the site already has its look.
- **Figma MCP**: we don't design in Figma.

## Avoid
- **OmniRoute**: sends your requests through unknown free AI providers, holds all your keys, and the free-Claude part relies on sharing a Claude login, which Anthropic's terms ban (since 2026-02-19). Risk: account banned, gym data leaked.
- **Ponytail**: real, but its numbers are its maker's own test, and its job is deleting code. Wrong habit for a security product.

See [[Ground rules]] and [[Decisions]].
