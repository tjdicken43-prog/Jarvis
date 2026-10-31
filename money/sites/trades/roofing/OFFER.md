# Roofing offer: gap review (2026-10-31)

Tj has a likely first client, a roofer. This lists what a professional roofing business needs, what we already have, and what is left. Prices: only $299 setup, $149/mo Front Desk, $249/mo Plus and $0.25/min over are set. Everything else is PROPOSED (see ../../../agency/ADDONS.md). All Front Desk switches stay off until Tj turns them on.

## The table

| Roofer needs | What exists | Gap | Done here / next |
|---|---|---|---|
| **Website** that wins quote requests | Golden site, KIT.md, auto mockup (`trade_build.py`), repair-or-replace check, storm steps, photo upload, FAQ schema, sticky call bar | Their real photos, license and insurance wording, warranty terms, financing line | **Built:** `trade_build.py` shows FAQ answers for warranty, financing, free inspection and claim help only when the owner supplies them (`warranty`, `financing`, `free_inspection`, `claim_help`). Facts checklist below |
| **Answering every call** (day and after hours) | Front Desk: message taking, urgent email, warm transfer to owner cell, call recording and transcript, owner page (off) | Storm weeks bring call spikes: 300 min can run out | Pitch Plus ($249, 800 min) to roofers. Over-minutes are $0.25 |
| **Storm and emergency calls** | Roofing emergency words, "stay off the roof" safety line, urgent-first email, transfer | Callers asking "can you come today" | Assistant never promises arrival times (already a rule). Owner decides transfer on or off |
| **Insurance-claim intake** | None | Roofers get claim calls all the time. A wrong word about coverage or deductibles is a legal risk | **Built:** 3 default roofing questions (water coming in now, recent storm and claim planned, roof age) and a rule that the assistant never talks coverage, deductibles or adjusters. Evals added. Owner can replace the questions |
| **Inspection booking** | Booking windows (Plus), pick-a-time form on the site, Google calendar sync built | Calendar sync untested live. "Free inspection" only if the owner says so | Ask the owner. Booking is a window, team confirms |
| **Estimates** | Quote form with photos; Quote Assistant is a proposed add-on, not built | Owner writes estimates by hand | Concierge first (below). Build only after a yes |
| **Reviews** | Review replies and weekly post drafts (add-ons, drafts only), review-ask tool | Not offered by default | Offer after month 1. Never offer anything for a review |
| **Lead gen / Google ads** | PLAYBOOK-D-E.md: LSA first, tracked calls | Needs client Google account, call tracking number | Month 3 or later. Proposed prices only |
| **Job photos** | Photo contact-sheet tool; site has slots | Almost every roofer lacks good photos | Ask for 5 finished jobs and 3 storm-repair jobs. No stock, no AI images |
| **Financing** | Nothing | Many homeowners ask | One line on the site and in FAQ **only if the roofer already offers financing**, naming their partner. We never offer or quote it |
| **Google Business Profile** | Checklist in GAP-REVIEW (general) | Roofer-specific list | Checklist below |
| **CRM / calendar** (JobNimbus, AccuLynx) | Owner email per call, .ics feed, Google two-way; Jobber/Housecall stubs | No JobNimbus or AccuLynx link | Day one: the call email is forwarded or pasted. Later: a webhook once the owner shows which tool and its API access (check: plan level needed) |
| **Trust and legal** | Recording and automated-assistant disclosure on every call | License, insurance and warranty claims | Owner gives proof. We print nothing we cannot source. State licensing rules: ask the owner what applies in Arkansas (check) |

## Facts to get from the roofer (each with a source)
Legal name and town; phone, email, hours, emergency line yes or no; towns served; services really offered (repair, replacement, inspections, gutters, siding, metal, commercial, new construction, tarping); license number and insurance (only if they say it, they show proof); warranty wording in their words; materials or manufacturer certifications they hold; financing partner if any; insurance-claim help they really give (explain, photos, meeting adjusters) in their words; real reviews and the Google link; logo file; 8 job photos; the cell for emergency transfer; which CRM and calendar they use.

## Concierge quoting (until Quote Assistant exists)
For each estimate the owner sends: address, roof size or squares, pitch, number of layers, tear-off or overlay, decking repairs expected, flashing and vents, material and color, access issues, photos. We return a clear written draft in their words and prices. They review and send. No invented prices, licenses or guarantees.

## Google Business Profile checklist
Primary category "Roofing contractor", secondary only what is true; service area by town (not a fake storefront address); hours with storm-season notes; every service listed; 8+ real photos, new ones monthly; reviews answered within a day; Q&A seeded with true answers; phone matches the website exactly; weekly post (seasonal tip). Suspended listings come from fake addresses, so don't.

## Rules that stay
Trades only. No AI cold calls or texts. Never promise rankings or lead counts. Never claim insurance help, warranty years, certifications, free inspections or prices unless the owner supplied and can back them. Premium look: square corners, no pill buttons, no AI tells.

## Before go-live (Tj)
Ten Front Desk test calls including an unanswered transfer; the roofer approves the greeting; owner cell confirmed; Twilio 10DLC if texts are wanted; the lawyer glance on recording and terms (money/agency/PRO-PASS.md and the Launch List).
