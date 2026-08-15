import {
  clearAmexSyncMailbox,
  handoffAcceptedMessageSchema,
  handoffReadyMessageSchema,
  loadAmexSyncMailbox,
  type MailboxStorage,
} from "@/lib/amex-benefit-reader/sync-mailbox";
import type { AmexSyncHandoffTarget } from "@/lib/amex-benefit-reader/handoff-target";

export function mountAmexSyncHandoffBridge(
  target: AmexSyncHandoffTarget,
  storage: MailboxStorage,
  pageWindow: Window = window,
): void {
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
    if (event.source !== pageWindow || event.origin !== target.origin) return;
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
        }, target.origin);
        clearTimer = window.setTimeout(expire, 20_000);
      })
      .catch(finish)
      .finally(() => { loading = false; });
  };

  pageWindow.addEventListener("message", receiveMessage);
}
