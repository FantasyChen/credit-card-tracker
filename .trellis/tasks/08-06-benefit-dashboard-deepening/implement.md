# Implementation plan — Deep Benefit Dashboard module

- [ ] Add failing high-level tests for current-year home claimed value across standard, bridge, custom, legacy, partial, completed-without-amount, and prior-year statuses.
- [ ] Add high-level Benefits Dashboard load tests covering cards, effective statuses, guide fallback, settings, totals, and ROI.
- [ ] Move dashboard data loading and home summary implementation behind the deep module interface.
- [ ] Reduce page callers to authentication/redirect plus one module call and rendering.
- [ ] Internalize or delete shallow exported helpers and obsolete data modules; retain exports needed by client display modules.
- [ ] Verify duplicate Physical Cards remain separated by ID.
- [ ] Run benefit-dashboard, effective-benefit, home/page, benefits page, notification, calendar, and authenticated route tests affected by projection types.
- [ ] Run strict TypeScript, changed-source ESLint, `npm run check:public-db`, and `git diff --check`.

Rollback: restore prior loaders if high-level parity cannot be proven; keep the current-year claimed-value tests and fix the owning read path.
