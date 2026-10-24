# Premium standard: what pros put on trade sites that owners pay for

Tj, 2026-10-23: "These need to be premium websites every time we cold email someone." This file sits on top of `../SITE_BAR.md`. The bar stops a bad site; this file says what a site a pro would charge for must have.

Researched 2026-10-23 from agencies that build and sell contractor sites (sources at the end). Most are sellers writing about their own trade, so I kept only what several agree on. Their stats are mostly unsourced or self-reported, and I left them out.

## What buyers pay for (agency price sheets)
- A 5-page local service site (plumber, HVAC, roofer) from an agency runs **$4,000 to $8,000**. That covers discovery, design, build, copywriting and SEO setup (bknd, one agency's own price sheet).
- The step up to $7,500+ is mostly **more pages plus online booking** (same source).
- Our $499 to $999 is far below that. Our edge is a finished preview of *their* site before they pay anything. So the preview has to look like the $5,000 one.

## The premium checklist (every preview, every time)
Things several pro sources agree on. ✅ = in the golden sites now. 🔒 = needs their real material first.

**First screen (phone)**
1. ✅ Plain promise with the job and the town ("Roof repair and replacement in Bella Vista").
2. ✅ One-tap call that stays on screen (sticky bar), plus a specific button ("Get a quote", "Call 24/7").
3. ✅ Proof right in the hero: a real review line with a name, or real brand names they install. Pros put the star rating and review count in the hero. 🔒 Only with a sourced count.
4. ✅ Emergency line in view for emergency trades.

**Lead path**
5. ✅ A short form: name, phone and the job. Everything else is optional.
6. ✅ Pick-a-time soft booking (preferred day plus morning or afternoon, "we confirm by phone"). Pros say it beats a form that feels like a black hole.
7. ✅ Photo upload on the form.
8. ✅ A 3-step "what happens next" strip. Pros say it lowers buyer nerves.

**Trust**
9. ✅ Real reviews with names, linked to the source.
10. ✅ Licenses, insurance, brands and warranty, only as they word them.
11. 🔒 Real photos: their crew, trucks and jobs (before and after). Every source puts this near the top. **This is our biggest gap.** See "Photos" below.
12. 🔒 Financing, certifications (GAF, NATE), BBB and awards, only if sourced.

**Usefulness (what made round 3 better)**
13. ✅ A trade tool: the roof check, HVAC troubleshooter or plumbing problem picker.
14. ✅ An FAQ with FAQPage schema.
15. ✅ The service area in text and on a map.

**Polish**
16. ✅ Desktop nav to each section. Clean on phone (no hamburger needed for one page).
17. ✅ Lighthouse mobile 90+ (ours are 100), WebP images under ~150 KB, 44 to 48 px taps, AA contrast.
18. ✅ LocalBusiness and FAQ schema.

**In the paid build (not the preview)**
- One page per service and one per main town (pros' local SEO structure), each with its own form.
- Calls and forms sent to the owner by text right away (pros: leads go cold in minutes). This is Front Desk.

**Front Desk on every preview (2026-10-24)**
19. ✅ A "Calling after hours?" section for customers: the answering assistant, what it asks, and the trade's safety line. Honest that it's automated.
20. ✅ An owner-only panel at the bottom (comes off at go-live): a sample after-hours call labeled as an example, the next-morning call log, and the two plans with our prices. Nothing else on the page names a price.
- A gallery sorted by job type once they send photos.

## No AI tells (Tj, 2026-10-23: "no pill shaped buttons, no AI indicators at all")
A site must not look AI-made to a designer or an owner. Researched 2026-10-23; the sources are design-critique posts and community ban lists, so treat this as consensus, not measured data.

**Never use (giveaways):**
- Pill buttons or pill chips (radius 999px), or round number badges (radius 50%). Buttons and chips get 4px corners, cards and panels 6 to 8px. Everything heavily rounded (16 to 24px) reads as a template.
- Purple, indigo or blue-to-purple gradients, gradient text, blurred glow blobs behind the hero, or glass panels. Colors come from the business's own logo, truck or old site.
- Emoji used as icons, sparkle icons, or a matching icon on every card. Use a few simple inline SVGs, or none.
- The default AI landing page: a centered hero, then three identical rounded cards with icon, title and blurb, all on the same spacing. Vary section shape and density (a ruled list, a numbered strip, a form band, a map).
- Fade-in or slide-in animation on every section.
- Stock people, AI-made photos, or invented logos. Use their real photo, or none.
- Filler copy: "elevate", "unlock", "seamless", "solutions", "we're passionate about", made-up stats or reviews, em-dash-heavy sentences, three-word slogans.
- A default font left untouched (Inter, Poppins, Montserrat everywhere). We use one workhorse sans (Libre Franklin) with a deliberate size scale.

**Do (what pros do):**
- Use real specifics a template can't guess: the town, the license number, the exact hours, review quotes with names, the owner's name, their own photo and logo.
- Write in the owner's plain voice. Short sentences and the job named in the headline ("Roof repair and replacement in Bella Vista").
- Keep a clear type hierarchy (2 to 3 sizes per section) and spacing on a grid, with a few intentional breaks: an overlapping trust panel, a full-width form band.
- Keep it quiet: one accent color on navy and white, flat surfaces, light shadows only where something floats.
- Build real states: form messages, a phone-first sticky bar, focus rings.

Sources: [7 tells that a UI is AI-generated](https://pages.thefountaininstitute.com/posts/7-tells-that-a-ui-is-ai-generated), [Anti AI slop ban list](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list), [Why AI design looks generic](https://www.superdesign.dev/blog/why-ai-design-looks-generic), [Why your AI keeps building the same purple gradient website](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website), [Making an AI-generated app look professional](https://vp0.com/blogs/make-ai-generated-app-look-professional.md), [Typography and AI](https://www.uxstudioteam.com/ux-blog/typography-ai).

## Photos: the unlock
Done 2026-10-23 with a Full-network environment. The finding: real photos are rare (stock on their sites, AI-made images on some Google profiles), so a preview uses the few real ones it finds plus the real logo and colors, and the paid build asks the owner for job photos. How-to and the one-run script: `trades/README.md` ("Photos and logo colors").

## Sources (read 2026-10-23)
- Hook Agency, contractor website trends 2026: https://hookagency.com/blog/contractor-website-design-trends-2026/
- Results Digital, best roofing websites 2026: https://resultsdigitalus.com/best-roofing-websites/
- PlumberSEO, maximum conversion for plumbing/HVAC (sales webinar; client numbers self-reported): https://www.plumberseo.net/how-to-setup-your-website-for-maximum-conversion-for-plumbing-hvac-home-service-contractors-2/
- BuiltRight Digital, roofing website guide (stats unsourced): https://builtrightdigital.com/roofing-website-design-guide/
- bknd Development, small business website costs: https://bknddevelopment.com/marketing/website-design-cost-small-business/
