import {
  resolveAmexSyncHandoffTarget,
} from "@/lib/amex-benefit-reader/handoff-target";
import { mountAmexSyncHandoffBridge } from "./amex-benefit-reader/handoff-runtime";
import { TampermonkeyMailboxStorage } from "./amex-benefit-reader/tampermonkey-storage";

declare const unsafeWindow: Window | undefined;
declare const __AMEX_READER_VERSION__: string;
declare const __AMEX_SYNC_HANDOFF_TARGET__: "production" | "local";

const AMEX_READER_ORIGIN = "https://global.americanexpress.com";
const AMEX_SYNC_HANDOFF_TARGET = resolveAmexSyncHandoffTarget(__AMEX_SYNC_HANDOFF_TARGET__);

function isExactHandoffPage(): boolean {
  if (window.location.origin !== AMEX_SYNC_HANDOFF_TARGET.origin
    || window.location.pathname !== AMEX_SYNC_HANDOFF_TARGET.path) return false;
  const params = new URLSearchParams(window.location.search);
  return Array.from(params.keys()).length === 1
    && /^[a-f0-9]{32}$/.test(params.get("transfer") ?? "");
}

function mountHandoffBridge(): void {
  const pageWindow = typeof unsafeWindow !== "undefined"
    ? unsafeWindow
    : window;
  mountAmexSyncHandoffBridge(AMEX_SYNC_HANDOFF_TARGET, new TampermonkeyMailboxStorage(), pageWindow);
}

async function main(): Promise<void> {
  if (window.top !== window.self) return;
  if (isExactHandoffPage()) {
    mountHandoffBridge();
    return;
  }
  if (window.location.origin !== AMEX_READER_ORIGIN) return;

  const { mountAmexBenefitReader } = await import("./amex-benefit-reader/reader-runtime");
  await mountAmexBenefitReader(__AMEX_READER_VERSION__, AMEX_SYNC_HANDOFF_TARGET.name);
}

// Branch before loading reader dependencies. First-party Amex reads remain
// reachable only from the panel's explicit Scan all cards button callback.
void main();
