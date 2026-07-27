import { z } from "zod";
import {
  OBSERVATION_CONTRACT_VERSION_V2,
  amexProductKeySchema,
  assertNoForbiddenFieldNames,
  creditFamilyKeySchema,
  quantitySchema,
  sourcePeriodV2Schema,
  type NormalizedBenefitObservationV2,
  type StoreEnvelopeV1,
} from "./contract";
import { retainSupportedAmexCardCredits } from "./supported-card-credits";

export const AMEX_SYNC_ENVELOPE_VERSION = "amex-sync-envelope/1" as const;
export const AMEX_SYNC_MAX_BYTES = 256 * 1024;
export const AMEX_SYNC_MAX_CARDS = 50;
export const AMEX_SYNC_MAX_ROWS = 300;
export const AMEX_SYNC_MAX_SCAN_AGE_MS = 30 * 60 * 1000;

const transportQuantitySchema = quantitySchema.refine(
  (quantity) => quantity.value.length <= 32,
  "Quantity value is too long.",
);

export const syncExclusionReasonSchema = z.enum([
  "v1_only",
  "older_scan",
  "stale",
  "partial",
  "failed",
  "not_attempted_successfully",
  "no_structured_period",
  "prerequisite_only",
  "status_unavailable",
]);
export type SyncExclusionReason = z.infer<typeof syncExclusionReasonSchema>;

export const amexSyncRowSchema = z.object({
  creditFamilyKey: creditFamilyKeySchema,
  sourcePeriod: sourcePeriodV2Schema.nullable(),
  enrollmentState: z.enum(["enrolled", "required", "linking_required", "not_required"]).nullable(),
  completionState: z.enum(["complete", "incomplete"]).nullable(),
  earnedOrUsed: transportQuantitySchema.nullable(),
  targetOrLimit: transportQuantitySchema.nullable(),
}).strict();
export type AmexSyncRow = z.infer<typeof amexSyncRowSchema>;

export const amexSyncCardSchema = z.object({
  sourceLocalCardId: z.string().uuid(),
  productKey: amexProductKeySchema,
  endingDigits: z.string().regex(/^\d{4,5}$/),
  observedAt: z.string().datetime({ offset: true }),
  parserVersion: z.string().min(1).max(80),
  rows: z.array(amexSyncRowSchema).max(AMEX_SYNC_MAX_ROWS),
}).strict();
export type AmexSyncCard = z.infer<typeof amexSyncCardSchema>;

export const amexSyncEnvelopeSchema = z.object({
  envelopeVersion: z.literal(AMEX_SYNC_ENVELOPE_VERSION),
  observationContractVersion: z.literal(OBSERVATION_CONTRACT_VERSION_V2),
  scanId: z.string().uuid(),
  scanFinishedAt: z.string().datetime({ offset: true }),
  cards: z.array(amexSyncCardSchema).min(1).max(AMEX_SYNC_MAX_CARDS),
  exclusions: z.array(z.object({
    reason: syncExclusionReasonSchema,
    count: z.number().int().positive().max(AMEX_SYNC_MAX_ROWS),
  }).strict()).max(syncExclusionReasonSchema.options.length),
}).strict().superRefine((envelope, context) => {
  const rowCount = envelope.cards.reduce((count, card) => count + card.rows.length, 0);
  if (rowCount > AMEX_SYNC_MAX_ROWS) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["cards"], message: "The sync envelope has too many rows." });
  }
  const cardIds = new Set<string>();
  const scanFinishedAt = Date.parse(envelope.scanFinishedAt);
  envelope.cards.forEach((card, index) => {
    if (cardIds.has(card.sourceLocalCardId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["cards", index, "sourceLocalCardId"], message: "Source cards must be unique." });
    }
    cardIds.add(card.sourceLocalCardId);
    if (Date.parse(card.observedAt) > scanFinishedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cards", index, "observedAt"],
        message: "A card observation cannot be newer than its completed scan.",
      });
    }
  });
});
export type AmexSyncEnvelope = z.infer<typeof amexSyncEnvelopeSchema>;

const SYNC_FORBIDDEN_FIELD_PATTERN = /(?:sourcefingerprint|identitysecret|fullcard|cardnumber|accountnumber|accounttoken|opaquetoken|tokenvalue|password|passcode|mfa|cookie|authorization|requestheaders|requestbody|rawrequest|rawresponse|userid|email)/i;

export function assertNoSyncForbiddenFieldNames(value: unknown): void {
  assertNoForbiddenFieldNames(value);
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) return candidate.forEach(visit);
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(candidate)) {
      if (SYNC_FORBIDDEN_FIELD_PATTERN.test(key.replace(/[^a-z]/gi, ""))) {
        throw new Error("Sync input contains a forbidden field name.");
      }
      visit(child);
    }
  };
  visit(value);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function parseAmexSyncEnvelope(value: unknown): AmexSyncEnvelope {
  assertNoSyncForbiddenFieldNames(value);
  const envelope = amexSyncEnvelopeSchema.parse(value);
  if (new TextEncoder().encode(canonicalJson(envelope)).byteLength > AMEX_SYNC_MAX_BYTES) {
    throw new Error("Sync input exceeds the byte limit.");
  }
  return envelope;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function digestAmexSyncEnvelope(envelope: AmexSyncEnvelope): Promise<string> {
  return sha256Hex(canonicalJson(parseAmexSyncEnvelope(envelope)));
}

function observedValue<T>(field: { state: string; value?: T }): T | null {
  return field.state === "observed" && field.value !== undefined ? field.value : null;
}

function projectRow(benefit: NormalizedBenefitObservationV2): AmexSyncRow {
  return {
    creditFamilyKey: benefit.creditFamilyKey,
    sourcePeriod: observedValue(benefit.sourcePeriod),
    enrollmentState: observedValue(benefit.enrollmentState),
    completionState: observedValue(benefit.completionState),
    earnedOrUsed: observedValue(benefit.earnedOrUsed),
    targetOrLimit: observedValue(benefit.targetOrLimit),
  };
}

export interface SyncEnvelopeProjection {
  envelope: AmexSyncEnvelope | null;
  reason: "ready" | "fresh_v2_scan_required" | "no_complete_cards";
}

export function projectLatestV2SyncEnvelope(store: StoreEnvelopeV1): SyncEnvelopeProjection {
  const summary = store.lastScan;
  if (!summary?.scanId || summary.status === "interrupted" || summary.status === "failed") {
    return { envelope: null, reason: "fresh_v2_scan_required" };
  }

  const successfulCardIds = new Set(summary.cards
    .filter((card) => card.result === "complete" && card.localCardId)
    .map((card) => card.localCardId as string));
  const exclusions = new Map<SyncExclusionReason, number>();
  const exclude = (reason: SyncExclusionReason, count = 1): void => {
    exclusions.set(
      reason,
      Math.min(AMEX_SYNC_MAX_ROWS, (exclusions.get(reason) ?? 0) + count),
    );
  };

  const cards: AmexSyncCard[] = [];
  for (const record of Object.values(store.cards)) {
    const latest = record.latest;
    if (!latest) {
      exclude("failed");
      continue;
    }
    if (latest.contractVersion !== OBSERVATION_CONTRACT_VERSION_V2) {
      exclude("v1_only", latest.benefits.length || 1);
      continue;
    }
    if (latest.scanId !== summary.scanId) {
      exclude("older_scan", latest.benefits.length || 1);
      continue;
    }
    if (record.freshness !== "current") {
      exclude(record.freshness === "stale_error" ? "stale" : "failed", latest.benefits.length || 1);
      continue;
    }
    if (record.completeness !== "complete" || latest.completeness !== "complete") {
      exclude("partial", latest.benefits.length || 1);
      continue;
    }
    if (!successfulCardIds.has(record.localCardId)) {
      exclude("not_attempted_successfully", latest.benefits.length || 1);
      continue;
    }
    const supportedBenefits = retainSupportedAmexCardCredits(latest.productName, latest.benefits);
    cards.push({
      sourceLocalCardId: latest.localCardId,
      productKey: latest.productKey,
      endingDigits: latest.endingDigits,
      observedAt: latest.observedAt,
      parserVersion: latest.parserVersion,
      rows: supportedBenefits.map(projectRow),
    });
  }

  if (!cards.length) return { envelope: null, reason: "no_complete_cards" };
  return {
    reason: "ready",
    envelope: parseAmexSyncEnvelope({
      envelopeVersion: AMEX_SYNC_ENVELOPE_VERSION,
      observationContractVersion: OBSERVATION_CONTRACT_VERSION_V2,
      scanId: summary.scanId,
      scanFinishedAt: summary.finishedAt,
      cards,
      exclusions: Array.from(exclusions, ([reason, count]) => ({ reason, count })),
    }),
  };
}

export function isSyncEnvelopeFresh(envelope: AmexSyncEnvelope, now: Date): boolean {
  const finishedAt = Date.parse(envelope.scanFinishedAt);
  const current = now.getTime();
  return Number.isFinite(finishedAt)
    && finishedAt <= current + 60_000
    && current - finishedAt <= AMEX_SYNC_MAX_SCAN_AGE_MS;
}
