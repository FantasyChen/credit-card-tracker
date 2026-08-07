# Implementation Plan: Resolve dependency release warnings

1. Record the baseline audit summary, direct advisory owners, installed version graph, and available same-major patches.
2. Update the explicitly selected dependency versions and lockfile using lifecycle scripts disabled.
3. Run `npm audit --json` and `npm ls` to evaluate remaining paths and toolchain alignment.
4. Apply only narrowly scoped compatible follow-up updates or overrides supported by dependency-path evidence.
5. Run safe verification:
   - `npm test -- --runInBand`
   - `npx tsc --noEmit --pretty false --incremental false`
   - ESLint on changed TypeScript/JavaScript files, if any source changes occur
   - `npm run check:public-db`
   - `npm run card-template:validate`
   - `npm run check:amex-userscripts`
   - Trellis structured-task parsing and package discovery
   - Markdown/stale-reference review when documentation changes
   - `git diff --check`
6. Review every changed/untracked path and sensitive-pattern risks.
7. Commit the dependency remediation separately and archive this child task.

## Stop Conditions

- Stop rather than force a major upgrade, incompatible override, Prisma generation, database access, or build.
- A residual advisory that cannot be fixed safely within current majors is documented and carried to the release review instead of hidden.
