# Vetted UI design skill research

Research date: 2026-09-03

## Selected skills

### Anthropic frontend-design

- Source: https://github.com/anthropics/skills
- Public popularity observed through the GitHub API: 173,554 stars.
- Installed skill license file: Apache-2.0.
- Installed at `/Users/lfan/.codex/skills/frontend-design`.
- Useful direction: ground the design in the product's subject matter; make
  typography, hierarchy, layout, and copy deliberate; spend boldness in one
  place; avoid generic AI/SaaS design tells; use restrained meaningful motion;
  critique with rendered screenshots; treat responsive and accessibility
  quality as the floor.

### UI UX Pro Max

- Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Public popularity observed through the GitHub API: 124,626 stars.
- Repository license reported by GitHub: MIT.
- Installed at `/Users/lfan/.codex/skills/ui-ux-pro-max`.
- Useful direction: searchable interaction/accessibility guidance, responsive
  checks, semantic status treatment, and stack-specific Next.js guidance.

These were selected because they combine a strong design point of view with a
large structured UX rule set. Star count was a discovery signal, not a claim
that popularity alone proves design quality. Both installed instruction files
were reviewed before applying their guidance.

## Search results applied

Queries used the installed UI UX Pro Max dataset:

- `credit card benefit tracker calm dashboard` as a design-system query with
  balanced variance, subtle motion, and moderately dense layout.
- `progressive disclosure long content` for long review surfaces.
- `success state feedback verify results` for confirmation outcomes.
- `expiry countdown recovery action` and a narrower `timeout warning` retry for
  expiry/recovery.
- `responsive dense list disclosure` for mobile behavior.
- `status color text icon` for accessible status semantics.
- `client component render performance list` against the Next.js stack.

Verified matches support:

- clear recovery actions instead of dead-end errors;
- visible state change after success;
- mobile-first reflow, touch-friendly controls, and breakpoint testing;
- color plus text/icon semantics, AA text contrast, and one contextual live
  status message;
- content-driven sizing and no essential-text truncation;
- stable async layout and narrow Client Component boundaries.

The compound `review prioritization dense financial list` query returned no
verified database match. The narrower `timeout warning` retry also returned no
match. Review prioritization and expiry presentation therefore come from the
repository's observed workflow, the skills' general principles, and standard
error-recovery guidance rather than a claimed catalog match.

## Recommendations deliberately rejected

The generated design-system suggestions included scroll-triggered storytelling,
liquid glass, a Cormorant/Montserrat luxury pairing, an unrelated Lora/Raleway
wellness pairing, a dark felt-green casino-like palette, and GSAP scroll reveal.
Those are poor fits for a compact, high-trust financial review and would add
unnecessary dependencies or visual noise. They will not be incorporated.

The useful synthesis is instead a product-specific **Quiet Ledger** direction:

- existing deep ink `#172033` as the identity anchor;
- existing mint `#8FE3C1` for positive/ready accents;
- existing gold `#FFCF70` for time/attention accents;
- off-white paper and cool-slate supporting surfaces;
- Geist in the first-party app and a compatible local/system sans in the
  isolated reader;
- one statement-like review spine as the memorable visual element;
- semantic grouping and progressive disclosure instead of a wall of equal
  cards;
- action-linked motion only, with immediate reduced-motion fallback.

## Implementation influence

The skills inform visual hierarchy, copy, layout, accessibility, and the
render-and-critique loop. They do not override AMEX safety, privacy, identity,
preview/confirmation, or testing contracts. No third-party UI code, font, or
animation dependency will be copied into the product.
