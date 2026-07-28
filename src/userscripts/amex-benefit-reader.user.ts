import {
  AMEX_SYNC_HANDOFF_ORIGIN,
  AMEX_SYNC_HANDOFF_PATH,
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
declare const __AMEX_READER_VERSION__: string;

const AMEX_READER_ORIGIN = "https://global.americanexpress.com";

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
  return window.location.origin === AMEX_SYNC_HANDOFF_ORIGIN
    && window.location.pathname === AMEX_SYNC_HANDOFF_PATH;
}

function mountHandoffBridge(): void {
  const storage = new HandoffMailboxStorage();
  let activeMailbox: Awaited<ReturnType<typeof loadAmexSyncMailbox>> | null = null;
  let clearTimer: number | null = null;
  let loading = false;

  const finish = (): void => {
    if (clearTimer !== null) window.clearTimeout(clearTimer);
    window.removeEventListener("message", receiveMessage);
  };

  const expire = (): void => {
    void clearAmexSyncMailbox(storage).finally(finish);
  };

  const receiveMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== window || event.origin !== AMEX_SYNC_HANDOFF_ORIGIN) return;
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
        window.postMessage({
          type: "perks-reminder:amex-sync-payload",
          transferId: mailbox.transferId,
          nonce: mailbox.nonce,
          digest: mailbox.digest,
          envelope: mailbox.envelope,
        }, AMEX_SYNC_HANDOFF_ORIGIN);
        clearTimer = window.setTimeout(expire, 20_000);
      })
      .catch(finish)
      .finally(() => { loading = false; });
  };

  window.addEventListener("message", receiveMessage);
}

async function main(): Promise<void> {
  if (window.top !== window.self) return;
  if (isExactHandoffPage()) {
    mountHandoffBridge();
    return;
  }
  if (window.location.origin !== AMEX_READER_ORIGIN) return;

  const { mountAmexBenefitReader } = await import("./amex-benefit-reader/reader-runtime");
  await mountAmexBenefitReader(__AMEX_READER_VERSION__);
}

// Branch before loading reader dependencies. First-party Amex reads remain
// reachable only from the panel's explicit Scan all cards button callback.
void main();
