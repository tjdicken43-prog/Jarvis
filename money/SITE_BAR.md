# Site bar: what every Sites by TJ site must pass before anyone sees it

TJ, 2026-10-23: "something to be proud of, something worth buying". No outreach goes out until a site passes every line here.
The Builder builds to this bar, the Auditor checks it, and TJ's Approve card shows the result. One fail means the site goes back. No exceptions.

## 1. It must not look like AI made it (instant reject)
Banned on sight. The Auditor greps for these and looks at the screenshot.
- **Words:** elevate, seamless, unlock, unleash, empower, cutting-edge, state-of-the-art, "your trusted partner", "look no further", "we pride ourselves", "one-stop shop", "in today's fast-paced world", "nestled", "testament", "tailored solutions", "peace of mind" as a headline.
- **Copy smells:** three-word slogan headings ("Quality. Service. Trust."), em-dash-heavy sentences, every section opening with a question, emojis in headings, exclamation marks in body copy.
- **Look smells:**
  - purple-to-blue gradients
  - gradient text
  - glassmorphism
  - a row of three identical icon-in-a-circle cards
  - everything centered
  - giant rounded cards everywhere
  - stock "handshake" or "smiling call-center" photos
  - AI-generated people
  - a hero with no real photo or content
- **Fake anything:** made-up reviews, star ratings, years in business, license numbers, "as seen on", awards, team names, or stats. Every fact needs a source in the Checker's notes. If it can't be sourced, leave it out.
- **Placeholders:** "Lorem", "TODO", "{{", "[your", "example.com", "555-", "Business Name", "City, State".

## 2. It must be about THEM (custom, not a template)
- Their real name, phone, service area towns, hours and services, taken from their Google profile, old site or Facebook, with sources.
- Colors come from their logo, truck or old site, not from our template.
- **Photos:**
  - Use their own (Google profile, old site, Facebook) in the preview only, with the concept bar showing.
  - Their photos are their copyright. They go only on the private preview shown to that owner, never on a public demo, our portfolio, the scorecard or socials without their written OK. Get their OK before the site goes live with them.
  - With no real photos, use clean type, a map or a pattern instead. Never stock people.
- Copy is written for their trade and town. "Same-day AC repair in Rogers and Bentonville", not "quality HVAC services".
- At least one specific detail only they have: a real review quote (with a link), their founding year, the brands they service, or a guarantee they actually offer.
- **Layout by trade:**
  - Emergency trades (HVAC, plumbing, electrical, towing): call first.
  - Project trades (roofing, remodel, landscaping): photos and a quote form first.
  - Shops and food: hours, menu or products, and directions first.

## 3. Minimum quality (measured, phone first)
- **Phone sizes:** 375 and 390 px wide with no sideways scroll, no text cut off, and nothing overlapping. Also checked at 768 and 1280.
- **Tap targets:** at least 48 px (Google's guidance). The tap-to-call button is visible without scrolling and stays on screen (sticky bar).
- **Speed:** Lighthouse mobile Performance 90+, Accessibility 95+, Best Practices 95+, SEO 95+. Core Web Vitals in the "good" range: LCP under 2.5 s, CLS under 0.1, INP under 200 ms. Total page weight under 1 MB, with images in WebP or AVIF and sized for the screen.
- **Readable:**
  - Body text 16 px or larger.
  - Contrast at least 4.5:1 (WCAG AA).
  - Two fonts at most.
  - Copy at a 6th to 8th grade reading level.
  - Short paragraphs.
- **Works:**
  - Every link and button works.
  - Phone links use tel:, address links open maps.
  - Forms show a clear "preview only" note until the site is sold.
  - It has a favicon, page title, meta description, LocalBusiness schema and alt text.
  - Zero console errors.
- **Spelling and grammar:** zero mistakes. Names, towns and phone numbers match the sources exactly.

## 4. It must beat their competition
- Before building, the Checker finds the 3 best-looking competitor sites for that trade in NWA.
- Our preview must clearly beat the best of them on a phone, side by side. If it doesn't, it isn't ready.

## 5. The human-eye test (the one that matters)
- **"Would they be proud to show it to a customer?"** and **"Would someone pay $499 to $999 for this?"** Both must be yes.
- **Before the first email ever goes out:**
  - Build 3 "golden" sites (HVAC, roofing, plumbing) for real NWA businesses on the cold list.
  - TJ plus two people who aren't TJ score each from 1 to 10.
  - Outreach starts only when every golden site scores 8 or higher and at least one person says "I'd pay for that".
- The golden sites become the yardstick. Every later site is compared side by side with them on the Approve card.

## 6. It must be premium (Tj, 2026-10-23)
"These need to be premium websites every time we cold email someone." Every preview meets the checklist in [sites/PREMIUM.md](sites/PREMIUM.md), drawn from what pro trade-site agencies build and charge $4,000 to $8,000 for. For a trade we've done, start from its kit in `sites/trades/`.

## How the factory uses this
- **Builder:** reads this file before every build.
- **Auditor:**
  - Runs the checks a script can do: banned words, placeholders, overflow at 375/390, tap target sizes, Lighthouse, links, console errors.
  - Then makes a screenshot judgment on sections 1, 2 and 4.
  - Writes PASS or FAIL with the reason on the card.
- **TJ's card:** shows the score next to the old site vs the new one. A FAIL never reaches TJ; it goes back to the Builder with the reason, 2 tries max, then it's skipped.
- **Waste rule:** a site that fails twice is a lead we skip, not a lead we email with a weak site.

Sources: Lighthouse scores, Core Web Vitals thresholds and the 48 px tap size are Google's published guidance (from memory, check before quoting to clients). The 4.5:1 contrast ratio is WCAG 2.1 AA. The rest is the house standard TJ set on 2026-10-23.
