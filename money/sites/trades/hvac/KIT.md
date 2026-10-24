# HVAC kit

Reference build: `../../golden/one-call-hvac/index.html`.

## Who visits and why
- **System down right now:** hot or cold, maybe at night. Needs the phone number in one tap and a few safe things to try first.
- **Scared of a gas smell or a burning smell:** needs a plain safety line.
- **Planning ahead:** tune-ups, replacing an old system, curious about heat pumps or geothermal.

## What the owner wants
Fewer wasted trips (a tripped breaker, dead thermostat batteries, a clogged filter). Callers who already know their unit's brand, age and filter size. Steady maintenance work in spring and fall.

## Page order (emergency trade: call first)
1. Hero: a season line (JS: Oct-Mar heating, Apr-Sep cooling) and "Heating and AC repair in <town>, day or night" if they're 24/7, with a big call button and a "Book a visit" form card.
2. **Before you call: quick checks.** Symptom picker: No heat, AC not cooling, Weak airflow, Water by the unit, Noise or smell (with the gas-smell alert).
3. **Have this ready when you call:** what it's doing, brand and age, error codes, filter size.
4. The work: repair, new systems, maintenance, with their brands.
5. **Tune-up reminders** form (preview only until sold), plus explainers for what they sell (geothermal, heat pumps), and FAQ.
6. Where we work: a map with town dots plus the list. Then contact, and a sticky Call / Book bar.

**Front Desk (every trade, 2026-10-24):** before the final call band, a **Calling after hours?** section (the answering assistant takes name, number, address and the problem; says it is automated if asked; the trade's safety line). On previews only, an owner panel at the bottom (`#owner`, linked from the concept bar): a sample after-hours call, the next-morning call log, and the two plans. Both come from `trade_build.py` (`after_hours_html`, `owner_html`), so copy and prices stay in one place.

## Reusable tool copy (general, safe)
- No heat: thermostat on Heat and set above the room; new thermostat batteries; furnace breaker and service switch; filter.
- No cooling: Cool plus fan Auto; both breakers (indoor and outdoor); filter; ice on the lines means turn cooling off, fan On, and call.
- Weak airflow: filter; open vents and clear returns; ice or a stopped fan means off and call.
- Water: system off, keep water from cords, blocked drain line is common.
- Noise or smell: grinding, screeching or burning means off and call. Gas smell means leave, don't flip switches, and call 911 or the gas company from outside.

## Facts to collect
Phone, hours (are they truly 24/7?), towns, services (repair, install, maintenance, refrigeration, ductwork, commercial), brands they install, licensed and insured, payment options, years of experience as they word it, maintenance plan (only if they have one), reviews.

## Never claim unless sourced
Prices, "free" service calls, financing, specific certifications (NATE, dealer tiers), response times.

## Photos
Run `../../tools/photo-sheet.js` once and follow "Photos and logo colors" in `../README.md`. Preview only; the owner's OK comes before go-live.
