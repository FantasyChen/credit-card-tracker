# Design — Architecture cleanup and deepening

## Structure

This parent is a coordination module. Six child tasks own implementation and verification; the parent owns ordering, shared decisions, conflict prevention, and the final integration review.

## Decisions

- Remove repository-unreferenced routes and public assets without production traffic verification.
- Home claimed value and net annual-fee position use the current calendar year.
- Complete catalog and AMEX ownership refactors before the active production rollout resumes.
- Preserve all database, envelope, reconciliation, privacy, replay, confirmation, and rollout behavior; this work performs no operational action.
- Use `CONTEXT.md` for domain language and `.trellis/spec/` for executable engineering contracts.

## Child ownership

| Child | Owned scope | Excluded overlap |
| --- | --- | --- |
| Domain/docs | `CONTEXT.md`, README, CONTRIBUTING, completed/stale general docs | Catalog operator docs owned by catalog child |
| Orphans | Unreferenced UI/code/routes/assets/generic scripts/dependencies | Legacy catalog framework owned by catalog child |
| Subscription | Free-product policy and compatibility callers/tests | No schema or stored-field removal |
| Dashboard | Benefits/home data loading and projection callers/tests | Effective source-union semantics remain authoritative |
| Catalog | Superseded benefit-migration framework/scripts/tests and catalog operator docs | Current exact global migration operator remains |
| AMEX ownership | Neutral AMEX catalog/policy module and import graph | No provider, envelope, or persistence behavior changes |

## Order

1. Domain/docs consolidation establishes vocabulary and current instructions.
2. Orphan cleanup shrinks the graph before refactors.
3. Subscription cleanup removes impossible policy branches.
4. Dashboard deepening concentrates effective read semantics.
5. Catalog consolidation removes competing write authority.
6. AMEX ownership neutralization changes the widest import graph last.
7. Parent integration review reruns cross-child checks and updates affected rollout artifacts/specs.

## Compatibility and rollback

- Each child is committed/reviewed independently before the next starts.
- A child rollback restores only its owned files and dependency changes.
- The AMEX and catalog children must leave existing rollout gates blocked until affected static/unit evidence is rerun.
- No schema, migration, database, deployment, cron, email, notification, userscript installation, or live browser/provider action is part of this task.
