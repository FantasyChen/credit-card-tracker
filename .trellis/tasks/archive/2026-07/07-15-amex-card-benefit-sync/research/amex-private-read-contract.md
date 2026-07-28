# Research: American Express private read contract from pinned public reference

- **Query**: Produce an implementation-ready, redacted Phase 1 contract for account discovery, benefit trackers, and benefit catalog using only `olddonkey/amex-assistant` revision `4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87` and linked public documentation.
- **Scope**: mixed (pinned public source and local approved PRD/design requirements)
- **Date**: 2026-07-15
- **Reference revision**: [`4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87`](https://github.com/olddonkey/amex-assistant/commit/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87)
- **Evidence boundary**: No live Amex network traffic, browser storage, cookies, request headers, account tokens, or response bodies were inspected. All example values below are constants or redacted placeholders from the pinned public repository.

## Findings

## 1. Exact Phase 1 read allowlist

Only these three origin/path/method tuples are supported by the pinned reference for the requested scope. URL comparison should use exact HTTPS origin and pathname, with no caller-supplied URL, query, fragment, method, headers, or body keys.

| Operation | Origin | Exact path | Method | Reference source |
|---|---|---|---|---|
| Account discovery | `https://global.americanexpress.com` | `/api/servicing/v1/member` | `GET` | [`src/amex-assistant.user.js#L73-L79`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L73-L79), [`#L914-L922`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L914-L922) |
| Benefit trackers | `https://functions.americanexpress.com` | `/ReadBestLoyaltyBenefitsTrackers.v1` | `POST` | [`src/amex-assistant.user.js#L87-L90`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L87-L90), [`#L1253-L1267`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1253-L1267) |
| Benefit catalog | `https://functions.americanexpress.com` | `/ReadLoyaltyBenefits.v2` | `POST` | [`src/amex-assistant.user.js#L91-L99`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L91-L99), [`#L1367-L1382`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1367-L1382) |

`ReadLoyaltyBenefitsCardProduct.v1`, offers endpoints, savings endpoints, and every other Amex path are absent from this three-operation allowlist. The pinned source contains no call to `ReadLoyaltyBenefitsCardProduct.v1`; it must not be added based only on its name or separate observations.

## 2. Minimal request construction

### Shared transport behavior constructed by the reference

- Uses ordinary browser `fetch`, not `GM_xmlhttpRequest`.
- Sets `credentials: "include"` for all three calls so the browser may attach the existing Amex session according to browser cookie policy.
- Does not read or construct cookie values.
- Does not construct `Authorization`, CSRF, or custom `x-*` headers.
- Does not manually set `Origin`; the browser owns that forbidden header.
- The account request does not set `method`, so Fetch uses `GET`.
- The two benefit requests explicitly set `method: "POST"` and JSON-stringify the fixed body.

Sources: [`src/amex-assistant.user.js#L797-L872`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L797-L872), [`docs/FINDINGS.md#L18-L40`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L18-L40).

### Account discovery request

```text
GET https://global.americanexpress.com/api/servicing/v1/member
credentials: include
Accept: application/json
body: none
```

Constructed headers are only:

```json
{
  "Accept": "application/json"
}
```

The reference does not construct `Content-Type` for this bodyless GET. Source: [`src/amex-assistant.user.js#L840-L850`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L840-L850).

### Benefit tracker request

```text
POST https://functions.americanexpress.com/ReadBestLoyaltyBenefitsTrackers.v1
credentials: include
Content-Type: application/json
Accept: */*
```

Exact JSON body shape:

```json
[
  {
    "accountToken": "<OPAQUE_ACCOUNT_TOKEN>",
    "locale": "en-US",
    "limit": "ALL"
  }
]
```

- `accountToken` is the opaque account token from account discovery. It is the only sensitive/token-bearing request-body field and must remain scan-memory only.
- The outer JSON value is an array containing exactly one object.
- `locale` is fixed to `en-US`.
- `limit` is fixed to `ALL`.
- `Accept: */*` is an endpoint-specific override. The source comments that `Accept: application/json` can produce an empty response for this endpoint.

Source: [`src/amex-assistant.user.js#L98-L102`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L98-L102), [`#L1253-L1267`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1253-L1267).

### Benefit catalog request

```text
POST https://functions.americanexpress.com/ReadLoyaltyBenefits.v2
credentials: include
Content-Type: application/json
Accept: application/json
```

Exact JSON body shape:

```json
{
  "accountToken": "<OPAQUE_ACCOUNT_TOKEN>",
  "locale": "en-US"
}
```

- `accountToken` is the opaque account token from account discovery. It is the only sensitive/token-bearing request-body field and must remain scan-memory only.
- Unlike the tracker endpoint, the outer JSON value is a plain object, not an array.
- `locale` is fixed to `en-US`.

Source: [`src/amex-assistant.user.js#L1367-L1382`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1367-L1382). The repository test mock explicitly distinguishes the tracker array body from the catalog object body at [`test/mock-fetch.mjs#L176-L189`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/mock-fetch.mjs#L176-L189).

## 3. Minimal account-discovery response contract

### Envelope and flattening paths

The reference reads:

```text
response.accounts
```

and treats it as an array, otherwise silently returning an empty list. Each top-level account and each supplementary wrapper can contribute a card-shaped entry.

| Purpose | Response path(s), in reference preference order | Reference behavior | Phase 1 constraint |
|---|---|---|---|
| Top-level opaque account token | `accounts[].account_token` | Includes the entry if truthy | Token is scan-memory only; derive HMAC identity before persistence |
| Supplementary collection | `accounts[].supplementary_accounts[]` | Iterates each wrapper | Unknown/non-array variants must be a structural issue, not silently ignored |
| Supplementary opaque token | `supplementary_accounts[].account_token`, then `supplementary_accounts[].account.account_token` | Wrapper token preferred; nested token accepted as a legacy shape | Token is scan-memory only |
| Product display name | `product.description`, then `product.product_description`, then `profile.embossed_name` | First truthy string | `profile.embossed_name` is a cardholder embossing field, not necessarily a product name; do not persist it as a product name unless separately characterized |
| Explicit ending digits | `account.display_account_number`, `account.account_number`, `display_account_number`, `account_number`, `display_number`, `card_number` | Removes non-digits and takes the last five | Require an explicit field resolving to exactly four or five digits; do not truncate a longer number or accept full-card-number material |
| Top-level relationship | `relationship` | Defaults missing value to `BASIC` | Do not default; absent/unknown is unrecognized |
| Supplementary relationship | `supplementary_accounts[].account.relationship`, then wrapper `relationship` | Defaults missing value to `SUPP` while flattening | Do not default; absent/unknown is unrecognized |
| Supplementary product | wrapper `product`, then nested `account.product`; merged over parent `product` | Inherits parent product fields when omitted | Parent inheritance is demonstrated by synthetic tests, but identity still comes from the supplementary token and explicit supplementary digits |

Sources:

- Account request/envelope: [`src/amex-assistant.user.js#L914-L922`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L914-L922).
- Supplementary flattening: [`#L924-L967`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L924-L967).
- Product/display fallbacks: [`#L1053-L1119`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1053-L1119).
- Supplementary synthetic test shape: [`test/offer-index.test.mjs#L103-L145`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/offer-index.test.mjs#L103-L145).
- Public findings describe `SUPP`, wrapper token, and nested identity fields: [`docs/FINDINGS.md#L46-L60`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L46-L60).

### Relationship evidence and limitation

Public evidence contains:

- `BASIC` as the primary/owned-card value used by the reference.
- `SUPP` in the documented and synthetic supplementary account shape.
- `SUPPLEMENTARY` only as a test helper's alternate input demonstrating that the reference's exact `BASIC` filter excludes it; it is not evidence that the member endpoint actually emits that value.

The pinned reference does **not** positively classify card versus non-card products. It includes any top-level or supplementary record with an `account_token`, defaults missing relationships, and later reads benefits only for exact `BASIC` cards. No public account-type/product-type discriminator or known non-card value set was found. Therefore:

1. `BASIC` and `SUPP` are the only relationship values directly characterized by the public member shape.
2. Missing, `SUPPLEMENTARY`, or any other relationship value must remain unrecognized until separately characterized; it must not be silently treated as primary or supplementary.
3. The Phase 1 requirement to positively classify supported cards and known non-cards cannot be fully implemented from this pinned public reference alone. Unknown account variants must affect discovery completeness rather than being scanned or silently dropped.

## 4. Minimal benefit-tracker response contract

### Envelope

The reference expects a top-level array of blocks and flattens each block's `trackers` array:

```text
response[]
response[].trackers[]
```

The repository's synthetic mock shape is:

```json
[
  {
    "trackers": []
  }
]
```

Source: [`src/amex-assistant.user.js#L1253-L1267`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1253-L1267), [`test/mock-fetch.mjs#L176-L181`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/mock-fetch.mjs#L176-L181).

For Phase 1, the top-level array, block objects, and each block's `trackers` array should be validated explicitly. A malformed envelope must not normalize to an ordinary empty result.

### Fields consumed by the reference

| Normalized purpose | Tracker response path | Reference use | Contract note |
|---|---|---|---|
| Issuer join identity | `trackers[].sorBenefitId` | Preferred identity; joins tracker to catalog | Strongest public join field, but not globally stable across products |
| Fallback tracker identity | `trackers[].benefitId` | Fallback when `sorBenefitId` is absent | Tracker-only fallback; catalog uses `sorBenefitId` |
| Title | `trackers[].benefitName` | Initial tracker title | Catalog may replace it using matching `sorBenefitId` |
| Category | `trackers[].category` | Copied and used to identify `spend` trackers | Only publicly evidenced category source |
| Tracker status | `trackers[].status` | Copied as an opaque string | Synthetic examples include `ACTIVE` and `ACHIEVED`; no exhaustive enum is published |
| Period start | `trackers[].periodStartDate` | Used to infer cadence | Preserve only as an observed value; do not infer cadence from span |
| Period end | `trackers[].periodEndDate` | Used to infer cadence and expiry | Preserve only when explicitly present and validated |
| Period duration | `trackers[].trackerDuration` | Fallback cadence heuristic | Recognize only explicitly characterized values; unknown remains unrecognized |
| Target/limit amount | `trackers[].tracker.targetAmount` | Parsed with `parseFloat` | Preserve a validated decimal string; absent is not zero |
| Earned/used amount | `trackers[].tracker.spentAmount` | Renamed to `spent` | Keep upstream semantics explicit; public source does not prove every tracker means spend versus earned credit |
| Remaining amount | `trackers[].tracker.remainingAmount` | Used when present; otherwise derived | Preserve only when explicitly present; never derive it |
| Display currency symbol | `trackers[].tracker.targetCurrencySymbol` | Copied; defaults to `$` | Do not default a missing symbol to USD |
| Unit discriminator | `trackers[].tracker.targetUnit` | Used to exclude `PASSES` | Preserve recognized money/count/pass semantics rather than dropping non-money trackers |
| Currency code in public fixture | `trackers[].tracker.targetCurrency` | Present in the linked synthetic mock but not consumed by `normalizeBenefit` | May support validated currency units; absence remains not exposed |

Source: normalization and amounts at [`src/amex-assistant.user.js#L1281-L1338`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1281-L1338); category/unit filtering at [`#L1352-L1365`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1352-L1365); synthetic response builder at [`test/mock-fetch.mjs#L41-L72`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/mock-fetch.mjs#L41-L72).

### Status evidence

The pinned source does not define a strict tracker-status enum. It:

- carries `tracker.status` through unchanged;
- uses synthetic `ACTIVE` and `ACHIEVED` values in tests;
- later applies a best-effort regular expression matching fragments such as `AVAILABLE`, `INACTIVE`, `NOT_ENROLLED`, and `ELIGIBLE_TO` to label an inactive benefit.

That regular expression is display heuristics, not an issuer contract. It must not be copied as a complete status mapping. Unknown statuses must produce `unrecognized`/partial output. Source: [`src/amex-assistant.user.js#L5128-L5137`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L5128-L5137), [`test/benefits.test.mjs#L310-L347`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/benefits.test.mjs#L310-L347).

## 5. Minimal benefit-catalog response contract

### Envelope

The public test mock states that the response is:

```json
{
  "cardProduct": {},
  "benefits": {
    "<slug>": {}
  }
}
```

The reference ignores `cardProduct` and returns only `response.benefits`, expected to be a dictionary keyed by slug. Source: [`src/amex-assistant.user.js#L1367-L1382`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1367-L1382), [`test/mock-fetch.mjs#L183-L189`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/mock-fetch.mjs#L183-L189).

For Phase 1, `benefits` should be explicitly validated as a string-keyed object. The dictionary slug is iteration structure only; the reference does not use it as stable identity.

### Fields consumed by the reference

| Purpose | Catalog response path | Reference behavior | Contract note |
|---|---|---|---|
| Issuer join identity | `benefits[slug].sorBenefitId` | Joins catalog entry to tracker | Use only as a per-card/product join discriminator unless broader stability is characterized |
| Preferred candidate title | `benefits[slug].benefitShortTitle`, then `benefitTitle`, then `benefitName` | Used for catalog-only candidate rows | Decode to inert text; never render issuer HTML |
| Preferred tracker-enrichment title | `benefits[slug].benefitTitle` | Replaces matching tracker title | Requires matching `sorBenefitId` |
| Enrollment layout/status | `benefits[slug].layoutType` | Exact `NOTENROLLED` identifies catalog candidates; synthetic `ENROLLED` is also present | No exhaustive layout enum is published |
| Enrollable flag | `benefits[slug].isEnrollable` | Must be truthy for reference candidate inclusion | Boolean presence does not establish linking/activation semantics beyond what is explicit |
| Category | Not found in the reference's catalog parser or linked synthetic catalog fixture | Reference assigns an empty category to catalog-only entries | Do not invent a catalog category; use tracker `category` when joined, otherwise `not_exposed` |

Sources: catalog-only normalization at [`src/amex-assistant.user.js#L1399-L1437`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1399-L1437); tracker-title join and enrollment candidates at [`#L1472-L1505`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1472-L1505); synthetic catalog builder at [`test/mock-fetch.mjs#L75-L92`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/mock-fetch.mjs#L75-L92).

### Stable issuer benefit identity

`sorBenefitId` is the only public field used to join tracker and catalog records. The reference comments that the same display benefit may have a different `sorBenefitId` on different card products, which is why it groups across cards by normalized title instead. Therefore:

- `sorBenefitId` is suitable evidence for joining tracker and catalog observations for the same card/product scan.
- It is not evidence of a globally stable cross-product identifier.
- `benefitId` is a tracker-only fallback and cannot join a catalog entry lacking `sorBenefitId`.
- Catalog dictionary slug is not used by the reference as identity.
- Cross-card name-only grouping and amount aggregation must not be copied. Phase 1 should retain per-physical-card observations and make ambiguous identities explicit.

Sources: [`src/amex-assistant.user.js#L1321-L1325`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1321-L1325), [`#L1340-L1350`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1340-L1350), [`#L1472-L1486`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1472-L1486), [`#L1592-L1615`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1592-L1615).

## 6. Authentication, session, redirects, CORS, and execution-world assumptions

### Authentication/session

- The reference assumes the user is already signed in on `global.americanexpress.com`.
- `credentials: "include"` asks the browser to attach eligible cookies to both same-origin account discovery and cross-origin `functions.americanexpress.com` requests.
- The reference does not read cookies and does not create an auth header, bearer token, CSRF token, or MFA value.
- Public project documentation claims the two benefit calls work because Amex configures cross-subdomain CORS and browser cookie policy for its SPA. This is an implementation assumption, not a public API guarantee.
- Phase 1 must let the browser attach session state to fresh requests; it must never inspect, copy, log, export, or persist session material.

Sources: [`src/amex-assistant.user.js#L17-L38`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L17-L38), [`docs/FINDINGS.md#L18-L40`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L18-L40), [`README.md#L184-L195`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/README.md#L184-L195).

### Redirects

The reference does not set Fetch's `redirect` option. Browser Fetch therefore uses its default redirect behavior, and the wrapper does not inspect `response.redirected` or the final `response.url`. A redirected 2xx JSON response could consequently be accepted; a login/challenge HTML response is caught only when JSON parsing fails.

This behavior does not satisfy the approved Phase 1 boundary. The endpoint-specific client must reject redirects rather than follow an unknown destination (for example, with a fixed `redirect: "error"` request policy) and must never retry a redirect through a generic caller.

Public Fetch reference: [MDN `Request.redirect`](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect). Pinned source wrapper: [`src/amex-assistant.user.js#L814-L838`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L814-L838).

### CORS

- Page origin: `https://global.americanexpress.com`.
- Benefit origin: `https://functions.americanexpress.com`.
- These are same-site but cross-origin requests.
- `Content-Type: application/json` on the POSTs is not a CORS-safelisted content type, so browser CORS/preflight behavior and Amex's response headers are prerequisites.
- The source does not set `mode`, so ordinary Fetch defaults apply.
- The source says the browser sets `Origin` and that it must not be set manually.
- Phase 1 must stop with a fixed redacted CORS/network error if the browser blocks the request. It must not fall back to privileged cross-origin transport without a separately approved design change.

Public references: [MDN CORS guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [MDN `Request.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials). Pinned source claim: [`docs/FINDINGS.md#L18-L40`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L18-L40).

### Page world / userscript / extension assumptions

- Userscript metadata is `@match https://global.americanexpress.com/*`, `@grant none`, and `@run-at document-idle`.
- The reference explicitly assumes `@grant none` gives direct page-window behavior; its keep-alive code accesses `window.timeout` on that basis.
- The MV3 builder defaults to an isolated content-script world and claims the same source can run there; it has an optional `MAIN`-world mode.
- The approved Phase 1 design must not copy the broad match, `MAIN`-world escape hatch, or `window` integration. It should use ordinary Fetch from the narrow benefits-route userscript if owner-only validation confirms the three exact requests work. If a privileged grant or page-world bridge is required, implementation must stop for design review rather than expanding authority automatically.

Sources: [`src/amex-assistant.user.js#L1-L15`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1-L15), [`#L2753-L2770`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2753-L2770), [`build/build-extension.mjs#L1-L19`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/build/build-extension.mjs#L1-L19), [`#L60-L75`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/build/build-extension.mjs#L60-L75).

## 7. Errors, retries, timeouts, cancellation, and concurrency

### Reference behavior

| Concern | Pinned reference behavior | Source |
|---|---|---|
| Network exception | Classified as HTTP status `0`, transient, not blocked | [`src/amex-assistant.user.js#L814-L821`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L814-L821) |
| Non-2xx | Throws; `5xx` is transient; `401`, `403`, and `429` are blocked; other `4xx` is definitive | [`#L822-L829`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L822-L829) |
| 2xx non-JSON | JSON parse failure classified as blocked/login/interstitial | [`#L830-L837`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L830-L837) |
| Content type | Not checked before `response.json()` | Same wrapper |
| Read retry policy | One extra attempt after network error or `5xx`; no retry for blocked, non-JSON, or other `4xx` | [`#L874-L897`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L874-L897) |
| Retry delay | Random 300–600 ms | [`#L123-L127`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L123-L127), [`#L2085-L2108`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2085-L2108) |
| Account retry | Account discovery is wrapped in the one-retry policy | [`#L914-L922`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L914-L922) |
| Tracker retry | Per-card tracker call is wrapped in the one-retry policy | [`#L1448-L1463`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1448-L1463) |
| Catalog retry | `fetchCardCatalog` catches every error and returns `{}`; the outer retry wrapper therefore receives a resolved value and does not retry | [`#L1367-L1382`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1367-L1382), [`#L1457-L1460`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1457-L1460) |
| Timeout | None; no timeout option or timer wraps these fetches | Network and benefit functions above |
| Cancellation | None; no `AbortSignal` is passed | Network and benefit functions above |
| Concurrency | Maximum four card workers; tracker then catalog are sequential within each card | [`#L104-L106`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L104-L106), [`#L1122-L1143`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1122-L1143), [`#L1448-L1463`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1448-L1463) |
| Per-card benefit failure | An unrecovered tracker failure rejects the shared `mapLimit` operation; benefit loading does not isolate that card | Same `fetchAllBenefits` block |

### Phase 1 contract implications

- Preserve the narrow retry classification: at most one retry for a fresh idempotent read after a network failure or `5xx`; never retry auth/challenge, `4xx`, schema, CORS, content-type, redirect, or cancellation failures.
- Apply the same explicit policy to all three operations rather than silently converting catalog errors to an empty catalog.
- Use a bounded timeout and caller-provided `AbortSignal`; cancellation must not be retried.
- Begin sequentially as the approved design states. If concurrency is enabled after owner validation, cap it explicitly and retain tracker-then-catalog sequencing per card.
- Isolate failures per card; a failed card must not erase or prevent safe observations from other cards.
- Empty but valid `accounts`, `trackers`, or `benefits` containers are distinct from malformed or failed responses.

## 8. Explicit mutation denylist and deny-by-default boundary

The pinned implementation and its linked findings identify these known mutation destinations on `https://functions.americanexpress.com`:

| Exact denied path | Denied path fragment | Evidence |
|---|---|---|
| `/CreateOffersHubEnrollment.web.v1` | `CreateOffersHubEnrollment` | Implemented mutation constant at [`src/amex-assistant.user.js#L80-L86`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L80-L86) |
| `/CreateCardAccountOfferEnrollment.v1` | `CreateCardAccountOfferEnrollment` | Legacy mutation documented at [`docs/FINDINGS.md#L109-L116`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L109-L116) |

No write request body or invocation procedure is reproduced here.

The safety rule must be stronger than the finite denylist:

1. Permit only the three exact tuples in section 1.
2. Deny every other origin, path, method, query, or body shape even if it does not match a known mutation fragment.
3. Instrument the two known fragments above as explicit fail-fast test sentinels.
4. Do not include a generic request function, generic `functions.americanexpress.com` permission, write constant, or offer client in the Phase 1 runtime.
5. `ReadOffersHubPresentation.web.v1` is a read endpoint in the reference, not a known mutation, but it is outside the requested account/tracker/catalog scope and therefore denied by omission.

The public source does not identify endpoint names for benefit enrollment, linking, activation, redemption, payment, dismissal, or other account changes. Their absence is not evidence that they are safe; deny-by-default covers them.

## 9. Reference normalization that must not be copied

| Reference behavior | Source | Required Phase 1 difference |
|---|---|---|
| Converts tracker quantities with `parseFloat` | [`src/amex-assistant.user.js#L1308-L1338`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1308-L1338) | Validate and persist decimal strings; do not use floating point for persisted quantities |
| Defaults missing/invalid target and spent to zero | Same block | Represent absent fields as `not_exposed` and invalid fields as `unrecognized` |
| Defaults missing/invalid currency symbol to `$` | Same block | Do not infer USD from an absent symbol |
| Derives missing remainder as `target - spent` | Same block | Persist remaining only when explicitly exposed |
| Infers month/quarter/half/year from date span or substring matching `trackerDuration` | [`#L1281-L1306`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1281-L1306) | Preserve explicit period evidence; do not manufacture cadence from dates |
| Derives display digits from the final token characters when explicit digits are absent | [`#L1053-L1067`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1053-L1067), [`#L1188-L1196`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1188-L1196) | Require explicit four- or five-digit response fields; never derive display identity from an opaque token |
| Removes non-digits and slices the final five from any candidate number | [`#L1070-L1093`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1070-L1093) | Reject values that expose more than the approved four/five ending digits rather than retaining or truncating full number material |
| Defaults missing top-level relationship to `BASIC` and supplementary to `SUPP` | [`#L935-L967`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L935-L967), [`#L1188-L1200`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1188-L1200) | Missing/unknown relationship is incomplete/unrecognized |
| Reads benefits only for exact `BASIC` cards | [`#L1440-L1455`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1440-L1455) | Do not copy primary-only filtering; retain characterized supplementary physical cards |
| Treats every account with a token as a card | [`#L924-L967`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L924-L967) | Positively classify supported card records; unknown/non-card variants affect completeness |
| Drops `category === "spend"` and `targetUnit === "PASSES"` trackers from tracked rows | [`#L1352-L1365`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1352-L1365) | Preserve trackable spend-progress and non-monetary counters with their explicit units |
| Infers catalog target from a dollar amount embedded in the title | [`#L1399-L1437`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1399-L1437) | Do not infer quantities from title text |
| Forces catalog-only candidates to yearly period, USD symbol, zero spent, and target remainder | Same block | Use observed/not-exposed/unrecognized fields; do not manufacture period, unit, amount, or progress |
| Includes only not-enrolled catalog candidates whose inferred dollar target is positive | [`#L1488-L1505`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1488-L1505) | Include characterized enrollment candidates even when non-monetary; exclude only purely informational entries without user-specific state |
| Applies a status-fragment regex for inactive state | [`#L5128-L5137`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L5128-L5137) | Use reviewed exact status mappings; unknown values remain unrecognized |
| Silently converts absent/malformed account arrays to `[]` and catalog failures to `{}` | [`#L919-L922`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L919-L922), [`#L1374-L1381`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1374-L1381) | Distinguish valid empty envelopes from transport/schema failure |
| Groups across physical cards by normalized name, sums quantities, and re-derives remainder | [`#L1567-L1615`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1567-L1615) | Keep per-card observations separate; conflicting indistinguishable identities make the card incomplete |
| Keeps raw account tokens in broad in-memory UI state | [`#L2454-L2509`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2454-L2509) | Keep tokens inside the active scan/request closure, derive installation-local HMAC identity, and discard tokens at completion/cancellation/unload |
| Defaults keep-alive on, suppresses lifecycle events, touches page timeout state, and runs an interval | [`#L2753-L2859`](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L2753-L2859) | No keep-alive, lifecycle suppression, synthetic activity, polling, or background scan |

## 10. Implementation-ready boundary summary

1. Enable scanning only after the user presses **Scan all cards** on an approved Amex benefits path.
2. Construct only the three fixed requests in sections 1–2. The only caller-provided request value is the transient opaque account token for the two benefit reads.
3. Never read or construct Cookie, Authorization, CSRF, MFA, or browser-storage values. Never log request options or raw response values.
4. Validate each response at the transport boundary using only the fields in sections 3–5; reject unknown envelopes without retaining raw diagnostics.
5. Derive the installation-local card HMAC while the account token is in scan memory; persist neither token nor raw response.
6. Require explicit product name evidence and explicit four/five ending digits. Do not truncate or recover digits from tokens.
7. Join tracker and catalog records by `sorBenefitId` only within the same card/product observation. Treat absent/conflicting identity as incomplete.
8. Do not infer missing status, period, amount, remaining, category, enrollment, or unit fields.
9. Begin with sequential cards, bounded timeout, cancellation, one narrowly classified idempotent retry, and per-card failure isolation.
10. Reject redirects and every non-allowlisted destination. Fail fast on the two known mutation fragments.
11. Keep raw account/catalog/tracker objects and tokens scan-scoped; clear references in `finally`, on cancellation, timeout, and unload.
12. Persist only strict normalized observations plus approved HMAC-derived local identity metadata. No raw export, third-party transport, remote update metadata, keep-alive, or background work.

## External References

- [Pinned endpoint constants](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L73-L102) — exact origins, paths, locale, tracker limit, and concurrency cap.
- [Pinned request wrapper](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L797-L897) — credentials, headers, JSON parsing, error classes, and retry policy.
- [Pinned account parsing](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L914-L967) — account envelope and supplementary flattening.
- [Pinned card display extraction](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1053-L1119) — product and ending-digit candidate paths plus forbidden token fallback.
- [Pinned tracker request and parser](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1253-L1365) — exact request shape and response fields.
- [Pinned catalog request and parser](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/src/amex-assistant.user.js#L1367-L1505) — exact request shape, catalog fields, tracker join, and enrollment candidates.
- [Pinned synthetic response builders](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/mock-fetch.mjs#L41-L92) — tracker and catalog field shapes without live data.
- [Pinned benefits tests](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/test/benefits.test.mjs#L39-L93) — `Accept: */*`, primary-only filtering, remainder inference, and dropped tracker classes.
- [Pinned public API findings](https://github.com/olddonkey/amex-assistant/blob/4c66c2041d89e11eed90dc7b63ad5b44dc7a2c87/docs/FINDINGS.md#L1-L60) — public account/auth/CORS claims and supplementary shape.
- [MDN `Request.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials) — browser credential-mode semantics.
- [MDN `Request.redirect`](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect) — Fetch redirect policy values.
- [MDN CORS guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) — cross-origin/preflight model.

## Related Specs

- `.trellis/tasks/07-15-amex-card-benefit-sync/prd.md:47-114` — approved manual read-only scan, identity, normalization, local persistence, and private API boundary.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:9-24` — exact read allowlist and minimum userscript authority.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:83-105` — endpoint contract, client, and response-adapter responsibilities.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:226-282` — HMAC identity and API scan flow.
- `.trellis/tasks/07-15-amex-card-benefit-sync/design.md:352-384` — synthetic fixtures, deny instrumentation, and owner-only validation boundary.
- `.trellis/tasks/07-15-amex-card-benefit-sync/implement.md:29-52` — implementation gate for exact endpoint definitions and redacted synthetic response tests.

## Caveats / Not Found

- The endpoints are undocumented private Amex contracts and may change without notice. The pin establishes what the reference constructed at that revision, not current issuer support.
- The pinned public repository does not characterize a reliable card/non-card discriminator in the member response. Positive non-card filtering remains unresolved from public evidence.
- The public evidence does not provide an exhaustive account relationship enum. Only `BASIC` and `SUPP` are directly represented as member-shape values.
- The public evidence does not provide exhaustive tracker `status`, catalog `layoutType`, linking-required, activation, completion, or activity-kind mappings. Synthetic examples are not a complete issuer enum.
- No catalog category field is consumed or represented by the linked catalog fixture. Category is publicly evidenced only on tracker records.
- `sorBenefitId` joins tracker and catalog for a card/product, but the source explicitly says it can differ across card products.
- The source does not validate response `Content-Type`, redirect destination, response schema, timeout, or cancellation.
- The source's claim that ordinary Fetch works across the two Amex origins depends on Amex CORS/cookie configuration and userscript execution behavior; this must be confirmed only through the separately bounded owner validation without recording live bodies, headers, cookies, or tokens.
- No live owner data or authenticated browser state was accessed for this research.
