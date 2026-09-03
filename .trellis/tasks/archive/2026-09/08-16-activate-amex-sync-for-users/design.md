# Design — AMEX sync user activation

## 1. Operational state machine

```text
verified off
  -> exact preview deployment
  -> fresh owner preview with zero-write proof
  -> bounded-proposal eligibility
  -> fresh action-time confirmation
  -> bounded write canary
  -> replay + fresh preview
  -> verified off
  -> conditional user-wide write activation
```

Any mismatch transitions directly to a newly deployed and runtime-proven exact `off` state. A Ready deployment or registered provider value is never sufficient without primary-alias deployment-ID equality and a narrow runtime probe.

## 2. Existing release boundary

The application and public reader are already released. Activation changes only the production capability mode and performs attended runtime verification. The ignored userscript/extension build outputs are not Vercel inputs, and tracked Trellis-only commits are not pushed merely to force a deployment. Any required configuration deployment uses the reviewed application release source and excludes `.env*`, Trellis workspace/task data, and unrelated local changes.

## 2a. Owner-authorized live E2E lane

The policy owner may authorize the agent to drive the bounded sequence against
the currently authenticated owner session. The server derives one exact
`userId` from that session; the account email is not required in task artifacts
and no other user scope is permitted. This lane allows agent-led preparation,
manual scan, handoff, preview, canary, replay, and rollback, while retaining
the platform action-time confirmations required immediately before sensitive
observation transmission and status confirmation.

## 3. Preview and canary boundary

Preview is authenticated and read-only. Its proposal token is mode-bound and cannot be reused after switching to `write`. Eligibility requires one or two proposed status changes with no blocking classification; zero proposals, more than two proposals, or a changed write-mode proposal ends the attempt in `off`.

The write step creates a new proposal in effective `write` mode, requires the exact reviewed proposal set, confirms once, and verifies only aggregate expected deltas. Completed-attempt replay must return the durable result without a second mutation. A new scan/preview must show the confirmed destinations as current and must not create a duplicate occurrence.

## 4. User-wide launch

The canary always returns to `off` first, proving rollback independently of launch. After a fully passing canary, the owner may separately request the existing user-wide launch. This exposes only the existing manual **Sync reviewed** flow: each user must run a manual scan, review a fresh proposal, and explicitly confirm. There is no automatic or batch synchronization.

Launch verification may reuse the exact immutable `write` deployment that passed the owner canary and same-envelope zero-proposal preview. A newly built deployment instead requires a fresh synthetic nonexistent identity and invented zero-row envelope so it proves effective `write` mode, private/no-store behavior, and zero database mutation without touching a real user's data.

## 5. Privacy and evidence

Evidence may contain versions, public URLs, hashes, deployment readiness/identity booleans, mode, aggregate row counts, closed reason codes, and before/after equality booleans. It must not contain card endings, account/user/row IDs, provider or database identifiers, recovery identifiers, tokens, cookies, headers, raw response/proposal bodies, provider configuration values, or raw observations.

## 6. Rollback and stop policy

Rollback is a provider configuration deployment using exact `off` with no trailing newline, followed by immutable Ready/primary-alias identity equality and an authenticated `sync_off` runtime proof. Unexpected database effects are not compensated automatically; stop, preserve recovery evidence, and investigate. The launch is left in `write` only when every canary, rollback, and final zero-write launch probe passes.
