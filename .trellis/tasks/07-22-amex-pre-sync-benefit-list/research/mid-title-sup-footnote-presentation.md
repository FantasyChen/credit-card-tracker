# Research: Mid-title AMEX `<sup>‡</sup>` presentation residue

- **Query**: Treat two visible Remaining titles containing literal `<sup>‡</sup>` in the middle followed by ` Statement Credit` as a separate narrow presentation issue from `benefit_identity_conflict`.
- **Scope**: internal
- **Date**: 2026-07-22

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/userscripts/amex-benefit-reader/provider-text.ts` | One-pass numeric decoder and terminal-only AMEX footnote removal. |
| `src/userscripts/amex-benefit-reader/panel.ts` | Applies the formatter at the title rendering boundary with `textContent`. |
| `src/userscripts/amex-benefit-reader/__tests__/provider-text.test.ts` | Explicitly preserves nonterminal daggers/markup-like text. |
| `src/userscripts/amex-benefit-reader/__tests__/panel.test.ts` | Panel-level terminal cleanup and inert-text coverage. |
| `.trellis/tasks/07-22-amex-pre-sync-benefit-list/design.md` | 0.2.10 design intentionally limited cleanup to terminal adornments. |
| `.trellis/spec/perks-reminder/browser-read-integrations.md` | Promoted terminal-only, inert-text security contract. |
| `src/lib/amex-benefit-reader/supported-card-credits.ts` | Matcher normalization can encounter markup-like words, but does not render titles. |

### Code Pattern

`formatAmexBenefitTitle` performs exactly one numeric-character-reference decode and then removes only:

```ts
.replace(/<sup>‡<\/sup>$/, "")
.replace(/‡$/, "")
```

at `provider-text.ts:22-28`. A title shaped like:

```text
... <sup>‡</sup> Statement Credit
```

cannot match either terminal expression because ` Statement Credit` follows the markup-like footnote. The literal text therefore remains visible.

The panel calls `formatAmexBenefitTitle(benefit.title)` and passes the result to an element helper that assigns `textContent` (`panel.ts:54-57,334-345`). The residue is inert visible text, not executable markup.

### Intentional 0.2.10 boundary

- Active design required removal only for a recognized **terminal** double-dagger adornment and preservation of nonterminal daggers/unrelated markup-like text (`.trellis/tasks/07-22-amex-pre-sync-benefit-list/design.md:62-65`).
- Unit tests explicitly expect `Nonterminal ‡ Credit` and unrelated markup-like text to remain (`provider-text.test.ts:28-33`).
- Panel tests expect terminal forms to disappear but `Nonterminal ‡ Credit` and `<em>visible</em>` to remain inert (`panel.test.ts:295-329`).
- The shared spec repeats terminal-only removal and preservation of nonterminal text (`browser-read-integrations.md:100,125,153-157,198`).

Thus the sanitized finding is evidence that the terminal-only rule is too narrow for this provider title shape, not evidence that the 0.2.10 implementation failed to follow its specification.

### Relationship to `benefit_identity_conflict`

This presentation residue is not itself a production site for `benefit_identity_conflict`.

The matcher’s `normalizedWords` replaces non-alphanumeric characters with spaces (`supported-card-credits.ts:135-145`). Literal `<sup>‡</sup>` becomes intervening `sup sup` words. Depending on placement, that can interrupt a reviewed multiword alias and cause a silent non-match, while an alias wholly before or after the marker may still match. A silent non-match is intentionally omitted and does not emit the conflict code. It contributes to the identity conflict only if another independently matched tracker/catalog title selects a different supported key or creates a same-key collision in the adapter.

The two visible affected titles necessarily survived matching/normalization, so their display residue alone does not explain all four card-level conflict reasons.

## Narrow synthetic strategy

1. Add invented formatter cases where a literal or numeric-reference-derived `<sup>‡</sup>` appears immediately before a reviewed suffix such as ` Statement Credit`.
2. Define the exact provider-specific grammar before changing behavior. A narrow candidate is removal of `<sup>‡</sup>` only when it is either terminal or immediately precedes a fixed reviewed suffix, rather than broad HTML/tag stripping.
3. Preserve one-pass decoding, `textContent`, normalized stored titles, named/malformed entity behavior, and unrelated markup-like text.
4. Add negative tests for:
   - arbitrary mid-title `<sup>‡</sup>` prose;
   - other tags or symbols;
   - multiple markers;
   - named entities;
   - double-encoded input;
   - a title that would become empty.
5. Add a matcher test separately if cleanup is ever proposed before matching. Presentation cleanup should not silently broaden eligibility; any matcher normalization change needs exact-card, exact-alias fixtures and unknown-title fail-closed assertions.

No broad tag stripper, `innerHTML`, `DOMParser`, repeated decoding, or normalized-storage rewrite is supported by current security contracts.

## External References

None. This is a repository-defined provider presentation rule.

## Related Specs

- `.trellis/spec/perks-reminder/browser-read-integrations.md:100,125` — inert one-pass decoding and terminal-only cleanup.
- `.trellis/spec/perks-reminder/browser-read-integrations.md:153-157` — title validation matrix.
- `.trellis/spec/perks-reminder/browser-read-integrations.md:198` — required synthetic title tests.

## Caveats / Not Found

- No raw title was retained; the only available shape is the sanitized fact that `<sup>‡</sup>` occurs mid-title before ` Statement Credit`.
- The exact safe suffix vocabulary cannot be broadened beyond that sanitized shape without additional reviewed evidence.
- This issue should remain separate from benefit identity diagnosis unless a synthetic joined tracker/catalog fixture proves that the marker placement causes different supported credit keys.
