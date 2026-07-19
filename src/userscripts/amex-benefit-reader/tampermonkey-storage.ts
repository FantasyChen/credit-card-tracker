import { createInstallationSecret, fingerprintCardToken } from "@/lib/amex-benefit-reader/identity";
import type { CardIdentityService, PreparedCardIdentity, ResultStore } from "@/lib/amex-benefit-reader/scan-engine";
import { retainSupportedAmexCardCredits } from "@/lib/amex-benefit-reader/supported-card-credits";
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

declare const GM: {
  getValue(key: string, defaultValue?: unknown): Promise<unknown>;
  setValue(key: string, value: unknown): Promise<void>;
  deleteValue(key: string): Promise<void>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function retainSupportedStoredCredits(store: StoreEnvelopeV1, projectedAt: string): StoreEnvelopeV1 {
  let changed = false;
  const cards: StoreEnvelopeV1["cards"] = {};
  for (const [localCardId, record] of Object.entries(store.cards)) {
    if (!record.latest) {
      cards[localCardId] = record;
      continue;
    }
    const benefits = retainSupportedAmexCardCredits(record.latest.productName, record.latest.benefits);
    if (benefits === record.latest.benefits) {
      cards[localCardId] = record;
      continue;
    }
    changed = true;
    cards[localCardId] = {
      ...record,
      latest: { ...record.latest, benefits },
    };
  }
  if (!changed) return store;
  return {
    ...store,
    revision: store.revision + 1,
    updatedAt: projectedAt,
    cards,
  };
}

export class TampermonkeyResultStore implements ResultStore {
  async load(): Promise<StoreEnvelopeV1> {
    const projectedAt = nowIso();
    const loaded = loadStoreValue(await GM.getValue(STORE_KEY, null), projectedAt);
    const projected = retainSupportedStoredCredits(loaded, projectedAt);
    if (projected !== loaded) await GM.setValue(STORE_KEY, projected);
    return projected;
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
    await Promise.all([GM.deleteValue(STORE_KEY), GM.deleteValue(IDENTITY_SECRET_KEY)]);
  }

  async initializeIfNeeded(): Promise<void> {
    const value = await GM.getValue(STORE_KEY, null);
    if (value == null) await GM.setValue(STORE_KEY, createEmptyStore(nowIso()));
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
