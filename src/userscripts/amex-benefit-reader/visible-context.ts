import type { VisibleContextGuard, VisiblePageContext } from "@/lib/amex-benefit-reader/scan-engine";

const ALLOWED_PATHS = new Set(["/card-benefits/view-all", "/card-benefits/activity"]);
const SELECTED_CARD_DISPLAY = '[data-testid="simple_switcher_combobox"][role="combobox"], [data-testid*="account-selector"] button[aria-expanded], [data-pr-account-selector-trigger]';

export function isSupportedAmexBenefitsRoute(locationValue: Pick<Location, "origin" | "pathname"> = window.location): boolean {
  return locationValue.origin === "https://global.americanexpress.com" && ALLOWED_PATHS.has(locationValue.pathname);
}

function displayFingerprint(root: ParentNode): string | null {
  const element = root.querySelector<HTMLElement>(SELECTED_CARD_DISPLAY);
  if (!element) return null;
  const display = (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().replace(/\s+/g, " ");
  if (!display) return null;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < display.length; index += 1) {
    const code = display.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

export class AmexVisibleContextGuard implements VisibleContextGuard {
  constructor(
    private readonly locationValue: Pick<Location, "origin" | "pathname"> = window.location,
    private readonly root: ParentNode = document,
  ) {}

  capture(): VisiblePageContext {
    if (!isSupportedAmexBenefitsRoute(this.locationValue)) throw new Error("Unsupported Amex route.");
    const selectedCardDisplayFingerprint = displayFingerprint(this.root);
    if (!selectedCardDisplayFingerprint) throw new Error("The visible card context is unavailable.");
    return {
      route: this.locationValue.pathname,
      selectedCardDisplayFingerprint,
    };
  }

  verifyUnchanged(context: VisiblePageContext): boolean {
    return isSupportedAmexBenefitsRoute(this.locationValue)
      && this.locationValue.pathname === context.route
      && displayFingerprint(this.root) === context.selectedCardDisplayFingerprint;
  }
}
