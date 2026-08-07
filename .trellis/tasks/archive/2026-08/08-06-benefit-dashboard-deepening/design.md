# Design — Deep Benefit Dashboard module

## Module shape

`benefit-dashboard.ts` becomes the deep owner for dashboard and home projections. Its small external interface loads a full Benefits Dashboard projection or a home summary from an injected database and explicit reference time.

The implementation absorbs the current `benefit-dashboard-data.ts` and `home-dashboard-data.ts` orchestration, while continuing to call `effective-benefit.ts` for the standard/bridge/custom/legacy union.

## Data flow

```text
page -> deep Benefit Dashboard module -> effective-benefit + Prisma adapter
     <- render-ready projection / home summary
```

The Benefits page no longer assembles authoritative card terms, status windows, usage-guide fallback, and projection helpers itself.

## Home semantics

- Claimed value includes current-calendar-year statuses across every effective source kind.
- Partial usage contributes recorded `usedAmount`.
- A completed status with no recorded amount contributes its approved maximum, matching dashboard claimed-value semantics.
- Prior-year usage does not contribute.
- Current annual fees remain keyed by distinct Physical Card identity.

## Test surface

High-level projection/load tests cover source kinds, history, duplicate Physical Cards, guides, filters, totals, and ROI. Pure internal helpers may remain but are not caller interfaces.
