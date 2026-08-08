# Collapse legacy subscription surface

## Goal

Retain required storage/session compatibility while deleting unused paid-tier policy code and impossible branches.

## Requirements

- Preserve `subscriptionTier` and `isBetaUser` storage/session compatibility.
- Remove unused tier, limit, feature-gate, beta-enrollment, and display exports that have no caller.
- Remove impossible email/card limit branches from live flows without changing free-product behavior.
- Keep user-configured reminder timing available to every account.

## Acceptance Criteria

- [ ] Every account still has unlimited cards/reminders and custom reminder timing.
- [ ] Auth/session compatibility remains stable for stored `FREE` and `PRO` users.
- [ ] The remaining interface contains only live compatibility behavior.
- [ ] Focused subscription, auth, notification, and caller tests pass.
