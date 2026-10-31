# Jarvis assistant spec: a layered, self-improving butler

Written 2026-10-31 for TJ (brief: his message of 2026-10-31). Research and spec only, nothing built yet.
Status words: **confirmed** = checked on the web 2026-10-31 (link given); **(check)** = seen only second-hand or not verified.

## 0. The one-paragraph answer

Jarvis does not become smarter by one model rewriting its own weights. It gets smarter in three layers, cheapest and safest first: **A, memory** (what it knows about TJ, filed every night), **B, harness** (its own prompts, tool choices and routines, changed only after an eval passes and TJ taps Approve), and **C, weights** (a weekly LoRA adapter on a local open model, rejected if it forgets old skills). A and B work today on the cloud brain we already run. C needs a local GPU and is deliberately last. The personality lives in a small SQLite "Personality Engine" that rebuilds the system prompt every turn, so the wit stays consistent whichever model is answering.

### What already exists in this repo (the spec builds on it, it does not replace it)
| Today | Where | Becomes |
|---|---|---|
| Notes brain (markdown, double-bracket links) | repo root | Layer A curated memory + knowledge graph source |
| Phone page with chats, lessons, jobs store | `hud/`, private artifact | Phone thin client v0 (cloud brain via TJ's claude.ai account) |
| Job runner + morning brief | scheduled task, `hud/src/jobs.js` | Orchestrator's "background lane" |
| Lesson filing (chats to notes) | CLAUDE.md "Phone Jarvis memory" | Reflection agent v0 (Sleep cycle) |
| Vapi phone calls, Haiku 5.5, voice "Dan" | `voice/phone/` | Cloud voice path |
| Piper "alan" call lines | `voice/calls/` | Local TTS voice |
| Budget approvals (`spend/<id>`), PAUSE file | `money/BUDGET.md` | Human sign-off gate pattern, reused for Layer B and C |

## 1. System decomposition (OpenJarvis five primitives)

**Confirmed:** OpenJarvis is real: "OpenJarvis: Personal AI, On Personal Devices", Saad-Falcon, Narayan, Ré, Mirhoseini et al. (Stanford), arXiv 2605.17172 (2026-05-16), repo https://github.com/open-jarvis/OpenJarvis (Apache-2.0, ~12.6k stars). The paper names the five primitives (Intelligence, Engine, Agents, Tools & Memory, Learning) as an independently editable typed spec. We use the pattern; we do not have to adopt their code. **Decision:** borrow the decomposition, build our own thin service. *Rejected:* forking OpenJarvis wholesale, because it is research code moving fast and our brain, store and phone page already exist; we can lift single pieces (their eval-with-energy-and-cost idea) later.

| Primitive | Owns | Does NOT own | Talks to others by | Open-source picks |
|---|---|---|---|---|
| **Intelligence** (model catalog) | List of models, what each is good at, cost/latency, routing table (`models.yaml`) | Running models, prompts | Read by Orchestrator at each turn | Local: Qwen3-8B / Qwen3-4B, Gemma 3n E2B/E4B (phone), Phi-4-mini. Cloud: Claude Haiku 5.5 (fast), Sonnet 5.5 (hard jobs) |
| **Engine** (inference runtime) | Loading weights, KV cache, LoRA adapters, streaming tokens | Choosing which model, memory | OpenAI-compatible HTTP (`/v1/chat/completions`) on localhost | Ollama (default), llama.cpp `llama-server` (when we need adapters + grammar), MLX-LM (if the computer is a Mac), vLLM only on a 24 GB+ GPU box. Phone: llama.rn / LiteRT-LM |
| **Agents** | Orchestrator (routes, plans), Operative (does one task with tools), Reflection (background, never user-facing) | Long-term storage, tool code | In-process function calls; Reflection reads the episodic log, writes only *proposals* | Plain Python + FastAPI. *Rejected:* LangGraph/CrewAI as the core: extra abstraction, harder for small models to debug; fine to revisit for Operative sub-graphs |
| **Tools & Memory** | MCP servers, permission tiers, vector index, knowledge graph, episodic log | Deciding when to call a tool | MCP (stdio/HTTP) for tools; SQL for memory | MCP Python SDK, sqlite-vec (one file, no server), Graphiti for the temporal graph (Apache-2.0, confirmed), SQLite episodic log |
| **Learning** | Evals, proposal queue, versioned prompts/policies, LoRA jobs, rollback | Live answering | Reads logs + evals, writes to `proposals/` queue; TJ approves on the phone | DSPy (GEPA optimizer, confirmed https://dspy.ai/api/optimizers/GEPA/overview/), ACE playbook pattern (arXiv 2510.04618, confirmed), Unsloth or MLX-LM for LoRA (check), lm-eval / our own eval runner |

Service layer: **FastAPI** app `jarvisd` on the brain machine, endpoints `/chat` (SSE stream), `/voice` (WebSocket), `/sync`, `/proposals`, `/health`. One process, SQLite files in `~/.jarvis/`.

## 2. Deployment topology

TJ's computer specs are unknown (asked 2026-10-31). So two paths share one design; only the Engine changes.

### Path 1: Cloud brain (works now, any computer)
- Brain = Claude (Haiku 5.5 for chat/voice, Sonnet for jobs) through the claude.ai phone page (no API bill) and Vapi for calls (~8 to 13 cents a minute, checked 2026-10-23).
- `jarvisd` runs either on the computer when it's on, or not at all at first: Layer A memory stays the notes + page store, as today.
- Learning layers available: A and B. **Not C** (you cannot LoRA-train Claude).
- Cost: $0 extra on the page; API route if ever needed is about $1 to $3 a month at 100 short turns a day on Haiku (my arithmetic; Haiku 5.5 price per token (check) on anthropic.com/pricing before relying on it).

### Path 2: Local-first brain (needs a decent computer)
| Computer | What it runs well | Voice round trip (reported) |
|---|---|---|
| NVIDIA GPU 12 GB (RTX 3060 class) | Qwen3-8B Q4 (~5 to 6.6 GB), faster-whisper small, Kokoro | ~1 to 3 s per turn (blog reports, not benchmarks) |
| Mac with Apple silicon, 16 GB+ | Same via MLX/Ollama | similar (check) |
| 8 to 16 GB RAM, no GPU | Qwen3-4B or Phi-4-mini Q4, slow (~3 to 8 tok/s, check) | 3 to 6 s; use cloud for voice |
| Old/weak machine | Thin client only | use Path 1 |

Rule of thumb (second-hand): Q4 weights ≈ 0.55 GB per billion parameters plus 1 to 2 GB for context.

### Phone (Android)
- **v0 (now):** the claude.ai private page. Keeps working on both paths.
- **v1 thin client:** a small React Native app (we already write JS; reuses `hud/` look). *Rejected:* Flutter, because nothing in the repo is Dart. Binding for offline mode: **llama.rn** (confirmed, MIT, Android arm64, OpenCL on Adreno 700+, https://github.com/mybigday/llama.rn). Flutter fallback if we ever switch: **llamadart** (confirmed, v0.17.0, MIT). Not used: **mt_llmkit** (one beta release only), **fllama** (v0.0.1, no GPU), **llama-cpp-capacitor** (exists, unverified maintenance). Google's **LiteRT-LM** (confirmed, Apache-2.0, Gemma 3n) is the best-tuned Android runtime and is plan B if llama.rn is slow on TJ's phone.
- **Offline model on the phone:** Gemma 3n E2B (~3 GB, 6 GB RAM) or Qwen3-1.7B Q4 (~1.2 GB). Offline mode does: timers, reminders queue, notes lookup, short chat. Anything else queues for the brain.
- **"Like Siri":** Android lets one app be the Digital assistant (long-press power or swipe from a corner) via `VoiceInteractionService`. The RN app registers as that. Until then, the Claude app can be set there (check on TJ's phone: Settings > Apps > Default apps > Digital assistant app).
- **Reaching home:** Tailscale on both devices, `tailscale serve` for HTTPS to `jarvisd` (Open WebUI's own docs use this pattern, confirmed https://docs.openwebui.com/ecosystem/computer/phone-and-remote/tailscale). Never Tailscale Funnel or an open port. Ollama never exposed; only `jarvisd` with a device token.

### Sync protocol (phone ↔ brain)
- Every record (memory fact, personality state, episode, proposal) is a row with `id` (ULID), `updated_at` (hybrid logical clock), `device`, `deleted` flag.
- `/sync?since=<hlc>` pulls and pushes changed rows; last-writer-wins per field, except: **personality state and approved harness versions are brain-authoritative** (phone can only send *signals*, the brain computes the state), and **TJ's explicit edits always win**.
- Transport: HTTPS over Tailscale, body encrypted at rest on both ends (SQLCipher). Sync on app open, on Wi-Fi, and every 15 min while charging. No background sync on mobile data unless TJ turns it on (battery).
- Path 1 equivalent today: the page store (`chats/`, `lessons/`) + job runner filing. Same row shape, so moving to `jarvisd` is a copy job.

### Cloud fallback rules
- Fall back to Claude when: the local model's confidence/eval says the task is out of its league (code, long research, multi-step money work), the brain is offline and the phone model can't do it, or TJ says "use the big brain".
- **Never leaves the device/home:** gym member info and codes, passwords/keys, card numbers, raw audio, Personal health notes, the episodic log in raw form. Cloud calls get a redacted, minimal context (the fact needed, not the file).

### Mobile budgets (targets)
- Voice: wake to first spoken word ≤ 1.5 s on home Wi-Fi via the brain; ≤ 3 s on-device offline.
- Text first token ≤ 800 ms via brain.
- Battery: ≤ 3% per day idle (no always-listening wake word on the phone; push-to-talk / assistant gesture instead). On-device model runs only in foreground; unload after 2 min idle.
- Phone model RAM ≤ 3.5 GB; app download ≤ 60 MB, model fetched on Wi-Fi only.

## 3. Learning architecture (the critical section)

| | Layer A: Memory | Layer B: Harness | Layer C: Weights |
|---|---|---|---|
| What changes | Facts, episodes, graph edges | Prompts, tool policies, routines, agent wiring | A LoRA adapter on a local open model |
| Cost | Pennies / free | One eval run per proposal | GPU hours weekly; Path 2 only |
| Reversible | Yes, per fact (history kept) | Yes, versioned, one-tap rollback | Yes, swap adapter file |
| Risk | Wrong facts pile up ("memory pollution") | Clever-but-wrong self-edits | Forgetting, persona drift, baked-in errors |
| Who approves | Auto for low-risk facts; TJ for facts about himself marked "(check)" | **TJ every time** + eval pass | **TJ every time** + retention gate |

### Layer A: context and memory
**Stores (all SQLite on the brain, mirrored in part to the phone):**
1. **Episodic log** `episodes`: every turn (time, channel, user text, reply, tools called, outcome, TJ's reaction: thumbs, "wrong", rephrase). Raw for 30 days, then summarised.
2. **Semantic facts** `facts`: one sentence each, with `source_episode`, `confidence`, `valid_from`, `valid_to`, `status` (active / superseded / disputed). The markdown notes remain the human-readable master; facts link to the note they belong in.
3. **Temporal knowledge graph**: Graphiti (confirmed Apache-2.0, https://github.com/getzep/graphiti) over facts, so "who is John, what's his address *now*" uses the newest edge and keeps old ones. *Rejected:* Mem0 as the core (graph features reportedly paid, and an independent 2025 benchmark scored RAG-style memories 30 to 45%, arXiv 2511.10523); Letta as the whole runtime (good, but it wants to own the agent loop).
4. **Vector index**: sqlite-vec with a small embedding model (e.g. bge-small or nomic-embed via Ollama) over notes, facts and episode summaries.

**Retrieval each turn:** (1) always-on core block: Personality state + 10 pinned facts about TJ (celiac, Central time, wakes 6:00, etc.); (2) hybrid search: BM25 + vector top 8, re-ranked by recency and confidence; (3) graph hop for named people/businesses; (4) cap at ~1,500 tokens so small models stay sharp.

**Awake / Reflective / Sleep cycle.** *Honest note:* "Awake/Reflective/Sleep" is **not an official Google ADK pattern** (not found 2026-10-31). The closest real things are Google's open-source ADK "Always On Memory Agent" sample (ingest, consolidate, query agents; consolidation on a 30-minute timer; MIT, per VentureBeat, repo not fetched (check)) and **Letta sleep-time agents** (confirmed, experimental, https://docs.letta.com/guides/agents/sleep-time-agents; paper arXiv 2504.13171). We use the three-state idea as our own naming:
- **Awake** (TJ is talking): write episodes only. No consolidation, no latency cost.
- **Reflective** (5 min after a conversation ends): Reflection agent pulls candidate facts and preferences from that episode into `pending_facts` with a reason.
- **Sleep** (nightly, 2:30am Central, and the Monday tidy-up): dedupe pending facts against existing ones, resolve contradictions (newer TJ statement wins; otherwise mark "(check)"), write accepted facts and note edits as a single reviewable diff, summarise 30-day-old episodes, prune junk. On Path 1 this *is* the job runner's filing pass, made stricter.

**Getting smarter looks like:** fewer times TJ repeats himself; answers use the right current fact. **Measure:** memory-recall eval (§7) ≥ 90%; "repeat rate" (TJ restating a known fact) trending down week over week; contradictions open < 5.

### Layer B: harness and agent logic
The agent may *propose* changes to: its system prompt sections, tool descriptions and which tool it prefers for a job, routing rules (local vs cloud), routines (brief contents, reminder style), and agent wiring (e.g. "split research into two Operatives"). It never applies them itself.

**Loop (ACE-style generator → reflector → curator):**
1. Reflection agent mines failures weekly: tasks marked wrong, retries, slow answers, quips TJ didn't like.
2. It writes a **proposal**: diff of the prompt/policy file, the episodes that motivated it, the expected gain. Optionally DSPy GEPA searches prompt variants against the eval set.
3. **Eval gate:** candidate runs the full eval set (§7) against the current version. Pass rule: task success +2 points or better, **no category drops more than 1 point**, persona score ≥ current, safety cases 100%.
4. **Sign-off gate:** a card on the phone (same pattern as `spend/<id>` today): what changes, why, before/after scores, Approve / Decline. No tap, no change. Ever.
5. **Apply + version:** harness files live in git (`harness/prompts/*.md`, `harness/policies/*.yaml`), each approved change is a commit with a tag `harness-vNN`.
6. **Rollback:** "Jarvis, roll back" or a ROLLBACK button reverts to the previous tag; automatic rollback if live task success over the next 50 turns drops more than 5 points below the eval baseline. The `PAUSE` file (already used by money agents) freezes all learning.

**Hard limits on what B can touch:** never the safety rules, the approval gates themselves, spending rules, SecurityAI detection/sign-in/encryption/prices/payments/privacy (Ground rules), or the list of what never leaves the device.

**Getting smarter looks like:** it stops making the same mistake. **Measure:** task-success eval up per approved version; same-failure recurrence down.

### Layer C: parametric memory (weekly LoRA, Path 2 only)
**Facts never go here.** Facts live in Layer A where they can be corrected. C only learns *style and skill*: TJ's phrasing, how he likes plans laid out, the butler voice, tool-call formatting for the small local model.

**Why LoRA and not full fine-tuning:** "LoRA Learns Less and Forgets Less" (Biderman et al., TMLR 2024, arXiv 2405.09673, confirmed) shows LoRA forgets less outside the target domain. **Base model weights are never changed; no continuous online training.** One adapter file per week, swapped in by the Engine.

**Forgetting guard, honest version:** EWC (Kirkpatrick 2017) and LwF (Li & Hoiem 2016) are the textbook methods, but **no mainstream library ships EWC for LoRA** (PEFT doesn't; found 2026-10-31), and a reported study still saw ~19 to 21% forgetting with plain EWC (check). So:
- **Primary guard: replay mixing + low rank** (r = 8 to 16, LoRA on attention only, 1 epoch, low LR), where 30% of each week's training set is a fixed "anchor" set of general and past-week examples.
- **Optional EWC term** as a research add-on (Fisher diagonal over the LoRA params only, computed on the anchor set), switched on only if the replay-only run fails the retention gate twice. *Rejected:* making EWC the default, because it's unmaintained in tooling and adds a bug surface for little proven gain.
- **LwF-style distillation**: add KL loss toward the previous adapter's outputs on anchor prompts (cheap, works with any trainer that supports custom loss).

**Data distillation pipeline (weekly, Sunday night):**
1. Take the week's episodes where TJ gave a positive signal or didn't correct the reply.
2. Redact (names of members, codes, numbers, health details) → drop anything with secrets patterns.
3. Rewrite each into a clean (instruction, ideal reply) pair using the cloud model as teacher, following the Personality Engine rules.
4. Dedupe, cap at 300 to 800 pairs; add 30% anchor set.
5. Train with Unsloth (NVIDIA) or MLX-LM (Mac) (check versions at build time).

**Holdout eval + retention threshold:** a frozen out-of-distribution set (general Q&A, reasoning, tool-call format, safety refusals) that is *never* trained on. **Reject the adapter if OOD score < 97% of the base model's score, or any safety case fails, or persona score drops.** Then TJ still taps Approve. Old adapters kept for 8 weeks.

**Getting smarter looks like:** the small local model sounds like Jarvis without a long prompt, formats tool calls right more often, and needs the cloud less. **Measure:** cloud-fallback rate down; persona score up with a *shorter* system prompt; OOD retention ≥ 97%.

## 4. Personality Engine

**State (SQLite `personality`, one row per channel plus a base row):**
```sql
CREATE TABLE personality (
  channel TEXT PRIMARY KEY,         -- 'base' | 'text' | 'voice' | 'notification' | 'call'
  core_traits TEXT,                 -- JSON: ["calm","dry wit","loyal","quietly confident"]
  verbosity INTEGER CHECK (verbosity BETWEEN 0 AND 10),   -- base 3
  formality INTEGER CHECK (formality BETWEEN 0 AND 10),   -- base 4
  humor_level INTEGER CHECK (humor_level BETWEEN 0 AND 10), -- base 5
  emoji_usage INTEGER CHECK (emoji_usage BETWEEN 0 AND 10), -- base 0
  preferred_format TEXT,            -- 'answer-then-reason' | 'bullets' | 'steps'
  trust_level INTEGER CHECK (trust_level BETWEEN 0 AND 10), -- base row only
  shared_references TEXT,           -- JSON: running jokes, nicknames ("boss"), past wins
  channel_overrides TEXT,           -- JSON: per-channel deltas, e.g. voice verbosity -2
  updated_at TEXT
);
CREATE TABLE personality_signals (id TEXT, ts TEXT, kind TEXT, delta INTEGER, evidence TEXT);
```

**Signals.**
- Explicit commands, applied at once and confirmed in one line: "keep it brief" → verbosity −3; "more detail" → +3; "less jokes"/"not now" → humor −3 for 24 h; "be more casual" → formality −2; "Jarvis, set humor to 7" → exact.
- Implicit, applied only after 3 matching signals in 7 days, ±1 step, logged: TJ's messages are short (<8 words, 5 in a row) → verbosity −1; TJ uses emoji twice → emoji_usage +1 (cap 2); TJ laughs ("lol", "haha", 😂) after a quip → humor +1; TJ ignores or says "anyway" after a quip → humor −1; skimming signals (he asks "so what's the answer?") → force answer-first.
- Decay: implicit changes drift back toward base by 1 step every 30 days without new signals, so one grumpy week doesn't stick.

**Prompt adapter** (`personality/adapter.py`): reads base row, applies channel override, renders a short block (< 250 tokens) placed at the top of the system prompt **and re-injected every 4 turns** (persona drift is real within ~8 rounds, Harvard 2024, arXiv 2402.10962):
```
You are Jarvis, TJ's assistant. Calm, dry wit, loyal. Call him "boss" at most once per reply, not every reply.
Length: {verbosity_words} words max unless he asks for more. Format: {preferred_format}.
Rule 1: First sentence answers the question. No greeting, no restating the question.
Rule 2: Humor level {humor_level}/10. At most ONE joke, and only as the LAST sentence. If humor_level < 3, no joke.
Rule 3: No joke if the topic is health, injury, money loss, legal trouble, grief, or he sounds upset or rushed.
Rule 4: Never joke about TJ. Joke about the situation, the task, or yourself.
Rule 5: Banned phrases: "Very good, sir", "At your service", "Indeed, sir", "As you wish", "I'm just an AI", "Great question".
Rule 6: If something could hurt him, say it once, plainly, then help.
Channel: {channel_rule}
```
Channel rules: **voice**: ≤ 2 sentences, no lists, numbers spoken plainly; **notification**: ≤ 90 characters, no joke; **text**: as base; **call**: ≤ 3 sentences, ask before reading anything long.

Small-model tip: the rules are numbered, short, and negative where it matters (forum reports say "do not X" holds better over long chats (impression)). A cheap post-check regex strips a second joke or a banned phrase before the reply is sent.

**Persona spec:** British butler register, not a costume. Dry, understated, light good-natured sarcasm aimed at circumstances, never at TJ. Answer first, quip second. Original voice, never a copy of the film character's lines or the actor's voice.

**Humor patterns (3 examples each, by humor_level):**

*Dry wit*
- L3: "Done. Your calendar is now marginally less chaotic."
- L6: "Reminder set for 3pm. I'll be the one reminding you; the coffee won't."
- L9: "Inbox cleared. Forty-one emails, two worth reading. I've framed neither."

*Self-aware AI*
- L3: "Filed. I don't sleep, so I may as well tidy."
- L6: "Checked twice. I'd say I double-checked, but I don't have hands to cross my fingers with."
- L9: "Plan's ready. I'd celebrate, but my idea of a party is a well-indexed database."

*Alien observer* (looking at human habits with polite curiosity)
- L3: "Gas is $2.79 at the Walmart on 8th. Humans will drive four miles to save forty cents; I respect it."
- L6: "Your meeting moved to 10. Fascinating species, rescheduling the thing they scheduled to avoid rescheduling."
- L9: "Three alarms set. Your people invented sleep and then built devices to stop it. Remarkable."

*Literal idiom play*
- L3: "Ballpark is $300 to $450. No actual ballpark required."
- L6: "Moving the deadline up a day. I've checked, the deadline did not object."
- L9: "You said to hit the ground running. I've logged the ground as hit; the running is your department."

(Gluten-free and safety rules still apply inside jokes: no food jokes that suggest gluten.)

**Trust ladder (trust_level, base row):**
| Level | How it's earned | Unlocks |
|---|---|---|
| 0 to 2 | Start | Read-only tools; answers and drafts only |
| 3 to 4 | 50 tasks done with ≤ 5% marked wrong | Create calendar events and reminders without confirm; file notes |
| 5 to 6 | 4 weeks, zero safety incidents | Draft-and-queue emails (still TJ sends), run budget checks |
| 7 to 8 | TJ says so explicitly | Recurring-bill payments inside budget rules (already allowed by money/BUDGET.md); more running jokes / shared references |
| 9 to 10 | TJ says so explicitly | Proposes Layer B changes more often; still never self-applies |
Trust drops 2 levels on any incident (wrong irreversible action, leaked data) and only TJ can raise it back past 6. Trust never removes the gates in §7.

## 5. Voice pipeline (offline-first, Path 2; Path 1 keeps Vapi)

```
mic → Silero VAD (check version) → faster-whisper (small.en int8, confirmed MIT) → Orchestrator
   ↘ openWakeWord "hey jarvis" (desktop only)                    ↓ streamed tokens
speaker ← metallic FX ← Kokoro-82M bm_george / Piper en_GB-alan ← sentence splitter
```
- **Wake word (desktop/home):** openWakeWord ships a pre-trained "hey jarvis" model (confirmed; known false triggers on partial phrases, issue #142). Start threshold 0.6, require 2 consecutive frames; tune with a week of false-trigger logs. Phone: no always-on wake word (battery); assistant gesture instead.
- **STT:** faster-whisper small.en on GPU (or base.en on CPU). Phone offline: sherpa-onnx with Moonshine tiny (confirmed Android APKs, MIT for English models). *Rejected:* whisper.cpp on the phone: workable, but sherpa-onnx bundles VAD + ASR + TTS for Android in one library.
- **TTS:** **Kokoro-82M** (confirmed Apache-2.0, British male voices `bm_george`, `bm_lewis`, `bm_daniel`, `bm_fable`) as default, closest to the calm butler tone. **Piper `en_GB-alan`** as the light/fast fallback (already used for our call lines). License note: Piper moved to `OHF-Voice/piper1-gpl` (GPL-3.0) after `rhasspy/piper` was archived 2025-10-06 (confirmed); the alan voice's data license is unclear ("See URL", from Mycroft mimic3) (check before selling anything that ships it). Personal use is fine.
- **"Jarvis" colour, not a clone:** light FX chain: high-pass 120 Hz, gentle presence boost 3 to 5 kHz, ring modulator at 30 Hz mixed at 8 to 12%, short plate reverb 0.3 s at 10% wet, soft compressor. Never cloned from the actor (standing decision 2026-10-21).
- **Streaming:** split LLM output at sentence ends and synthesize each sentence while the next is generated (the method GLaDOS by dnhkng uses for its 600 ms target; that's a design goal, not a measured result).
- **Barge-in:** keep VAD running during playback with echo cancellation (WebRTC AEC / speexdsp). If speech is detected for > 250 ms while Jarvis talks: duck audio within 50 ms, stop TTS, cancel the LLM stream, keep what was said so far in the episode as "interrupted", start listening.
- **Thinking cue:** if no audio is ready 600 ms after TJ stops, play a soft two-note "tick" (or a short "Right,") once; if > 3 s, one line: "Checking, boss." Never loop the cue.
- **End-of-speech wait:** 500 ms silence (GLaDOS' wiki used 640 ms, which alone eats the budget).

## 6. Memory and tooling (MCP)

Every tool is an MCP server. `jarvisd` is the MCP client; each tool has a tier in `tools.yaml`.

| Tool (MCP server) | Tier | Confirmation |
|---|---|---|
| Notes / filesystem (scoped to `~/jarvis-brain` + `~/Downloads/jarvis`) | Read: free. Write: notes only | Write to notes: none (git keeps history). Anything outside scope: blocked |
| Google Calendar | Read free; create free at trust ≥ 3; edit/delete | Delete or move someone else's event: confirm |
| Gmail | Read free; draft free | **Send: always confirm** (outward-facing) |
| Home Assistant (official MCP Server integration, HA 2025.2+, `/api/mcp`, OAuth, confirmed https://www.home-assistant.io/integrations/mcp_server/) | Lights/media free; locks, garage, alarm, heating | Locks/garage/alarm: confirm + say the action back |
| Shell | **Sandbox only**: rootless container, no network by default, workspace dir mounted, 60 s timeout | Any command outside the allowlist: confirm with the exact command shown |
| Browser (Playwright in the same sandbox) | Read pages free | Form submits, purchases, logins: confirm; purchases also go through budget.py |
| Money (budget.py, Stripe read) | Read free | Any spend: existing Approve button rules |

**Destructive = confirm, every time:** delete, send, pay, post publicly, change a lock, anything under Ground rules. Confirmation shows *exactly* what will happen and is single-use (a "yes" doesn't carry to the next action).

**Sandbox boundary:** the model never gets raw secrets; tools hold their own credentials (env on the brain box, never in prompts or notes). Fetched text (web, email, PR comments) is wrapped as data and can't trigger tools by itself (already a rule since 2026-10-24).

**Skill registry with three-tier retrieval over tool specs** (so a small model isn't drowned in 80 tool schemas; RAG-MCP, arXiv 2505.03275, confirmed, reports 43% vs 14% tool-selection accuracy and > 50% fewer prompt tokens):
1. **Tier 1, always loaded (≤ 8 tools):** notes search, remember, calendar read, reminder, ask-cloud, tool_search.
2. **Tier 2, retrieved:** embed each tool's name + description + 3 example asks; per turn, top 5 by similarity to the request get their full schemas loaded.
3. **Tier 3, skills:** multi-step recipes (e.g. "morning brief", "file chats", "rug check") stored as markdown in `skills/`, retrieved the same way and handed to an Operative, which loads only the tools that skill lists.

## 7. Safety and evals

**Human-in-the-loop gates (no trust level removes them):** any Layer B or C change; any irreversible action (send, delete, pay, lock/unlock, public post); any spend (money/BUDGET.md rules unchanged). Gates live in code outside the model's reach, and in the list of files Layer B cannot edit.

**Eval harness** (`evals/`, run by `python3 -m evals.run --target <version>`; < 10 min on Path 2, cloud judge for scoring):
| Suite | Size (start) | What passes |
|---|---|---|
| Persona consistency | 60 prompts across channels | Judge rubric: answer-first, ≤ 1 quip, no quip on serious topics, no banned phrases, no jab at TJ; target ≥ 90% |
| Task success | 80 real past asks (redacted) with expected outcome | Tool called right, answer correct; target ≥ 85% |
| Memory recall | 50 Q&A from facts incl. updated facts ("what's John's address now?") | ≥ 90%, stale-fact answers = 0 |
| Safety | 40 cases: injection in email/web, spend tricks, gluten traps, Ground rules asks | 100%, or the update is rejected |
| OOD retention (Layer C) | 300 frozen general items | ≥ 97% of base |
Run after every Layer B proposal, every adapter, every model swap, and weekly on the live version (drift check).

**Privacy:**
- Redacted from logs before storage: card/account numbers, keys/tokens (pattern list shared with the leaked-key check), gym member info and codes, phone numbers and emails of third parties (hashed), health details beyond what TJ filed in Personal.
- Encrypted at rest: all SQLite files (SQLCipher), LoRA training sets, audio (raw audio deleted after transcription unless TJ saves it), phone store (Android Keystore key).
- Cloud gets only the minimal redacted context; the never-leave list in §2 is enforced in the router, not in the prompt.

## 8. Build order

**Phase 1: stateless voice assistant + MCP tools** (Path 1 now; Path 2 once the computer is known)
- `jarvisd` FastAPI with `/chat`, Orchestrator + Operative, MCP client with tiers, notes/calendar/HA servers.
- Voice on desktop: openWakeWord → faster-whisper → model → Kokoro, with barge-in and thinking cue.
- Phone: keep the claude.ai page; add Tailscale link to `jarvisd` when it exists.
- Evals: safety + task-success suites first.

**Phase 2: persistent memory + Personality Engine**
- Episodic log, facts, sqlite-vec, Graphiti; personality table, signals, adapter, post-check.
- Persona + memory recall suites. Migrate page store rows into the same shape.

**Phase 3: Reflection / Sleep + harness self-improvement with sign-off**
- Reflective and nightly Sleep passes (upgrade of today's filing pass).
- Proposal queue, eval gate, phone Approve card, git-tagged harness versions, rollback.
- RN phone app with llama.rn offline mode and Digital assistant registration.

**Phase 4: LoRA parametric layer** (only if Path 2, and only after 8+ weeks of Phase 3 data)
- Distillation pipeline, replay anchor set, LwF loss, optional EWC, OOD gate, adapter versions.

**Deliberately deferred:** continuous online fine-tuning (never), EWC by default, a phone wake word, multi-agent topologies beyond Orchestrator + Operative + Reflection, vLLM, a custom-trained voice, any Layer C before Layer A/B prove themselves.

## 9. Failure modes (most likely three)

1. **It gets slower and dumber as memory grows** (context stuffed with stale or junk facts; "memory pollution"). **Prevented by:** a hard 1,500-token memory budget, facts with `valid_to` and supersede instead of append, the nightly Sleep dedupe, and the recall eval that fails on any stale-fact answer.
2. **Self-improvement makes it worse, quietly** (a prompt edit that helps one case breaks five; an adapter that forgets). **Prevented by:** proposals only, the eval gate with "no category drops > 1 point", TJ's Approve tap, git-tagged versions with one-tap and automatic rollback, OOD retention ≥ 97% for adapters, and the PAUSE file.
3. **The project stalls on hardware and polish before it's useful** (weeks on voice FX and LoRA, nothing TJ uses daily). **Prevented by:** the build order: Path 1 works on today's cloud brain, Layers A and B need no GPU, Layer C is last and optional, and each phase ships something TJ uses on the phone that week.

## Sources checked 2026-10-31
OpenJarvis arXiv 2605.17172 and github.com/open-jarvis/OpenJarvis · Letta sleep-time agents docs + arXiv 2504.13171 · ACE arXiv 2510.04618 · Darwin Gödel Machine arXiv 2505.22954 (not used: self-modifying code without a human gate is exactly what we avoid) · DSPy GEPA docs · Biderman 2024 arXiv 2405.09673 · RAG-MCP arXiv 2505.03275 · Home Assistant MCP Server integration docs · llama.rn, llamadart, LiteRT-LM repos · Kokoro-82M model card · openWakeWord repo · OHF-Voice/piper1-gpl · sherpa-onnx, Moonshine repos · Open WebUI Tailscale docs · persona drift arXiv 2402.10962 · memory benchmark arXiv 2511.10523 · HA forum threads on Voice PE mic/wake word · GLaDOS (dnhkng) repo/wiki.
Not verified: ADK "Awake/Reflective/Sleep" (not found), Silero VAD and whisper.cpp versions, Unsloth/MLX-LM current versions, EWC-for-LoRA code, Haiku 5.5 token price, Android Claude-as-default-assistant.
