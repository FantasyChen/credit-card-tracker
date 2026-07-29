/** @jest-environment-options {"url":"https://preview.example.com/integrations/amex-sync"} */
import { render, screen, waitFor } from "@testing-library/react";
import { AmexSyncHandoffClient } from "../AmexSyncHandoffClient";

const transferId = "a".repeat(32);

describe("unsupported-origin Amex sync handoff client", () => {
  beforeEach(() => {
    jest.spyOn(window, "postMessage").mockImplementation(() => undefined);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fails closed without requesting a mailbox payload or preview", async () => {
    render(<AmexSyncHandoffClient transferId={transferId} initialMode="preview" />);

    await waitFor(() => expect(screen.getByRole("status"))
      .toHaveTextContent("not available on the current origin"));
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
