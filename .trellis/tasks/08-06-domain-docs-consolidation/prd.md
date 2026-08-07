# Consolidate domain and project documentation

## Goal

Create the domain glossary and prune or rewrite stale plans, contributor guidance, and operational documentation.

## Requirements

- Maintain the root `CONTEXT.md` as an implementation-free glossary derived from durable domain invariants.
- Rewrite README and contributor guidance to reference existing routes, files, safe checks, and canonical catalog workflows.
- Remove, archive, or clearly mark completed plans, expired drafts, and superseded operational guides.
- Keep durable engineering contracts in `.trellis/spec/`; docs should link rather than duplicate them.

## Acceptance Criteria

- [ ] No active guidance points to nonexistent `AGENT.md`, `Settings → Suggest`, drag-and-drop prioritization, seed-first catalog rollout, or superseded broad migration scripts.
- [ ] `CONTEXT.md` defines the canonical domain language without implementation details.
- [ ] Historical documents are either archived with clear status or deleted when they have no durable value.
- [ ] Documentation links and documented safe commands are verified statically.
