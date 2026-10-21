---
type: reference
checked: 2026-10-21
---
# AI tools to use and avoid

Things seen on TikTok, checked before touching them.

## Using
- **Impeccable** (design checklist) and **Emil Kowalski's** motion review: used for the Gym-security website polish on 2026-10-20.
- **Playwright**: a real browser that checks every page on phone and desktop. Already in the cloud setup, so no Playwright MCP needed.
- **Impeccable** and **Emil Kowalski's** `emil-design-eng` and `review-animations` skills: installed in the [[Basis]] repo on 2026-10-21 (markdown only; Impeccable's launcher, which downloads a binary, removed).
- **vet-ai-tool** skill (our own, in this repo): the steps for checking any new tool TJ sends before installing.

## Fine, not needed now
- **Agent Skills** (Addy Osmani): planning, specs and tests as written instructions. Safe.
- **Graphify**: maps a codebase into a graph on your own computer. Worth it for big codebases; ours is about 100 files. Keep its "send to AI" option off.
- **Taste** skill: not now; the site already has its look.
- **Figma MCP**: we don't design in Figma.
- **Claude in Chrome**: already installed; waits until TJ has a computer. See [[To do]].
- **Perplexity MCP** and **Firecrawl MCP**: need paid API keys, and built-in web search and page fetch already cover research. Ask TJ before paying.
- **Higgsfield MCP**: paid AI images and video. Maybe later for [[Basis]] marketing, only if TJ wants to pay.

## Avoid
- **claude-mem**: runs a background worker and hooks on every session and stores everything; the cloud sessions are wiped anyway, and the brain notes plus project memory already do this. Skipped 2026-10-21.
- **find-skills / `npx skills add`**: installs strangers' skills automatically without reading them. Use the vet-ai-tool skill instead.
- **OmniRoute**: sends your requests through unknown free AI providers, holds all your keys, and the free-Claude part relies on sharing a Claude login, which Anthropic's terms ban (since 2026-02-19). Risk: account banned, gym data leaked.
- **Ponytail**: real, but its numbers are its maker's own test, and its job is deleting code. Wrong habit for a security product.

See [[Ground rules]] and [[Decisions]].
