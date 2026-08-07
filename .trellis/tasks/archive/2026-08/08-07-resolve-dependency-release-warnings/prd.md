# Resolve dependency release warnings

## Goal

Remove the known security and toolchain release warnings without expanding into major-version migrations or unrelated dependency modernization.

## Background

- `npm audit` reports 30 findings: 6 low, 3 moderate, 17 high, and 4 critical.
- Direct affected packages include `@auth/prisma-adapter`, `axios`, `eslint`, `next`, `next-auth`, and `prisma`.
- Patched same-major releases are available for the direct critical/high owners, including Next 15.5.23, NextAuth 4.24.15, Auth Prisma Adapter 2.11.3, Axios 1.19.0, and Prisma 6.19.3.
- The installed Next/SWC versions are mismatched at 15.5.11 and 15.5.7; matching 15.5.23 packages are available.

## Requirements

- Update only packages required to remediate current advisories or align the Next.js toolchain.
- Keep Next.js on major 15, NextAuth on major 4, Prisma on major 6, Axios on major 1, ESLint on major 9, and React on its existing major.
- Keep `next`, `@next/swc-wasm-nodejs`, and `eslint-config-next` aligned to the same 15.5 patch release.
- Keep `prisma` and `@prisma/client` aligned to the same release.
- Do not use `npm audit fix` or `npm audit fix --force`.
- Install lockfile changes with lifecycle scripts disabled locally; do not run Prisma generation, build, or any database command as local validation.
- Preserve application behavior and existing architecture boundaries.

## Acceptance Criteria

- [x] `package.json` and `package-lock.json` contain reviewed same-major remediation updates only.
- [x] `npm audit` has no critical or high finding with an available same-major direct-dependency remediation left unapplied; the target is zero audit findings if the current ecosystem permits it without a major migration or unsafe override.
- [x] `npm ls next @next/swc-wasm-nodejs eslint-config-next prisma @prisma/client` shows aligned framework/ORM versions without invalid or extraneous entries.
- [x] Full Jest, strict TypeScript, public DB, card-template, AMEX userscript, task-structure, and diff checks pass; changed-source lint is truthfully skipped because no TypeScript/JavaScript source changed.
- [x] Any residual advisory is documented with its dependency path, exposure assessment, and reason it requires a separate major-version decision.

## Out of Scope

- Major-version upgrades, automated forced remediation, code redesign, database operations, and production operations.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
