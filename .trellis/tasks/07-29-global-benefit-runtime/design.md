# Design — Global benefit runtime

## 1. Runtime source union

The effective source is explicit:

```text
standard: creditCardId + predefinedBenefitId (+ userId/status cycle)
bridge:   standard global links + retained legacy benefitId
custom:   benefitId (+ optional owned card link), no predefinedBenefitId
legacy:   benefitId only until migration/rollback completes
```

When a global link exists, global card/benefit fields are authoritative and current legacy fields are not an override. Custom/legacy rows source definition fields from `Benefit`. The projection returns the existing display DTO so consumers do not reconstruct source logic.

## 2. Shared projection

A reusable server module loads the necessary physical card, global definition, custom definition, and status state, then projects:

- stable opaque benefit identity and physical-card identity;
- current name/description/amount/frequency/cycle/guide fields from the authoritative definition source;
- persisted user cycle, amount, completion, usability, order, and timestamps from the status;
- a standard/custom capability flag used server-side to omit edit/delete authority.

Dashboard, home, notification, API, calendar, and guide paths consume this module or typed projections derived from it. Standard guide lookup uses direct global identity. Legacy fallback remains isolated and removable after the migration rollback window.

## 3. Card creation

One transaction:

1. authenticate and validate the selected global product;
2. create the physical `CreditCard` with `predefinedCardId` and user fields;
3. create the card event;
4. enumerate active global benefits;
5. derive cycle coordinates and insert standard statuses with `creditCardId`, `predefinedBenefitId`, and `userId`;
6. create no copied standard `Benefit` records.

Duplicate cards of one product remain distinct because status uniqueness includes physical card identity.

## 4. Materialization

Cycle computation is refactored into definition-independent coordinates. Two adapters supply global or custom definition inputs. The cron scans active cards/global definitions and custom definitions separately, inserts only missing occurrence tuples, and uses the partial unique indexes as concurrency protection.

Global additions propagate on the next bounded materialization run. Retirement excludes only future creation. Existing rows are never updated by materialization, even if current global terms or calculated boundaries differ; discrepancies stop/report rather than rewrite history.

## 5. Mutation and authorization

Standard definition mutation endpoints reject or omit standard rows by construction. Status transitions continue to authorize by `userId`, reload current status/source, and update only user state. Custom creation validates an optional linked card with both card ID and authenticated owner before creating its definition/statuses.

## 6. Public and compatibility boundaries

Anonymous catalog pages keep using `static-catalog` and make no Prisma/auth call. Authenticated database-backed routes adapt the effective projection into their existing JSON contract. Hybrid reads stay in place through migration and cleanup validation.

## 7. Rollback

Runtime remains capable of reading legacy-only rows. Before cleanup, disabling global-first behavior returns to legacy projection without data recreation. New global-only standard statuses require the additive schema/runtime pair; rollback after creating them uses a reviewed forward compatibility fix rather than manufacturing copied `Benefit` rows.
