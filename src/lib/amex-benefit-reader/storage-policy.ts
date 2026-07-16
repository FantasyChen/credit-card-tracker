import {
  STORAGE_SCHEMA_VERSION,
  assertNoForbiddenFieldNames,
  parseStoreEnvelope,
  scanSummarySchema,
  storeEnvelopeSchema,
  type IssueCode,
  type NormalizedCardObservationV1,
  type ScanSummaryV1,
  type StoreEnvelopeV1,
  type StoredCardRecordV1,
} from "./contract";

export const STORE_KEY = "perksReminder.amexBenefitReader.store.v1" as const;
export const IDENTITY_SECRET_KEY = "perksReminder.amexBenefitReader.identitySecret.v1" as const;

export interface CardIdentityMetadata {
  localCardId: string;
  sourceFingerprint: string;
  productName: string;
  endingDigits: string;
}

export type CardAttemptResult =
  | {
      disposition: "complete" | "partial";
      identity: CardIdentityMetadata;
      attemptedAt: string;
      observation: NormalizedCardObservationV1;
    }
  | {
      disposition: "failed";
      identity: CardIdentityMetadata;
      attemptedAt: string;
      errorCode: IssueCode;
    };

const ERROR_MESSAGES: Record<IssueCode, string> = {
  unknown_account_variant: "An unrecognized account response variant was not scanned.",
  duplicate_card_entry: "A physical card identity appeared more than once in account discovery.",
  identity_unavailable: "A stable local card identity could not be created.",
  identity_ambiguous: "This card could not be matched safely to local data.",
  identity_conflict: "Conflicting local card identities were detected.",
  display_reconciled: "The local card display identity changed and was reconciled.",
  response_schema_invalid: "An Amex read response did not match the reviewed structure.",
  unknown_activity_kind: "A benefit activity type was not recognized.",
  unknown_status: "A benefit status was not recognized.",
  unknown_quantity: "A benefit amount or unit was not recognized.",
  benefit_identity_conflict: "Two benefits could not be distinguished safely.",
  request_timeout: "A first-party Amex read request timed out.",
  network_error: "A first-party Amex read request was blocked or could not connect.",
  http_error: "A first-party Amex read request returned an unexpected response.",
  content_type_invalid: "An Amex read response was not JSON.",
  redirect_rejected: "An unexpected redirect was rejected.",
  signed_out: "The signed-in Amex session is no longer available.",
  scan_cancelled: "The scan was cancelled.",
  visible_context_changed: "The visible Amex card or route changed during the API scan.",
  storage_invalid: "Local reader data is malformed or from an unsupported version.",
};

export function fixedErrorMessage(code: IssueCode): string {
  return ERROR_MESSAGES[code];
}

export function createEmptyStore(now: string): StoreEnvelopeV1 {
  return storeEnvelopeSchema.parse({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    revision: 0,
    updatedAt: now,
    cards: {},
    lastScan: null,
  });
}

function migrateLegacyRestorationSummary(value: unknown): StoreEnvelopeV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  const lastScan = envelope.lastScan;
  if (!lastScan || typeof lastScan !== "object" || Array.isArray(lastScan)) return null;
  const legacySummary = lastScan as Record<string, unknown>;
  if (!("restoration" in legacySummary) || "visibleContext" in legacySummary) return null;
  // The previous rendered-page prototype stored only an enum-like restoration
  // result. It cannot prove API-scan page invariance, so migration deliberately
  // downgrades the result to unavailable instead of translating it optimistically.
  if (typeof legacySummary.restoration !== "string") return null;
  const summaryWithoutRestoration = { ...legacySummary };
  delete summaryWithoutRestoration.restoration;
  return parseStoreEnvelope({
    ...envelope,
    lastScan: {
      ...summaryWithoutRestoration,
      status: summaryWithoutRestoration.status === "complete" ? "partial" : summaryWithoutRestoration.status,
      visibleContext: "unavailable",
    },
  });
}

export function loadStoreValue(value: unknown, now: string): StoreEnvelopeV1 {
  if (value == null) return createEmptyStore(now);
  assertNoForbiddenFieldNames(value);
  if (typeof value === "object" && value && "schemaVersion" in value) {
    const version = (value as { schemaVersion?: unknown }).schemaVersion;
    if (typeof version === "number" && version > STORAGE_SCHEMA_VERSION) {
      throw new Error("Local data uses a newer unsupported schema.");
    }
  }
  try {
    return parseStoreEnvelope(value);
  } catch (error) {
    const migrated = migrateLegacyRestorationSummary(value);
    if (migrated) return migrated;
    throw error;
  }
}

export function mergeCardAttempt(store: StoreEnvelopeV1, attempt: CardAttemptResult): {
  store: StoreEnvelopeV1;
  record: StoredCardRecordV1;
} {
  const existing = store.cards[attempt.identity.localCardId];
  let record: StoredCardRecordV1;
  if (attempt.disposition === "failed") {
    record = {
      localCardId: attempt.identity.localCardId,
      identity: existing?.latest
        ? existing.identity
        : {
            sourceFingerprint: attempt.identity.sourceFingerprint,
            productName: attempt.identity.productName,
            endingDigits: attempt.identity.endingDigits,
          },
      latest: existing?.latest ?? null,
      freshness: existing?.latest ? "stale_error" : "error_no_data",
      completeness: "failed",
      observedAt: existing?.observedAt ?? null,
      lastAttemptAt: attempt.attemptedAt,
      error: { code: attempt.errorCode, message: fixedErrorMessage(attempt.errorCode) },
    };
  } else {
    record = {
      localCardId: attempt.identity.localCardId,
      identity: {
        sourceFingerprint: attempt.identity.sourceFingerprint,
        productName: attempt.identity.productName,
        endingDigits: attempt.identity.endingDigits,
      },
      latest: attempt.observation,
      freshness: "current",
      completeness: attempt.disposition,
      observedAt: attempt.observation.observedAt,
      lastAttemptAt: attempt.attemptedAt,
      error: null,
    };
  }
  const next = parseStoreEnvelope({
    ...store,
    revision: store.revision + 1,
    updatedAt: attempt.attemptedAt,
    cards: { ...store.cards, [record.localCardId]: record },
  });
  return { store: next, record: next.cards[record.localCardId] };
}

export function mergeScanSummary(store: StoreEnvelopeV1, summary: ScanSummaryV1): StoreEnvelopeV1 {
  const validatedSummary = scanSummarySchema.parse(summary);
  return parseStoreEnvelope({
    ...store,
    revision: store.revision + 1,
    updatedAt: validatedSummary.finishedAt,
    lastScan: validatedSummary,
  });
}

export function hasMixedObservations(store: StoreEnvelopeV1): boolean {
  const records = Object.values(store.cards);
  const observationTimes = new Set(records.map((record) => record.observedAt).filter(Boolean));
  return observationTimes.size > 1
    || records.some((record) => record.freshness !== "current" || record.completeness !== "complete")
    || Boolean(store.lastScan && (
      store.lastScan.status !== "complete" || store.lastScan.visibleContext !== "unchanged"
    ));
}
