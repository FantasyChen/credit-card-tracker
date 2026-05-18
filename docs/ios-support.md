# iOS Support Plan

This repo supports iOS in two phases.

## Phase 1: iOS PWA

The web app is installable from iOS Safari through Add to Home Screen. The app now ships iOS-sized icons, a stricter manifest, safe-area viewport support, service worker registration, and a small iOS-only install prompt.

Validation:

```bash
npm test -- --runInBand
npm run lint
npx next build
```

Manual check:

1. Open `https://www.perks-reminder.com` in iOS Safari.
2. Confirm the Add to Home Screen prompt appears only in Safari and not once installed.
3. Add the app to the Home Screen and confirm the icon, title, standalone display, and safe-area spacing.

## Phase 2: Capacitor iOS Shell

The native shell reuses the existing production web app through Capacitor:

- App ID: `com.perksreminder.app`
- App name: `Perks Reminder`
- Web directory: `capacitor-web`
- Hosted URL: `https://www.perks-reminder.com`

Useful commands:

```bash
npm run ios:sync
npm run ios:open
```

Phase 2 validates that the iOS project can be generated and synchronized. Before App Store submission, validate OAuth provider behavior in the native WebView and decide whether to move from the hosted shell to a bundled static/mobile-specific flow.

## Phase 3: Focused Native Companion

Do not rebuild the whole product in Swift first. The web/PWA remains the canonical app, data model, guide library, and card onboarding surface. Native iOS should add value where the web app cannot:

1. **Glanceable widgets**: home/lock screen widgets for expiring benefits, unused monthly value, and next reset.
2. **Push notifications**: benefit-expiration and new-cycle alerts that mirror email preferences without requiring users to live in email.
3. **Quick mark-complete**: tap a widget or notification action, authenticate if needed, and mark a specific `BenefitStatus` as complete.
4. **Fast benefit detail**: open directly into the relevant web guide or benefit row so "what qualifies?" is one tap away.

Smallest first milestone:

- Ship a TestFlight-only Capacitor companion that signs in, opens the hosted `/benefits` view, registers an APNs device token, and shows one native widget fed by a small authenticated API endpoint returning the next 5 open benefits.
- Keep mutation scope to one server action/API path: mark a `BenefitStatus` complete by ID after confirming the status belongs to the signed-in user.

Technical risks:

- OAuth/session behavior inside the Capacitor WebView may require provider redirect URI updates and cookie-domain checks.
- APNs token storage needs a new table keyed by user/device, plus unsubscribe/revocation handling.
- Widget data should avoid storing sensitive card details locally; prefer display name, amount, due date, and a signed deep link.
- Quick actions must use existing transition logic from `src/lib/benefit-status-transitions.ts` so native and web completion behavior cannot drift.
- App Store review may object if the shell feels too thin, so the first native submission should include a real widget and notification workflow rather than only a web wrapper.
