# Review and deepen codebase architecture

## Goal

Reduce architectural friction and remove verified dead code and stale documentation without weakening Perks Reminder's domain, database-safety, authentication, catalog, or deployment invariants.

The visual architecture review is complete. The user selected all six candidates for staged implementation; this parent task coordinates the child deliverables and final integration review.

## Confirmed Facts

- The repository has no `CONTEXT.md` domain glossary and no `docs/adr/` decision records; `.trellis/spec/` currently carries the durable domain and architecture contracts.
- Public anonymous catalog routes must remain database-free, and catalog changes must preserve immutable keys, synchronize global definitions, and disposition existing-card status propagation.
- `main` deploys automatically, so this task must not make broad schema-dependent or operational changes implicitly.
- The worktree was clean before this task was created; unrelated AMEX/global-benefit rollout tasks remain active and are out of scope unless the selected refactor explicitly requires coordination.
- Several modules have no live callers, while legacy catalog-migration code and documentation coexist with the current global catalog synchronization path.
- The user selected every report candidate: catalog workflow consolidation, Benefit Dashboard deepening, AMEX catalog ownership, subscription-surface cleanup, orphan cleanup, and domain/documentation consolidation.

## Requirements

- Inspect code, tests, scripts, dependencies, assets, and documentation for verified dead material and architectural friction.
- Apply the deletion test before labeling a module dead or shallow.
- Use the architecture vocabulary: module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, and locality.
- Preserve the authoritative business-logic owners and invariants documented in `.trellis/spec/perks-reminder/` and `.trellis/spec/frontend/`.
- Distinguish safe deletion candidates from deepening candidates; do not add a seam with only one justified adapter.
- Produce a self-contained HTML report in the OS temporary directory with before/after visuals, evidence, benefits, dependency category, and recommendation strength for each candidate.
- Do not propose a concrete new interface or edit application code until the user selects a candidate and approves the subsequent implementation plan.
- Implement the selected candidates as independently verifiable child tasks rather than one sweeping change.
- Sequence work so the neutral domain glossary and safe cleanup land before cross-module refactors, while AMEX ownership changes wait until they can be reconciled with active AMEX rollout tasks.
- Never read or modify `.env`, and do not run database, build, deployment, cron, email, notification, or other external-effect operations during the review.

## Acceptance Criteria

- [ ] The review identifies evidence-backed dead code/documentation with false-positive caveats where route entrypoints, scripts, or external consumers may exist.
- [ ] Each architectural candidate names involved files, current friction, deepening direction, locality/leverage gains, test implications, dependency category, and recommendation strength.
- [ ] Every candidate includes a before/after visual in a temporary HTML report, and the report ends with one top recommendation.
- [ ] The report explicitly accounts for the absent domain glossary/ADRs and uses existing Trellis domain language instead.
- [ ] No application code, runtime configuration, database state, generated artifact, or external system is changed during the review phase.
- [x] The user selected all six candidates.
- [ ] Each child task passes its own tests and review gate before the parent integration review.
- [ ] The final repository has one canonical catalog-change workflow, a deeper dashboard projection module, a neutral AMEX identity owner, a minimal free-product compatibility surface, no verified orphan island, and current domain/contributor documentation.

## Out of Scope for the Review Phase

- Database migrations or data cleanup.
- Production, Vercel, cron, email, notification, or browser-session operations.
- Re-litigating active AMEX/global-benefit rollout decisions without direct evidence of architectural friction.
- Bulk deletion based only on filename age, comments, or lack of a simple static import match.

## Child Task Map

1. `08-06-domain-docs-consolidation` — domain glossary plus current project and operator documentation.
2. `08-06-orphan-code-assets-cleanup` — verified orphan modules, routes, dependencies, scripts, and assets.
3. `08-06-subscription-surface-cleanup` — minimal free-product compatibility surface.
4. `08-06-benefit-dashboard-deepening` — one effective dashboard/home projection owner.
5. `08-06-catalog-workflow-consolidation` — retire superseded catalog migration implementation and documentation.
6. `08-06-amex-catalog-ownership` — neutral shared AMEX identity/policy ownership, coordinated with active rollout work.

## Decisions

- Repository unreferencedness is sufficient evidence to remove direct route modules and public assets; production traffic verification is not required for this cleanup.
- Home `totalClaimedValue` and net annual-fee position use the current calendar year.
- Complete catalog and AMEX architecture refactoring before the still-active production rollout resumes. Preserve its behavior and rerun affected static/unit verification afterward; do not perform rollout operations in this task.

## Notes

- Planning remains open until the deletion-evidence policy is resolved and the parent/child design and execution artifacts receive explicit user approval.
