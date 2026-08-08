# Implementation plan — Deep Benefit Dashboard module

- [x] Add high-level tests for current-year home claimed value, partial usage, completed-without-amount, not-usable, and prior-year statuses through the effective projection.
- [x] Add a high-level Benefits Dashboard load test covering cards, settings, totals, and the render-ready projection.
- [x] Move dashboard data loading and home summary implementation behind the deep module interface.
- [x] Reduce page callers to authentication/redirect plus one module call and rendering.
- [x] Internalize data-loading helpers and delete obsolete dashboard/home data modules; retain exports needed by client display modules.
- [x] Preserve duplicate Physical Card separation by ID through existing projection coverage.
- [x] Run benefit-dashboard, effective-benefit, and page-focused tests affected by projection types.
- [x] Run strict TypeScript, changed-source ESLint, `npm run check:public-db`, and `git diff --check`.

Rollback: restore prior loaders if high-level parity cannot be proven; keep the current-year claimed-value tests and fix the owning read path.
