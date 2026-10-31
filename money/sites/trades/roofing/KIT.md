# Roofing kit

Reference build: `../../golden/johns-quality-roofing/index.html` (Tj scored the layout 8/10 on 2026-10-23, the best of round 1).

## Who visits and why
- **After a storm:** worried, maybe with a leak right now. Needs to know what to do first and that someone will come.
- **Old roof:** wondering "repair or replace?" and afraid of being upsold. Needs a straight self-check and a quote path.
- **Insurance claim:** needs photos, notes and a roofer who shows up.
- **Builders:** want to know the roofer does new construction.

## What the owner wants
Quote requests with the address and photos, so trips aren't wasted. Storm calls routed fast. Fewer "how much for a roof?" calls with no details.

## Page order (project trade: quote form first)
1. Hero: "Roof repair and replacement in <town>." Hours plus emergency line, with a quote form card (name, phone, job type, address, **photos**).
2. Reviews: real quotes with names and a link to all reviews.
3. **Repair or replace?** check (6 signs, live verdict, and the button picks the job type in the form).
4. **After a hail or wind storm:** 4 steps.
5. The work: services they really list.
6. FAQ, plus FAQPage schema.
7. Where we work: town chips. Then call-or-stop-by details, and a sticky Call / Get a quote bar.

**Front Desk (every trade, 2026-10-24):** before the final call band, a **Calling after hours?** section (the answering assistant takes name, number, address and the problem; says it is automated if asked; the trade's safety line). On previews only, an owner panel at the bottom (`#owner`, linked from the concept bar): a sample after-hours call, the next-morning call log, and the two plans. Both come from `trade_build.py` (`after_hours_html`, `owner_html`), so copy and prices stay in one place.

## Reusable tool copy (general, safe for any roofer)
- Signs: roof about 20+ years old; curling, cracked or missing shingles in more than one spot; granules in gutters; leaks in more than one place; dipping roofline; moss or dark streaks over big areas.
- Verdicts: 0 = nothing yet; 1 = likely a repair; 2-3 = get an inspection; 4+ = ask about replacement. Always add "A general guide, not a diagnosis."
- Storm steps: stay off the roof and photograph from the ground; stop water inside (turn off the breaker if water comes through a fixture); call for a look; call your insurer soon (many policies have time limits).

## Facts to collect (with sources)
Name, phone, email, address, hours, emergency line (yes/no), towns, services (repair, replacement, inspections, siding, gutters, new construction, metal, commercial), licensed and insured (only if they say so), warranty wording, materials or brands (only if named), real reviews with names and the link, financing (only if they offer it), and their own job photos.

## Never claim unless sourced
Insurance-claim help, specific warranty years, shingle brands, certifications (GAF, Owens Corning), "free" inspections or estimates, prices.

## Photos
Run `../../tools/photo-sheet.js` once and follow "Photos and logo colors" in `../README.md`. Preview only; the owner's OK comes before go-live.

## Offer gap review (2026-10-31)
See [OFFER.md](OFFER.md) for the roofer gap table, facts list, concierge quoting and Google profile checklist. One-page pitch and checklist: [pitch.html](pitch.html). Front Desk roofing intake and claim rules: `agency/api/receptionist.py` (ROOF_RULES), defaults in `shopcfg.py`.
