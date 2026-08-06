# Design — Category-drift global-benefit repair

## Boundaries

The original exact classifier and `CatalogMigrationLedger` remain historical truth. A separate `GlobalBenefitCategoryRepair` overlay records a reviewed category exception and supplies runtime suppression/canonical authority only while `phase = APPLIED`.

No request path performs relaxed matching. Discovery and manifest creation are operator-only; runtime consumes database evidence by exact IDs and catalog-bound targets.

## Data model

Add a parent repair record keyed one-to-one to the legacy benefit and original migration ledger. Store owner/card/global targets, target catalog keys, immutable definition fingerprint, reviewed graph/destination/manifest/plan fingerprints, evidence version, and APPLIED/ROLLED_BACK timestamps.

Add occurrence evidence for every promoted or removed status: action, exact cycle/occurrence, keeper identity and baseline, removed source kind and complete versioned preimage, target catalog key, and repair-added audit metadata. Keep canonical global targets restrictive during the rollback window, but cascade repair evidence with user-owned source/ledger/owner/card/parent/keeper lifecycle so `ROLLED_BACK` history cannot block deletion forever; authenticated mutations reject those deletions while evidence is `APPLIED`. Deleted-row IDs remain scalar evidence rather than foreign keys.

## Discovery and manifest

A candidate is ownerless, card-linked, `CUSTOM / CLASSIFIED`, on an already globally linked card, with one same-product definition matching every shape field except category and agreeing with all non-null provider identity. Same-owner custom definitions are excluded before relaxed matching.

Discovery emits aggregate proposals plus a private manifest. The manifest binds the complete strict-custom inventory, each source/ledger/card, target catalog keys, current graph, destination, and entry digest. Apply accepts no inferred or unmanifested row.

## Status planning

Pair only exact user/card/target/start/end/occurrence tuples. Classify state using usage, completion/completedAt, usability, order, provenance, and inbound audits. A losing row must be pristine/unattached or exactly equal to a keeper and unattached.

Prefer the meaningful/history-bearing row. If both are pristine or exactly equal without attachments, preserve the legacy status. Conflicting state, dual attachments, non-exact overlap, or duplicate destinations block the definition. Safe definitions on one card can proceed only after the full card graph proves destination uniqueness.

## Apply and rollback

Apply re-reads the full graph in a serializable transaction, re-plans against the reviewed fingerprint, stores rollback evidence before deletion, uses raw SQL compare-and-set, promotes the keeper or retains canonical state, and verifies one canonical authority plus complete protected-state parity before commit.

Rollback preserves current mutable keeper state. It clears only repair-added links/audit metadata and recreates removed rows from exact snapshots using catalog-key-rebound global IDs. New provenance/audits, AMEX writes, source/cycle drift, occupied IDs/keys, cleanup, or evidence mismatch close rollback.

## Runtime integration

- Cron excludes only benefits with exact active repair evidence.
- Effective projection accepts a historical-custom bridge only with matching active repair evidence and uses canonical terms/read-only capability.
- Custom update/delete and card deletion reject active repairs.
- AMEX loading marks bridge authority as strict-standard, active-category-repair, or invalid; invalid retained-benefit global links are not writable.
- Strict migration replay accounts for active evidence but still reports historical custom classification; generic cleanup ignores it.
- Manual legacy migration/template/duplicate-status utilities are not deployed request paths, but remain executable; they must fail closed before mutating a repair-bearing card, keeper, or exact occurrence tuple. Broad superseded utilities are deprecated, while the bounded active-status utility receives a narrow transactional guard.
- Clone includes repair/evidence rows and rebinds all global targets/snapshots by catalog key.

Do not change dashboard deduplication or add virtual category-based hiding; repaired data has one live status per occurrence, while blocked rows remain honestly visible.

## Development rehearsal harness

The checked-in rehearsal is a development-only orchestrator around the existing operator and Prisma adapter, not a second planner or writer. It validates process-supplied `DATABASE_URL_DEV`, an exact private development database/schema/branch identity fingerprint, exact private expected/forbidden host and branch fingerprints, raw/effective AMEX `off`, recovery attestation, and the exact rehearsal phrase before constructing one lazy development client. Existing destination identity machinery independently verifies database/schema/branch and is repeated immediately before every fixture/operator/CAS/provenance/cleanup write.

The fixture is an invented first-page `example.invalid` graph bound to one catalog-key-sorted writable AMEX definition. It bootstraps historical ledger evidence through adapter `readBatch` and `legacyBenefitSourceFingerprint`, keeps all manifests/fingerprints/snapshots in memory, and exercises deterministic discover/dry-run, apply/replay, centralized suppression/effective/AMEX authority through an explicitly injected client, keeper-state CAS, rollback, fresh reapply, provenance-drift closure, exact provenance removal, and final rollback parity. Cleanup is exact and only after `ROLLED_BACK`/absent evidence; safe recovery never force-deletes active/invalid evidence. The CLI emits a closed boolean/count report and one fixed failure sentence.

The optional client parameter on `loadAmexSyncDestinationContext` is server-internal. One-argument request/service callers retain lazy process-singleton behavior, and no request DTO can select a database.

Harness code and mocked tests complete only the static implementation gate. The PRD's live verified-development rehearsal acceptance criterion remains open until separately authorized execution.

## Operational safety

CLI modes are discover, dry-run, apply, rollback-preview, and rollback. Discovery can write a new permission-restricted private page manifest; rollback-preview is explicitly no-write and derives its reviewed page fingerprint from persisted evidence plus the original manifest. Writes require bounded pages, exact private manifest digest, reviewed page fingerprint, target/recovery/AMEX-off attestations, and distinct exact phrases. Output is aggregate-only. Production application remains a separate parent-task gate.
