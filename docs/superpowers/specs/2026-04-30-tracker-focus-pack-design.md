# Tracker Focus Pack Design

## Goal
Make the benefits dashboard easier for power users to scan by adding high-signal filters and richer group summaries without changing the database schema.

## Scope
- Add client-side filters for benefit frequency and free-night/certificate-like benefits.
- Add reusable helper functions for filtering and group summary calculations.
- Surface group totals for remaining value, claimed value, partial progress count, and soonest due date.
- Keep existing tabs, search, category/card filters, sorting, partial completion, and ROI behavior intact.

## Non-Goals
- No bank or loyalty account linking.
- No new free-night/certificate database model.
- No notification, calendar, or email changes.
- No redesign of the benefit card itself beyond data passed through existing lists.

## Approach
Create a small helper module for dashboard filtering and summary logic so the behavior is unit-testable outside React. `BenefitsDisplayClient` will compose the new filters with the existing search/category/card filters. `CategoryBenefitsGroup` will use the helper summary to display compact operational context in each group header.

## Testing
Add Jest tests for the helper module first. The tests cover frequency filtering, free-night/certificate matching, combined filters, and group summary totals. Existing component tests continue to guard the dashboard controls.
