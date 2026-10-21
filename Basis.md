---
type: business
status: building
---
# Basis

AI workout tracking and nutrition app. Separate from [[SecurityAI]].

- Code: GitHub repo `tjdicken43-prog/basis`, imported 2026-10-21 from the 2026-10-12 backup plus new screens from 2026-10-20. A redesign is underway (check).
- Platforms: Google Play and the App Store.
- Price: $5 a month per person. The code also mentions "$50 a year" (check which is current). See [[Pricing]].
- Brand: black app icon with a gold "B".
- Look: smooth and sleek, subtle sacred geometry with natural and gym touches, switchable backgrounds.

## What's built (from the repo README, 2026-10-21)
- Near-complete app: lifting, food, runs and rides, sleep and recovery, routes for exploring somewhere new, hands-free voice in the gym and on the bike, contest-prep tools, a harm-reduction education library with bloodwork literacy, and a toolkit for personal trainers and gyms.
- Built as a Node API with a React app and Postgres, deployed with a Render blueprint (API, app, two scheduled jobs, database).
- Works without the paid extras: no Stripe means no checkout (trials still run), no email key means no emails, and no Anthropic key means no AI features.
- Lines it never crosses: no drug doses, cycles or sourcing, no diagnosis, no body-fat estimates from photos, adults-only areas closed to under-18s, sensitive data stored only with consent. US only by default.

## Next
- [ ] Bring the existing checks into `npm test` (first item on the repo's roadmap).
- [ ] Finish the redesign (check).
