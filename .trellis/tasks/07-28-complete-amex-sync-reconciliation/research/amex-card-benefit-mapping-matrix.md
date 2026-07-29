# Research: Complete AMEX card and benefit mapping inventory

- **Query**: Build a repository-backed mapping inventory for every American Express card and perk represented in PerksReminder, including proposed stable product/family/period keys, exact observed AMEX aliases where evidence exists, confidence, exclusions, ambiguities, and one-sided gaps, while preserving closed exact matching and independent server authority.
- **Scope**: internal
- **Date**: 2026-07-28

## Executive inventory

- The shared PerksReminder AMEX catalog contains **12 cards and 56 destination benefit rows**: Gold, Platinum, Business Platinum, Business Gold, three Hilton cards, three Delta cards, and two Marriott cards (`src/lib/american-express-card-catalog.ts:30-645`; archived confirmation at `.trellis/tasks/archive/2026-07/07-22-sync-reviewed-amex-benefits/research/schema-catalog-gaps.md:55-70`).
- `src/lib/static-catalog.ts` imports all 12 shared AMEX definitions into the public catalog (`src/lib/static-catalog.ts:86,235-243,274,700`). `prisma/seed.ts` imports that same static catalog and copies key fields only when present (`prisma/seed.ts:1-8,20-99`). There is no competing AMEX contributor template: `card-templates/` contains only its schema, README, and a Chase example.
- Only **one card product key** and **eight benefit rows across two families** are currently populated: `american-express-platinum-card`, Platinum Resy Q1–Q4, and Platinum lululemon Q1–Q4 (`src/lib/american-express-card-catalog.ts:80-84,136-239`).
- Browser destination projection is currently closed to three exact-normalized base-Platinum product aliases and five exact-normalized title aliases covering only Resy and lululemon (`src/lib/amex-benefit-reader/supported-card-credits.ts:54-89`). The server independently authorizes only that product and those two families (`src/lib/amex-sync/authority.ts:4-8`).
- The sanitized archived live review preserved exact evidence for a Morgan Stanley Platinum-like product with ten `usage` titles, a Hilton Honors Card with no eligible usage title, and a Delta SkyMiles Gold Business Card with one eligible usage title plus one `spend` and one catalog-only title (`.trellis/tasks/archive/2026-07/07-27-review-live-amex-reader-data/prd.md:42-49,67-76`; synthetic encoding of the approved outcomes at `src/lib/amex-benefit-reader/__tests__/amex-response-adapter.test.ts:149-229` and `src/lib/amex-benefit-reader/__tests__/scan-engine.test.ts:137-199`).
- The archived report intentionally did not preserve every live product/title combination. Absence of an exact title below means **not found in repository-safe evidence**, not proof that AMEX never exposes a tracker.

## Authority and notation

### Closed authority model that this matrix preserves

1. **Local observation** remains product-independent: exact tracker category `usage`, reviewed title exclusions, and no destination keys in V3 (`.trellis/spec/perks-reminder/browser-read-integrations.md:240-246,272-278`).
2. **Browser projection** may introduce destination keys only for a closed exact-normalized product/title pair; no substring, amount, cadence, ending-digit, or resemblance inference (`src/lib/amex-benefit-reader/supported-card-credits.ts:75-89`).
3. **Server write authority** remains independent and deny-by-default (`src/lib/amex-sync/authority.ts:4-8,337-344`; `.trellis/spec/perks-reminder/browser-read-integrations.md:693-701`).
4. Exact destination resolution requires non-null product/family/period keys and exactly one benefit/status cycle; unresolved records remain unwritable (`src/lib/amex-sync/catalog-backfill.ts:85-100,129-180`; `src/lib/amex-sync/authority.ts:367-395`).

### Proposed period-key vocabulary used in this inventory

These are stable template identities, not occurrence IDs. Only `calendar-quarter-q1` through `q4` currently exist in catalog/runtime authority. All other values are inventory proposals requiring explicit implementation review.

| Proposed period key | Destination shape |
|---|---|
| `calendar-month` | One recurring calendar-month template row |
| `calendar-month-december` | Separate December-only destination row |
| `calendar-quarter` | One recurring calendar-quarter template row |
| `calendar-quarter-q1` … `q4` | Separate fixed-quarter destination rows; already used by Platinum |
| `calendar-half-h1`, `calendar-half-h2` | Separate Jan–Jun and Jul–Dec destination rows |
| `calendar-year` | One fixed calendar-year row |
| `card-anniversary-quarter` | One quarterly row aligned to card anniversary/default rather than fixed calendar quarter |
| `card-anniversary-year` | One annual row aligned to card anniversary/default |

The current server derives only fixed calendar-quarter keys from exact ranges (`src/lib/amex-sync/authority.ts:149-157`) and rejects all rows without one (`src/lib/amex-sync/authority.ts:353-365`).

### Confidence labels

- **Closed / high**: already represented in both exact browser mapping and independent server authority.
- **Exact evidence / high**: exact repository-preserved AMEX product/title evidence and one semantically unique destination counterpart, but not currently authorized.
- **Candidate / medium**: exact title evidence exists, but only on another product, only in a synthetic characterization fixture, or destination period splitting still needs judgment.
- **Catalog-only / low**: destination exists, but no exact AMEX tracker-title evidence was preserved.
- **Excluded**: source evidence is non-credit, linking, spend qualification, access/status, or catalog-only and cannot become a writable usage row.
- **Ambiguous**: user/product judgment is required before any closed mapping can be authorized.

## Card/product mapping matrix

| Destination card | Proposed stable product key | Exact AMEX product alias evidence | Confidence and disposition | Evidence anchors |
|---|---|---|---|---|
| American Express Gold Card | `american-express-gold-card` | `American Express Gold Card` appears in storage/E2E fixtures, but is not preserved as a reviewed live alias. | Candidate / medium; exact canonical fixture only. | Catalog `:31-79`; `src/userscripts/amex-benefit-reader/__tests__/tampermonkey-storage.test.ts:50`; `tests/e2e/amex-benefit-reader/amex-benefit-reader.spec.ts:74` |
| American Express Platinum Card | `american-express-platinum-card` | `American Express Platinum Card`; `The Platinum Card from American Express`; `Platinum Card®` | **Closed / high** for exact aliases. | Catalog `:80-295`; exact map `supported-card-credits.ts:61-88`; tests `supported-card-credits.test.ts:50-84` |
| American Express Business Platinum Card | `american-express-business-platinum-card` | `American Express Business Platinum Card` appears in scan-engine fixtures; archived live review establishes Business Platinum-like Dell/Adobe/One AP evidence but redacts card names. | Candidate / medium; canonical fixture, not a retained live product alias. | Catalog `:296-403`; `scan-engine.test.ts:46,201-213,342-350`; archived PRD `:58,64` |
| American Express Business Gold Card | `american-express-business-gold-card` | No exact repository-safe observed product alias found. | Catalog-only / low. | Catalog `:404-425` |
| Hilton Honors American Express Aspire Card | `hilton-honors-american-express-aspire-card` | No exact repository-safe observed Aspire alias found. `Hilton Honors Card` is a distinct no-fee product and must not map here. | Catalog-only / low; `Hilton Honors Card` exact rejection. | Catalog `:426-480`; exact negative fixture `supported-card-credits.test.ts:88-90`; archived PRD `:69` |
| Hilton Honors American Express Surpass Card | `hilton-honors-american-express-surpass-card` | No exact repository-safe observed product alias found. | Catalog-only / low. | Catalog `:481-498` |
| Hilton Honors American Express Business Card | `hilton-honors-american-express-business-card` | No exact repository-safe observed product alias found. | Catalog-only / low. | Catalog `:499-513` |
| Delta SkyMiles Gold American Express Card | `delta-skymiles-gold-american-express-card` | `Delta SkyMiles Gold Business Card` is observed/characterized, but is a different business product and must not map to the consumer Gold destination. | Catalog-only / low; exact business-product rejection. | Catalog `:514-535`; archived PRD `:70`; negative fixture `supported-card-credits.test.ts:90` |
| Delta SkyMiles Platinum American Express Card | `delta-skymiles-platinum-american-express-card` | No exact repository-safe observed product alias found. | Catalog-only / low. | Catalog `:536-564` |
| Delta SkyMiles Reserve American Express Card | `delta-skymiles-reserve-american-express-card` | No exact repository-safe observed product alias found. | Catalog-only / low. | Catalog `:565-593` |
| Marriott Bonvoy Brilliant American Express Card | `marriott-bonvoy-brilliant-american-express-card` | No exact repository-safe observed product alias found. | Catalog-only / low. | Catalog `:594-615` |
| Marriott Bonvoy Business American Express Card | `marriott-bonvoy-business-american-express-card` | No exact repository-safe observed product alias found. | Catalog-only / low. | Catalog `:616-644` |

### Observed/characterized AMEX products with no destination card

| Exact AMEX product name | Local evidence | Destination gap / disposition |
|---|---|---|
| `Morgan Stanley Platinum` | Ten exact `usage` titles, including CLEAR+ and Equinox. | No PerksReminder Morgan Stanley Platinum card. Must remain local-only; current tests explicitly reject its Resy title for base Platinum sync. |
| `Hilton Honors Card` | No eligible usage tracker; status/reward/access/spend evidence only. | No no-fee Hilton Honors Card destination. Do not map to Aspire, Surpass, or Business. |
| `Delta SkyMiles Gold Business Card` | `$150 Delta Stays Credit` usage; `$200 Delta Flight Credit` spend; `$120 Rideshare Credit` catalog-only. | No Delta Gold Business destination. Do not map to consumer Delta Gold. |
| `Additional Platinum Card®`; `Companion Platinum Card®` / `Companion Platinum Card` | Archived live review found supplementary physical cards; synthetic discovery fixtures encode Companion. | Explicit primary-only ownership exclusion. Nested exact `SUPP` is discarded before identity/read/storage/sync work. |

Evidence: `.trellis/tasks/archive/2026-07/07-27-review-live-amex-reader-data/prd.md:65-70`; `supported-card-credits.test.ts:86-100`; `scan-engine.test.ts:137-213`; `.trellis/spec/perks-reminder/browser-read-integrations.md:242-248`.

## Destination benefit mapping matrix

### American Express Gold Card

Proposed product key: `american-express-gold-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$10 Monthly Uber Cash` | `american-express-gold-card:uber-cash` | `calendar-month` | `Uber Cash` is exact preserved title evidence only on the Morgan-like Platinum fixture, not Gold. | Candidate / medium title vocabulary; no exact Gold product/title pair. |
| `$10 Monthly Dining Credit (e.g., Grubhub, Cheesecake Factory)` | `american-express-gold-card:dining` | `calendar-month` | Historical matcher accepted exact-normalized phrases `dining credit` and `grubhub credit`; no safe exact live title retained. | Candidate / medium historical rule, not a closed exact alias set. Archived matcher note: `benefit-identity-conflict-paths.md:56-70`. |
| `$7 Monthly Dunkin Credit` | `american-express-gold-card:dunkin` | `calendar-month` | Not found. | Catalog-only / low. |
| `$50 Resy Credit (Jan-Jun)` | `american-express-gold-card:resy` | `calendar-half-h1` | Historical Gold rule accepted `resy dining credit`, `resy credit`, and `resy`, but no exact Gold observation was retained. | Candidate / medium; period split exact only from source range. |
| `$50 Resy Credit (Jul-Dec)` | `american-express-gold-card:resy` | `calendar-half-h2` | Same as H1. | Candidate / medium; period split exact only from source range. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:31-79`.

### American Express Platinum Card

Proposed/current product key: `american-express-platinum-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$200 Airline Fee Credit (Incidental Fees, select one airline)` | `american-express-platinum-card:airline-fee` | `calendar-year` | `$200 Airline Fee Credit` | Exact title evidence / high, but **currently intentionally unmapped**. Archive retained this exact live title; current negative tests assert it does not project. |
| `$15 Monthly Uber Cash ($35 in December)` | `american-express-platinum-card:uber-cash` | `calendar-month` | `Uber Cash` | Candidate / medium. Exact title exists in Morgan-like evidence, but not an approved base-Platinum pair. December aggregation is ambiguous. |
| `$20 Additional Uber Cash (December)` | `american-express-platinum-card:uber-cash-december-bonus` | `calendar-month-december` | `Uber Cash` | **Ambiguous**: one AMEX title may report aggregate December usage while PerksReminder has a separate bonus row. Exact title alone cannot split source amount/state between two overlapping destinations. |
| `$50 Saks Fifth Avenue Credit (Jan-Jun)` | `american-express-platinum-card:saks` | `calendar-half-h1` | `Saks Fifth Avenue Credit` | Candidate / medium. Exact title preserved on Morgan-like product; base product alias and source range still required. |
| `$50 Saks Fifth Avenue Credit (Jul-Dec)` | `american-express-platinum-card:saks` | `calendar-half-h2` | `Saks Fifth Avenue Credit` | Candidate / medium. Exact title preserved on Morgan-like product; base product alias and source range still required. |
| `$100 Quarterly Resy Dining Credit (Q1: Jan-Mar)` | `american-express-platinum-card:resy` | `calendar-quarter-q1` | `Resy Credit`; `Resy Dining Credit`; `$400 Resy Credit` | **Closed / high**. Existing exact product/title browser map and server family allowlist; exact source range selects quarter. |
| `$100 Quarterly Resy Dining Credit (Q2: Apr-Jun)` | `american-express-platinum-card:resy` | `calendar-quarter-q2` | Same closed aliases. | **Closed / high**. |
| `$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)` | `american-express-platinum-card:resy` | `calendar-quarter-q3` | Same closed aliases. | **Closed / high**. |
| `$100 Quarterly Resy Dining Credit (Q4: Oct-Dec)` | `american-express-platinum-card:resy` | `calendar-quarter-q4` | Same closed aliases. | **Closed / high**. |
| `$75 Quarterly Lululemon Credit (Q1: Jan-Mar)` | `american-express-platinum-card:lululemon` | `calendar-quarter-q1` | `lululemon Credit`; `$300 lululemon Credit` | **Closed / high**. Existing exact product/title browser map and server family allowlist. |
| `$75 Quarterly Lululemon Credit (Q2: Apr-Jun)` | `american-express-platinum-card:lululemon` | `calendar-quarter-q2` | Same closed aliases. | **Closed / high**. |
| `$75 Quarterly Lululemon Credit (Q3: Jul-Sep)` | `american-express-platinum-card:lululemon` | `calendar-quarter-q3` | Same closed aliases. | **Closed / high**. |
| `$75 Quarterly Lululemon Credit (Q4: Oct-Dec)` | `american-express-platinum-card:lululemon` | `calendar-quarter-q4` | Same closed aliases. | **Closed / high**. |
| `$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jan-Jun)` | `american-express-platinum-card:hotel` | `calendar-half-h1` | `Hotel Credit` | Candidate / medium. Exact title preserved on Morgan-like product; generic wording is safe only in an exact reviewed base-Platinum pair plus exact source range. |
| `$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jul-Dec)` | `american-express-platinum-card:hotel` | `calendar-half-h2` | `Hotel Credit` | Candidate / medium; same constraints. |
| `$25 Monthly Digital Entertainment Credit` | `american-express-platinum-card:digital-entertainment` | `calendar-month` | `Digital Entertainment Credit` | Candidate / medium. Exact title preserved on Morgan-like product, not an approved base pair. |
| `$120 Annual Uber One Membership Credit` | `american-express-platinum-card:uber-one` | `calendar-year` | Not found. | Catalog-only / low. |
| `$200 Annual Oura Ring Credit` | `american-express-platinum-card:oura` | `calendar-year` | Not found. | Catalog-only / low. |
| `$12.95 Monthly Walmart+ Membership Credit` | `american-express-platinum-card:walmart-plus` | `calendar-month` | `Walmart+ Credit` | Candidate / medium. Exact title preserved on Morgan-like product, not an approved base pair. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:80-295`. Closed alias anchors: `supported-card-credits.ts:61-88`; `supported-card-credits.test.ts:50-100`. Approved ten-title fixture: `amex-response-adapter.test.ts:171-191`.

### American Express Business Platinum Card

Proposed product key: `american-express-business-platinum-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$200 Airline Fee Credit` | `american-express-business-platinum-card:airline-fee` | `calendar-year` | `$200 Airline Fee Credit` is exact preserved live title vocabulary, but retained evidence does not bind it to a non-redacted Business Platinum product alias. | Candidate / medium. |
| `$300 Semi-Annual Hotel Credit ... Jan-Jun` | `american-express-business-platinum-card:hotel` | `calendar-half-h1` | `Hotel Credit` exists on Morgan-like product only. | Candidate / low-medium; exact Business Platinum pair not preserved. |
| `$300 Semi-Annual Hotel Credit ... Jul-Dec` | `american-express-business-platinum-card:hotel` | `calendar-half-h2` | `Hotel Credit` exists on Morgan-like product only. | Candidate / low-medium. |
| `$1,150 Annual Dell Technologies Credit` | `american-express-business-platinum-card:dell` | `calendar-year` | `Dell Technologies Credit` is characterized in tests; archive confirms a live Dell `usage` tracker with observed $150 limit and a separate Dell `spend` row. | Candidate / medium. Only category `usage` may map; every `spend` row remains excluded independent of title/amount. |
| `$250 Annual Adobe Credit (after $600 spend)` | `american-express-business-platinum-card:adobe` | `calendar-year` | `$250 Adobe Credit` with `$600 of $600` was exact archived live evidence, category `spend`. | **Excluded**: qualifying-spend tracker, not authoritative credit usage. No eligible usage title preserved. |
| `$1,200 Annual Amex Travel Flight Credit (High Spender Benefit)` | `american-express-business-platinum-card:amex-travel-flight` | `calendar-year` | Not found as usage. | Catalog-only / low; likely prerequisite ambiguity due high-spender qualification. |
| `$2,400 Annual One AP Statement Credit (High Spender Benefit)` | `american-express-business-platinum-card:one-ap` | `calendar-year` | Archived `One AP` rows were category `spend`; exact full title was not retained. | **Excluded**: qualifying-spend tracker. |
| `$50 Quarterly Hilton Credit (Hilton properties)` | `american-express-business-platinum-card:hilton` | `card-anniversary-quarter` | Not found. | Catalog-only / low. **Ambiguity**: catalog says `QUARTERLY` but `CARD_ANNIVERSARY` and `occurrencesInCycle: 1`; user judgment is needed before period authority. |
| `$90 Quarterly Indeed Credit (Job Postings)` | `american-express-business-platinum-card:indeed` | `calendar-quarter` | Not found. | Catalog-only / low. |
| `$10 Monthly Wireless Bill Credit` | `american-express-business-platinum-card:wireless` | `calendar-month` | Not found. | Catalog-only / low. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:296-403`. Live-category anchors: archived design `:42-55`; archived PRD `:58,64,84`.

### American Express Business Gold Card

Proposed product key: `american-express-business-gold-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$20 Monthly Flexible Business Credit (FedEx, Grubhub, Office Supply)` | `american-express-business-gold-card:flexible-business` | `calendar-month` | Not found. | Catalog-only / low. |
| `$12.95 Monthly Walmart+ Membership Credit` | `american-express-business-gold-card:walmart-plus` | `calendar-month` | `Walmart+ Credit` preserved only on Morgan-like product. | Candidate title vocabulary / low-medium; no exact Business Gold pair. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:404-425`.

### Hilton Honors American Express Aspire Card

Proposed product key: `hilton-honors-american-express-aspire-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `Annual Free Night Reward` | `hilton-honors-american-express-aspire-card:free-night` | `card-anniversary-year` | `Annual Free Night Reward` appears in exclusion tests. | **Excluded**: explicit free-night/non-credit phrase (`supported-card-credits.ts:17-28`). |
| `$50 Quarterly Flight Credit` | `hilton-honors-american-express-aspire-card:flight` | `calendar-quarter` | Not found. | Catalog-only / low. |
| `$200 Semi-Annual Hilton Resort Credit (Jan-Jun)` | `hilton-honors-american-express-aspire-card:hilton-resort` | `calendar-half-h1` | `Hilton Resort Statement Credit` is characterized as an eligible local title in tests, not retained as live Aspire evidence. | Candidate / medium title vocabulary; no exact Aspire product/title pair. |
| `$200 Semi-Annual Hilton Resort Credit (Jul-Dec)` | `hilton-honors-american-express-aspire-card:hilton-resort` | `calendar-half-h2` | Same as H1. | Candidate / medium. |
| `$189 CLEAR Plus Credit` | `hilton-honors-american-express-aspire-card:clear-plus` | `calendar-year` | `$219 CLEAR+ Credit` exact preserved on Morgan-like product; amount/title differ from destination. | **Ambiguous / no exact match**. Do not infer from merchant resemblance or amount. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:426-480`; eligibility fixture `supported-card-credits.test.ts:7-18,30-46`.

### Hilton Honors American Express Surpass Card

Proposed product key: `hilton-honors-american-express-surpass-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$50 Quarterly Hilton Credit` | `hilton-honors-american-express-surpass-card:hilton` | `calendar-quarter` | Not found. | Catalog-only / low. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:481-498`.

### Hilton Honors American Express Business Card

Proposed product key: `hilton-honors-american-express-business-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$60 Quarterly Hilton Credit ($240 annual)` | `hilton-honors-american-express-business-card:hilton` | `card-anniversary-quarter` | Not found. | Catalog-only / low. Catalog omits explicit fixed alignment, so default is card anniversary. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:499-513`; default alignment behavior documented at `.trellis/spec/perks-reminder/catalog-and-benefit-updates.md:20-25`.

### Delta SkyMiles Gold American Express Card

Proposed product key: `delta-skymiles-gold-american-express-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$200 Delta Flight Credit (after $10k spend)` | `delta-skymiles-gold-american-express-card:delta-flight` | `card-anniversary-year` | `$200 Delta Flight Credit` exact evidence exists only on `Delta SkyMiles Gold Business Card`, category `spend`. | **Excluded** for observed business-product row; no exact consumer usage pair. |
| `$100 Delta Stays Credit` | `delta-skymiles-gold-american-express-card:delta-stays` | `card-anniversary-year` | `$150 Delta Stays Credit` exact evidence exists only on Delta Gold Business. | **Ambiguous / no exact match**: product and amount/title differ. Do not map by merchant resemblance. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:514-535`; Delta evidence `amex-response-adapter.test.ts:194-216`; archived PRD `:70`.

### Delta SkyMiles Platinum American Express Card

Proposed product key: `delta-skymiles-platinum-american-express-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$150 Delta Stays Credit` | `delta-skymiles-platinum-american-express-card:delta-stays` | `card-anniversary-year` | `$150 Delta Stays Credit` exact title preserved on Delta Gold Business only. | Candidate title vocabulary / medium; wrong product, so not an exact pair. |
| `$10 Monthly Resy Credit` | `delta-skymiles-platinum-american-express-card:resy` | `calendar-month` | Generic `Resy Credit` aliases exist for base Platinum; no exact Delta Platinum pair. | Catalog-only / low; cannot borrow base-Platinum authority. |
| `$10 Monthly Rideshare Credit` | `delta-skymiles-platinum-american-express-card:rideshare` | `calendar-month` | `$120 Rideshare Credit` was catalog-only on Delta Gold Business and therefore did not create a local row. | Catalog-only / low; no tracker-backed exact pair. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:536-564`.

### Delta SkyMiles Reserve American Express Card

Proposed product key: `delta-skymiles-reserve-american-express-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `$200 Delta Stays Credit` | `delta-skymiles-reserve-american-express-card:delta-stays` | `card-anniversary-year` | `$150 Delta Stays Credit` exact evidence exists on Delta Gold Business only. | Ambiguous / low: title amount and product differ. |
| `$20 Monthly Resy Credit` | `delta-skymiles-reserve-american-express-card:resy` | `calendar-month` | No exact Delta Reserve title pair retained. | Catalog-only / low. |
| `$10 Monthly Rideshare Credit` | `delta-skymiles-reserve-american-express-card:rideshare` | `calendar-month` | `$120 Rideshare Credit` was catalog-only on Delta Gold Business. | Catalog-only / low; no tracker-backed exact pair. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:565-593`.

### Marriott Bonvoy Brilliant American Express Card

Proposed product key: `marriott-bonvoy-brilliant-american-express-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `Annual Free Night Award (up to 85k points)` | `marriott-bonvoy-brilliant-american-express-card:free-night` | `card-anniversary-year` | Free-night phrase is explicitly rejected in local title policy. | **Excluded**: non-credit certificate. |
| `$25 Monthly Dining Credit` | `marriott-bonvoy-brilliant-american-express-card:dining` | `calendar-month` | No exact Brilliant product/title evidence retained. | Catalog-only / low. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:594-615`.

### Marriott Bonvoy Business American Express Card

Proposed product key: `marriott-bonvoy-business-american-express-card`.

| Destination benefit | Proposed family key | Proposed period key | Exact AMEX title alias evidence | Confidence / disposition |
|---|---|---|---|---|
| `Annual Free Night Award (up to 35,000 points)` | `marriott-bonvoy-business-american-express-card:free-night` | `card-anniversary-year` | Free-night phrase is explicitly rejected. | **Excluded**: non-credit certificate. |
| `15 Elite Night Credits towards Marriott Bonvoy Elite status` | `marriott-bonvoy-business-american-express-card:elite-night-credits` | `card-anniversary-year` | Elite-status phrase is explicitly rejected. | **Excluded**: status/non-credit. |
| `Marriott Bonvoy Gold Elite Status (complimentary)` | `marriott-bonvoy-business-american-express-card:gold-elite-status` | `card-anniversary-year` | Elite-status phrase is explicitly rejected. | **Excluded**: status/non-credit. |

Catalog anchor: `src/lib/american-express-card-catalog.ts:616-644`; exclusions `supported-card-credits.ts:17-28,39-52`.

## Exact observed/characterized title inventory and one-sided gaps

### AMEX titles with a plausible PerksReminder counterpart

The rows below inventory exact title evidence. A plausible counterpart is not write authority; product alias, category, structured period, one destination row, and independent server allowlisting are still required.

| Exact AMEX title | Product evidence | Candidate destination family | Status |
|---|---|---|---|
| `$200 Airline Fee Credit` | Morgan-like approved outcome; archive also retained exact title as live vocabulary | Base Platinum `:airline-fee`; Business Platinum `:airline-fee` | Product ambiguity. Current browser map explicitly rejects it even for base Platinum. |
| `$300 lululemon Credit` | Morgan Stanley Platinum; also closed title alias for base Platinum | Base Platinum `:lululemon` | Closed only when paired with an approved base-Platinum product alias. |
| `lululemon Credit` | Closed characterization fixture | Base Platinum `:lululemon` | Closed only with approved base-Platinum product alias. |
| `$400 Resy Credit` | Morgan Stanley Platinum; also closed title alias for base Platinum | Base Platinum `:resy` | Closed only with approved base-Platinum product alias. |
| `Resy Credit`; `Resy Dining Credit` | Closed characterization fixtures | Base Platinum `:resy`; historical Gold Resy rule | Closed only for base Platinum current map. Gold and Delta must not borrow it. |
| `Digital Entertainment Credit` | Morgan Stanley Platinum | Base Platinum `:digital-entertainment` | Exact title but wrong/no destination product match. |
| `Hotel Credit` | Morgan Stanley Platinum | Base Platinum `:hotel`; Business Platinum `:hotel` | Generic title; exact product and source range required. |
| `Saks Fifth Avenue Credit` | Morgan Stanley Platinum | Base Platinum `:saks` | Exact title but wrong/no destination product match. |
| `Uber Cash` | Morgan Stanley Platinum | Gold/Base Platinum Uber families | Ambiguous, especially Platinum December split. |
| `Walmart+ Credit` | Morgan Stanley Platinum | Base Platinum/Business Gold Walmart+ families | Product ambiguity. |
| `Dell Technologies Credit` | Characterization test; archived live Dell usage evidence | Business Platinum `:dell` | Only exact category `usage`; same-title/related `spend` rows excluded. |
| `Hilton Resort Statement Credit` | Characterization test only | Aspire `:hilton-resort` | No exact Aspire product/title live evidence. |
| `$150 Delta Stays Credit` | Delta SkyMiles Gold Business Card | Delta Platinum `:delta-stays` textually exact, but product is different; consumer catalog destinations otherwise differ | No exact destination product pair. |

### AMEX titles/records intentionally excluded

| Exact or bounded title evidence | Reason | Anchor |
|---|---|---|
| `35% Airline Bonus` | Reviewed exact catalog/title exclusion; not credit usage. | `supported-card-credits.ts:30-41`; archived PRD `:28` |
| `Link Your Resy Profile` | Reviewed exact linking exclusion; cannot create a row. | `supported-card-credits.ts:30-41`; archived PRD `:29` |
| `$250 Adobe Credit` observed as `$600 of $600` | Provider category `spend`; qualifying threshold, not credit utilization. | archived PRD `:58,64` |
| `$200 Delta Flight Credit` on Delta Gold Business | Provider category `spend`. | archived PRD `:47,70` |
| Dell qualification-spend record | Provider category `spend`; separate Dell usage record remains locally eligible. | archived design `:42-55` |
| One AP qualification records | Provider category `spend`. | archived design `:50-53`; archived PRD `:58` |
| `$120 Rideshare Credit` on Delta Gold Business | Catalog-only; no tracker-backed usage row. | archived PRD `:47,70`; adapter test `:204-216` |
| `Annual Free Night Reward` / titles containing `free night` | Explicit non-credit exclusion. | `supported-card-credits.ts:17-28`; tests `:30-46` |
| Titles containing `elite status`, `lounge access`, `priority pass`, protection/insurance, `global dining access` | Explicit non-credit/access/protection exclusion. | `supported-card-credits.ts:17-28`; tests `:30-46` |
| Exact tracker categories `spend`, `access`, `loan`, missing, unrecognized | Omitted before title joining/interpretation; title resemblance cannot reinstate them. | `.trellis/spec/perks-reminder/browser-read-integrations.md:242-244,272-278` |
| Nested exact `SUPP` cards, including Additional/Companion Platinum | Ownership exclusion before identity and provider reads. | `.trellis/spec/perks-reminder/browser-read-integrations.md:248,272`; archived PRD `:33-35,65` |

### PerksReminder destination perks with no exact repository-safe AMEX usage title

The following destination rows have **no exact tracker-backed AMEX title tied to the same exact product** in retained evidence:

- All five Gold rows (historical phrase rules exist for dining/Resy, but no exact reviewed Gold product/title pair is retained).
- Platinum Uber monthly/December split, Saks halves, hotel halves, digital entertainment, Uber One, Oura, Walmart+; title vocabulary exists for several on Morgan Stanley Platinum but not as an exact base-Platinum pair.
- All Business Platinum rows except partial title/category evidence for airline fee, Dell, Adobe, and One AP. Adobe and One AP evidence is excluded `spend`.
- Both Business Gold rows.
- All Aspire, Surpass, and Hilton Business usage-credit rows. `Hilton Resort Statement Credit` is only a characterization fixture; free-night is excluded.
- All consumer Delta rows. The retained Delta evidence belongs to Delta Gold Business, which has no destination card.
- Brilliant dining.
- All Marriott Business rows and Brilliant free night are non-credit/status exclusions rather than missing credit titles.

### AMEX observations with no PerksReminder counterpart

- Product-level: `Morgan Stanley Platinum`, `Hilton Honors Card`, and `Delta SkyMiles Gold Business Card` have no destination card.
- Benefit-level: `$219 CLEAR+ Credit` and `$300 Equinox Credit` appear in Morgan Stanley Platinum evidence but have no matching benefit on any represented destination for that exact product.
- Delta Gold Business `$150 Delta Stays Credit` has no destination because the business card itself is absent. Mapping it to a consumer Delta product is forbidden.
- Hilton Honors Card's status/reward/service/$20,000 qualification records have no tracker-backed destination usage row and are intentionally omitted.

## Unresolved ambiguities requiring user judgment

1. **Whether proposed keys should be authorized when title evidence exists only on Morgan Stanley Platinum.** The same title vocabulary does not establish a base-Platinum product/title pair. Under the closed model, these remain local-only until exact base-product evidence is reviewed.
2. **Platinum Uber December modeling.** AMEX evidence preserves one `Uber Cash` title, while PerksReminder has a recurring `$15` row and a separate `$20 December` row. Exact title/range evidence alone does not prove how one source amount/completion should be divided. This must remain unwritable unless AMEX exposes distinct tracker identities or product requirements define an exact aggregate rule.
3. **Business Platinum Hilton period identity.** The catalog row is `QUARTERLY` but aligned `CARD_ANNIVERSARY` with `occurrencesInCycle: 1` (`american-express-card-catalog.ts:375-384`). It is not safe to assign fixed calendar Q1–Q4 keys without product judgment.
4. **Hilton Business quarterly period identity.** The catalog has `QUARTERLY` with no explicit alignment (`:499-512`), therefore repository defaults imply card anniversary. Confirm whether AMEX exposes calendar quarters before authorizing a period key.
5. **High-spender and after-spend destination benefits.** Adobe, One AP, Amex Travel Flight, and Delta Flight are represented in PerksReminder, but retained AMEX evidence categorizes relevant qualification trackers as `spend`. Decide whether these catalog perks remain intentionally manual/non-sync; they cannot be admitted under the current exact-`usage` policy.
6. **CLEAR title/amount variants.** Destination Aspire is `$189 CLEAR Plus Credit`; preserved AMEX evidence is `$219 CLEAR+ Credit` on Morgan Stanley Platinum. Merchant resemblance and amount differences cannot establish a match.
7. **Delta product/title variants.** `$150 Delta Stays Credit` is observed on Delta Gold Business. Consumer Delta Platinum has a textually identical destination benefit, but product mismatch forbids mapping; consumer Gold/Reserve also differ by amount.
8. **No safe product aliases for nine catalog cards.** Except base Platinum and canonical fixture strings for Gold/Business Platinum, repository-safe evidence does not establish the exact AMEX display names. Exact alias lists must remain empty rather than inferred from canonical catalog names.
9. **Non-quarter runtime period keys.** Current server authority recognizes only exact calendar-quarter ranges. Monthly, half-year, calendar-year, and anniversary proposals in this matrix describe inventory identity only; they are not currently writable.
10. **Last-five policy is not represented by current field naming/logic.** The active PRD requires exact last five and no manual bypass (`.trellis/tasks/07-28-complete-amex-sync-reconciliation/prd.md:27-35`), while current `CreditCard.lastFourDigits`, sync schema (`^\d{4,5}$`), and resolver still accept 4–5 digits/manual mappings (`prisma/schema.prisma:99`; `sync-contract.ts:50-57`; `authority.ts:256-276`). This is a card-reconciliation constraint, not a reason to broaden product/title mapping.

## Repository file map

| File | Mapping relevance |
|---|---|
| `src/lib/american-express-card-catalog.ts` | Sole shared AMEX card/benefit inventory and the only current catalog key declarations. |
| `src/lib/static-catalog.ts` | Imports all shared AMEX definitions; deterministic public slugs support proposed product-key spelling. |
| `prisma/seed.ts` | Persists static catalog and copies product/family/period keys only when present. |
| `prisma/schema.prisma` | Nullable destination key columns on cards/benefits/templates. |
| `prisma/migrations/20260727062040_add_amex_benefit_sync/migration.sql` | Adds destination key columns, unique predefined product key, mappings, provenance, attempts, and audits. |
| `src/lib/amex-benefit-reader/supported-card-credits.ts` | Current local exclusions and exact closed base-Platinum browser mapping. |
| `src/lib/amex-benefit-reader/__tests__/supported-card-credits.test.ts` | Positive exact aliases and explicit near/wrong-product rejection cases. |
| `src/lib/amex-benefit-reader/__tests__/amex-response-adapter.test.ts` | Exact approved Morgan/Hilton/Delta title fixtures and product-independent behavior. |
| `src/lib/amex-benefit-reader/__tests__/scan-engine.test.ts` | End-to-end normalized approved outcome fixture, including no destination keys. |
| `src/lib/amex-benefit-reader/sync-contract.ts` | Browser projection gate and exact map invocation. |
| `src/lib/amex-sync/authority.ts` | Independent server allowlist, quarter period resolution, and exact destination matching. |
| `src/lib/amex-sync/catalog-backfill.ts` | Deterministic key backfill rules; runtime never uses shape classification. |
| `.trellis/tasks/archive/2026-07/07-27-review-live-amex-reader-data/prd.md` | Sanitized live findings and approved exact product/title/category outcomes. |
| `.trellis/tasks/archive/2026-07/07-22-sync-reviewed-amex-benefits/research/schema-catalog-gaps.md` | Prior stable-key and split-period analysis. |
| `.trellis/tasks/archive/2026-07/07-22-amex-pre-sync-benefit-list/research/benefit-identity-conflict-paths.md` | Historical matcher families, title phrases, and multi-window collision evidence. |
| `.trellis/spec/perks-reminder/browser-read-integrations.md` | Product-independent observation, closed projection, and independent authority contracts. |
| `.trellis/spec/perks-reminder/catalog-and-benefit-updates.md` | Shared catalog, split-window, and cycle modeling rules. |

## Caveats / not found

- No external web research was used. The relevant AMEX APIs are private and this task asks for repository-backed evidence.
- No live browser scan, database query, migration, seed, backfill, or application write was performed.
- The archived safe report deliberately omits many raw/live titles and card names. This inventory does not reconstruct or guess them.
- `card-templates/` contains no AMEX template to add independent evidence.
- Existing user database contents were not queried; this inventories the shared static catalog and migration/seed behavior, not production row drift.
- Proposed keys outside current Platinum Resy/lululemon are research labels only. They do not alter browser projection or server authority.
