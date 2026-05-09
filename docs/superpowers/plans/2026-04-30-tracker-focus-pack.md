# Tracker Focus Pack Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add power-user benefit filters and compact group summaries to the benefits dashboard.

**Architecture:** Keep the work client-side and schema-free. Extract filter and summary behavior to a focused helper module, test it directly, then wire it into `BenefitsDisplayClient` and `CategoryBenefitsGroup`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Jest.

---

### Task 1: Dashboard Helper Module

**Files:**
- Create: `src/lib/benefit-dashboard.ts`
- Test: `src/lib/__tests__/benefit-dashboard.test.ts`

- [x] Write failing tests for frequency filtering, free-night/certificate filtering, combined filters, and group summary calculations.
- [x] Run `npm test -- src/lib/__tests__/benefit-dashboard.test.ts` and verify the tests fail because the module does not exist.
- [x] Implement the minimal helper module.
- [x] Run `npm test -- src/lib/__tests__/benefit-dashboard.test.ts` and verify the tests pass.

### Task 2: Benefits Dashboard Filters

**Files:**
- Modify: `src/components/BenefitsDisplayClient.tsx`
- Test: `src/components/__tests__/BenefitsDisplayClient.test.tsx`

- [x] Add component tests for the new frequency and free-night/certificate controls.
- [x] Run `npm test -- src/components/__tests__/BenefitsDisplayClient.test.tsx` and verify the tests fail.
- [x] Wire helper filters into the existing filter pipeline.
- [x] Add a frequency select and free-night/certificate toggle to the existing filter UI.
- [x] Run `npm test -- src/components/__tests__/BenefitsDisplayClient.test.tsx` and verify the tests pass.

### Task 3: Group Summary Header

**Files:**
- Modify: `src/components/CategoryBenefitsGroup.tsx`
- Test: covered by `src/lib/__tests__/benefit-dashboard.test.ts`

- [x] Use the helper summary in group headers.
- [x] Show remaining value, claimed value, partial count, and soonest due date in compact text.
- [x] Run focused tests from Tasks 1 and 2.

### Task 4: Verification

**Files:**
- Read: `CONTEXT.md`, `NOW.md`
- Modify: `NOW.md`

- [x] Run `npm test -- src/lib/__tests__/benefit-dashboard.test.ts src/components/__tests__/BenefitsDisplayClient.test.tsx`.
- [x] Run `npm test -- src/lib/__tests__/partial-completion.test.ts` as a nearby regression check.
- [x] Update `NOW.md` with the completed state.
