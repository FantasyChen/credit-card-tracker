# Effective projection contract summary

- `effective-benefit.ts` owns the standard, bridge, custom, and legacy source union.
- Dashboard, home, authenticated routes, notifications, calendar, and guides must consume that projection or a typed adapter from it.
- Global definition/card fields are authoritative whenever `predefinedBenefitId` exists; retained legacy definitions do not override them.
- Status state, exact cycle instants, occurrence, ordering, and timestamps come from `BenefitStatus`.
- Physical Cards remain distinct by `CreditCard.id`, even for the same Standard Card Definition.
- Standard/bridge definitions are read-only; only valid owned custom definitions can be mutated.
- Home claimed value is a task decision: current calendar year, all effective source kinds, partial recorded amount, completed-without-amount uses approved maximum, prior years excluded.
- Verification must cover standard, bridge, custom, legacy, duplicate-card, guide, history, partial, completed, not-usable, and ROI behavior.
