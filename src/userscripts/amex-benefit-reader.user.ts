import {
  resolveAmexSyncHandoffTarget,
} from "@/lib/amex-benefit-reader/handoff-target";
import {
  clearAmexSyncMailbox,
  handoffAcceptedMessageSchema,
  handoffReadyMessageSchema,
  loadAmexSyncMailbox,
  type MailboxStorage,
} from "@/lib/amex-benefit-reader/sync-mailbox";

interface UserscriptStorageApi {
  getValue<T>(key: string, defaultValue?: T): Promise<T>;
  deleteValue(key: string): Promise<void>;
}

declare const GM: UserscriptStorageApi;
declare const unsafeWindow: Window | undefined;
declare const __AMEX_READER_VERSION__: string;
declare const __AMEX_SYNC_HANDOFF_TARGET__: "production" | "local";

const AMEX_READER_ORIGIN = "https://global.americanexpress.com";
const AMEX_SYNC_HANDOFF_TARGET = resolveAmexSyncHandoffTarget(__AMEX_SYNC_HANDOFF_TARGET__);

class HandoffMailboxStorage implements MailboxStorage {
  getValue<T>(key: string, defaultValue?: T): Promise<T> {
    return GM.getValue(key, defaultValue);
  }

  deleteValue(key: string): Promise<void> {
    return GM.deleteValue(key);
  }

  setValue(): Promise<void> {
    throw new Error("The handoff branch cannot create mailbox entries.");
  }
}

function isExactHandoffPage(): boolean {
  return window.location.origin === AMEX_SYNC_HANDOFF_TARGET.origin
    && window.location.pathname === AMEX_SYNC_HANDOFF_TARGET.path;
}

function mountHandoffBridge(): void {
  const storage = new HandoffMailboxStorage();
  const pageWindow = typeof unsafeWindow !== "undefined"
    ? unsafeWindow
    : window;
  let activeMailbox: Awaited<ReturnType<typeof loadAmexSyncMailbox>> | null = null;
  let clearTimer: number | null = null;
  let loading = false;

  const finish = (): void => {
    if (clearTimer !== null) window.clearTimeout(clearTimer);
    pageWindow.removeEventListener("message", receiveMessage);
  };

  const expire = (): void => {
    void clearAmexSyncMailbox(storage).finally(finish);
  };

  const receiveMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== pageWindow || event.origin !== AMEX_SYNC_HANDOFF_TARGET.origin) return;
    const accepted = handoffAcceptedMessageSchema.safeParse(event.data);
    if (accepted.success && activeMailbox
      && accepted.data.transferId === activeMailbox.transferId
      && accepted.data.nonce === activeMailbox.nonce) {
      activeMailbox = null;
      void clearAmexSyncMailbox(storage).finally(finish);
      return;
    }

    const ready = handoffReadyMessageSchema.safeParse(event.data);
    if (!ready.success || loading || activeMailbox) return;
    loading = true;
    void loadAmexSyncMailbox(storage, ready.data.transferId)
      .then((mailbox) => {
        activeMailbox = mailbox;
        pageWindow.postMessage({
          type: "perks-reminder:amex-sync-payload",
          transferId: mailbox.transferId,
          nonce: mailbox.nonce,
          digest: mailbox.digest,
          envelope: mailbox.envelope,
        }, AMEX_SYNC_HANDOFF_TARGET.origin);
        clearTimer = window.setTimeout(expire, 20_000);
      })
      .catch(finish)
      .finally(() => { loading = false; });
  };

  pageWindow.addEventListener("message", receiveMessage);
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
