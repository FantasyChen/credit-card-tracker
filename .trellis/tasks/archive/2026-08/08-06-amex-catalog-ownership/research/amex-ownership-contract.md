# AMEX ownership contract summary

- Preserve exactly 12 AMEX products, 56 benefit identities, and 47 writable `usage` destinations.
- Catalog/product/benefit/credit-family/period/source-credit identities and source semantics remain unchanged.
- Browser observation is manual, session-bound, conservative, privacy-preserving, and produces a reviewable proposal rather than a write.
- Confirmation applies one bound proposal with freshness, exact-last-five, ownership, destination, replay, atomicity, audit, and provenance checks.
- Public V3 envelope/request/response contracts, HMAC behavior, storage policy, and userscript bundle targets do not change.
- Global definitions and standard statuses are the destination authority; per-user legacy identity keys are not authority.
- The neutral module may own pure registry, period, normalization, and source-credit policy only. Browser observation retains observation/storage schemas; server reconciliation retains request/proposal/authority/repository/persistence.
- Public anonymous catalog remains DB-free.
- No provider, browser-session, userscript installation, production configuration, proposal confirmation, database, build, deployment, or live operation is permitted.
- Rerun all affected static catalog, reader, userscript, request, authority, proposal, repository, service, privacy, replay, and route tests before the active rollout resumes.
