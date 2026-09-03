/** @jest-environment-options {"url":"https://www.perks-reminder.com/integrations/amex-sync"} */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AMEX_SYNC_MAX_ROWS,
  digestAmexSyncEnvelope,
  parseAmexSyncEnvelope,
} from "@/lib/amex-benefit-reader/sync-contract";
import { AmexSyncHandoffClient } from "../AmexSyncHandoffClient";

const transferId = "a".repeat(32);
const nonce = "b".repeat(32);
const scanTime = new Date(Date.now() - 60_000).toISOString();
const envelope = parseAmexSyncEnvelope({
  envelopeVersion: "amex-sync-envelope/3",
  observationContractVersion: "amex-benefits/3",
  scanId: "22222222-2222-4222-8222-222222222222",
  scanFinishedAt: scanTime,
  cards: [{
    sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
    providerProductName: "American Express Platinum Card",
    productKey: "american-express-platinum-card",
    endingDigits: "12345",
    observedAt: scanTime,
    parserVersion: "amex-api-us/3.0.0",
    rows: [{
      providerTitle: "Resy",
      providerCategory: "usage",
      sourceCreditKey: "american-express-platinum-card:resy",
      creditFamilyKey: "american-express-platinum-card:resy",
      sourcePeriod: {
        kind: "calendar_date_range",
        startDate: "2026-07-01",
        endDate: "2026-09-30",
        timeZone: "UTC",
      },
      enrollmentState: "enrolled",
      completionState: "incomplete",
      earnedOrUsed: { value: "40", unit: "USD", currency: "USD" },
      targetOrLimit: { value: "100", unit: "USD", currency: "USD" },
    }],
  }],
  exclusions: [],
});

const row = {
  sourceRowIdentity: "c".repeat(64),
  atomicGroupIdentity: "d".repeat(64),
  sourceLocalCardId: envelope.cards[0].sourceLocalCardId,
  productKey: "american-express-platinum-card",
  creditFamilyKey: "american-express-platinum-card:resy",
  disposition: "proposed",
  reason: "proposed_update",
  destinationCardId: "card-1",
  before: { usedAmount: 100, isCompleted: true, completedAt: "2026-07-10T00:00:00.000Z", isNotUsable: false },
  after: { usedAmount: 40, isCompleted: false, completedAt: null, isNotUsable: false },
  changes: { amountDecrease: true, amountIncrease: false, completionSet: false, completionCleared: true },
};

function response(value: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: async () => value } as Response);
}

async function deliverPayload(payloadEnvelope = envelope) {
  const digest = await digestAmexSyncEnvelope(payloadEnvelope);
  window.dispatchEvent(new MessageEvent("message", {
    origin: "https://www.perks-reminder.com",
    source: window,
    data: { type: "perks-reminder:amex-sync-payload", transferId, nonce, digest, envelope: payloadEnvelope },
  }));
}

describe("Amex sync handoff client", () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    window.history.replaceState(null, "", `/?transfer=${transferId}`);
    jest.spyOn(window, "postMessage").mockImplementation(() => undefined);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("acquires a typed mailbox payload, strips the locator, and previews without writing", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [row],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for the local Amex reader");

    await deliverPayload();
    await screen.findByText("Resy");
    expect(screen.getByRole("heading", { name: "American Express Platinum Card ••••• 12345" })).toBeInTheDocument();
    expect(screen.getByText("Jul–Sep 2026")).toBeInTheDocument();

    expect(window.location.pathname).toBe("/integrations/amex-sync");
    expect(window.location.search).toBe("");
    expect(window.postMessage).toHaveBeenCalledWith({
      type: "perks-reminder:amex-sync-accepted",
      transferId,
      nonce,
    }, "https://www.perks-reminder.com");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/integrations/amex-sync/preview", expect.objectContaining({ method: "POST" }));
    expect(screen.getByRole("heading", { name: "Preview only" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
    view.unmount();
  });

  it("shows decreases and requires a separate confirmation gesture in write mode", async () => {
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "proposal-token".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [],
      }))
      .mockReturnValueOnce(response({ attemptId: "attempt-1", replayed: false, rows: [{ ...row, disposition: "updated" }], updatedCount: 1 }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    expect(await screen.findByText(/decreases the amount and clears completion/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 update" }));
    await screen.findByText("Confirmation recorded");
    expect(screen.getAllByText("Updated").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ready to update")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith("/api/integrations/amex-sync/confirm", expect.objectContaining({ method: "POST" }));
    view.unmount();
  });

  it("uses the reviewed Uber source context for the December bonus row", async () => {
    const decemberEnvelope = parseAmexSyncEnvelope({
      ...envelope,
      scanFinishedAt: "2026-12-15T12:00:00.000Z",
      cards: [{
        ...envelope.cards[0],
        observedAt: "2026-12-15T11:59:00.000Z",
        rows: [{
          ...envelope.cards[0].rows[0],
          providerTitle: "Uber Cash",
          sourceCreditKey: "american-express-platinum-card:uber-cash",
          creditFamilyKey: "american-express-platinum-card:uber-cash",
          sourcePeriod: {
            kind: "calendar_date_range",
            startDate: "2026-12-01",
            endDate: "2026-12-31",
            timeZone: "UTC",
          },
        }],
      }],
    });
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [{
        ...row,
        creditFamilyKey: "american-express-platinum-card:uber-cash-december-bonus",
      }],
      proposalToken: "december-proposal".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload(decemberEnvelope);

    expect(await screen.findByRole("heading", { name: "Uber Cash" })).toBeInTheDocument();
    expect(screen.getByText("Dec 2026")).toBeInTheDocument();
    view.unmount();
  });

  it("keeps duplicate-looking physical cards in separate source-card groups", async () => {
    const secondCardId = "33333333-3333-4333-8333-333333333333";
    const repeatedCardEnvelope = parseAmexSyncEnvelope({
      ...envelope,
      cards: [
        envelope.cards[0],
        {
          ...envelope.cards[0],
          sourceLocalCardId: secondCardId,
        },
      ],
    });
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [
        row,
        {
          ...row,
          sourceRowIdentity: "4".repeat(64),
          atomicGroupIdentity: "5".repeat(64),
          sourceLocalCardId: secondCardId,
        },
      ],
      proposalToken: "duplicate-card-proposal".repeat(2),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload(repeatedCardEnvelope);

    expect(await screen.findAllByRole("heading", { name: "American Express Platinum Card ••••• 12345" }))
      .toHaveLength(2);
    view.unmount();
  });

  it("keeps proposed changes first and secondary outcomes in counted disclosures", async () => {
    const unchangedRow = {
      ...row,
      sourceRowIdentity: "e".repeat(64),
      atomicGroupIdentity: "f".repeat(64),
      disposition: "unchanged",
      reason: "already_current",
    };
    const skippedRow = {
      ...row,
      sourceRowIdentity: "1".repeat(64),
      atomicGroupIdentity: "2".repeat(64),
      disposition: "skipped",
      reason: "period_not_current",
    };
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "write",
      rows: [unchangedRow, skippedRow, row],
      proposalToken: "mixed-proposal".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();

    const proposed = await screen.findByText("Ready to update");
    const confirm = screen.getByRole("button", { name: "Confirm 1 update" });
    const unchanged = screen.getByText("Already current", { selector: "summary" });
    const skipped = screen.getByText("Skipped safely", { selector: "summary" });
    expect(unchanged.closest("details")).not.toHaveAttribute("open");
    expect(skipped.closest("details")).not.toHaveAttribute("open");
    expect(proposed.compareDocumentPosition(unchanged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(proposed.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(confirm.compareDocumentPosition(unchanged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(confirm).toBeEnabled();
    view.unmount();
  });

  it("disables stale confirmation and gives one fresh-scan recovery path", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "write",
      rows: [row],
      proposalToken: "expired-proposal".repeat(4),
      proposalExpiresAt: new Date(Date.now() - 1_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();

    expect(await screen.findByText("Preview expired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm 1 update" })).toBeDisabled();
    expect(screen.getByText(/return to Amex, run a fresh scan/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("counts down into expiry and stops scheduling proposal timers", async () => {
    jest.useFakeTimers();
    const now = Date.now();
    jest.setSystemTime(now);
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "write",
      rows: [row],
      proposalToken: "countdown-proposal".repeat(4),
      proposalExpiresAt: new Date(now + 2_500).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await act(async () => {
      await deliverPayload();
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Expires soon · 0:03 left")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1_000));
    expect(screen.getByText("Expires soon · 0:02 left")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1_000));
    expect(screen.getByText("Expires soon · 0:01 left")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByText("Preview expired")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm 1 update" })).toBeDisabled();
    expect(jest.getTimerCount()).toBe(1);
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps replay and partial confirmation outcomes distinct and inspectable", async () => {
    const failedRow = {
      ...row,
      sourceRowIdentity: "6".repeat(64),
      atomicGroupIdentity: "7".repeat(64),
      disposition: "failed",
      reason: "persistence_failed",
    };
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "partial-proposal".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-partial",
        replayed: true,
        rows: [{ ...row, disposition: "updated" }, failedRow],
        updatedCount: 1,
      }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm 1 update" }));

    expect(await screen.findByRole("heading", { name: "Result already recorded" })).toBeInTheDocument();
    expect(screen.getByText("1 updated, 0 unchanged, 0 skipped, and 1 failed.")).toBeInTheDocument();
    expect(screen.getByText("This row could not be saved")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("already processed");
    view.unmount();
  });

  it("rejects an incomplete 2xx confirmation result instead of reporting success", async () => {
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "proposal-token".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-1",
        replayed: false,
        rows: [{ ...row, disposition: "updated", changes: undefined }],
        updatedCount: 1,
      }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm 1 update" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Confirmation failed safely"));
    expect(screen.queryByText("Confirmation recorded")).not.toBeInTheDocument();
    view.unmount();
  });

  it("rejects a non-final confirmation disposition instead of reporting success", async () => {
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "proposal-token".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-1",
        replayed: false,
        rows: [row],
        updatedCount: 0,
      }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm 1 update" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Confirmation failed safely"));
    expect(screen.queryByText("Confirmation recorded")).not.toBeInTheDocument();
    view.unmount();
  });

  it("rejects a confirmation count that disagrees with final row dispositions", async () => {
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "proposal-token".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-1",
        replayed: false,
        rows: [{ ...row, disposition: "updated" }],
        updatedCount: 0,
      }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm 1 update" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Confirmation failed safely"));
    expect(screen.queryByText("Confirmation recorded")).not.toBeInTheDocument();
    view.unmount();
  });

  it("shows one actionable missing-last-five card skip without a manual selector", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "write",
      rows: [{
        ...row,
        disposition: "skipped",
        reason: "destination_last_five_required",
        destinationCardId: null,
        before: null,
        after: null,
        changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
      }],
      proposalToken: "first-proposal".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [{
        destinationCardId: "card-1",
        reason: "destination_last_five_required",
        label: "Synthetic Platinum",
        editHref: "/cards/card-1/edit#lastFourDigits",
      }],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    const editLink = await screen.findByRole("link", { name: "Add five ending digits for Synthetic Platinum" });
    expect(editLink).toHaveTextContent("Add five ending digits");
    expect(editLink).toHaveAccessibleDescription(/opens in a new tab.*save it there.*return here.*check the details again/i);
    expect(editLink).toHaveAttribute("href", "/cards/card-1/edit#lastFourDigits");
    expect(editLink).toHaveAttribute("target", "_blank");
    expect(editLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/opens in a new tab.*save it there.*return here.*check the details again/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check card details" })).toBeEnabled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm 0 updates" })).toBeDisabled();
    view.unmount();
  });

  it.each([
    "https://evil.example/cards/card-1/edit#lastFourDigits",
    "/cards/card-1?next=/edit#lastFourDigits",
    "/cards/../edit#lastFourDigits",
  ])("rejects malformed card edit URL %s before acknowledging the mailbox", async (editHref) => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "write",
      rows: [row],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [{
        destinationCardId: "card-1",
        reason: "destination_last_five_required",
        label: "Synthetic Platinum",
        editHref,
      }],
    }));

    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(screen.queryByRole("link", { name: /add five ending digits/i })).not.toBeInTheDocument();
    expect(window.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }),
      "https://www.perks-reminder.com",
    );
    view.unmount();
  });

  it("refreshes from retained envelope state and confirms only the replacement proposal", async () => {
    const cardSkip = {
      destinationCardId: "card-1",
      reason: "destination_last_five_required",
      label: "Synthetic Platinum",
      editHref: "/cards/card-1/edit#lastFourDigits",
    };
    const refreshedRow = {
      ...row,
      after: { ...row.after, usedAmount: 25 },
      changes: { ...row.changes, amountDecrease: true },
    };
    let resolveRefresh!: (value: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "initial-proposal".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [cardSkip],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-1",
        replayed: false,
        rows: [{ ...row, disposition: "updated" }],
        updatedCount: 1,
      }))
      .mockReturnValueOnce(refreshResponse)
      .mockReturnValueOnce(response({
        attemptId: "attempt-2",
        replayed: false,
        rows: [{ ...refreshedRow, disposition: "updated" }],
        updatedCount: 1,
      }));

    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm 1 update" }));
    await screen.findByText("Confirmation recorded");

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(screen.getByRole("button", { name: "Checking card details…" })).toBeDisabled();
    expect(screen.queryByText("Confirmation recorded")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm 1 update" })).not.toBeInTheDocument();

    const refreshRequest = (global.fetch as jest.Mock).mock.calls[2];
    expect(refreshRequest[0]).toBe("/api/integrations/amex-sync/preview");
    expect(JSON.parse(refreshRequest[1].body)).toEqual({ envelope });

    resolveRefresh({
      ok: true,
      status: 200,
      json: async () => ({
        mode: "write",
        rows: [refreshedRow],
        proposalToken: "refreshed-proposal".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [cardSkip],
      }),
    } as Response);

    expect(await screen.findByText(/\$100\.00 → \$25\.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm 1 update" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sync finished"));

    const refreshedConfirmationRequest = (global.fetch as jest.Mock).mock.calls[3];
    expect(refreshedConfirmationRequest[0]).toBe("/api/integrations/amex-sync/confirm");
    expect(JSON.parse(refreshedConfirmationRequest[1].body)).toEqual({
      envelope,
      proposalToken: "refreshed-proposal".repeat(4),
    });
    view.unmount();
  });

  it("does not start a refresh while confirmation is in flight", async () => {
    let resolveConfirmation!: (value: Response) => void;
    const confirmationResponse = new Promise<Response>((resolve) => {
      resolveConfirmation = resolve;
    });
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "proposal-token".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [{
          destinationCardId: "card-1",
          reason: "destination_last_five_required",
          label: "Synthetic Platinum",
          editHref: "/cards/card-1/edit#lastFourDigits",
        }],
      }))
      .mockReturnValueOnce(confirmationResponse);

    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm 1 update" }));

    const refreshButton = screen.getByRole("button", { name: "Check card details" });
    expect(refreshButton).toBeDisabled();
    fireEvent.click(refreshButton);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    resolveConfirmation({
      ok: true,
      status: 200,
      json: async () => ({
        attemptId: "attempt-1",
        replayed: false,
        rows: [{ ...row, disposition: "updated" }],
        updatedCount: 1,
      }),
    } as Response);
    await screen.findByText("Confirmation recorded");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it("fails closed when refreshing an expired or invalid reviewed handoff", async () => {
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "initial-proposal".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [{
          destinationCardId: "card-1",
          reason: "destination_last_five_required",
          label: "Synthetic Platinum",
          editHref: "/cards/card-1/edit#lastFourDigits",
        }],
      }))
      .mockReturnValueOnce(response({ error: "scan_expired" }, false, 400));

    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Check card details" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("run a fresh scan, then choose Sync reviewed again"));
    expect(screen.queryByRole("button", { name: "Confirm 1 update" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check card details" })).not.toBeInTheDocument();
    view.unmount();
  });

  it("does not acknowledge or consume the mailbox when server mode is off", async () => {
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="off" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("currently turned off"));
    expect(window.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }), "https://www.perks-reminder.com");
    expect(global.fetch).not.toHaveBeenCalled();
    view.unmount();
  });

  it("acknowledges the mailbox only after preview accepts the envelope", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({ error: "request_invalid" }, false, 400));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(window.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }), "https://www.perks-reminder.com");
    view.unmount();
  });

  it("rejects an incomplete 2xx preview row without acknowledging the mailbox", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [{ ...row, changes: undefined }],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(window.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }), "https://www.perks-reminder.com");
    view.unmount();
  });

  it("rejects a response row that does not belong to the accepted in-memory envelope", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [{ ...row, sourceLocalCardId: "88888888-8888-4888-8888-888888888888" }],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(screen.queryByText("Amex card")).not.toBeInTheDocument();
    expect(window.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }),
      "https://www.perks-reminder.com",
    );
    view.unmount();
  });

  it("rejects unknown preview response fields without acknowledging the mailbox", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [row],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
      unexpected: true,
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(window.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }), "https://www.perks-reminder.com");
    view.unmount();
  });

  it("rejects an over-limit preview response without acknowledging the mailbox", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: Array.from({ length: AMEX_SYNC_MAX_ROWS + 1 }, () => row),
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(window.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }), "https://www.perks-reminder.com");
    view.unmount();
  });

  it("rejects a final-only disposition in a preview without acknowledging the mailbox", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [{ ...row, disposition: "updated" }],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(window.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }), "https://www.perks-reminder.com");
    view.unmount();
  });

  it("rejects an invalid preview disposition and reason combination", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [{ ...row, disposition: "skipped" }],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      cardSkips: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(window.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }), "https://www.perks-reminder.com");
    view.unmount();
  });

  it("ignores wrong-origin and wrong-transfer messages", async () => {
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    const digest = await digestAmexSyncEnvelope(envelope);
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://evil.example",
      source: window,
      data: { type: "perks-reminder:amex-sync-payload", transferId, nonce, digest, envelope },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://www.perks-reminder.com",
      source: window,
      data: { type: "perks-reminder:amex-sync-payload", transferId: "f".repeat(32), nonce, digest, envelope },
    }));
    await Promise.resolve();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(window.location.search).toContain("transfer");
    view.unmount();
  });
});
