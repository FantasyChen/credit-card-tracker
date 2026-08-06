# Design — Production category-drift repair

## 1. Boundary and authority

This task applies the already implemented category-only repair to every safely
eligible production account. Eligibility is not inferred from dashboard content.
It comes only from deterministic discovery of ownerless, card-linked,
`CUSTOM / CLASSIFIED` legacy definitions that differ from exactly one canonical
same-product definition in category alone and are covered by an exact private
manifest.

Blocked, ambiguous, attached, cross-owner, non-category-drift, graph-drifted, or
unmanifested units retain their existing rows and remain visible. Production AMEX
stays effectively `off` for the complete task. Strict legacy cleanup, repair
evidence deletion, provider/userscript activity, and AMEX reactivation are separate
future decisions.

## 2. Deployment and schema sequence

The repair implementation is schema-dependent on
`GlobalBenefitCategoryRepair` and `GlobalBenefitCategoryRepairOccurrence` from
ordinary authenticated and cron paths. Production therefore uses migration-first
sequencing:

1. Verify the currently recorded effective-AMEX-off evidence is still current.
2. Create a fresh no-compute recovery branch from the exact production branch and
   verify the recovery parent privately.
3. Verify pooled/application and direct/migration production identities immediately
   before schema access.
4. From an isolated workspace containing only copied Prisma schema/migrations and
   no dotenv files, apply only the reviewed additive repair migration.
5. Independently verify migration state and required tables.
6. Release the reviewed schema-dependent application, require a Ready immutable
   deployment, and prove the primary alias resolves to the same deployment ID.

Any missing-table behavior, migration divergence, target mismatch, deployment
mismatch, or uncertain mode stops the rollout without repair reads or writes.

## 3. Aggregate-only parity verifier

No checked-in production parity command currently proves the complete allowed
delta for category repair. Before production discovery or apply, add a narrow
operator/verifier with mocked tests and a closed report schema.

The verifier has two database-backed modes, both requiring explicit target
verification before their first read:

- `capture` writes a new `0600` private baseline file without overwriting an
  existing path. It binds the complete repair inventory/page manifests, exact
  keeper identities and protected-state digests, occurrence tuples, relevant
  audit/provenance attachment digests, table counts, and an unrelated-row digest.
- `verify` accepts that private baseline plus the reviewed manifests, reloads the
  current graph, classifies repair authority centrally, and checks only the exact
  deltas authorized by the manifests and persisted repair evidence.

The verifier must prove:

- every manifest-covered safe unit is `APPLIED_VALID` and every blocked/ineligible
  unit is unchanged;
- keeper ID, owner, cycle instants, occurrence, used amount, completion,
  `completedAt`, usability, order, timestamps, and pre-existing attachments are
  preserved;
- every removed occurrence is the exact evidence-backed loser and no additional
  status is absent;
- each repaired occurrence has one canonical effective authority and no remaining
  visible duplicate from its repaired source;
- repair parent/occurrence evidence and explicitly repair-added audit metadata are
  the only expected additions;
- unrelated users, cards, definitions, statuses, audits, provenance, and other
  protected rows have identical counts and digests.

Console output contains only mode, boolean gates, aggregate counts, action counts,
and closed stop counts. It never contains private paths, cursors, manifests,
fingerprints, target identities, account identifiers, row identifiers, or row
values. A mismatch is a hard stop and never triggers compensating writes.

## 4. Discovery and private manifests

Discovery runs twice over the complete bounded inventory. Each page in each pass
uses a unique private `0600` manifest path; cursors and fingerprints are read only
inside the private operator boundary. The two passes must have identical page
boundaries, aggregate counts, action counts, stop counts, and private manifest
authority.

The all-account scope is satisfied only when pagination reaches `hasMore = false`
and every safely eligible manifest entry across all pages has a reviewed
disposition. Private manifests are never copied to Git, task files, chat, or
sanitized evidence.

## 5. Bounded apply and replay

Apply proceeds one reviewed page at a time. Immediately before every page writer,
reverify:

- exact production application/direct target identity;
- the fresh recovery point;
- effective AMEX mode `off` on the primary alias;
- inventory, manifest, page, graph, destination, plan, and postimage authority;
- the exact apply confirmation phrase.

Each definition remains one serializable transaction. Evidence and complete loser
preimages persist before deletion. The history-bearing keeper is retained; if both
rows are pristine/equal, the legacy status remains the keeper. The writer deletes
only an unattached pristine or exactly equal redundant loser and verifies protected
state before commit.

After each page, rerun the same page in apply mode to prove idempotency, then run
the parity verifier against that page and the cumulative baseline. Any stop or
unexpected delta ends the rollout before the next page.

## 6. Runtime and user verification

After all pages pass replay and parity:

- effective-benefit reads must classify repaired units as `APPLIED_VALID`, suppress
  only the historical custom source, and project canonical read-only terms;
- AMEX remains `off`, even though valid repaired relations would later be eligible
  for separately authorized global authority;
- one representative authenticated repaired account, including the originally
  reported account when eligible, must show a single canonical entry with the same
  usage/completion history.

The dashboard check is confirmation of the repaired projection, not repair
authority. It may not be used to widen matching or manually hide rows.

## 7. Rollback and stop policy

Rollback is not automatic. On unexpected production behavior, preserve the
recovery point and private evidence, stop all later pages, and choose separately
between evidence-scoped rollback, forward repair, or provider recovery after impact
review. Do not issue compensating writes merely because one unit or parity check
failed.

Evidence-scoped rollback, if separately approved, uses the original manifest and
rollback preview, preserves current mutable keeper state, restores only exact
removed preimages, clears only repair-added metadata, and refuses new
audit/provenance/AMEX activity, occupied identities, source/cycle drift, cleanup,
or catalog rebinding failure.
