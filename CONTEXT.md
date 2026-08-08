# Perks Reminder

Perks Reminder tracks time-bounded credit card value for a user while keeping shared product terms separate from the user's cards and usage state.

## Language

**Physical Card**:
A credit card owned by a user. Two Physical Cards remain distinct even when they refer to the same card product.
_Avoid_: Card instance, duplicate card

**Standard Card Definition**:
The shared canonical identity and terms for a card product available to every user.
_Avoid_: Template card, user card

**Standard Benefit Definition**:
The shared canonical terms for a recurring or time-bounded benefit attached to a Standard Card Definition.
_Avoid_: Template benefit, copied benefit

**Custom Benefit Definition**:
A benefit definition owned by one user rather than shared through the catalog. It may be attached to a Physical Card or stand alone.
_Avoid_: Standard benefit, global benefit

**Benefit Status**:
The user-owned usage state for one occurrence of a Standard Benefit Definition or Custom Benefit Definition.
_Avoid_: Benefit definition, benefit record

**Benefit Cycle**:
The exact time window and occurrence in which a benefit can be used and tracked.
_Avoid_: Billing cycle, reset date

**Catalog**:
The approved collection of Standard Card Definitions and Standard Benefit Definitions.
_Avoid_: Seed data, templates

**Benefit Usage Guide**:
Practical, caveated instructions for using a benefit, including qualification, timing, and common failure modes.
_Avoid_: Benefit description, marketing copy

**AMEX Observation**:
Session-bound evidence read from American Express for cards and benefit usage visible to the user.
_Avoid_: Import, synchronization

**AMEX Sync Proposal**:
A reviewable plan that compares an AMEX Observation with the user's Perks Reminder state without changing that state.
_Avoid_: Automatic sync, preview write

**AMEX Sync Confirmation**:
The user's approval to apply one bound AMEX Sync Proposal to their owned state.
_Avoid_: Background sync, implicit consent
