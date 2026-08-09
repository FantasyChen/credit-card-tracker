# Sanitized production global-catalog synchronization — 2026-07-29

## Authorization and scope

The user separately authorized applying the exact reviewed global-catalog dry-run plan and rerunning the dry-run to prove idempotency. This boundary did not authorize or perform legacy bridging, cleanup, application push/deployment, configuration changes, preview, userscript/provider activity, or AMEX status writes.

## Read-only reviewed plan

The complete production dry-run reported:

| Catalog | Create | Adopt | Update | Retire | Unchanged |
|---|---:|---:|---:|---:|---:|
| Cards | 0 | 34 | 0 | 0 | 0 |
| Benefits | 0 | 129 | 0 | 0 | 0 |

Conflict count was zero. Existing exact-shape global rows were eligible for stable catalog-identity adoption; no card or benefit definition would be created, updated canonically, or retired.

## Immediate pre-apply verification

Immediately before apply:

- application and direct database connections matched;
- the database identity matched the provider project and default branch;
- production AMEX remained effectively `off` with no HMAC configured;
- Prisma reported the schema up to date;
- a fresh dry-run exactly matched the reviewed aggregate plan.

Any mismatch would have stopped the operation before catalog writes.

## Apply and idempotency result

The target-verified, exact-confirmation catalog apply completed successfully:

- 34 existing card definitions were adopted;
- 129 existing benefit definitions were adopted;
- zero definitions were created, canonically updated, or retired;
- zero conflicts occurred.

The immediate post-apply dry-run reported all 34 cards and all 129 benefits unchanged, with zero create/adopt/update/retire actions and zero conflicts.

## Current gate

The production schema and global catalog gates passed. Production AMEX remains `off`. The next independent boundary is the complete bounded legacy migration dry-run, which remains read-only but requires separate authorization before production inspection. Legacy bridge apply, cleanup, push/deployment, preview, userscript/provider activity, and AMEX writes remain unperformed.

## Privacy

Environment values and raw command output were held only in temporary private files and removed automatically. This record contains no connection value, database/provider identifier, branch identifier, record ID, cursor, plan fingerprint, card ending, user value, token, or provider payload.
