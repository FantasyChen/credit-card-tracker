import { z } from "zod";

export const OBSERVATION_CONTRACT_VERSION = "amex-benefits/1" as const;
export const STORAGE_SCHEMA_VERSION = 1 as const;
export const PARSER_VERSION = "amex-api-us/1.1.0" as const;

export const issueCodeSchema = z.enum([
  "unknown_account_variant",
  "duplicate_card_entry",
  "identity_unavailable",
  "identity_ambiguous",
  "identity_conflict",
  "display_reconciled",
  "response_schema_invalid",
  "unknown_activity_kind",
  "unknown_status",
  "unknown_quantity",
  "benefit_identity_conflict",
  "request_timeout",
  "network_error",
  "http_error",
  "content_type_invalid",
  "redirect_rejected",
  "signed_out",
  "scan_cancelled",
  "visible_context_changed",
  "storage_invalid",
]);
export type IssueCode = z.infer<typeof issueCodeSchema>;

export const quantitySchema = z.object({
  value: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/),
  unit: z.enum(["USD", "count", "points", "percent", "unknown"]),
  currency: z.literal("USD").nullable(),
}).strict().superRefine((quantity, context) => {
  if ((quantity.unit === "USD") !== (quantity.currency === "USD")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["currency"], message: "Currency must match the quantity unit." });
  }
});
export type QuantityV1 = z.infer<typeof quantitySchema>;

const POSSIBLE_FULL_CARD_NUMBER = /(?:\d[ -]?){11,18}\d/;

function approvedVisibleText(maxLength: number) {
  return z.string().trim().min(1).max(maxLength).refine(
    (value) => !POSSIBLE_FULL_CARD_NUMBER.test(value),
    "Visible text contains a disallowed long number.",
  );
}

export function observedFieldSchema<T extends z.ZodTypeAny>(value: T) {
  return z.discriminatedUnion("state", [
    z.object({ state: z.literal("observed"), value }).strict(),
    z.object({ state: z.literal("not_exposed") }).strict(),
    z.object({ state: z.literal("unrecognized"), issueCode: issueCodeSchema }).strict(),
  ]);
}

export type ObservedField<T> =
  | { state: "observed"; value: T }
  | { state: "not_exposed" }
  | { state: "unrecognized"; issueCode: IssueCode };

export const activityKindSchema = z.enum([
  "enrollment_candidate",
  "spend_progress",
  "credit_earned",
  "completed",
]);
export type ActivityKind = z.infer<typeof activityKindSchema>;

export const normalizedBenefitObservationSchema = z.object({
  benefitKey: z.string().min(16).max(128),
  title: approvedVisibleText(200),
  category: observedFieldSchema(approvedVisibleText(100)),
  activityKind: activityKindSchema,
  enrollmentState: observedFieldSchema(z.enum([
    "enrolled",
    "required",
    "linking_required",
    "not_required",
  ])),
  trackerState: observedFieldSchema(z.enum([
    "not_started",
    "in_progress",
    "earned",
    "completed",
  ])),
  completionState: observedFieldSchema(z.enum(["complete", "incomplete"])),
  earnedOrUsed: observedFieldSchema(quantitySchema),
  targetOrLimit: observedFieldSchema(quantitySchema),
  remaining: observedFieldSchema(quantitySchema),
  period: observedFieldSchema(approvedVisibleText(160)),
  confidence: z.enum(["high", "medium", "low"]),
  issueCodes: z.array(issueCodeSchema).max(20),
}).strict();
export type NormalizedBenefitObservationV1 = z.infer<typeof normalizedBenefitObservationSchema>;

export const normalizedCardObservationSchema = z.object({
  contractVersion: z.literal(OBSERVATION_CONTRACT_VERSION),
  issuer: z.literal("american_express_us"),
  localCardId: z.string().uuid(),
  productName: approvedVisibleText(160),
  endingDigits: z.string().regex(/^\d{4,5}$/),
  observedAt: z.string().datetime({ offset: true }),
  parserVersion: z.string().min(1).max(80),
  completeness: z.enum(["complete", "partial"]),
  issueCodes: z.array(issueCodeSchema).max(30),
  benefits: z.array(normalizedBenefitObservationSchema).max(300),
}).strict().superRefine((observation, context) => {
  const keys = new Set<string>();
  observation.benefits.forEach((benefit, index) => {
    if (keys.has(benefit.benefitKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["benefits", index, "benefitKey"],
        message: "Benefit keys must be unique within a card observation.",
      });
    }
    keys.add(benefit.benefitKey);
  });
});
export type NormalizedCardObservationV1 = z.infer<typeof normalizedCardObservationSchema>;

export const redactedErrorSchema = z.object({
  code: issueCodeSchema,
  message: z.string().min(1).max(240),
}).strict();
export type RedactedErrorV1 = z.infer<typeof redactedErrorSchema>;

export const storedCardRecordSchema = z.object({
  localCardId: z.string().uuid(),
  identity: z.object({
    sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    productName: approvedVisibleText(160),
    endingDigits: z.string().regex(/^\d{4,5}$/),
  }).strict(),
  latest: normalizedCardObservationSchema.nullable(),
  freshness: z.enum(["current", "stale_error", "error_no_data"]),
  completeness: z.enum(["complete", "partial", "failed"]),
  observedAt: z.string().datetime({ offset: true }).nullable(),
  lastAttemptAt: z.string().datetime({ offset: true }),
  error: redactedErrorSchema.nullable(),
}).strict().superRefine((record, context) => {
  if (record.latest) {
    const consistent = record.latest.localCardId === record.localCardId
      && record.latest.productName === record.identity.productName
      && record.latest.endingDigits === record.identity.endingDigits
      && record.latest.observedAt === record.observedAt;
    if (!consistent) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Stored card identity and observation are inconsistent." });
    }
  } else if (record.observedAt !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["observedAt"], message: "A card without an observation cannot have an observation time." });
  }
  const validState = record.freshness === "current"
    ? Boolean(record.latest && !record.error && record.completeness === record.latest.completeness)
    : record.freshness === "stale_error"
      ? Boolean(record.latest && record.error && record.completeness === "failed")
      : Boolean(!record.latest && record.error && record.completeness === "failed");
  if (!validState) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Stored card freshness, completeness, data, and error state are inconsistent." });
  }
});
export type StoredCardRecordV1 = z.infer<typeof storedCardRecordSchema>;

export const scanCardDispositionSchema = z.object({
  localCardId: z.string().uuid().nullable(),
  result: z.enum(["complete", "partial", "failed"]),
  issueCode: issueCodeSchema.nullable(),
}).strict();

export const scanSummarySchema = z.object({
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }),
  status: z.enum(["complete", "partial", "interrupted", "failed"]),
  discoveredCardCount: z.number().int().nonnegative(),
  attemptedCardCount: z.number().int().nonnegative(),
  unknownAccountVariantCount: z.number().int().nonnegative(),
  cards: z.array(scanCardDispositionSchema),
  visibleContext: z.enum(["unchanged", "changed", "unavailable"]),
}).strict();
export type ScanSummaryV1 = z.infer<typeof scanSummarySchema>;

export const storeEnvelopeSchema = z.object({
  schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true }),
  cards: z.record(z.string().uuid(), storedCardRecordSchema),
  lastScan: scanSummarySchema.nullable(),
}).strict().superRefine((store, context) => {
  Object.entries(store.cards).forEach(([key, record]) => {
    if (key !== record.localCardId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cards", key, "localCardId"],
        message: "Stored card keys must match their local card IDs.",
      });
    }
  });
});
export type StoreEnvelopeV1 = z.infer<typeof storeEnvelopeSchema>;

const FORBIDDEN_FIELD_PATTERN = /(?:fullcard|cardnumber|accountnumber|accounttoken|opaquetoken|tokenvalue|pan|cvv|cvc|password|passcode|mfa|cookie|authorization|authheader|requestheaders|requestbody|rawdom|rawhtml|rawjson|rawrequest|rawresponse|loyaltynumber|balance|transaction)/i;

export function assertNoForbiddenFieldNames(value: unknown): void {
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(candidate)) {
      if (FORBIDDEN_FIELD_PATTERN.test(key.replace(/[^a-z]/gi, ""))) {
        throw new Error("Storage contains a forbidden field name.");
      }
      visit(child);
    }
  };
  visit(value);
}

export function parseStoreEnvelope(value: unknown): StoreEnvelopeV1 {
  assertNoForbiddenFieldNames(value);
  return storeEnvelopeSchema.parse(value);
}
