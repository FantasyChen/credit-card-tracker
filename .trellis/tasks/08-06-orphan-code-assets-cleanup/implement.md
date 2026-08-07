# Implementation plan — Orphan code and assets

- [ ] Build a final deletion inventory with inbound-reference evidence.
- [ ] Delete the no-op action and stale commented callers.
- [ ] Delete orphan search UI/analytics modules and their unused route modules.
- [ ] Delete orphan drag UI and DnD packages.
- [ ] Delete unused structured logging code.
- [ ] Delete unreferenced starter assets and generic one-off scripts.
- [ ] Remove top-level dependencies with no remaining live/tooling import; update lockfile mechanically.
- [ ] Search for every deleted path/symbol/package.
- [ ] Run targeted maintained search, layout, monitoring, PWA, and public-route tests.
- [ ] Run strict TypeScript, changed-source ESLint, and `git diff --check`.

Rollback: restore any candidate whose post-deletion search reveals a live repository consumer.
