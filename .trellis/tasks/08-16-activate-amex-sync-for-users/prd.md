# Activate AMEX sync for users

## Goal

Make the already-deployed public AMEX reader's manual **Sync reviewed** flow available to production users, while proving one fresh owner-scoped write canary, idempotency, exact target/alias identity, and a tested return to `off` before the user-wide activation.

## Background

- Application release `f6fe053` is already deployed and the public setup page and Greasy Fork `1.0.0` artifact are live. This task does not need an application-code release unless action-time inspection finds a genuine defect.
- The exact public reader mounted once, remained idle before manual action, and produced two stable read-only scans: five physical-card groups, 44 normalized observations, 26 Remaining, 18 Used, and zero duplicate physical identities.
- The latest authenticated production preview was zero-write: 0 proposed, 13 unchanged, 1 `destination_not_usable` skip, 0 failed, 15 `partial` exclusions, and four destination-card exact-five prerequisites.
- Production was then restored and freshly proven effectively `off`, with no confirmation controls and no database mutation.
- Historical canary evidence proves the mechanism has worked before, but it does not replace the required fresh one-proposal canary for this rollout.

## Requirements

1. Keep production effectively `off` throughout planning and until all preflight and preview gates pass.
2. Reverify the reviewed production project, primary public alias, immutable Ready deployment, exact deployment-ID equality, application/database target identity where required, current migration compatibility, a fresh recovery point, and the absence of overlapping repair/cleanup work. Never read, create, copy, or modify `.env`.
3. Use Computer Use as the only browser/GUI surface. Inspect only the exact reader, AMEX page, and Perks Reminder handoff controls; retain sanitized aggregates only.
4. Reverify one enabled public reader host at version `1.0.0`, idle before manual action, and run a fresh manual read-only scan without provider mutation or automatic activity.
5. Activate exact production `preview` only with no-trailing-newline provider input, deploy from the reviewed release source, require immutable Ready/primary-alias identity equality, and prove effective preview mode through authenticated runtime behavior.
6. Run a fresh owner-scoped preview and prove exact before/after equality for every potentially written table. Report only proposed/unchanged/skipped/failed/excluded aggregates and closed reason vocabularies.
7. A write canary is eligible only when a fresh preview contains exactly one proposed status change and no blocking ambiguity, duplicate, partial-source, destination, period, authority, or privacy condition. Never manufacture an AMEX or Perks Reminder state change to create a proposal.
8. Immediately before changing production to `write`, request one fresh action-time confirmation that states the sanitized one-row impact, expected audit/provenance deltas, rollback to `off`, and the conditional user-wide activation. Earlier approvals do not satisfy this gate.
9. After confirmation, deploy exact `write`, require Ready/alias equality, obtain a new mode-bound proposal, confirm exactly once, and verify one expected status delta plus the expected attempt/audit/provenance deltas with no unrelated or duplicate change.
10. Replay the completed attempt and run a fresh manual scan/preview. Require durable replay, no second mutation, no duplicate destination occurrence, and zero repeated proposal for the confirmed state.
11. Restore and prove exact `off` after the canary. Only if every canary and rollback check passes may the already-authorized user-wide launch redeploy exact `write`, reprove Ready/alias identity, and pass a zero-write synthetic runtime probe. The final production state is `write`; any failed or uncertain gate leaves it exactly `off`.
12. User-wide activation remains manual and user-confirmed. It must not add autoscan, background provider reads, provider mutation, broader permissions, bulk confirmation, notification/email activity, database repair/cleanup, or Chrome Web Store publication.
13. Record only sanitized task evidence, run proportionate static checks for any changed tracked files, commit Trellis evidence locally, and do not push documentation-only commits to auto-deploying `main`.

## Acceptance Criteria

- [ ] The exact production target, recovery path, Ready deployment, primary alias, schema compatibility, and initial effective `off` mode are freshly verified.
- [ ] Exactly one enabled public `1.0.0` reader host is idle before a fresh manual scan, and the scan has no duplicate physical-card or source-credit/period group.
- [ ] Exact preview mode is deployed with no-trailing-newline input, the alias serves that deployment, and authenticated preview proves zero database mutation.
- [ ] The canary preview contains exactly one fresh proposed status change; otherwise the task records the blocker and leaves production `off`.
- [ ] The user provides fresh action-time confirmation immediately before the bounded write/canary/conditional-launch sequence.
- [ ] One fresh proposal is confirmed exactly once with only the expected status, attempt, audit, and provenance deltas.
- [ ] Completed-attempt replay plus a fresh scan/preview proves no repeated write or duplicate destination occurrence.
- [ ] The canary is returned to verified exact `off` before user-wide activation.
- [ ] User-wide production `write` activation is served by the primary alias and a synthetic authenticated preview proves the runtime is active without writing.
- [ ] Final evidence truthfully reports the effective mode, public URLs, deployment/alias gate, checks, commits, rollback readiness, and any remaining blocker without private data.

## Out of Scope

- Manufacturing a proposal by changing AMEX, card identity, status, benefit, or provider state.
- AMEX enrollment, offer activation, linking, redemption, payments, or any other provider mutation.
- Database migrations, catalog changes, category-repair apply/rollback/cleanup, legacy cleanup, or schema/code work unless a separately planned defect is discovered.
- Automatic scans, background synchronization, bulk confirmation, email/notification sends, or other-user data inspection.
- Chrome Web Store review/publication.
