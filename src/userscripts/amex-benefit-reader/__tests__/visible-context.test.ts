import {
  AmexVisibleContextGuard,
  isPrimaryAmexBenefitsRoute,
  isSupportedAmexOrigin,
} from "../visible-context";

const memberOrigin = "https://global.americanexpress.com";

function selectedCardButton(display = "Synthetic Card ending 1234"): HTMLButtonElement {
  const button = document.createElement("button");
  button.dataset.testid = "simple_switcher_combobox";
  button.setAttribute("role", "combobox");
  button.textContent = display;
  return button;
}

describe("Amex visible context guard", () => {
  it("separates exact-origin support from the two primary benefits paths", () => {
    expect(isSupportedAmexOrigin({ origin: memberOrigin })).toBe(true);
    expect(isSupportedAmexOrigin({ origin: "http://global.americanexpress.com" })).toBe(false);
    expect(isSupportedAmexOrigin({ origin: "https://www.americanexpress.com" })).toBe(false);
    expect(isSupportedAmexOrigin({ origin: "https://example.com" })).toBe(false);

    expect(isPrimaryAmexBenefitsRoute({ origin: memberOrigin, pathname: "/card-benefits/view-all" })).toBe(true);
    expect(isPrimaryAmexBenefitsRoute({ origin: memberOrigin, pathname: "/card-benefits/activity" })).toBe(true);
    expect(isPrimaryAmexBenefitsRoute({ origin: memberOrigin, pathname: "/" })).toBe(false);
    expect(isPrimaryAmexBenefitsRoute({ origin: memberOrigin, pathname: "/account-overview" })).toBe(false);
    expect(isPrimaryAmexBenefitsRoute({ origin: "https://example.com", pathname: "/card-benefits/view-all" })).toBe(false);
  });

  it("captures a null fingerprint when no selected-card control is available", () => {
    const locationValue = { origin: memberOrigin, pathname: "/account-overview" };
    const root = document.createDocumentFragment();
    const guard = new AmexVisibleContextGuard(locationValue, root);

    const captured = guard.capture();
    expect(captured).toEqual({ route: "/account-overview", selectedCardDisplayFingerprint: null });
    expect(guard.verifyUnchanged(captured)).toBe(true);

    root.append(selectedCardButton());
    expect(guard.verifyUnchanged(captured)).toBe(true);
  });

  it("captures and strictly compares a one-way display fingerprint without clicking the page", () => {
    const locationValue = { origin: memberOrigin, pathname: "/card-benefits/view-all" };
    const root = document.createDocumentFragment();
    const control = selectedCardButton();
    const click = jest.spyOn(control, "click");
    root.append(control);
    const guard = new AmexVisibleContextGuard(locationValue, root);

    const captured = guard.capture();
    expect(captured.selectedCardDisplayFingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(captured)).not.toContain("Synthetic Card");
    expect(guard.verifyUnchanged(captured)).toBe(true);

    control.textContent = "Synthetic Card ending 9876";
    expect(guard.verifyUnchanged(captured)).toBe(false);
    control.remove();
    expect(guard.verifyUnchanged(captured)).toBe(false);
    expect(click).not.toHaveBeenCalled();
  });

  it("requires the captured origin and pathname to remain supported and unchanged", () => {
    const locationValue = { origin: memberOrigin, pathname: "/account-overview" };
    const guard = new AmexVisibleContextGuard(locationValue, document.createDocumentFragment());
    const captured = guard.capture();

    locationValue.pathname = "/payments";
    expect(guard.verifyUnchanged(captured)).toBe(false);
    locationValue.pathname = "/account-overview";
    locationValue.origin = "https://example.com";
    expect(guard.verifyUnchanged(captured)).toBe(false);
    expect(() => guard.capture()).toThrow("Unsupported Amex origin");
  });
});
