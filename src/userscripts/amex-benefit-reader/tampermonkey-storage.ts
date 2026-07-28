import { createInstallationSecret, fingerprintCardToken } from "@/lib/amex-benefit-reader/identity";
import type { CardIdentityService, PreparedCardIdentity, ResultStore } from "@/lib/amex-benefit-reader/scan-engine";
import {
  IDENTITY_SECRET_KEY,
  STORE_KEY,
  createEmptyStore,
  loadStoreValue,
  mergeCardAttempt,
  mergeScanSummary,
  type CardAttemptResult,
} from "@/lib/amex-benefit-reader/storage-policy";
import type { ScanSummaryV1, StoreEnvelopeV1, StoredCardRecordV1 } from "@/lib/amex-benefit-reader/contract";
import {
  AMEX_SYNC_MAILBOX_KEY,
  LEGACY_AMEX_SYNC_MAILBOX_KEY,
  type MailboxStorage,
} from "@/lib/amex-benefit-reader/sync-mailbox";

declare const GM: {
  getValue(key: string, defaultValue?: unknown): Promise<unknown>;
  setValue(key: string, value: unknown): Promise<void>;
  deleteValue(key: string): Promise<void>;
};

export const PRIMARY_ONLY_COMPATIBILITY_KEY = "perksReminder.amexBenefitReader.compat.primaryOnly.v1" as const;
export const PRIMARY_ONLY_COMPATIBILITY_VALUE = "primary-only/1" as const;
export const V3_SELECTION_COMPATIBILITY_KEY = "perksReminder.amexBenefitReader.compat.v3Selection.v1" as const;
export const V3_SELECTION_COMPATIBILITY_VALUE = "v3-selection/1" as const;

function nowIso(): string {
  return new Date().toISOString();
}

function invalidateObservations(store: StoreEnvelopeV1, invalidatedAt: string): StoreEnvelopeV1 {
  if (Object.keys(store.cards).length === 0 && store.lastScan === null) return store;
  return {
    ...store,
    revision: store.revision + 1,
    updatedAt: invalidatedAt,
    cards: {},
    lastScan: null,
  };
}

function invalidateSelectionIncompleteObservations(
  store: StoreEnvelopeV1,
  invalidatedAt: string,
): StoreEnvelopeV1 {
  const cards = Object.fromEntries(Object.entries(store.cards).filter(([, record]) =>
    record.latest === null || record.latest.contractVersion === "amex-benefits/3"));
  if (Object.keys(cards).length === Object.keys(store.cards).length && store.lastScan === null) return store;
  return {
    ...store,
    revision: store.revision + 1,
    updatedAt: invalidatedAt,
    cards,
    lastScan: null,
  };
}

async function deletePendingMailboxes(): Promise<void> {
  await GM.deleteValue(LEGACY_AMEX_SYNC_MAILBOX_KEY);
  await GM.deleteValue(AMEX_SYNC_MAILBOX_KEY);
}

export class TampermonkeyResultStore implements ResultStore {
  async load(): Promise<StoreEnvelopeV1> {
    const migratedAt = nowIso();
    // Both compatibility markers are read before the store. A concurrent load
    // that observes either completed marker must therefore read the resulting
    // post-migration snapshot rather than retain a pre-migration value.
    const primaryCompatibility = await GM.getValue(PRIMARY_ONLY_COMPATIBILITY_KEY, null);
    const v3Compatibility = await GM.getValue(V3_SELECTION_COMPATIBILITY_KEY, null);
    const rawStore = await GM.getValue(STORE_KEY, null);
    // Validate before deleting mailboxes or writing markers. Malformed and
    // future-schema stores stay untouched and unmarked.
    let loaded = loadStoreValue(rawStore, migratedAt);

    if (primaryCompatibility !== PRIMARY_ONLY_COMPATIBILITY_VALUE) {
      const invalidated = invalidateObservations(loaded, migratedAt);
      await deletePendingMailboxes();
      if (invalidated !== loaded) await GM.setValue(STORE_KEY, invalidated);
      await GM.setValue(PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE);
      loaded = invalidated;
    }

    if (v3Compatibility !== V3_SELECTION_COMPATIBILITY_VALUE) {
      const invalidated = invalidateSelectionIncompleteObservations(loaded, migratedAt);
      await deletePendingMailboxes();
      if (invalidated !== loaded) await GM.setValue(STORE_KEY, invalidated);
      // Marker last keeps a partial persistence failure retryable.
      await GM.setValue(V3_SELECTION_COMPATIBILITY_KEY, V3_SELECTION_COMPATIBILITY_VALUE);
      loaded = invalidated;
    }

    return loaded;
  }

  async commitCard(result: CardAttemptResult): Promise<StoredCardRecordV1> {
    const current = await this.load();
    const merged = mergeCardAttempt(current, result);
    await GM.setValue(STORE_KEY, merged.store);
    return merged.record;
  }

  async recordScanSummary(summary: ScanSummaryV1): Promise<void> {
    const current = await this.load();
    await GM.setValue(STORE_KEY, mergeScanSummary(current, summary));
  }

  async clear(): Promise<void> {
    await Promise.all([
      GM.deleteValue(STORE_KEY),
      GM.deleteValue(IDENTITY_SECRET_KEY),
      GM.deleteValue(AMEX_SYNC_MAILBOX_KEY),
      GM.deleteValue(LEGACY_AMEX_SYNC_MAILBOX_KEY),
      GM.deleteValue(PRIMARY_ONLY_COMPATIBILITY_KEY),
      GM.deleteValue(V3_SELECTION_COMPATIBILITY_KEY),
    ]);
  }

  async initializeIfNeeded(): Promise<void> {
    const value = await GM.getValue(STORE_KEY, null);
    if (value == null) await GM.setValue(STORE_KEY, createEmptyStore(nowIso()));
  }
}

export class TampermonkeyMailboxStorage implements MailboxStorage {
  getValue(key: string, defaultValue?: unknown): Promise<unknown> {
    return GM.getValue(key, defaultValue);
  }

  setValue(key: string, value: unknown): Promise<void> {
    return GM.setValue(key, value);
  }

  deleteValue(key: string): Promise<void> {
    return GM.deleteValue(key);
  }
}

export class TampermonkeyCardIdentityService implements CardIdentityService {
  private async loadSecret(): Promise<string> {
    const stored = await GM.getValue(IDENTITY_SECRET_KEY, null);
    if (typeof stored === "string" && /^[a-f0-9]{64}$/.test(stored)) return stored;
    if (stored != null) throw new Error("The local identity secret is malformed.");
    const secret = createInstallationSecret();
    await GM.setValue(IDENTITY_SECRET_KEY, secret);
    return secret;
  }

  async prepareCard(input: { rawAccountToken: string; productName: string; endingDigits: string }): Promise<PreparedCardIdentity> {
    const sourceFingerprint = await fingerprintCardToken(await this.loadSecret(), input.rawAccountToken);
    return {
      sourceFingerprint,
      productName: input.productName,
      endingDigits: input.endingDigits,
    };
  }
}
