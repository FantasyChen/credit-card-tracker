import { fireEvent, waitFor } from "@testing-library/react";
import { AmexBenefitReaderPanel } from "../panel";
import { createEmptyStore, mergeCardAttempt, mergeScanSummary } from "@/lib/amex-benefit-reader/storage-policy";

const now = "2026-07-15T12:00:00.000Z";
const localCardId = "11111111-1111-4111-8111-111111111111";

function shadow(): ShadowRoot {
  return document.getElementById("perks-reminder-amex-reader")!.shadowRoot!;
}

function button(name: string): HTMLButtonElement {
  return Array.from(shadow().querySelectorAll("button")).find((item) => item.textContent === name) as HTMLButtonElement;
}

describe("Amex reader side panel", () => {
  beforeEach(() => {
    document.getElementById("perks-reminder-amex-reader")?.remove();
    jest.restoreAllMocks();
  });

  it("mounts local-only disclosure without scanning automatically", () => {
    const startScan = jest.fn(async () => undefined);
    new AmexBenefitReaderPanel(createEmptyStore(now), {
      startScan,
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().textContent).toContain("Local only — not sent to Perks Reminder");
    expect(shadow().textContent).toContain("first-party American Express read requests");
    expect(shadow().textContent).toContain("Raw responses are not saved");
    expect(shadow().textContent).toContain("Nothing is scanned until you start");
    expect(startScan).not.toHaveBeenCalled();
    expect(button("Scan all cards")).toBeEnabled();
  });

  it("shows a persisted cross-document interruption without resuming automatically", () => {
    const startScan = jest.fn(async () => undefined);
    const interrupted = mergeScanSummary(createEmptyStore(now), {
      startedAt: now,
      finishedAt: "2026-07-15T12:01:00.000Z",
      status: "interrupted",
      discoveredCardCount: 9,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 0,
      cards: [],
      visibleContext: "unavailable",
    });
    new AmexBenefitReaderPanel(interrupted, {
      startScan,
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().textContent).toContain("interrupted after 1 of 9 cards were attempted");
    expect(shadow().textContent).toContain("Nothing resumes until you press Scan all cards");
    expect(shadow().textContent).toContain("visible Amex card context could not be verified");
    expect(startScan).not.toHaveBeenCalled();
    expect(button("Scan all cards")).toBeEnabled();
  });

  it("starts only from the named button and exposes accessible live progress and cancellation", async () => {
    let release!: () => void;
    const startScan = jest.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const cancelScan = jest.fn();
    const panel = new AmexBenefitReaderPanel(createEmptyStore(now), { startScan, cancelScan, clearData: jest.fn(async () => undefined) });
    fireEvent.click(button("Scan all cards"));
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
    panel.report({ type: "started" });
    panel.report({ type: "discovered", cardCount: 2, unknownEntryCount: 1 });
    expect(shadow().querySelector('[role="status"]')).toHaveAttribute("aria-live", "polite");
    expect(shadow().textContent).toContain("2 supported cards");
    fireEvent.click(button("Cancel"));
    expect(cancelScan).toHaveBeenCalledTimes(1);
    expect(shadow().textContent).toContain("Cancelling");
    release();
  });

  it("prioritizes meaningful tracker progress over the generic incomplete state", () => {
    const identity = { localCardId, sourceFingerprint: "a".repeat(64), productName: "Synthetic Card", endingDigits: "1234" };
    const store = mergeCardAttempt(createEmptyStore(now), {
      disposition: "complete",
      identity,
      attemptedAt: now,
      observation: {
        contractVersion: "amex-benefits/1",
        issuer: "american_express_us",
        localCardId,
        productName: "Synthetic Card",
        endingDigits: "1234",
        observedAt: now,
        parserVersion: "fixture/1",
        completeness: "complete",
        issueCodes: [],
        benefits: [{
          benefitKey: "benefit-1234567890abcdef",
          title: "Synthetic Progress Benefit",
          category: { state: "observed", value: "spend" },
          activityKind: "spend_progress",
          enrollmentState: { state: "not_exposed" },
          trackerState: { state: "observed", value: "in_progress" },
          completionState: { state: "observed", value: "incomplete" },
          earnedOrUsed: { state: "not_exposed" },
          targetOrLimit: { state: "not_exposed" },
          remaining: { state: "not_exposed" },
          period: { state: "not_exposed" },
          confidence: "high",
          issueCodes: [],
        }],
      },
    }).store;
    new AmexBenefitReaderPanel(store, { startScan: jest.fn(async () => undefined), cancelScan: jest.fn(), clearData: jest.fn(async () => undefined) });
    expect(shadow().querySelector(".primary-status")?.textContent).toBe("in progress");
  });

  it("renders stale card status, timestamps, fixed errors, and mixed-age warning", () => {
    const identity = { localCardId, sourceFingerprint: "a".repeat(64), productName: "Synthetic Card", endingDigits: "1234" };
    const successful = mergeCardAttempt(createEmptyStore(now), {
      disposition: "complete",
      identity,
      attemptedAt: now,
      observation: {
        contractVersion: "amex-benefits/1",
        issuer: "american_express_us",
        localCardId,
        productName: "Synthetic Card",
        endingDigits: "1234",
        observedAt: now,
        parserVersion: "fixture/1",
        completeness: "complete",
        issueCodes: [],
        benefits: [],
      },
    }).store;
    const stale = mergeCardAttempt(successful, {
      disposition: "failed",
      identity,
      attemptedAt: "2026-07-15T13:00:00.000Z",
      errorCode: "request_timeout",
    }).store;
    new AmexBenefitReaderPanel(stale, { startScan: jest.fn(async () => undefined), cancelScan: jest.fn(), clearData: jest.fn(async () => undefined) });
    expect(shadow().textContent).toContain("Synthetic Card");
    expect(shadow().textContent).toContain("Stale");
    expect(shadow().textContent).toContain("read request timed out");
    expect(shadow().textContent).toContain("not fully current");
  });

  it("renders explicit unknown-account and visible-context warnings", () => {
    const store = mergeScanSummary(createEmptyStore(now), {
      startedAt: now,
      finishedAt: "2026-07-15T12:01:00.000Z",
      status: "partial",
      discoveredCardCount: 1,
      attemptedCardCount: 1,
      unknownAccountVariantCount: 2,
      cards: [],
      visibleContext: "changed",
    });
    new AmexBenefitReaderPanel(store, {
      startScan: jest.fn(async () => undefined),
      cancelScan: jest.fn(),
      clearData: jest.fn(async () => undefined),
    });
    expect(shadow().textContent).toContain("2 account response variants were not recognized");
    expect(shadow().textContent).toContain("visible Amex card or route changed");
  });

  it("requires confirmation before clearing both local-data concerns", async () => {
    const clearData = jest.fn(async () => undefined);
    jest.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    new AmexBenefitReaderPanel(createEmptyStore(now), { startScan: jest.fn(async () => undefined), cancelScan: jest.fn(), clearData });
    fireEvent.click(button("Clear local data"));
    expect(clearData).not.toHaveBeenCalled();
    fireEvent.click(button("Clear local data"));
    await waitFor(() => expect(clearData).toHaveBeenCalledTimes(1));
    expect(shadow().textContent).toContain("Local data cleared");
  });
});
