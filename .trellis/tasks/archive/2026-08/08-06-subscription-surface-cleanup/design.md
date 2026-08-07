# Design — Free-product compatibility module

## External seam

Auth/session code retains compatibility with stored `subscriptionTier` and `isBetaUser`. The product policy itself is constant: every account receives the full free product.

## Deepening

- Shrink the subscription module to live compatibility behavior only.
- Remove database reads and exported methods whose only purpose was paid-tier limits or beta enrollment.
- Let notification logic use user reminder preferences directly and remove impossible quota branches/counter writes.
- Preserve generated/storage types and session fields; no schema change.

## Test surface

Tests assert the free-product invariant, stored FREE/PRO compatibility, custom reminder timing, and absence of quota writes.
