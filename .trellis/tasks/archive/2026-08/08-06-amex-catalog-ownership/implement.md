# Implementation plan — Neutral AMEX catalog ownership

- [x] Add import-graph tests/guards proving public Catalog and reader modules do not import `amex-sync` ownership.
- [x] Create the neutral `amex-catalog` module by moving registry, period, normalization, and source-credit policy code without changing values.
- [x] Replace imports in static Catalog, AMEX reader, AMEX sync, tests, scripts, and userscript build inputs.
- [x] Remove old `amex-sync` ownership files and temporary compatibility exports.
- [x] Confirm no cyclic reader/sync ownership remains.
- [x] Run static Catalog/validation parity tests; all AMEX reader contract, scan, adapter, identity, storage, mailbox, and userscript tests; all AMEX sync request, authority, proposal, service, repository, evidence, and route tests.
- [x] Run `npm run check:public-db`, `npm run card-template:validate`, `npm run check:amex-userscripts`, strict TypeScript, changed-source ESLint, and `git diff --check`.
- [x] Record in the parent/spec that affected rollout verification must be rerun before operations resume.

Rollback: revert the file move/import graph as one child change if any identity tuple or contract output differs.
