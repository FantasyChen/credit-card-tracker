# Implementation plan — Orphan code and assets

- [x] Build a final deletion inventory with inbound-reference evidence.
- [x] Delete the no-op action and stale commented callers.
- [x] Delete orphan search UI/analytics modules and their unused route modules.
- [x] Delete orphan drag UI and DnD packages.
- [x] Delete unused structured logging code.
- [x] Delete unreferenced starter assets and generic one-off scripts.
- [x] Remove top-level dependencies with no remaining live/tooling import; update lockfile mechanically.
- [x] Search for every deleted path/symbol/package.
- [x] Run targeted maintained layout, monitoring, PWA, and public-route tests.
- [x] Run strict TypeScript, changed-source ESLint, and `git diff --check`.

Rollback: restore any candidate whose post-deletion search reveals a live repository consumer.
