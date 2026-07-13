# Documentation and Release Notes

## Context ownership

- `.trellis/spec/perks-reminder/` owns durable engineering, safety, domain, and verification rules.
- `.trellis/tasks/` owns scoped requirements, research, plans, decisions, and implementation evidence.
- `PLAN.md` remains a retained product/history record; do not treat old parked or archived items as current requirements without review.
- Detailed procedures remain in their owning `docs/` runbooks. Update a runbook when its operator behavior changes rather than duplicating the procedure in a general spec.
- Do not recreate Context Harness cards, indexes, `NOW.md`, `CONTEXT.md`, session hooks, or indexing scripts.

When work establishes a durable invariant or corrects an existing one, update the relevant indexed spec. Task-only observations stay in the active task, not in global project guidance.

## Release notes

The retained release history is `docs/version-history.md`.

- Update release history only when the user explicitly asks to record or bump a version.
- Format one user-facing Chinese line per release: `V主.次：简短中文描述`.
- Prefer clear product language over English implementation jargon.
- Prepend the new entry and update the current-version line; do not infer a release from ordinary implementation work.
