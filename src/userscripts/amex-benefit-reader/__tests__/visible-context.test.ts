import { AmexVisibleContextGuard, isSupportedAmexBenefitsRoute } from "../visible-context";

describe("Amex visible context guard", () => {
  it("allows only the two reviewed benefits paths", () => {
    expect(isSupportedAmexBenefitsRoute({ origin: "https://global.americanexpress.com", pathname: "/card-benefits/view-all" })).toBe(true);
    expect(isSupportedAmexBenefitsRoute({ origin: "https://global.americanexpress.com", pathname: "/card-benefits/activity" })).toBe(true);
    expect(isSupportedAmexBenefitsRoute({ origin: "https://global.americanexpress.com", pathname: "/overview" })).toBe(false);
    expect(isSupportedAmexBenefitsRoute({ origin: "https://example.com", pathname: "/card-benefits/view-all" })).toBe(false);
  });

  it("reports an unavailable context instead of treating a missing card selector as unchanged", () => {
    const guard = new AmexVisibleContextGuard(
      { origin: "https://global.americanexpress.com", pathname: "/card-benefits/view-all" },
      document.createDocumentFragment(),
    );
    expect(() => guard.capture()).toThrow("visible card context is unavailable");
  });

  it("captures and compares a one-way display fingerprint without clicking the page", () => {
    const locationValue = { origin: "https://global.americanexpress.com", pathname: "/card-benefits/view-all" };
    const root = document.createDocumentFragment();
    const button = document.createElement("button");
    button.dataset.testid = "simple_switcher_combobox";
    button.setAttribute("role", "combobox");
    button.textContent = "Synthetic Card ending 1234";
    const click = jest.spyOn(button, "click");
    root.append(button);
    const guard = new AmexVisibleContextGuard(locationValue, root);
    const captured = guard.capture();
    expect(captured.selectedCardDisplayFingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(captured)).not.toContain("Synthetic Card");
    expect(guard.verifyUnchanged(captured)).toBe(true);
    button.textContent = "Synthetic Card ending 9876";
    expect(guard.verifyUnchanged(captured)).toBe(false);
    expect(click).not.toHaveBeenCalled();
    button.remove();
  });
});
