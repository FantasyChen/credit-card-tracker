import { AmexApiClient } from "@/lib/amex-benefit-reader/amex-api-client";
import type { AmexSyncHandoffTargetName } from "@/lib/amex-benefit-reader/handoff-target";
import { AmexBenefitScanEngine, type ScanReporter } from "@/lib/amex-benefit-reader/scan-engine";
import {
  amexSyncHandoffUrl,
  createAmexSyncMailbox,
  storeAmexSyncMailbox,
} from "@/lib/amex-benefit-reader/sync-mailbox";
import { projectLatestV3SyncEnvelope } from "@/lib/amex-benefit-reader/sync-contract";
import { AMEX_READER_HOST_ID, AmexBenefitReaderPanel } from "./panel";
import {
  TampermonkeyCardIdentityService,
  TampermonkeyMailboxStorage,
  TampermonkeyResultStore,
} from "./tampermonkey-storage";
import type { CardIdentityService, ResultStore } from "@/lib/amex-benefit-reader/scan-engine";
import type { MailboxStorage } from "@/lib/amex-benefit-reader/sync-mailbox";
import {
  AmexVisibleContextGuard,
  isPrimaryAmexBenefitsRoute,
  isSupportedAmexOrigin,
} from "./visible-context";

function markMountedReaderVersion(version: string): void {
  document.getElementById(AMEX_READER_HOST_ID)?.setAttribute("data-reader-version", version);
}

export interface ReaderRuntimeAdapters {
  store: ResultStore;
  mailboxStorage: MailboxStorage;
  identity: CardIdentityService;
}

export interface ReaderRuntimeOptions {
  initiallyCollapsed?: boolean;
  adapters?: ReaderRuntimeAdapters;
}

export async function mountAmexBenefitReader(
  version: string,
  handoffTargetName: AmexSyncHandoffTargetName = "production",
  options: ReaderRuntimeOptions = {},
): Promise<void> {
  if (!isSupportedAmexOrigin() || document.getElementById(AMEX_READER_HOST_ID)) return;

  const initiallyCollapsed = options.initiallyCollapsed ?? !isPrimaryAmexBenefitsRoute();
  const store = options.adapters?.store ?? new TampermonkeyResultStore();
  const adapters = options.adapters ?? {
    store,
    mailboxStorage: new TampermonkeyMailboxStorage(),
    identity: new TampermonkeyCardIdentityService(),
  };
  try {
    const initialStore = await store.load();
    if (document.getElementById(AMEX_READER_HOST_ID)) return;
    let engine: AmexBenefitScanEngine | null = null;
    let panel: AmexBenefitReaderPanel | null = null;
    const reporter: ScanReporter = { report: (progress) => panel?.report(progress) };
    panel = new AmexBenefitReaderPanel(initialStore, {
      startScan: async () => {
        if (!engine) throw new Error("The local scanner is not ready.");
        await engine.scanAllCards();
      },
      cancelScan: () => engine?.cancel(),
      syncReviewed: async () => {
        const popup = window.open("about:blank", "_blank");
        if (!popup) throw new Error("Allow pop-ups for Amex, then choose Sync reviewed again.");
        popup.opener = null;
        try {
          const projection = projectLatestV3SyncEnvelope(await store.load());
          if (!projection.envelope) {
            throw new Error(projection.reason === "fresh_v3_scan_required"
              ? "Run and review a fresh complete scan before syncing."
              : "No complete reviewed card observations are available to sync.");
          }
          const mailbox = await createAmexSyncMailbox(projection.envelope);
          await storeAmexSyncMailbox(adapters.mailboxStorage, mailbox);
          popup.location.replace(amexSyncHandoffUrl(mailbox.transferId, handoffTargetName));
        } catch (error) {
          popup.close();
          throw error;
        }
      },
      clearData: () => store.clear(),
    }, { initiallyCollapsed });
    markMountedReaderVersion(version);
    engine = new AmexBenefitScanEngine(
      new AmexApiClient(),
      new AmexVisibleContextGuard(),
      store,
      adapters.identity,
      reporter,
    );
    window.addEventListener("beforeunload", () => engine?.cancel(), { once: true });
  } catch {
    if (document.getElementById(AMEX_READER_HOST_ID)) return;
    AmexBenefitReaderPanel.mountError(
      "Local reader data is malformed or from an unsupported version. Clear local data to recover.",
      () => store.clear(),
      { initiallyCollapsed },
    );
    markMountedReaderVersion(version);
  }
}
