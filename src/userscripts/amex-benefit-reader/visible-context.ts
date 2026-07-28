import type { VisibleContextGuard, VisiblePageContext } from "@/lib/amex-benefit-reader/scan-engine";

export const AMEX_MEMBER_ORIGIN = "https://global.americanexpress.com";
const AMEX_BENEFITS_PATHS = new Set(["/card-benefits/view-all", "/card-benefits/activity"]);
const SELECTED_CARD_DISPLAY = '[data-testid="simple_switcher_combobox"][role="combobox"], [data-testid*="account-selector"] button[aria-expanded], [data-pr-account-selector-trigger]';

export function isSupportedAmexOrigin(
  locationValue: Pick<Location, "origin"> = window.location,
): boolean {
  return locationValue.origin === AMEX_MEMBER_ORIGIN;
}

export function isPrimaryAmexBenefitsRoute(
  locationValue: Pick<Location, "origin" | "pathname"> = window.location,
): boolean {
  return isSupportedAmexOrigin(locationValue) && AMEX_BENEFITS_PATHS.has(locationValue.pathname);
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
    if (!isSupportedAmexOrigin(this.locationValue)) throw new Error("Unsupported Amex origin.");
    return {
      route: this.locationValue.pathname,
      selectedCardDisplayFingerprint: displayFingerprint(this.root),
    };
  }

  verifyUnchanged(context: VisiblePageContext): boolean {
    if (!isSupportedAmexOrigin(this.locationValue) || this.locationValue.pathname !== context.route) return false;
    return context.selectedCardDisplayFingerprint === null
      || displayFingerprint(this.root) === context.selectedCardDisplayFingerprint;
  }
}
