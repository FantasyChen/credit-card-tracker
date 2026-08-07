# Design — Orphan code and assets

## Deletion rule

Repository-wide unreferencedness plus the deletion test is sufficient. Route modules and public assets receive the same repository-only rule by user decision.

## Owned candidates

- No-op benefit action and stale layout comments.
- Unused SearchInput/useDebounce/search analytics island and test analytics route.
- Unused drag UI and DnD dependencies.
- Unused structured logging module.
- Unreferenced starter/public assets.
- Unreferenced generic one-off scripts and top-level dependencies not owned by another child.

## Exclusions

- Do not remove the maintained catalog search route or `cardSearchUtils` without separate evidence.
- Do not remove legacy catalog scripts/framework here; catalog child owns them.
- Keep framework route entrypoints merely because imports are absent when the route itself is a live product surface.

## Verification

Search imports, route strings, manifest/service-worker paths, package scripts, docs, tests, and lockfile ownership before and after deletion.
