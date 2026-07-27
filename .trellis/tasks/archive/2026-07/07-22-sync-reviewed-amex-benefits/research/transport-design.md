# Research: Least-authority Tampermonkey-to-Perks transport design

- **Query**: Compare direct cross-origin API, a first-party handoff page, and safer alternatives that work with Tampermonkey while preserving one global Sync button and a separate confirmation summary; recommend one.
- **Scope**: mixed
- **Date**: 2026-07-22

## Findings

### Files Found

| File Path | Description |
|---|---|
| `scripts/build-amex-benefit-reader.mjs` | Current exact AMEX match and storage-only userscript grants. |
| `src/userscripts/amex-benefit-reader.user.ts` | Exact-origin entry guard and panel action wiring. |
| `src/userscripts/amex-benefit-reader/panel.ts` | Existing global scan action and local review UI boundary. |
| `src/userscripts/amex-benefit-reader/tampermonkey-storage.ts` | Script-private GM storage adapter. |
| `src/lib/amex-benefit-reader/contract.ts` | Portable normalized observation and forbidden-field guard. |
| `src/lib/amex-benefit-reader/storage-policy.ts` | Versioned GM keys, current/stale records, revision, and safe clearing. |
| `src/lib/auth.ts` | First-party Lax session cookie and server session identity. |
| `next.config.ts` | `X-Frame-Options: DENY`; no CORS/COOP source configuration. |

### Product/UI constraints carried into transport

- The durable write must remain separate from scanning and local review (`.trellis/tasks/07-22-sync-reviewed-amex-benefits/prd.md:13-18`).
- There is one global **Sync** action for the reviewed scan set, followed by a read-only proposed/skipped summary and a separate confirmation (`prd.md:15-18`).
- Only approved normalized fields may cross the boundary; raw AMEX data, cookies, account tokens, headers, credentials, and session material may not (`prd.md:20-25`).
- The server derives the Perks Reminder user from its own authenticated session (`prd.md:22-25`).
- The archived browser-reader design explicitly states that a website transport accepts portable normalized observations, never `StoredCardRecordV1` or the installation fingerprint (`.trellis/tasks/archive/2026-07/07-15-amex-card-benefit-sync/design.md:422-426`).

### Option comparison

| Design | Browser/auth behavior | Added userscript authority | Reliability | Security/data properties | Verdict |
|---|---|---|---|---|---|
| Native cross-origin `fetch` from AMEX to Perks | `SameSite=Lax` session cookie is not sent; JSON POST preflights; current server has no CORS | Destination code only, but would require server CORS expansion | Not authenticated under current rules | Would require credentialed CORS and a broader cross-site mutation surface | Reject |
| Privileged `GM.xmlHttpRequest` direct API | Background-context request may bypass page CORS, but session-cookie/partition behavior is an extension boundary | Add powerful network grant plus exact `@connect` destination; non-anonymous mode can carry cookies | Browser/extension dependent; current artifact has no grant | Makes the AMEX-installed script a direct cookie-bearing mutation client; anonymous mode loses session auth | Reject for initial scope |
| New first-party tab + opener `postMessage` | Top-level GET can carry Lax cookie; page then calls same-origin API | No cross-origin network grant; uses `window.open` and message handshake | Good when already signed in; opener may be lost through OAuth/COOP redirects | No payload in URL; exact origin/source/nonce validation required | Viable signed-in baseline, not most robust |
| New first-party tab + one-time GM mailbox bridge | Top-level first-party page owns login/session/API calls; shared script-private GM storage survives login redirects | Add a narrowly path-scoped Perks Reminder `@match`; retain only existing GM storage grants; no `@connect` or GM network grant | Works with already-signed-in and sign-in-return flows | Only portable payload temporarily stored; opaque transfer ID in URL; exact path/origin and single-use TTL | **Recommended** |
| URL fragment/form/upload/clipboard transfer | First-party page authenticates | Little/no network authority | Size/history/manual-flow limitations | Payload may leak into history/diagnostics or require extra manual import, and top-level cross-site POST does not get Lax auth | Reject |

### Recommended design: one-time script-private mailbox plus first-party handoff page

This is a first-party handoff with a safer, more reliable transfer channel than a long-lived cross-origin opener. It preserves the current browser cookie policy and avoids adding a privileged cross-origin network API.

#### 1. Global Sync action on AMEX

After the review surface is complete and idle, the single global **Sync** button:

1. Selects only current, complete, locally reviewed card observations. Stale, failed, partial, enrollment-only, linking-only, unavailable, ambiguous, or unsupported rows remain represented as skipped proposal inputs/reasons, not writable rows.
2. Projects to an exact versioned sync envelope containing only portable normalized fields required for mapping/status derivation. It never includes `sourceFingerprint`, installation secret, raw record error data, headers, cookies, tokens, or raw responses.
3. Generates a cryptographically random transfer ID and writes one short-lived transfer envelope to a new script-private GM storage key. Include `createdAt`, `expiresAt`, transport version, contract version, and a digest; cap cards/rows/bytes.
4. Opens one top-level `https://www.perks-reminder.com/integrations/amex-sync?transfer=<opaque-id>` page from the direct user gesture. The query contains only an opaque random locator, never AMEX observations. A fragment can be used when no authentication redirect is needed, but a non-sensitive query locator is easier to preserve through sign-in callback URLs.

The existing userscript already has asynchronous GM storage grants (`scripts/build-amex-benefit-reader.mjs:18-20`) and versioned strict storage parsing (`src/lib/amex-benefit-reader/storage-policy.ts:65-113`). No `GM.xmlHttpRequest`, `GM.cookie`, `unsafeWindow`, or wildcard `@connect` is needed.

#### 2. Narrow first-party userscript branch

Add a second, path-narrow match for only the handoff page, not the entire Perks Reminder site. On that exact origin/path:

1. Do not construct the AMEX API client, scan engine, or provider UI. The current AMEX entry guard already prevents execution outside its exact supported origin (`src/userscripts/amex-benefit-reader.user.ts:17-19`); the first-party branch should be a separate exact handoff entry.
2. Read only the requested transfer ID from script-private GM storage.
3. Validate version, strict schema, TTL, size, digest, and forbidden field names.
4. Deliver the envelope only to the exact first-party page using an exact-origin typed handshake (for example `window.postMessage` with exact target origin and a nonce tied to the transfer ID). The page validates message type, nonce, origin, and expected source.
5. Delete the mailbox after the first-party page acknowledges successful preview acceptance; also expire/delete on timeout, cancellation, malformed content, or clear-data. A consumed transfer cannot be reopened.

Because the same userscript identity owns GM storage across its allowed matches, the handoff can resume after a first-party sign-in redirect without exposing the payload in URL/history or relying on an opener that survives OAuth.

#### 3. First-party preview

The handoff page uses the ordinary Perks Reminder session. A top-level safe navigation is compatible with the current Lax cookie. If no session exists, it sends the user through existing sign-in and returns to the same handoff URL; the mailbox remains short-lived.

After receiving the envelope, page JavaScript makes a **same-origin** JSON call to the preview route. The route:

- authenticates before parsing/DB access;
- validates exact first-party `Origin`/Fetch Metadata and keeps CORS absent;
- revalidates the strict bounded transport;
- derives `userId` solely from `getServerSession(authOptions)`;
- auto-maps only exact canonical product + ending digits with exactly one owned card;
- applies saved mappings only when they belong to the authenticated user and still reference an owned card;
- resolves stable credit and exact structured/reviewed period to exactly one owned benefit status/cycle/occurrence;
- calculates before/after values and reasons for every skipped row;
- returns a read-only summary plus a short-lived signed proposal token bound to user ID, payload digest, current before-state digest, and expiry;
- performs no card/benefit/status mutation.

Manual mapping is offered only inside this first-party confirmation page. The user chooses among their server-loaded cards; client-submitted card IDs are rechecked for ownership and mapping compatibility.

#### 4. Separate confirmation

The confirmation button sends the proposal token, same normalized envelope/digest, and approved one-time manual mappings to a same-origin confirmation route. The server re-authenticates, revalidates, verifies token/user/digest/expiry, and re-resolves current state. If destination state changed after preview, the affected row returns `conflict_repreview_required` rather than silently applying a stale proposal.

For each accepted row, one transaction writes the absolute status transition and its provenance/audit result. A server-computed attempt idempotency key lets an identical confirmation return the original row results. Stale/equal source observation handling is enforced from durable source provenance, not client claims.

### Why this is least-authority for the current architecture

- It does not relax `SameSite=Lax` or make the session cookie cross-site.
- It does not add credentialed CORS.
- It does not give the AMEX-page branch direct network permission to Perks Reminder.
- It does not issue or transport a bearer/session token to AMEX.
- It adds only one exact first-party handoff path to the same userscript and reuses its existing script-private storage API.
- Perks Reminder cookies remain `HttpOnly`; neither AMEX code nor the userscript reads them.
- The durable write occurs from a visible authenticated first-party confirmation page, matching the product's separate-summary requirement.

### Direct opener/`postMessage` fallback

If product scope guarantees the user is already signed in to Perks Reminder, the mailbox can be replaced by direct popup messaging:

- open the exact first-party handoff URL from the Sync click;
- first-party page sends `ready` to its opener;
- AMEX branch requires exact `event.origin`, exact `event.source`, expected message type, and one-time nonce before sending the portable envelope with exact `targetOrigin`;
- the first-party page acknowledges, then severs/ignores further messages.

MDN documents exact `targetOrigin` and origin/source validation as necessary. This variant avoids temporary mailbox persistence, but it is less reliable if sign-in traverses OAuth or another response severs the opener. It should not fall back to wildcard `*`, payload-in-URL, or direct cross-origin fetch.

### External References

- [MDN: Window.postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) — controlled cross-origin window communication and exact `targetOrigin` behavior.
- [MDN: Window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) — top-level tab/window creation, popup blocking, asynchronous navigation, and opener semantics.
- [MDN: Set-Cookie / SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) — Lax top-level safe navigation behavior.
- [MDN: CSRF prevention](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSRF_prevention) — CSRF tokens, Fetch Metadata, non-simple requests, and SameSite as defense in depth.
- [Tampermonkey `@connect`](https://www.tampermonkey.net/documentation.php?locale=en&q=connect) — destination expansion needed by privileged network requests.
- [Tampermonkey `GM_xmlhttpRequest`](https://www.tampermonkey.net/documentation.php?locale=en&q=GM_xmlhttpRequest) — background request authority and anonymous cookie suppression.

### Related Specs

- `.trellis/spec/perks-reminder/browser-read-integrations.md:79-97` — provider-read/local-persistence boundary and authority expansion requirement.
- `.trellis/spec/perks-reminder/browser-read-integrations.md:138-164` — generated artifact grant/destination/sensitive-data tests.
- `.trellis/spec/perks-reminder/architecture-and-domain.md:32-71` — authenticated server mutation contract.
- `.trellis/tasks/07-22-sync-reviewed-amex-benefits/prd.md:13-25`, `:55-68` — one Sync action, preview/confirm separation, minimal transport, and acceptance criteria.

## Caveats / Not Found

- Tampermonkey match-pattern behavior and shared GM storage across the two exact origins should be proven with the generated artifact in a synthetic browser harness before owner-only live validation.
- The exact handoff route does not yet exist.
- No current Cross-Origin-Opener-Policy is configured, but OAuth/provider responses are external and may affect opener continuity; that is why the mailbox variant is recommended.
- The source transport needs a stable semantic credit key and exact period representation; the current normalized `benefitKey`/free-form period are insufficient by themselves. See `schema-catalog-gaps.md`.
