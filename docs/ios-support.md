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
