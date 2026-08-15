import { resolveAmexSyncHandoffTarget } from "@/lib/amex-benefit-reader/handoff-target";
import { mountAmexSyncHandoffBridge } from "@/userscripts/amex-benefit-reader/handoff-runtime";
import { mountAmexBenefitReader } from "@/userscripts/amex-benefit-reader/reader-runtime";
import { BrowserCardIdentityService, BrowserMailboxStorage, BrowserResultStore } from "@/userscripts/amex-benefit-reader/storage-port";
import { ChromeLocalStorage } from "./storage";
import { isExactHandoffUrl } from "./route-classifier";

declare const __AMEX_EXTENSION_VERSION__: string;

const target = resolveAmexSyncHandoffTarget("production");
const AMEX_ORIGIN = "https://global.americanexpress.com";
const storage = new ChromeLocalStorage();

function isHandoffPage(): boolean {
  return isExactHandoffUrl(window.location);
}

async function main(): Promise<void> {
  if (window.top !== window.self) return;
  if (isHandoffPage()) {
    mountAmexSyncHandoffBridge(target, new BrowserMailboxStorage(storage), window);
    return;
  }
  if (window.location.origin !== AMEX_ORIGIN) return;
  await mountAmexBenefitReader(__AMEX_EXTENSION_VERSION__, "production", {
    adapters: {
      store: new BrowserResultStore(storage),
      mailboxStorage: new BrowserMailboxStorage(storage),
      identity: new BrowserCardIdentityService(storage),
    },
  });
}

void main();
