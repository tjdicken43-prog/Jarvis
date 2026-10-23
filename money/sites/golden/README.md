# Golden sites

The 3 golden sites that `money/SITE_BAR.md` requires before any outreach. Built 2026-10-23, hand-made (not `build.py`'s template).
Each folder is a static page: `index.html` plus its self-hosted fonts. Concept bar and `noindex` stay on until a site is sold.
Scorecard for Tj and the two other scorers: https://claude.ai/artifact/2pAMYGiriYdHEBAkZnjfxX
Trade kits built from these sites: `../trades/` (round 3, 2026-10-23: each site got customer tools for its trade).

| Site | Trade, town | Lighthouse mobile (perf / a11y / best / SEO*) | Weight |
|---|---|---|---|
| one-call-hvac | HVAC, Bentonville | 100 / 100 / 100 / 100 | 58 KB |
| johns-quality-roofing | Roofing, Bella Vista | 100 / 100 / 100 / 100 | 146 KB |
| its-plumbing | Plumbing, Rogers | 100 / 100 / 100 / 100 | 139 KB |

\* SEO is 60 with the preview `noindex` on, 100 with it off. Checked at 375, 390 and 1280 px: no sideways scroll, no console errors, all taps 48 px or more.
No business has been contacted.

## House style (Tj, 2026-10-23)
Round 1 scores from Tj: John's Roofing 8/10, the other two 6/10. Tj: go with the John's Quality Roofing layout ("the cleanest UI by far"), with nothing that gives away that AI built it.
- One plain workhorse font (Libre Franklin), self-hosted. No serif-on-cream, no terracotta, no italic accent words, no invented logos.
- Dark hero band with the trade's own texture at the bottom (shingles, vent slats, pipe), with a white form card beside the headline.
- Plain headline that names the job and the town. Hours and one proof point under it.
- Sections: reviews (when real ones exist), "The work" ruled list, area, then the contact details. A sticky two-button bar on phones.
- Each site still gets its own colors, texture, copy and order (call first for emergency trades, the form first for project trades).

## Sources (every fact on the pages comes from these, read 2026-10-23)
- **One Call Heating, Cooling & Refrigeration:** https://onecallnwa.com/ . Phone (479) 273-2914, "24/7 Emergency Service", "over 30 years of experience", "Licensed & Insured", "All Major Credit Cards Accepted", tagline "One Call Solves All", twice-a-year maintenance, brands American Standard, York, ClimateMaster geothermal, the 33 towns. No street address or hours on their site, so none on ours. Map dots are approximate town centers.
- **John's Quality Roofing:** https://johnsqualityroofing.com . Phone 479-426-7931, jqroofingsystems@gmail.com, 5 Cromer Drive, Bella Vista, AR 72715, Mon to Sat 7 am to 7 pm, 24/7 emergency response, services, service area (incl. Fort Smith, Garfield, SW Missouri), "license and insurance", "premium roofing materials", "strong warranties" (no terms given). Six review quotes with names are the Google reviews shown on their site.
- **It's Plumbing:** https://itsplumbingnwa.com/ . Phone (479) 866-6310, itsplumbingnwa@gmail.com, 14123 Pleasant Ridge Rd. Rogers, AR 72756, Mon to Fri 8 am to 5 pm, Master Plumber MP-6881, "locally-owned", services, three named reviews.

## Round 4: real brand and photos (2026-10-23, Full-network environment)
- **Logo colors** (measured from their logo files): John's red #d80028 (buttons #c8102e), It's Plumbing blue #218aee (buttons #1462b0 for AA contrast), One Call blue #106494. All three sites use them now.
- **Logos:** John's and It's Plumbing headers use their real logo files (`logo.webp`). One Call's logo only exists inside a 100 px banner, too small to reuse.
- **Where the photo and logo files live:** in project files (`sites-by-tj/golden/<site>/`) and on the private scorecard, not in this repo. The repo is public, so `.gitignore` keeps them out. Copy them next to `index.html` before you open a site locally.
- **Photos used:** `johns-quality-roofing/job-bella-vista-roof.webp`, a finished roof posted to John's Google profile in July 2026. `its-plumbing/owners.webp`, Matt and Rachel Gifford from itsplumbingnwa.com/about-us/. Preview only. Get the owner's OK before going live, and never use them in demos or our portfolio.
- **Photos skipped:** every photo on johnsqualityroofing.com is stock, and most of John's Google photos look AI-made. It's Plumbing's site and Google posts are mostly stock with their logo on top. They have one real crew photo on Google, but it's only 400 px wide, so ask for the original. One Call has no Google photos and only product shots on its site.
- **Before shots** (390 px phone) and the **competitor side-by-side** are on the scorecard. Rivals: Paschal (HVAC), Brown Boys Roofing, Benjamin Franklin Plumbing Rogers. Lighthouse mobile performance: Paschal 41, Brown Boys 25, Ben Franklin 29, against 100 for ours. Ours wins on speed and the first screen (no pop-ups, call button visible). The rivals win on big real photos, which is the remaining gap for One Call.
- **It's Plumbing phone (check):** on a phone their site shows (479) 265-1359, while the page source says (479) 866-6310. It's probably a call-tracking swap, so ask the owner which number to use.

## Still open (check)
- Real job photos for One Call, and more for the other two: ask once they reply.
- Scores from Tj and two other people on round 4.
