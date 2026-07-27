import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  envelopeVersion: "amex-sync-envelope/1",
  observationContractVersion: "amex-benefits/2",
  scanId: "22222222-2222-4222-8222-222222222222",
  scanFinishedAt: scanTime,
  cards: [{
    sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
    productKey: "american-express-platinum-card",
    endingDigits: "1234",
    observedAt: scanTime,
    parserVersion: "fixture/2",
    rows: [],
  }],
  exclusions: [],
});

const row = {
  sourceRowIdentity: "c".repeat(64),
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

async function deliverPayload() {
  const digest = await digestAmexSyncEnvelope(envelope);
  window.dispatchEvent(new MessageEvent("message", {
    origin: "https://www.perks-reminder.com",
    source: window,
    data: { type: "perks-reminder:amex-sync-payload", transferId, nonce, digest, envelope },
  }));
}

describe("Amex sync handoff client", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", `/?transfer=${transferId}`);
    jest.spyOn(window, "postMessage").mockImplementation(() => undefined);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("acquires a typed mailbox payload, strips the locator, and previews without writing", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [row],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      mappingOptions: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for the local Amex reader");

    await deliverPayload();
    await screen.findByText("Resy");

    expect(window.location.pathname).toBe("/integrations/amex-sync");
    expect(window.location.search).toBe("");
    expect(window.postMessage).toHaveBeenCalledWith({
      type: "perks-reminder:amex-sync-accepted",
      transferId,
      nonce,
    }, "https://www.perks-reminder.com");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/integrations/amex-sync/preview", expect.objectContaining({ method: "POST" }));
    expect(screen.getByText(/preview-only/i)).toBeInTheDocument();
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
        mappingOptions: [],
      }))
      .mockReturnValueOnce(response({ attemptId: "attempt-1", replayed: false, rows: [{ ...row, disposition: "updated" }], updatedCount: 1 }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    expect(await screen.findByText(/decreases the amount and clears completion/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Confirm proposed updates" }));
    await screen.findByText("Confirmation recorded");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith("/api/integrations/amex-sync/confirm", expect.objectContaining({ method: "POST" }));
    view.unmount();
  });

  it("rejects an incomplete 2xx confirmation result instead of reporting success", async () => {
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [row],
        proposalToken: "proposal-token".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        mappingOptions: [],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-1",
        replayed: false,
        rows: [{ ...row, disposition: "updated", changes: undefined }],
        updatedCount: 1,
      }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm proposed updates" }));
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
        mappingOptions: [],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-1",
        replayed: false,
        rows: [row],
        updatedCount: 0,
      }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm proposed updates" }));
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
        mappingOptions: [],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-1",
        replayed: false,
        rows: [{ ...row, disposition: "updated" }],
        updatedCount: 0,
      }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm proposed updates" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Confirmation failed safely"));
    expect(screen.queryByText("Confirmation recorded")).not.toBeInTheDocument();
    view.unmount();
  });

  it("allows a separately confirmed compatible mapping even when no status update is proposed", async () => {
    const mappingRequired = {
      ...row,
      disposition: "skipped",
      reason: "manual_mapping_required",
      destinationCardId: null,
      before: null,
      after: null,
      changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
    };
    const alreadyCurrent = {
      ...row,
      disposition: "unchanged",
      reason: "already_current",
      before: row.after,
      after: row.after,
      changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
    };
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [mappingRequired],
        proposalToken: "first-proposal".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        mappingOptions: [{ id: "card-1", productKey: row.productKey, label: "Synthetic Platinum" }],
      }))
      .mockReturnValueOnce(response({
        mode: "write",
        rows: [alreadyCurrent],
        proposalToken: "second-proposal".repeat(4),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        mappingOptions: [{ id: "card-1", productKey: row.productKey, label: "Synthetic Platinum" }],
      }))
      .mockReturnValueOnce(response({
        attemptId: "attempt-mapping",
        replayed: false,
        rows: [alreadyCurrent],
        updatedCount: 0,
      }));

    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="write" />);
    await deliverPayload();
    const select = await screen.findByLabelText("Amex card from this scan");
    fireEvent.change(select, { target: { value: "card-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create new preview" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm selected card mapping" }));
    await screen.findByText("Confirmation recorded");
    expect(global.fetch).toHaveBeenCalledTimes(3);
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
      mappingOptions: [],
    }));
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await deliverPayload();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be previewed"));
    expect(window.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "perks-reminder:amex-sync-accepted" }), "https://www.perks-reminder.com");
    view.unmount();
  });

  it("rejects unknown preview response fields without acknowledging the mailbox", async () => {
    (global.fetch as jest.Mock).mockReturnValue(response({
      mode: "preview",
      rows: [row],
      proposalToken: "proposal-token".repeat(4),
      proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      mappingOptions: [],
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
      mappingOptions: [],
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
      mappingOptions: [],
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
      mappingOptions: [],
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
