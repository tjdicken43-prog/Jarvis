# Trade kits

One kit per trade. When we pitch a new business in a trade we already have, start from that trade's kit and its golden site. Then make it theirs: their facts, colors, photos, towns and reviews. Tj, 2026-10-23: "look at it as if you were them and their customers... save those templates to reference."

| Trade | Kit | Golden site (reference build) |
|---|---|---|
| Roofing | [roofing/KIT.md](roofing/KIT.md) | `../golden/johns-quality-roofing/` |
| HVAC | [hvac/KIT.md](hvac/KIT.md) | `../golden/one-call-hvac/` |
| Plumbing | [plumbing/KIT.md](plumbing/KIT.md) | `../golden/its-plumbing/` |

Every site must also meet [../PREMIUM.md](../PREMIUM.md): hero proof, a 3-step strip, pick-a-time booking, photo upload, desktop nav and an area map.

## How to use a kit
1. Collect the facts on the kit's checklist, each with a source (their site, Google profile, Facebook). Anything you can't source stays out.
2. Copy the golden site's `index.html` and font file into a new folder, then replace every fact. Search the copy for the old business's name, phone and towns, and none may remain.
3. Pick their colors from their logo (see Photos and logo colors below). Swap the hero texture only if the trade differs.
4. Keep every customer tool in the kit. The tool copy is general trade advice that is safe for any business in that trade. Change only the lines that name the business (hours, phone, services they actually offer).
5. Run the site bar checks (`../../SITE_BAR.md`): banned words, 375/390 px, Lighthouse, facts against sources.

## Photos and logo colors (2026-10-23)
What we learned on the 3 golden sites: most small-trade sites use stock photos, and some Google profiles are full of AI-made images. Real job photos are rare, so don't spend a long hunt on them before the first email.
1. Run `node ../tools/photo-sheet.js <slug> <site-url> "<Name Town AR>"` once (Full-network environment; `npm i playwright sharp`). It saves the 390 px "before" shot, a numbered `sheet.png` of every image from their site and Google profile, and `sources.txt`.
2. Look at `sheet.png` once. Keep only photos that are clearly theirs: their logo, owners, crew, trucks, finished jobs. Skip stock (studio light, models, watermark-style shots) and AI-made images (too-perfect houses, odd details).
3. Take the colors from their logo file, not a guess. Use the darkest logo shade that passes AA (4.5:1) for buttons and links.
4. WebP, 720 px wide or less, under 150 KB, `loading="lazy"`, real `alt` text and a caption that says where it came from.
5. If nothing usable turns up, keep the trade texture and ask for 5 job photos once they reply.
Their photo and logo files never go in this public repo (`.gitignore` blocks `*.webp` under golden/ and shops/). Keep them in project files. Rule: their photos are only for the private preview sent to that owner. Get the owner's OK before going live, and never use them in public demos or our portfolio.

## House style (all trades): layout B, Paschal style (Tj, 2026-10-23)
Tj scored the Paschal-style layout 10/10 and chose it for every site. Start each new site from its trade's golden `index.html`. The old dark-band layout is kept as `layout-a.html` for reference only.
- A white sticky top bar: their real logo, the section nav, the phone and a pill "Get a quote" / "Book a visit" button.
- Hero: their own photo full-width behind the headline when they have a strong one (`johns-quality-roofing`). Otherwise use a navy band with the trade texture (`one-call-hvac`, `its-plumbing`). The headline names the job and the town.
- A white "Why <town> calls <name>" panel overlaps the hero, with 4 navy cards of sourced facts (hours, 24/7, license, local).
- The 3-step strip, then the full form on a navy band, then card-style reviews (stars only if their source shows the rating), trade tools, service cards, FAQ, area and contact. Sticky Call / Quote bar on phones.
- One plain font (Libre Franklin), their logo colors, and their navy if they use one. No stock people, no invented logos.
- Pro upgrades to consider (option C, `johns-quality-roofing/layout-c.html`): a top emergency bar, the phone number written out in the header, the Google star rating under the headline, a 2-field quick quote card in the desktop hero, 2-by-2 trust cards on phones and a final CTA band.

## Adding a new trade
Write its kit the same way. Start with who calls and why, what they're scared of, what they need to decide, and what the owner wants fewer of (wasted trips, tire-kickers, phone tag). Turn each answer into a section or a small tool on the page.
