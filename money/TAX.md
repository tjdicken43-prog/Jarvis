# Tax: set aside, file, pay

TJ's ask (2026-10-24): know every tax before the money comes in, and make each monthly and quarterly payment one Approve tap. Researched 2026-10-24 (sources below). Estimates, not tax advice: **a CPA checks the method once before the first quarterly payment** (one visit, about $150 to $300 (check)).

Jarvis can't file or pay. `money/tax/tax.py` works out the numbers; the **Taxes** sheet (wallet icon, then Taxes) shows each filing with its numbers and the official payment page. TJ taps **Approve** (opens the page, he types the numbers and pays), then **I paid it**. Jarvis backend copies paid ones into `money/tax/paid.csv` (from `tax/<id>` in the page store, status `paid`) and refreshes the page.

## The money flow

1. A client pays through Stripe into TJ's business bank.
2. Same day, move the tax share to a separate **tax savings** account: **all sales tax collected + 25% of profit** (the sheet shows the exact %, it rises if the year's pace puts him in a higher bracket).
3. Filings are paid from tax savings. **Taxes never go on the business card** (money/BUDGET.md).

`python3 money/tax/tax.py setaside monitoring 149` prints it for one payment.

**Tracking the tax savings account (TJ approved 2026-10-24):**
- Every paid Stripe invoice lands in the agency API's `payments` table. Jarvis backend pulls `GET /payments?since=...` (operator token) and runs `python3 money/tax/tax.py import FILE.json` to add them to income.csv. Gym invoices from the Gym-security Stripe go in by hand until that side has the same hook.
- `money/tax/pot.csv` is the account: money in (positive), money out for anything but a filing (negative). Paid filings come out through paid.csv.
- The Taxes sheet shows the balance, what should have gone in so far, and what's due in the next 45 days. When it's behind, it shows the amount and an **I moved it** button (writes `taxpot/<id>` in the page store; Jarvis backend appends it to pot.csv with `tax.py moved AMOUNT` and sets `filed: true`). If the account can't cover what's due in 45 days, the sheet says so first and the wallet lights up.
- TJ's bank rule: **move 25% of every Stripe deposit into Tax savings, automatically.** That covers the receptionist (needs ~15%) and setup (25%). A gym payment needs ~30%, so the sheet asks for the small top-up. Extra saved stays as a cushion for April.
- Approve on a filing opens IRS Direct Pay or ATAP, both bank debit (ACH) from Tax savings: no card fees.

## What gets taxed (Arkansas sales tax, 9.5% in Bentonville)

State 6.5% + Benton County 1% + Bentonville 2% = 9.5%. Charged on top of the price, so it doesn't cut margin.

| Item | Sales tax | Why |
|---|---|---|
| AI receptionist $149 / $249 | No (likely) | Software used online, nothing downloaded. Rule GR-25 taxes only software on a disk/drive. No DFA ruling on SaaS, so we ask in writing. |
| $299 setup | No | Not a listed taxable service; sets up a non-taxable one. |
| Website build, hosting | No | Custom programming isn't taxable (GR-25(H)(2)); hosting isn't a listed service. |
| Gym security $200 + $100/entrance | **Yes, 9.5%** | Security and alarm monitoring is taxable (rule GR-9.12). Treated as taxable until DFA says otherwise. |
| Camera kit at cost (~$275) | **Yes, 9.5%** | Goods. Buy it tax-free for resale (form ST391 with the permit number), charge the gym the tax. |
| Install labor, own invoice line | No | Alarm installation isn't taxable (GR-9.12). |

**Before the first gym invoice or kit sale:** sales tax permit on ATAP, $50 one time. Returns due the 20th of the next month (next workday if a weekend); file even at $0. Timely-filing discount about 2% (check).

## Etsy sales (TJ, 2026-10-25: same tax setup as everything else)
- **Sales tax: Etsy handles it.** Etsy is a marketplace facilitator. Etsy's seller handbook lists Arkansas among the states where it collects and remits on its orders (from 2019-07-01; Etsy's page blocks this cloud's fetcher with a 403, so that date comes from a search summary of it, checked 2026-10-25). Arkansas law puts the duty on the facilitator ([DFA remote sellers and marketplace facilitators](https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/remote-sellers/)). So: add no sales tax to Etsy prices, and never put Etsy orders on our ET-1 as ours, or it gets paid twice.
- **Permit:** a Sales Tax Institute summary of a DFA letter opinion says a seller that only sells through a marketplace needs no gross receipts permit and files no returns (secondary source, about six years old). We get the permit anyway for the gym, and the sheet leaves Etsy sales off the return and says so on it.
- **Digital items:** Arkansas taxes "specified digital products" (digital audio, audio-visual, digital books, digital codes; [DFA notice on Act 141 of 2017](https://www.dfa.arkansas.gov/wp-content/uploads/CandySoftDrinkDigitalProducts.pdf)). Planners, trackers and fillable forms aren't "works generally recognized as books", so likely not taxed, but it doesn't matter while Etsy collects. It would matter for anything sold on our own site.
- **Income and self-employment tax: full, same as the agency.** Etsy income is business profit on Schedule C. `tax.py etsy-import` copies the Etsy lane's `money/lanes/sales.csv` (booked net of Etsy fees and refunds) into income.csv as item `etsy`; the lane's card charges are already costs in the ledger. The federal and Arkansas estimates, the 25% floor set-aside and the Approve filings (quarterly, April) then include it with no extra steps. Net earnings of $400 or more owe SE tax even if Etsy never sends a form.
- **1099-K:** Etsy Payments reports to the IRS only above $20,000 and more than 200 transactions for 2026 (restored by the 2025 budget law; secondary sources, not IRS text, checked 2026-10-25). Under that, the income still counts.
- **Tax before surplus:** money for the card's top-up is only what's left after the tax set-aside. See money/LANES.md.

## Income tax (single-member LLC = Schedule C on TJ's own return)

- **Self-employment tax** 15.3% on 92.35% of profit (Social Security part stops at $184,500 for 2026).
- **Federal income tax** at TJ's bracket after the $16,100 standard deduction and the 20% QBI deduction (made permanent in 2025). 2026 brackets: 10% to $12,400, 12% to $50,400, 22% to $105,700.
- **Arkansas** top rate 3.7% for 2026 (check: secondary source).
- His J Street wages stack under the business profit, so `w2_wages` in tax.json makes the number right (TJ tells Jarvis the yearly figure).

**Quarterly estimates (federal 1040-ES + Arkansas AR1000ES), same dates:** Apr 15 (Jan-Mar), Jun 15 (Apr-May), Sep 15 (Jun-Aug), Jan 15 (Sep-Dec). Weekends move to Monday. The sheet pays as you go: each quarter pays the tax on profit to date minus earlier quarters. No federal penalty if the year owes under $1,000, or he pays 90% of this year / 100% of last year. First likely payment: **2027-01-15** for Nov-Dec 2026 income.

**Yearly:** 1040 + Schedule C/SE and Arkansas AR1000F by Apr 15. Stripe sends a 1099-K only over $20,000 and 200 payments; income counts either way.

## Other deadlines that could catch us (in the same sheet, Done tap)

| What | When | Applies |
|---|---|---|
| Bentonville business registry | Within 60 days of starting; renew Nov 1 to Dec 31. $15/yr per city FAQ (check). Type A home occupation may be exempt (check). | Once there's income |
| Arkansas LLC franchise tax | $150, May 1 each year after the LLC is formed. Late: $25 + interest. | Set `llc_formed` in tax.json |
| 1099-NEC | Jan 31, to any contractor paid $2,000+ (2026 rule, check). W-9 before the first payment. | Set `has_contractors` |
| Insurance renewal | 30 days before the renewal date. | Set `insurance_renews` |

Already handled in code (checked 2026-10-24): CAN-SPAM footer with postal address and one-click unsubscribe (agency mailer, sends nothing without `MAILING_ADDRESS`); receptionist opens with "automated after-hours assistant, this call may be recorded" (Arkansas is one-party consent; disclosure covers callers from two-party states); domain, Workspace and Render renewals run through money/BUDGET.md.

Not deadlines, still rules: keep every receipt and the ledger 7 years; keep a mileage log (date, miles, place, purpose); never put gym cameras in locker rooms, showers or restrooms (Ark. Code 5-16-101); a breach of member images or faceprints means notifying people within 45 days and the Attorney General if over 1,000 (Ark. Code 4-110-105); answer every Stripe dispute before its due date (7 to 21 days, $15 fee).

## Prices after tax (TJ's call; TJ 2026-10-24: undercut the market, still enough profit to be passive income)

| | Price | Our cost | Profit | Set aside 25% | Kept per client |
|---|---|---|---|---|---|
| Front Desk | $149/mo | ~$60 (Vapi 300 min + hosting) | $89 | $22 | **$67/mo** |
| Plus | $249/mo | ~$125 (800 min) | $124 | $31 | **$93/mo** |
| Setup | $299 once | ~$0 | $299 | $75 | **$224 once** |
| Gym, 1 entrance | $200/mo + $19 tax | ~$10 | $190 | $48 | **$142/mo** |
| Gym at $149 (option) | $149/mo + $14 tax | ~$10 | $139 | $35 | **$104/mo** |
| Camera kit | $275 + $26 tax | $275 | $0 | $0 | $0 |

Clients for a monthly take-home (after the 25% set-aside):

| Take-home | Front Desk only | Plus only | Gyms at $200 | Gyms at $149 |
|---|---|---|---|---|
| $1,000 | 15 | 11 | 8 | 10 |
| $3,000 | 45 | 33 | 22 | 29 |
| $5,000 | 75 | 54 | 36 | 49 |

Market (looked up 2026-10-24, vendor and review sites, check before quoting):

| Who | Price | Note |
|---|---|---|
| Human answering service | $250 to $800/mo | Ruby from ~$250, traditional services $500 to $800 |
| Smith.ai | ~$95 AI only, ~$292 with humans | add-ons push it higher |
| DIY AI apps (Rosie, Goodcall, Dialzara) | $29 to $99/mo, Dialzara $199 for 500 min | owner sets it up alone, no site, no local help |
| Camio (gym tailgating) | from $125/door/mo | needs cameras and access control already in place |
| Kisi (gym access + tailgating) | ~$99 base + ~$100 tailgating add-on, ~$800 setup | reseller figures |
| GymMaster tailgating camera | ~$400 one time | hardware only, install extra |

Verdict:
- **Agency: keep $149 / $249 / $299.** It undercuts what a trade actually compares it to (a human answering service at $250+, Smith.ai with people at ~$292) and it's done for you with the site. It's above the DIY apps, so the pitch says "set up and run for you, local". Profit holds: $67 to $93 a client.
- **Gym: $200 is above the market** (Camio $125/door, Kisi ~$199 all in plus $800 setup). To undercut and still keep it passive: **$149 first entrance + $79 each extra** (TJ's call). It beats Kisi by about 25% with no setup fee, and we bring the cameras. It still keeps $104 a gym. Founding gyms get the lower price automatically ("lower of locked vs list").
- Either way, gym quotes and Stripe invoices add **"plus Arkansas sales tax"** on monitoring and the kit, or the 9.5% comes out of our price.

Sources: https://dupple.com/learn/best-ai-receptionists , https://www.lowcode.agency/blog/best-ai-receptionist-for-small-business , https://fast.io/resources/smith-ai-review-2026.md , https://camio.com/gyms , https://pages.getkisi.com/hubfs/Industry-specific%20PDFs/Kisi-Fit-Tailgating-ROI-Calculator.pdf , https://docs.gymdesk.com/hubfs/MKT1547-Gymdesk-Door-Access-Onepager%20(3).html?hsLang=en , https://www.gymmaster.com/hardware/tailgating-detection-system/

## Questions sent to Arkansas DFA (Sales.tax@dfa.arkansas.gov, keep the reply)

1. Is remotely accessed AI phone-answering software with a monthly fee taxable?
2. Is camera and software monitoring of gym entrances "security and alarm monitoring" under GR-9.12?
3. Is install labor taxable when billed on its own line next to a taxable kit?

## Sources (checked 2026-10-24)

- Arkansas sales and use tax, 6.5% state rate, use tax: https://www.dfa.arkansas.gov/excise-tax/sales-and-use-tax/
- Due dates: https://www.dfa.arkansas.gov/excise-tax/sales-and-use-tax/due-dates/
- Bentonville 9.5% combined (secondary): https://www.salestaxhandbook.com/arkansas/rates/bentonville
- Rule GR-25 software and computer services: https://www.law.cornell.edu/regulations/arkansas/006-05-06-Ark-Code-R-SS-25
- Rule GR-9.12 security and alarm monitoring: https://regulations.justia.com/states/arkansas/agency-006/division-05/gross-receipts-tax-rules/rule-006-05-08-004-gr-9-12
- Resale certificate ST391: https://dfa.arkansas.gov/wp-content/uploads/ExemptionCertificate.pdf
- Estimated taxes and safe harbor: https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes
- 2026 brackets, $16,100 standard deduction (Rev. Proc. 2025-32): https://www.journalofaccountancy.com/news/2025/oct/annual-inflation-adjustments-announced-for-tax-year-2026/
- QBI permanent, 2026 minimum: https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
- 1099-K back to $20,000 / 200: https://www.irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000
- Arkansas 3.7% top rate for 2026 (secondary): https://tax.thomsonreuters.com/news/arkansas-cuts-individual-and-corporate-income-tax-rates/
- Arkansas estimates and deadlines: https://www.dfa.arkansas.gov/office/taxes/income-tax-administration/individual-income-tax/deadlines-extensions/
- LLC franchise tax $150, May 1: https://www.sos.arkansas.gov/uploads/LLC1_FT_2024.pdf
- Bentonville business registry: https://www.bentonville.ar.gov/FAQ.aspx?QID=256
- CAN-SPAM: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- IRS record keeping: https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records
