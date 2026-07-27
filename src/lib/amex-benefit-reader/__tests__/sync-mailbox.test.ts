import {
  AMEX_SYNC_HANDOFF_ORIGIN,
  AMEX_SYNC_MAILBOX_KEY,
  amexSyncHandoffUrl,
  clearAmexSyncMailbox,
  createAmexSyncMailbox,
  loadAmexSyncMailbox,
  storeAmexSyncMailbox,
  type MailboxStorage,
} from "../sync-mailbox";
import { parseAmexSyncEnvelope } from "../sync-contract";

class MemoryStorage implements MailboxStorage {
  readonly values = new Map<string, unknown>();
  async getValue(key: string, defaultValue?: unknown) { return this.values.get(key) ?? defaultValue; }
  async setValue(key: string, value: unknown) { this.values.set(key, value); }
  async deleteValue(key: string) { this.values.delete(key); }
}

const now = new Date("2026-07-15T12:00:00.000Z");
const envelope = parseAmexSyncEnvelope({
  envelopeVersion: "amex-sync-envelope/1",
  observationContractVersion: "amex-benefits/2",
  scanId: "22222222-2222-4222-8222-222222222222",
  scanFinishedAt: now.toISOString(),
  cards: [{
    sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
    productKey: "american-express-platinum-card",
    endingDigits: "1234",
    observedAt: now.toISOString(),
    parserVersion: "fixture/2",
    rows: [],
  }],
  exclusions: [],
});

describe("private Amex sync mailbox", () => {
  it("creates opaque locator and nonce and builds only the exact first-party URL", async () => {
    const mailbox = await createAmexSyncMailbox(envelope, now);
    expect(mailbox.transferId).toMatch(/^[a-f0-9]{32}$/);
    expect(mailbox.nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(mailbox.transferId).not.toBe(mailbox.nonce);
    const url = new URL(amexSyncHandoffUrl(mailbox.transferId));
    expect(url.origin).toBe(AMEX_SYNC_HANDOFF_ORIGIN);
    expect(url.pathname).toBe("/integrations/amex-sync");
    expect(Array.from(url.searchParams.keys())).toEqual(["transfer"]);
  });

  it("stores one entry, verifies integrity, and clears it explicitly", async () => {
    const storage = new MemoryStorage();
    const mailbox = await createAmexSyncMailbox(envelope, now);
    await storeAmexSyncMailbox(storage, mailbox, now);
    await expect(loadAmexSyncMailbox(storage, mailbox.transferId, now)).resolves.toEqual(mailbox);
    await expect(storeAmexSyncMailbox(storage, await createAmexSyncMailbox(envelope, now), now)).rejects.toThrow("already waiting");
    await clearAmexSyncMailbox(storage);
    expect(storage.values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);
  });

  it("deletes expired, malformed, mismatched, and integrity-failed entries", async () => {
    const storage = new MemoryStorage();
    const mailbox = await createAmexSyncMailbox(envelope, now);

    storage.values.set(AMEX_SYNC_MAILBOX_KEY, { bad: true });
    await expect(loadAmexSyncMailbox(storage, mailbox.transferId, now)).rejects.toThrow("invalid");
    expect(storage.values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);

    storage.values.set(AMEX_SYNC_MAILBOX_KEY, mailbox);
    await expect(loadAmexSyncMailbox(storage, "f".repeat(32), now)).rejects.toThrow("invalid");
    expect(storage.values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);

    storage.values.set(AMEX_SYNC_MAILBOX_KEY, { ...mailbox, digest: "0".repeat(64) });
    await expect(loadAmexSyncMailbox(storage, mailbox.transferId, now)).rejects.toThrow("integrity");
    expect(storage.values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);

    storage.values.set(AMEX_SYNC_MAILBOX_KEY, mailbox);
    await expect(loadAmexSyncMailbox(storage, mailbox.transferId, new Date(mailbox.expiresAt))).rejects.toThrow("expired");
    expect(storage.values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);

    storage.values.set(AMEX_SYNC_MAILBOX_KEY, {
      ...mailbox,
      expiresAt: new Date(now.getTime() + 11 * 60 * 1000).toISOString(),
    });
    await expect(loadAmexSyncMailbox(storage, mailbox.transferId, now)).rejects.toThrow("invalid");
    expect(storage.values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);

    storage.values.set(AMEX_SYNC_MAILBOX_KEY, {
      ...mailbox,
      createdAt: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
    });
    await expect(loadAmexSyncMailbox(storage, mailbox.transferId, now)).rejects.toThrow("creation time");
    expect(storage.values.has(AMEX_SYNC_MAILBOX_KEY)).toBe(false);
  });
});
