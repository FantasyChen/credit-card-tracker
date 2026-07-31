# Sanitized production application deployment — 2026-07-30

## Authorization and scope

The user authorized pushing the reviewed release branch, opening and reviewing its pull request, and merging it. The merge triggered the linked automatic production application deployment. This boundary retained production AMEX `off` and did not authorize or perform cleanup, configuration changes, HMAC provisioning, AMEX preview, userscript/provider activity, live scanning, or benefit-status writes.

## Review and merge

- Pull request #10 contained the global catalog, runtime, legacy bridge tooling, AMEX global-definition authority, deployment-safety correction, and sanitized rollout evidence.
- Initial provider deployment checks passed.
- An independent 120-path review found one cleanup-pagination defect: after cleanup deleted the final copied benefit in a page, its opaque continuation cursor could no longer resolve through live benefits.
- The fix permits cursor resolution through retained ledger evidence without making cleaned units eligible for processing again.
- Regression coverage was added.
- Final verification passed 74 Jest suites, 594 tests with one skipped, strict TypeScript, changed-source/script lint, public-database invariants, card-template/userscript checks, structured-file/link checks, sensitive-data scans, and whitespace checks.
- Updated provider checks passed after the review fix.
- Pull request #10 was merged through the approved path.

## Deployment result

- The linked production deployment for the exact merged commit reached `Ready`.
- The production alias was assigned to that deployment.
- The generic application build did not run database migrations; the schema was already current through the separately attended migration boundary.
- Production AMEX still resolved effectively to `off`.

## Read-only smoke result

The promoted production alias passed these anonymous smoke checks:

- public home page returned healthy HTML;
- sign-in page returned healthy HTML;
- the cards page returned its intended anonymous shell and its private API remained unauthorized;
- the benefits page redirected anonymous access to sign-in;
- the anonymous session endpoint returned its expected unauthenticated object;
- private card and benefit APIs returned unauthorized responses.

Independent database invariants remained true after deployment:

- the additive migration remained applied;
- 34 active keyed global cards and 129 active keyed global benefits remained present;
- 11,922 standard bridge ledgers and 813 custom classification ledgers remained valid;
- zero ledger rows were cleaned;
- no bridged status relationship mismatch was found.

An initial smoke attempt targeted the immutable deployment URL rather than the promoted public alias and expected `/cards` to redirect instead of rendering its intentional anonymous shell. That attempt failed its smoke assertions without identifying an application defect. The corrected alias-based smoke passed every check above.

## Current gate

The production application is deployed with the global-definition runtime and AMEX remains `off`. Schema, catalog, bridge, preservation, hybrid parity, idempotency, merge, deployment, and anonymous core smoke gates passed. Cleanup, production HMAC provisioning, AMEX preview, userscript publication/installation, live provider scanning, and benefit-status write activation remain separate future boundaries.

## Privacy

Raw deployment output, project/deployment identifiers, aliases, environment values, connection values, and response bodies were held only in temporary private files and removed. This record contains only a public pull-request number and aggregate or boolean outcomes.
