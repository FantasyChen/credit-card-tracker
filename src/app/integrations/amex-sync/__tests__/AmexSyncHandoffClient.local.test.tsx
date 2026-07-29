/** @jest-environment-options {"url":"http://localhost:3000/integrations/amex-sync"} */
import { render, screen, waitFor } from "@testing-library/react";
import {
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
    rows: [],
  }],
  exclusions: [],
});

describe("local-development Amex sync handoff client", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", `/integrations/amex-sync?transfer=${transferId}`);
    jest.spyOn(window, "postMessage").mockImplementation(() => undefined);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        mode: "preview",
        rows: [],
        proposalToken: "synthetic-proposal-token".repeat(2),
        proposalExpiresAt: new Date(Date.now() + 300_000).toISOString(),
        cardSkips: [],
      }),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses localhost exclusively for ready, payload, and accepted messages", async () => {
    const view = render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);
    await waitFor(() => expect(window.postMessage).toHaveBeenCalledWith(
      { type: "perks-reminder:amex-sync-ready", transferId },
      "http://localhost:3000",
    ));

    const digest = await digestAmexSyncEnvelope(envelope);
    window.dispatchEvent(new MessageEvent("message", {
      origin: "http://localhost:3000",
      source: null,
      data: { type: "perks-reminder:amex-sync-payload", transferId, nonce, digest, envelope },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://www.perks-reminder.com",
      source: window,
      data: { type: "perks-reminder:amex-sync-payload", transferId, nonce, digest, envelope },
    }));
    expect(global.fetch).not.toHaveBeenCalled();

    window.dispatchEvent(new MessageEvent("message", {
      origin: "http://localhost:3000",
      source: window,
      data: { type: "perks-reminder:amex-sync-payload", transferId, nonce, digest, envelope },
    }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(window.postMessage).toHaveBeenCalledWith({
      type: "perks-reminder:amex-sync-accepted",
      transferId,
      nonce,
    }, "http://localhost:3000");
    expect(screen.getByRole("status")).toHaveTextContent("Review every row");
    view.unmount();
  });
});
