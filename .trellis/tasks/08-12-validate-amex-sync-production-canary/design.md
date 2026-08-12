# Design — AMEX sync production canary

## 1. Safety boundary

The canary is an attended sequence of independently gated operations:

```text
synthetic regression gate
  -> target/deployment/mode/recovery verification
  -> exact userscript install/mount verification
  -> live scan A (local normalized observations only)
  -> live scan B + sanitized stability/duplicate review
  -> production preview activation + zero-write proposal
  -> user review and explicit confirmation decision
  -> optional one bounded fresh confirmation
  -> replay + fresh scan/preview + duplicate audit
  -> effective off
```

No later gate inherits authorization from an earlier gate. In particular, a live scan does not authorize preview configuration, preview does not authorize write activation, and write activation does not authorize clicking Confirm.

## 2. Evidence layers

- Synthetic bundle evidence covers reachable corner cases that must not be manufactured in production: supplementary cards, repeated products, duplicate source credits, cancellation, partial/stale reads, hostile routes/transports, corrupted handoffs, ambiguous/missing destinations, refunds/decreases, omitted fields, stale proposals, replay, and December grouping.
- Live provider evidence covers actual authenticated endpoint compatibility, current response normalization, multiple physical-card handling, current userscript/Tampermonkey behavior, and stable repeated scans.
- Production preview evidence covers owner-scoped destination resolution without mutation.
- One optional confirmation covers the transactional persistence path; replay and a fresh preview prove idempotency and duplicate prevention.

## 3. Duplicate-prevention invariants

Browser identity remains the installation-secret HMAC fingerprint plus explicit four/five display ending, never product name. The sync envelope excludes duplicate source-credit/period groups. Server preview independently re-resolves product and source credit, requires exactly one owned active physical card by global product plus exact stored last five, and requires exactly one authorized global status occurrence. Confirmation binds and reloads the full physical/global/status/repair authority plus before-state. Completed attempt IDs return durable results without repeating writes.

## 4. Privacy and observability

Task evidence contains only counts, booleans, closed reason/issue vocabularies, version metadata, and pass/fail gate states. Card endings, product-to-ending pairings, account/user/row IDs, raw titles not already public catalog vocabulary, transfer nonces/digests, proposal tokens, provider tokens, and raw responses stay in browser/process memory and are never copied to task files or chat.

## 5. Stop and rollback

Every mismatch stops before the next boundary. Configuration rollback is returning AMEX to exact `off` on a Ready deployment whose primary alias identity is verified. A failed confirmation is not compensated automatically; retain evidence and inspect. No database cleanup or repair is part of rollback.
