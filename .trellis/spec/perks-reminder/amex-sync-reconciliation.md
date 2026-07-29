# AMEX Sync Reconciliation

## Scenario: catalog-mapped, exact-card, confirmed AMEX synchronization

### 1. Scope / Trigger

Use this contract when complete local `amex-benefits/3` observations are projected into a first-party AMEX sync envelope, previewed for an authenticated user, and optionally confirmed to update durable benefit status.

This is the current contract for production userscript `0.5.1` and `amex-sync-envelope/3`; envelope V3 began during development at userscript `0.5.0`, and the final production artifact increases that already-installed version strictly. It supersedes the historical Platinum-only envelope-V2 mapping contract in [Browser-Side Authenticated Read Integrations](browser-read-integrations.md). The local reader remains product-independent; destination identity is introduced only at the synchronization boundary.

The shared AMEX catalog contains 12 products and 56 period-specific benefit rows. Every row has stable destination identity and source-semantics classification. Only provider `usage` credits receive write authority; `spend`, certificate, and status/access rows remain keyed but unwritable.

### 2. Signatures

#### Observation and envelope

```ts
const OBSERVATION_CONTRACT_VERSION_V3 = "amex-benefits/3";
const PARSER_VERSION = "amex-api-us/3.0.0";
const AMEX_SYNC_ENVELOPE_VERSION = "amex-sync-envelope/3";

interface AmexSyncRow {
  providerTitle: string;
  providerCategory: "usage";
  sourceCreditKey: string;
  creditFamilyKey: string;
  sourcePeriod: SourcePeriodV2 | null;
  enrollmentState: EnrollmentState | null;
  completionState: "complete" | "incomplete" | null;
  earnedOrUsed: QuantityV1 | null;
  targetOrLimit: QuantityV1 | null;
}

interface AmexSyncCard {
  sourceLocalCardId: string;
  providerProductName: string;
  productKey: string;
  endingDigits: string; // exactly five decimal digits
  observedAt: string;
  parserVersion: "amex-api-us/3.0.0";
  rows: AmexSyncRow[];
}

interface AmexSyncEnvelopeV3 {
  envelopeVersion: "amex-sync-envelope/3";
  observationContractVersion: "amex-benefits/3";
  scanId: string;
  scanFinishedAt: string;
  cards: AmexSyncCard[];
  exclusions: Array<{ reason: SyncExclusionReason; count: number }>;
}
```

Local `NormalizedCardObservationV3` continues to accept explicit four- or five-digit endings for observation compatibility and contains no `productKey`; local benefit observations contain no destination family. Sync projection requires exactly five digits and carries bounded provider evidence plus browser claims for independent server verification.

#### Closed handoff targets

```ts
type AmexSyncHandoffTargetName = "production" | "local";

type AmexSyncHandoffOrigin =
  | "https://www.perks-reminder.com"
  | "http://localhost:3000";

resolveAmexSyncHandoffTarget(
  name: unknown,
): AmexSyncHandoffTarget; // throws for any other value

resolveAmexSyncHandoffTargetForOrigin(
  origin: string,
): AmexSyncHandoffTarget | null;
```

Build commands and identities are separate:

```bash
npm run build:amex-userscript       # production 0.5.1
npm run build:amex-userscript:local # local 0.5.0-local.3
npm run check:amex-userscripts
```

The production artifact remains `build/amex-benefit-reader.user.js`, namespace `https://perks-reminder.com/`, and targets only the production handoff. Production `0.5.1` must compare strictly newer than the previously installed `0.5.0`; reusing a version fails the artifact check. The ignored `build/` output is not distributed by Vercel, so application deployment does not publish or update the userscript. Production artifact publication/installation remains a separate authorized release action. The ignored local artifact is `public/local-development/amex-benefit-reader.local.user.js`, namespace `http://localhost:3000/perks-reminder-amex-reader-local/`, and targets only the exact localhost handoff. Build target, destination URL, page activation, accepted message origin, and `postMessage` destination are compiled into each artifact; no runtime input may select an arbitrary origin.

#### Product and credit resolution

```ts
resolveAmexBrowserProduct(productName: string): AmexProductResolution;

matchAmexBrowserSyncCredit(
  productName: string,
  trackerTitle: string,
  evidence?: AmexSourceCreditEvidence,
): AmexBrowserSyncMatch | null;

resolveServerAmexProduct(productName: string): string | null;

resolveServerAmexCredit(
  productKey: string,
  providerTitle: string,
  evidence?: AmexSourceCreditEvidence,
): ServerCreditDescriptor | null;
```

Browser and server registries are independently enumerated. Product resolution checks reviewed exact aliases first, then bounded fuzzy matching with minimum score `0.88`, minimum runner-up margin `0.10`, and hard business/consumer, tier, and cobrand conflicts. Benefit resolution is product-scoped: an exact alias wins; otherwise exactly one descriptor must satisfy required tokens, forbidden tokens, compatible period, and optional USD amount constraints.

#### Catalog identity

```ts
type AmexSourceSemantics =
  | "usage"
  | "spend"
  | "certificate"
  | "status_or_access";

interface AmexCatalogBenefitIdentity {
  creditFamilyKey: string;
  periodKey: AmexPeriodKey;
  sourceSemantics: AmexSourceSemantics;
  sourceCreditKey: string | null;
}
```

The 13-value `AmexPeriodKey` vocabulary covers calendar month, December month, recurring quarter, Q1–Q4, H1/H2, calendar year, anniversary quarter, and anniversary year. The catalog has 47 writable destination rows backed by 35 independently authorized source credits; non-`usage` rows always have `sourceCreditKey: null`.

#### Preview, confirmation, and card skips

```ts
interface AmexSyncCardSkip {
  destinationCardId: string;
  reason: "destination_last_five_required";
  label: string;
  editHref: string; // /cards/{owned-id}/edit#lastFourDigits
}

previewAmexSync({
  userId,
  envelope,
  mode,
  hmacKey,
  now,
}): Promise<{
  mode: "preview" | "write";
  rows: PublicAmexSyncRowResult[];
  proposalToken: string;
  proposalExpiresAt: string;
  cardSkips: AmexSyncCardSkip[];
}>;

confirmAmexSync({
  userId,
  envelope,
  proposalToken,
  hmacKey,
  now,
}): Promise<{
  attemptId: string;
  replayed: boolean;
  rows: PublicAmexSyncRowResult[];
  updatedCount: number;
}>;
```

Requests contain no manual mapping collection. Responses contain no mapping options. The handoff renders each missing-last-five destination card once with the server-derived edit link and offers no identity bypass.

#### Group persistence

```ts
planAmexSync({
  envelope,
  context,
  userId,
  now,
  transitionTime,
}): AmexSyncPlan;

applyAmexSyncGroup({
  attemptId,
  userId,
  rows,
}): Promise<StoredRowResult[]>;
```

Ordinary source observations produce one-row atomic groups. Platinum December Uber produces one two-row group. The grouped write requires at least two rows with the same `atomicGroupIdentity` and applies every status/provenance/audit change in one serializable transaction.

#### Backfill operator

```ts
const AMEX_CATALOG_BACKFILL_CONFIRMATION =
  "FILL_NULL_AMEX_CATALOG_KEYS";

runAmexCatalogBackfillOperator({
  mode?,                 // "dry-run" by default, or "apply"
  confirmApply?,         // exact confirmation phrase for apply
  targetVerified?,       // must be true for apply
  limit?,                // 1..500, default 250
  referenceDate?,
  after?: { predefined?: string; user?: string },
  database?,
} = {}): Promise<AmexCatalogBackfillOperatorReport>;
```

Operator command:

```bash
npm run backfill:amex-catalog -- [--dry-run | --apply] \
  [--confirm=FILL_NULL_AMEX_CATALOG_KEYS] \
  [--target-verified] [--limit=N] \
  [--after-predefined=ID] [--after-user=ID]
```

With no mode flag, the command is dry-run. `--apply` and `--dry-run` are mutually exclusive. Running either mode against a database remains a separately authorized operational action; implementation tests use injected fakes and do not connect to a database.

### 3. Contracts

1. **Catalog completeness is not write authority.** All 12 products and 56 benefit rows have stable product/family/period identity and one source-semantics classification. Only `usage` entries with a non-null source credit may be browser-projected and server-authorized.
2. **Local observation stays product-independent.** The reader retains every eligible tracker-backed `usage` row for a top-level `BASIC` card without destination keys. Sync matching never changes local admission or persisted observation identity.
3. **Provider evidence crosses a bounded V3 boundary.** Envelope V3 carries bounded provider product/title/category evidence, claimed source/destination semantic keys, explicit status fields, and exact five digits. It carries no raw response, provider token, cookie, authorization material, destination database ID, user ID, or manual mapping.
4. **Browser and server both resolve evidence.** The browser may claim a product/source credit; the server independently resolves the same evidence and rejects claim mismatch, ambiguity, hard conflict, unsupported source, incompatible period, or amount constraint failure.
5. **Product fuzzy matching is bounded.** Exact aliases win. Fuzzy acceptance requires score at least `0.88`, margin at least `0.10`, and no hard business/consumer, tier, affiliation, or cobrand conflict. There is no nearest-product fallback or manual confirmation.
6. **Benefit matching is structured and product-scoped.** Exact title aliases win. Otherwise exactly one descriptor must satisfy required/forbidden token groups and evidence constraints. Duplicate rows for the same source-credit/period are excluded independently; they do not suppress unrelated benefits on the same card.
7. **Card authority requires exact last five.** A destination card must be owned by the authenticated user, active, issued by AMEX, keyed to the resolved product, store exactly five digits, and equal the source digits. Exactly one match is required. Names, four-digit suffixes, manual selections, and retained `ExternalCardMapping` rows never authorize a write.
8. **Preview and confirmation remain separate.** Preview is read-only. Confirmation requires effective `write` mode and a valid short-lived proposal bound to user, mode, envelope, ordered row/group identities, exact card identity, destination plan, before state, transition time, and expiry.
9. **Transaction-time identity is mandatory.** Every status write reloads and rechecks owner, issuer, active lifecycle, product, exact five digits, destination card/benefit/status IDs, destination keys, cycle range, occurrence, before state, and monotonic provenance. Source period boundaries authorize by UTC calendar date; after that check passes, the final compare-and-set must use the exact persisted `cycleStartDate` and `cycleEndDate` instants loaded inside the same transaction. It must not reconstruct midnight timestamps because materialized inclusive cycle ends may be end-of-day instants. Any change returns `conflict_repreview_required` and writes no successful status/provenance/audit result.
10. **Explicit AMEX fields are authoritative.** Explicit `earnedOrUsed` replaces `usedAmount`, including decreases and zero. Explicit completion sets or clears completion. Omitted fields preserve local values; an omitted benefit produces no plan row. `isNotUsable` is never overwritten and causes a fail-closed skip.
11. **Completion timestamps follow transitions.** Incomplete-to-complete uses the proposal transition time; complete-to-complete preserves the existing timestamp; complete-to-incomplete clears it; omitted completion preserves it.
12. **December Platinum Uber is atomic.** For an exact December base-Platinum Uber observation, allocate `min(total,$15)` to monthly and `min(max(total-$15,$0),$20)` to the December bonus. Missing/invalid/non-USD/negative or greater-than-$35 aggregate evidence rejects both. Both destination rows update or neither does.
13. **Period resolution is closed.** Calendar periods require exact UTC boundaries. Anniversary periods require exact equality with an already materialized destination status cycle. Missing, malformed, or mismatched periods remain unwritable.
14. **Backfill is additive and dry-run-first.** The operator uses deterministic ID-ascending batches and independent cursors, fills only null keys through serializable compare-and-set writes, preserves non-null conflicts, limits materialization to 24 statuses per benefit, uses `skipDuplicates`, and never changes existing status amount/completion/usability. Apply additionally requires the exact phrase and `targetVerified === true`.
15. **Rollout stays gated.** Application and userscript envelope changes are coordinated at production userscript `0.5.1`, which strictly supersedes the previously installed `0.5.0`. Vercel does not distribute the ignored production artifact; publication/installation, live AMEX validation, database dry-run/apply, and production write-mode enablement remain separately authorized.
16. **Local handoff is a separate compiled identity.** Production `0.5.1` remains fixed to `https://www.perks-reminder.com`. Local `0.5.0-local.3` has a different Tampermonkey name/namespace/output path, opens and activates only on exact `http://localhost:3000/integrations/amex-sync`, and never silently updates or replaces production. The localhost app requires `event.source === window`; the local Tampermonkey bridge compares against and posts through its granted `unsafeWindow`, which is that same localhost page-realm window rather than the userscript sandbox wrapper. Both sides still require the exact compiled/current approved origin. The production artifact retains its original grants and page-window handling. API requests additionally retain same-origin fetch and content-type guards. Local write testing requires `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` set to exact localhost, an explicit `AMEX_SYNC_MODE`, a development-only HMAC key of at least 32 characters, and the verified development-database wrapper. Because both identities match AMEX and share one reader panel host, disable the production identity while the local identity is enabled, then reverse that choice during cleanup.
17. **Card prerequisite edits preserve the accepted handoff in memory.** A server-projected card edit URL must pass the strict anchored internal `/cards/{id}/edit#lastFourDigits` response validator before the mailbox is acknowledged. The UI opens it in a separate `noopener noreferrer` tab and keeps the validated envelope only in the original page's React memory. After saving, an explicit refresh reuses that envelope for a new read-only preview, clears any prior confirmation result, and atomically replaces the old preview/proposal only after strict response validation. Refresh and confirmation share one in-flight guard and never run concurrently. No envelope or proposal is placed in a URL, browser storage, cookie, or durable resume record; invalid or expired refresh requires a fresh AMEX scan and handoff.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Local card has four digits | Keep valid local V3 observation; exclude it from sync with `source_last_five_required` |
| Owned active AMEX destination card has null/four-digit ending | Return one card-level `destination_last_five_required` skip with a strictly validated internal edit link; no row write or mapping selector |
| User follows a prerequisite edit link | Open the existing card editor in a separate `noopener noreferrer` tab so the accepted handoff remains in the original page's memory |
| User refreshes after saving card details | Clear any prior confirmation result, request a new preview with the retained envelope, and replace the old rows/proposal only after strict response validation |
| Refresh and confirmation overlap | Allow only the first action; disable or ignore the other until the in-flight request finishes |
| Refreshed handoff is invalid or expired | Fail closed, remove confirmation controls, and require a fresh AMEX scan plus **Sync reviewed** handoff |
| Card edit URL is external, malformed, or not the anchored internal route | Reject the preview before mailbox acknowledgement and render no edit link |
| Zero or multiple exact destination cards | Skip as missing/ambiguous; names and saved mappings do not resolve it |
| Exact product alias | Resolve with score `1` |
| Fuzzy score below `0.88`, margin below `0.10`, tie, or hard conflict | Reject product mapping; do not choose the nearest product |
| One exact product-scoped benefit alias | Prefer it over structured non-exact candidates |
| Exactly one structured product-scoped benefit candidate | Accept only when period/amount evidence is compatible |
| Duplicate source credit in the same source period | Exclude that duplicate group on browser and server; preserve unrelated source credits |
| Category is `spend`, certificate, status/access, or non-credit wording | Retain only as allowed by local observation rules; never project/authorize a status write |
| Browser claim differs from independent server evidence | `source_evidence_mismatch` or `source_mapping_ambiguous`; no destination write |
| Explicit amount differs from local amount | Replace local amount, including decrease or zero |
| Explicit completion differs from local completion | Set or clear completion and transition timestamp accordingly |
| Amount or completion is omitted | Preserve only the omitted field |
| Entire source benefit is omitted | Produce no plan row and leave destination unchanged |
| Destination is marked not usable | `destination_not_usable`; never clear the flag |
| December Uber aggregate is `$0..$35` | Produce two destination rows in one atomic group with sequential `$15/$20` allocation |
| December Uber amount is missing, invalid, non-USD, negative, or above `$35` | Reject both rows as `amount_incompatible`; never truncate |
| Card/destination/before state changes after preview | `conflict_repreview_required`; write no status, provenance, or successful audit |
| Authorized status has an inclusive end-of-day cycle end | Compare the proposal period by UTC calendar date, then use the transaction-loaded exact cycle instants in the final compare-and-set |
| Persisted cycle resolves to a different UTC calendar date | `conflict_repreview_required` before mutation or provenance work |
| Completed attempt is replayed | Return durable stored results; do not repeat writes |
| Backfill runs with no mode | Dry-run only |
| Backfill apply lacks exact phrase or verified-target attestation | Reject before any writer call |
| Backfill sees non-null conflicting keys or runtime CAS conflict | Preserve existing values and report conflict |
| Backfill has another bounded batch | Return `hasMore` and the appropriate next cursor |
| Production artifact runs on localhost or local artifact runs on production | Remain inactive; never read or acknowledge a mailbox |
| Handoff page has an unsupported origin/path, wrong `event.source`, or cross-target message | Fail closed; do not preview, acknowledge, or clear the mailbox |
| Local request uses a non-3000 port, non-HTTP scheme, or `NEXT_PUBLIC_SITE_URL` is not exact localhost | Reject the request origin |
| Local and production builds would share identity/output or contain an unapproved origin/config marker | Fail the artifact audit |
| Envelope V2/manual-mapping field/unknown field is submitted | Strict request/schema rejection; require a fresh compatible scan |

Request boundary failures remain finite: `origin_rejected`, `content_type_invalid`, `request_too_large`, and `request_invalid`. Successful preview/confirmation DTOs remain strict, bounded, and phase-specific.

### 5. Good / Base / Bad Cases

- **Good:** A five-digit base Platinum observation has one December Uber usage row. Browser and server independently resolve the product/source credit, preview resolves one owned active AMEX destination card, confirmation revalidates both destination statuses, and one serializable group applies monthly and bonus status/provenance/audits atomically.
- **Good:** AMEX reports a lower used amount or explicit incompletion. The exact destination status is overwritten downward and completion is cleared; unrelated fields and benefits remain unchanged.
- **Base:** One source benefit is duplicated while another is unique. The duplicate source-credit/period is excluded, while the unique row remains previewable and writable.
- **Base:** A relevant owned destination card lacks five digits. Preview remains read-only, returns one actionable card skip, and offers no manual mapping. The edit link opens in a separate protected tab; after saving, the user returns to the retained sync page and explicitly refreshes to obtain a replacement preview/proposal.
- **Base:** An authorized local manual test installs the separately named local artifact, launches the app with exact localhost site/auth origins and a development-only HMAC key through `dev:devdb`, then performs the same preview/confirm flow without changing production metadata or origin authority.
- **Bad:** Navigate away from the only accepted handoff page, put the envelope/proposal into a URL or browser storage, accept an arbitrary `returnTo`, or confirm with the old proposal after card identity changes.
- **Bad:** Fuzzy-match every source to its nearest catalog product, match benefits globally by merchant or amount, trust browser keys, or let a saved mapping bypass product/last-five equality.
- **Bad:** Treat a missing benefit or omitted completion as zero/incomplete, derive a destination reset from absence, or overwrite `isNotUsable`.
- **Bad:** Run the backfill in apply mode because the command name contains `backfill`, without separately verifying the database target and supplying the exact confirmation phrase.

### 6. Tests Required

For every change to this contract, assert:

- catalog count and key invariants: 12 products, 56 classified period rows, unique destination tuples, no source credit for excluded semantics, and server/browser writable-set agreement;
- exact aliases, score `0.88`, immediately-below threshold, margin `0.10`, immediately-below margin, ties, and business/consumer/tier/cobrand hard conflicts on both browser and server;
- product-scoped exact-first benefit resolution, one structured candidate, zero/multiple candidates, forbidden tokens, incompatible periods/amounts, and independent duplicate-group exclusion;
- envelope V3 exact-five requirement, bounded payload limits, forbidden fields, V2/manual-field rejection, and local four-digit observation compatibility;
- authenticated ownership, issuer, lifecycle, product, exact-last-five, zero/duplicate card behavior, saved-mapping non-authority, and card-skip edit links;
- complete period vocabulary, exact UTC calendar boundaries, and anniversary-cycle equality;
- amount increase/decrease/zero, completion set/clear, field omission, whole-benefit omission, not-usable skip, unchanged/replay, stale/conflicting provenance, and unrelated-row isolation;
- December allocation at `$0`, `$15`, between `$15` and `$35`, exactly `$35`, above `$35`, missing/invalid evidence, missing destination, preview conflict, and two-row transaction atomicity;
- proposal binding, completed replay, partial retry, compare-and-set failure, audit/provenance atomicity, exact transaction-time card/destination revalidation, real inclusive end-of-day cycle timestamps in single/grouped writes, and different-calendar-cycle rejection before mutation;
- handoff strict DTO validation, one card-level prerequisite per destination card, anchored internal edit-URL rejection before acknowledgement, card-specific accessible new-tab links with `noopener noreferrer`, memory-only envelope retention, explicit refresh loading/error states, refreshed preview/proposal replacement, stale-proposal non-use, refresh/confirm exclusion, no mapping controls, and distinct split rows;
- backfill default dry-run, apply authorization, bounded cursors, null-only updates, conflict preservation, status materialization cap/defaults, idempotency, and no existing-status reset;
- isolated production/local userscript builds and metadata audit proving distinct names, namespaces, versions, output paths, exact match scopes, compiled targets, absence of unapproved origins/config markers, and no local-build mutation of the production artifact;
- generated-bundle browser tests proving production/local cross-target inactivity, exact self-source/origin checks, local URL generation, mailbox acknowledgement/deletion parity, public DB invariant, strict TypeScript, targeted lint/Jest, sensitive-pattern scan, and `git diff --check`.

Do not use production build, Prisma generation/migration/seed, database backfill execution, or live AMEX/browser actions as routine verification.

### 7. Wrong vs Correct

#### Wrong

```ts
// Browser claim, closest product, and four-digit suffix become write authority.
const product = closestCatalogProduct(card.providerProductName);
const destination = userCards.find(
  (candidate) => candidate.lastFourDigits?.endsWith(card.endingDigits.slice(-4)),
);
await updateStatus(destination!.id, row.creditFamilyKey, row.earnedOrUsed);
```

#### Correct

```ts
const serverProduct = resolveServerAmexProduct(card.providerProductName);
if (!serverProduct || serverProduct !== card.productKey) return evidenceMismatch();

const serverCredit = resolveServerAmexCredit(
  serverProduct,
  row.providerTitle,
  { sourcePeriod: row.sourcePeriod, earnedOrUsed: row.earnedOrUsed },
);
if (!serverCredit || serverCredit.sourceCreditKey !== row.sourceCreditKey) {
  return evidenceMismatch();
}

const destination = resolveExactlyOneOwnedActiveAmexCard({
  userId,
  productKey: serverProduct,
  endingDigits: card.endingDigits, // exact /^\d{5}$/ equality
});
if (!destination) return cardNotAuthorized();

// Confirmation repeats exact identity, destination, before-state, and provenance
// checks inside the serializable transaction before compare-and-set persistence.
```

#### Wrong prerequisite edit resume

```tsx
// Same-tab navigation destroys the accepted in-memory envelope, while a callback
// URL cannot recreate a mailbox that has already been acknowledged and deleted.
<a href={skip.editHref}>Add five ending digits</a>
router.push("/integrations/amex-sync?proposal=...");
```

#### Correct prerequisite edit refresh

```tsx
<a href={skip.editHref} target="_blank" rel="noopener noreferrer">
  Add five ending digits
</a>

const refreshPreview = () => {
  if (!envelope || actionInFlight.current) return;
  // runPreview clears the prior result and replaces the preview/proposal only
  // after the strict response schema succeeds.
  void runPreview(envelope);
};
```

#### Wrong cycle compare-and-set

```ts
// Reconstructing midnight can never match a materialized inclusive end-of-day cycle end.
cycleEndDate: new Date(`${row.sourcePeriodEndDate}T00:00:00.000Z`),
```

#### Correct cycle compare-and-set

```ts
const currentStatus = await loadAuthorizedDestinationStatus(transaction, userId, row);
if (!currentStatus || !stateMatchesProjection(currentStatus, userId, row.before)) {
  throw new Error("conflict_repreview_required");
}

// Date authorization already passed; retain exact persisted instants in the final CAS.
cycleStartDate: currentStatus.cycleStartDate,
cycleEndDate: currentStatus.cycleEndDate,
```

#### Wrong backfill

```ts
await prisma.benefit.update({
  where: { id: candidate.id },
  data: inferredKeys,
});
```

#### Correct backfill

```ts
const report = await runAmexCatalogBackfillOperator({
  mode: "dry-run",
  limit: 250,
});
// Apply is a separate authorized operation requiring target verification and:
// confirmApply: "FILL_NULL_AMEX_CATALOG_KEYS"
```

#### Wrong local handoff

```ts
// Runtime input can redirect the privileged mailbox bridge anywhere.
const handoffOrigin = new URLSearchParams(location.search).get("origin")!;
window.postMessage(payload, handoffOrigin);
```

#### Correct local handoff

```ts
const target = resolveAmexSyncHandoffTarget(COMPILED_HANDOFF_TARGET);
if (window.location.origin !== target.origin) return;
const pageWindow = target.name === "local" && typeof unsafeWindow !== "undefined"
  ? unsafeWindow
  : window;
if (event.source !== pageWindow || event.origin !== target.origin) return;
pageWindow.postMessage(payload, target.origin);
// Local bridges the Tampermonkey sandbox to the same localhost page realm;
// production and local builds retain distinct identities, grants, and exact targets.
```
