---
name: skill-scout
description: Decide which skills Claude should learn next, based on the work TJ actually does. Use when TJ asks what skill would help, during the Monday tidy-up, or when the same multi-step job has been done by hand three or more times.
---

# Skill scout: pick the next skill from real work

Goal: one or two skills that save real time, never a pile. Every pick goes through [[vet-ai-tool]] before install.

## 1. Look at the work (last 2 weeks)
- `git log --since="14 days ago" --oneline` in each repo, this week's note in Weekly, [[To do]], and recent project threads.
- List jobs that repeated (3+ times), jobs that went wrong or needed redoing, and jobs coming up soon (check [[To do]] and the money plan).
- Check what we already have: `.claude/skills/` in each repo, built-in skills (skill-creator, docx, xlsx, pdf, pptx, dataviz, deep-research), and [[AI tools to use and avoid]].

## 2. Name the gaps
For each repeated or upcoming job, write one line: the job, how often, minutes it costs, and whether a skill would fix it (a fixed procedure, a checklist, a house style) or not (one-off work, needs a paid tool, judgement calls).

## 3. Find candidates, in this order
1. **Write our own** with the built-in skill-creator when the procedure is ours (brain filing, site builds, gym installs). Safest: we wrote every line.
2. **Anthropic's own skills** (github.com/anthropics/skills) and the built-in list.
3. **Well-known public skills** (many stars, recent commits, readable license). Search GitHub; never use `npx skills add` or any auto-installer.

## 4. Vet, then rank
- Run every outside candidate through [[vet-ai-tool]]. Markdown we have read, free, no keys, or it is out.
- Rank by: minutes saved per week x how sure we are it will trigger and help. Drop anything that duplicates a skill we have.

## 5. Report and record
- Give TJ one clear pick (two at most) with the four voices and a "do next" list. Install only after his OK, unless he already asked for it.
- Record every verdict in [[AI tools to use and avoid]], and a line in this week's note.
