import { AmexApiClient } from "@/lib/amex-benefit-reader/amex-api-client";
import { AmexBenefitScanEngine, type ScanReporter } from "@/lib/amex-benefit-reader/scan-engine";
import { AmexBenefitReaderPanel } from "./amex-benefit-reader/panel";
import { TampermonkeyCardIdentityService, TampermonkeyResultStore } from "./amex-benefit-reader/tampermonkey-storage";
import { AmexVisibleContextGuard, isSupportedAmexBenefitsRoute } from "./amex-benefit-reader/visible-context";

async function main(): Promise<void> {
  if (!isSupportedAmexBenefitsRoute() || document.getElementById("perks-reminder-amex-reader")) return;

  const store = new TampermonkeyResultStore();
  try {
    const initialStore = await store.load();
    let engine: AmexBenefitScanEngine | null = null;
    let panel: AmexBenefitReaderPanel | null = null;
    const reporter: ScanReporter = { report: (progress) => panel?.report(progress) };
    panel = new AmexBenefitReaderPanel(initialStore, {
      startScan: async () => {
        if (!engine) throw new Error("The local scanner is not ready.");
        await engine.scanAllCards();
      },
      cancelScan: () => engine?.cancel(),
      clearData: () => store.clear(),
    });
    engine = new AmexBenefitScanEngine(
      new AmexApiClient(),
      new AmexVisibleContextGuard(),
      store,
      new TampermonkeyCardIdentityService(),
      reporter,
    );
    window.addEventListener("beforeunload", () => engine?.cancel(), { once: true });
  } catch {
    AmexBenefitReaderPanel.mountError(
      "Local reader data is malformed or from an unsupported version. Clear local data to recover.",
      () => store.clear(),
    );
  }
}

// Mounting the panel is the only load-time behavior. First-party Amex reads are
// reachable only from the panel's explicit Scan all cards button callback.
void main();
