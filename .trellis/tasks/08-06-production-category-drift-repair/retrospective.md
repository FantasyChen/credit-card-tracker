## Bug Analysis: production parity timeout and blocked-sibling false drift

### 1. Root Cause Category

- **Category**: B/D/E — cross-layer contract, test-coverage gap, and implicit assumption.
- **Specific cause**: the complete database parity snapshot inherited a 10-second
  request-path interactive-transaction timeout even though it aggregates the full
  repair graph. After that was bounded explicitly, completed failed gates were
  collapsed into an opaque error. Once the closed report was visible, blocked
  definitions were being compared by their wider same-card graph, which legitimately
  included exact manifest-covered effects from repaired siblings.

### 2. Why Fixes Failed

1. **Generic safe error only**: protected private database details, but removed the
   aggregate evidence needed to distinguish timeout from a comparison failure.
2. **Timeout-only fix**: allowed the snapshot to finish and correctly revealed that
   the remaining failure was parity logic rather than database availability.
3. **Naive blocked fingerprint equality**: treated authorized sibling mutations as
   if the blocked definition itself changed; it did not reconstruct the original
   reviewed page/card state before comparison.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
| --- | --- | --- | --- |
| P0 | Architecture | Give complete parity reads an explicit bounded repeatable-read timeout independent of shared request defaults. | DONE |
| P0 | Runtime evidence | Emit only closed aggregate reports for completed failed gates, with a nonzero exit. | DONE |
| P0 | Domain comparison | Reconstruct reviewed page boundaries and reverse only exact manifest-covered same-card sibling effects before blocked own-state comparison. | DONE |
| P0 | Test coverage | Cover same-page, mixed-page, invalid sibling evidence, true blocked drift, timeout options, and native-error redaction. | DONE |
| P1 | Documentation | Record the timeout, reporting, and blocked-sibling contracts in database, global-benefit, and verification specs. | DONE |

### 4. Systematic Expansion

- **Similar issues**: any full-inventory verifier that reuses request-path database
  defaults; any migration parity check whose unit snapshot contains shared parent or
  sibling state; any safe CLI that throws before serializing closed diagnostics.
- **Design improvement**: treat reviewed page membership and manifest authority as
  explicit comparison inputs, not information inferred from current mutated state.
- **Process improvement**: production-safe tools need tests for both success reports
  and failed-gate reports; a generic safe error is not sufficient operational evidence.

### 5. Knowledge Capture

- [x] Updated database/data-safety parity transaction and failed-report contracts.
- [x] Updated global-benefit blocked-sibling and mixed-page authority contracts.
- [x] Updated verification requirements and regressions.
- [x] Added focused tests and proved complete production parity after the fixes.
