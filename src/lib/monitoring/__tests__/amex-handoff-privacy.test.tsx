import { render } from "@testing-library/react";
import {
  isAmexHandoffUrl,
  parseMonitoringErrorReport,
  sanitizeMonitoringUrl,
} from "@/app/api/monitoring/errors/route";
import { ErrorBoundary, sanitizedClientUrl } from "../errorBoundary";

function ThrowingChild(): React.ReactNode {
  throw new Error("synthetic render failure");
}

describe("Amex handoff monitoring privacy", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    global.fetch = jest.fn();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("projects client and server URLs to origin plus pathname only", () => {
    window.history.replaceState(null, "", "/cards?private=locator#fragment");
    expect(sanitizedClientUrl()).toBe("http://localhost/cards");
    expect(sanitizeMonitoringUrl("https://www.perks-reminder.com/cards?private=locator#fragment")).toBe("https://www.perks-reminder.com/cards");
    expect(sanitizeMonitoringUrl("not a url?private=locator")).toBe("unknown");
  });

  it("recognizes the exact handoff independent of its locator query", () => {
    expect(isAmexHandoffUrl("https://www.perks-reminder.com/integrations/amex-sync?transfer=private")).toBe(true);
    expect(isAmexHandoffUrl("https://www.perks-reminder.com/integrations/amex-sync-history?transfer=private")).toBe(false);
  });

  it("accepts only strict bounded monitoring fields", () => {
    const valid = {
      errorId: "err_synthetic_1",
      message: "Synthetic failure",
      url: "https://www.perks-reminder.com/cards?private=locator",
      timestamp: "2026-07-26T12:00:00.000Z",
    };
    expect(parseMonitoringErrorReport(valid)).toEqual(valid);
    expect(parseMonitoringErrorReport({ ...valid, additionalInfo: { envelope: "private" } })).toBeNull();
    expect(parseMonitoringErrorReport({ ...valid, message: "x".repeat(4_097) })).toBeNull();
    expect(parseMonitoringErrorReport({ ...valid, url: "javascript:alert(1)" })).toBeNull();
  });

  it("does not send automatic or custom error monitoring from the exact handoff", () => {
    window.history.replaceState(null, "", "/integrations/amex-sync?transfer=private-locator");
    const onError = jest.fn();
    const view = render(<ErrorBoundary onError={onError}><ThrowingChild /></ErrorBoundary>);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(view.container).not.toHaveTextContent("synthetic render failure");
    expect(console.error).not.toHaveBeenCalledWith(
      "Error Boundary caught an error:",
      expect.anything(),
    );
  });
});
