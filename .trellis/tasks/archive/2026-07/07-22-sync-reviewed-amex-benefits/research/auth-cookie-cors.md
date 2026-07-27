# Research: NextAuth session, cookies, SameSite, and CORS

- **Query**: Determine whether a cross-origin fetch from `global.americanexpress.com` can reliably authenticate to Perks Reminder under the current NextAuth/session/cookie and browser SameSite/CORS configuration.
- **Scope**: mixed
- **Date**: 2026-07-22

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/lib/auth.ts` | NextAuth v4 providers, JWT session strategy, canonical host logic, and production cookie overrides. |
| `src/lib/site.ts` | Canonical `www.perks-reminder.com` URL and shared `.perks-reminder.com` cookie-domain derivation. |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth GET/POST handler. |
| `src/middleware.ts` | Cookie-presence checks and route/subdomain redirects; API routes are excluded from middleware. |
| `src/app/api/force-signout/route.ts` | Explicit host-only/shared-domain cookie clearing and cookie-name inventory. |
| `next.config.ts` | Global response headers; no CORS or cross-origin opener policy. |
| `scripts/build-amex-benefit-reader.mjs` | Current Tampermonkey grants and exact AMEX match scope. |
| `package.json` | Next.js `15.5.11`, NextAuth `4.24.11`, and Prisma `6.16.3`. |

### Current session and cookie configuration

- NextAuth uses the Prisma adapter but explicitly selects JWT sessions (`src/lib/auth.ts:43-44`, `src/lib/auth.ts:96-98`). The checked-in `Session` table exists (`prisma/schema.prisma:63-69`), but the active NextAuth session strategy is the encrypted/signed JWT cookie rather than a database-session lookup.
- The session callback copies `token.id` into `session.user.id`, and mutations are expected to derive ownership from that server session (`src/lib/auth.ts:145-181`).
- In production, the session cookie is named `__Secure-next-auth.session-token` and configured as `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, with the shared domain returned by `getSharedCookieDomain()` (`src/lib/auth.ts:102-127`). For the canonical production host, that domain is `.perks-reminder.com` (`src/lib/site.ts:17-26`, `src/lib/site.ts:29-40`). This shares login among the apex, `www`, and `loyalty` hosts, but not with AMEX.
- Only `sessionToken` and `callbackUrl` are overridden. NextAuth's CSRF cookie remains on its default configuration. That CSRF mechanism protects NextAuth's own auth endpoints; no project code applies a NextAuth CSRF token to custom API mutations.
- Middleware recognizes host-only and secure NextAuth session-cookie names (`src/middleware.ts:41-46`) but its matcher excludes all `/api/` routes (`src/middleware.ts:111-115`). API authentication therefore comes from each route handler, not middleware.
- Force sign-out clears host-only and shared-domain session/callback/CSRF variants and emits `SameSite=Lax` expired cookies (`src/app/api/force-signout/route.ts:4-18`, `src/app/api/force-signout/route.ts:44-63`, `src/app/api/force-signout/route.ts:91-124`).

### Cross-origin native `fetch` result under current rules

A native browser request initiated by code running at `https://global.americanexpress.com` and targeting `https://www.perks-reminder.com` is both cross-origin and cross-site. Under the checked-in configuration, it cannot reliably authenticate:

1. `SameSite=Lax` excludes cookies from cross-site `fetch()` requests. Lax permits a cross-site cookie on a top-level navigation using a safe method, not a subresource/fetch request. Setting `credentials: "include"` does not override the cookie's SameSite policy.
2. Native cross-origin fetch defaults to `credentials: "same-origin"`; changing it to `include` only asks the browser to include credentials that are otherwise eligible.
3. A JSON `POST` (`Content-Type: application/json`) requires a CORS preflight. The repository has no route-level `OPTIONS` handler and no `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, or allowed-method/header responses. `next.config.ts:55-75` sets only `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.
4. Even a CORS-safelisted request would not solve authentication: its response would remain unreadable without CORS permission, and the `SameSite=Lax` session cookie would still be excluded from the cross-site fetch.
5. Credentialed CORS would require an explicit AMEX origin plus `Access-Control-Allow-Credentials: true`; wildcard origin is invalid with credentials. Adding those headers alone would still not make a Lax cookie eligible.

**Conclusion**: a direct native cross-origin API call from the AMEX page is not a reliable authenticated transport under the current configuration. The current Lax setting is beneficial and should not be weakened merely to enable this integration.

### Tampermonkey privileged transport status

- The current artifact matches only `https://global.americanexpress.com/*` and grants only `GM.getValue`, `GM.setValue`, and `GM.deleteValue` (`scripts/build-amex-benefit-reader.mjs:10-21`). It has no `GM.xmlHttpRequest`/`GM_xmlhttpRequest` grant and no `@connect` permission for Perks Reminder.
- Tampermonkey documents `GM_xmlhttpRequest` as a request dispatched from its background context and `@connect` as the destination allowlist. It also documents `anonymous` as “don't send cookies.” Thus a cookie-bearing privileged request would require new extension authority; an anonymous request would not carry the NextAuth session.
- Background/extension cookie behavior is a separate browser-extension boundary and is affected by browser cookie/partition policy. It should not be treated as proof that the current first-party NextAuth cookie will authenticate reliably. It would also bypass the repository's current “storage grants only” artifact boundary.

### Handoff-related response headers

- `X-Frame-Options: DENY` is applied globally (`next.config.ts:55-74`), so a Perks Reminder handoff page cannot be embedded in an AMEX iframe. A new top-level tab/window remains viable.
- No `Cross-Origin-Opener-Policy` is configured in the repository. A basic opener/`postMessage` handoff is therefore possible while the user is already authenticated, but cross-origin OAuth redirects can make long-lived opener reliability browser/provider dependent.

### External References

- [MDN: Set-Cookie / SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) — `Lax` allows cross-site cookies for top-level safe navigations and excludes `fetch()` and iframe/subresource requests.
- [MDN: Request.credentials](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials) — `same-origin` is the default; `include` requests credentials cross-origin but does not override cookie SameSite policy.
- [MDN: CORS guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) — credentialed CORS requires explicit origin and `Access-Control-Allow-Credentials: true`; third-party cookie policy still applies.
- [NextAuth v4 options](https://next-auth.js.org/configuration/options#cookies) — cookie options and the warning that overriding cookie configuration opts out of built-in defaults for those entries.
- [Tampermonkey `@connect`](https://www.tampermonkey.net/documentation.php?locale=en&q=connect) — privileged request destination allowlist.
- [Tampermonkey `GM_xmlhttpRequest`](https://www.tampermonkey.net/documentation.php?locale=en&q=GM_xmlhttpRequest) — background-context transport and cookie-suppression option.

### Related Specs

- `.trellis/spec/perks-reminder/architecture-and-domain.md:26-30` — shared auth across Perks Reminder subdomains and NextAuth route ownership.
- `.trellis/spec/perks-reminder/architecture-and-domain.md:61-71` — authenticated mutation contract and server-derived user identity.
- `.trellis/spec/perks-reminder/browser-read-integrations.md:79-97` — provider read boundary and prohibition on unreviewed website transport expansion.
- `.trellis/tasks/07-22-sync-reviewed-amex-benefits/prd.md:20-25` — minimal authenticated transport and prohibition on transmitting cookies/session material.

## Caveats / Not Found

- No production response capture was performed; findings are based on checked-in configuration and browser standards.
- Vercel/CDN dashboard headers are external state and were not inspected. No source-controlled CORS policy exists.
- Real Tampermonkey cookie attachment/partition behavior was not tested against a logged-in Perks Reminder session. The current artifact does not request that authority, so such a test is outside the present boundary.
