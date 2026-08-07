# Implementation plan — Neutral AMEX catalog ownership

- [ ] Add import-graph tests/guards proving public catalog and reader modules do not import `amex-sync` ownership.
- [ ] Create the neutral `amex-catalog` module by moving registry, period, normalization, and source-credit policy code without changing values.
- [ ] Replace imports in static catalog, AMEX reader, AMEX sync, tests, scripts, and userscript build inputs.
- [ ] Remove old `amex-sync` ownership files and any temporary compatibility exports.
- [ ] Confirm no cyclic reader/sync ownership remains.
- [ ] Run static catalog/validation parity tests; all AMEX reader contract, scan, adapter, identity, storage, mailbox, and userscript tests; all AMEX sync registry, policy, period, request, authority, proposal, service, repository, evidence, and route tests.
- [ ] Run `npm run check:public-db`, `npm run card-template:validate`, `npm run check:amex-userscripts`, strict TypeScript, changed-source ESLint, and `git diff --check`.
- [ ] Record affected active-rollout verification that must be rerun before operations resume.

Rollback: revert the file move/import graph as one child change if any identity tuple or contract output differs.
