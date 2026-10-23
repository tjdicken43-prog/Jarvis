# Vendored plugin skills

Copied 2026-10-23 from Anthropic's official plugins (anthropic-plugin-directory), version 1.2.0, Apache 2.0 (LICENSE here):
- marketing: email-sequence, seo-audit, brand-review, competitive-brief
- design: accessibility-review
- engineering: deploy-checklist

Why: TJ wants the 6 useful skills without the 3 whole plugins, which load 25 skills and about 30 connector servers (Ahrefs, HubSpot, Slack, Notion...) into every session and waste usage. Markdown only, no scripts; checked with vet-ai-tool. Each skill sits in its own folder under .claude/skills/.
