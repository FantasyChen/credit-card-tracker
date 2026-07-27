import { z } from "zod";

export const OBSERVATION_CONTRACT_VERSION = "amex-benefits/1" as const;
export const OBSERVATION_CONTRACT_VERSION_V2 = "amex-benefits/2" as const;
export const STORAGE_SCHEMA_VERSION = 1 as const;
export const PARSER_VERSION = "amex-api-us/2.0.2" as const;

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

const benefitObservationFields = {
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
};

export const normalizedBenefitObservationSchema = z.object(benefitObservationFields).strict();
export type NormalizedBenefitObservationV1 = z.infer<typeof normalizedBenefitObservationSchema>;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export const utcDateOnlySchema = z.string().refine(isRealDateOnly, "Expected a real UTC calendar date in YYYY-MM-DD form.");

export const sourcePeriodV2Schema = z.object({
  kind: z.literal("calendar_date_range"),
  startDate: utcDateOnlySchema,
  endDate: utcDateOnlySchema,
  timeZone: z.literal("UTC"),
}).strict().superRefine((period, context) => {
  if (period.startDate > period.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "The period end must not precede its start." });
  }
});
export type SourcePeriodV2 = z.infer<typeof sourcePeriodV2Schema>;

export const amexProductKeySchema = z.enum([
  "american-express-gold-card",
  "american-express-platinum-card",
  "american-express-business-platinum-card",
  "american-express-business-gold-card",
  "hilton-honors-american-express-aspire-card",
  "hilton-honors-american-express-surpass-card",
  "hilton-honors-american-express-business-card",
  "delta-skymiles-gold-american-express-card",
  "delta-skymiles-platinum-american-express-card",
  "delta-skymiles-reserve-american-express-card",
  "marriott-bonvoy-brilliant-american-express-card",
  "marriott-bonvoy-business-american-express-card",
]);
export type AmexProductKey = z.infer<typeof amexProductKeySchema>;

export const creditFamilyKeySchema = z.string()
  .min(8)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)$/);

export const normalizedBenefitObservationV2Schema = z.object({
  ...benefitObservationFields,
  creditFamilyKey: creditFamilyKeySchema,
  sourcePeriod: observedFieldSchema(sourcePeriodV2Schema),
}).strict();
export type NormalizedBenefitObservationV2 = z.infer<typeof normalizedBenefitObservationV2Schema>;
export type NormalizedBenefitObservation = NormalizedBenefitObservationV1 | NormalizedBenefitObservationV2;

function requireUniqueBenefitKeys(
  observation: { benefits: Array<{ benefitKey: string }> },
  context: z.RefinementCtx,
): void {
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
}

const cardObservationFields = {
  issuer: z.literal("american_express_us"),
  localCardId: z.string().uuid(),
  productName: approvedVisibleText(160),
  endingDigits: z.string().regex(/^\d{4,5}$/),
  observedAt: z.string().datetime({ offset: true }),
  parserVersion: z.string().min(1).max(80),
  completeness: z.enum(["complete", "partial"]),
  issueCodes: z.array(issueCodeSchema).max(30),
};

export const normalizedCardObservationSchema = z.object({
  contractVersion: z.literal(OBSERVATION_CONTRACT_VERSION),
  ...cardObservationFields,
  benefits: z.array(normalizedBenefitObservationSchema).max(300),
}).strict().superRefine(requireUniqueBenefitKeys);
export type NormalizedCardObservationV1 = z.infer<typeof normalizedCardObservationSchema>;

export const normalizedCardObservationV2Schema = z.object({
  contractVersion: z.literal(OBSERVATION_CONTRACT_VERSION_V2),
  ...cardObservationFields,
  scanId: z.string().uuid(),
  productKey: amexProductKeySchema,
  benefits: z.array(normalizedBenefitObservationV2Schema).max(300),
}).strict().superRefine(requireUniqueBenefitKeys);
export type NormalizedCardObservationV2 = z.infer<typeof normalizedCardObservationV2Schema>;
export type NormalizedCardObservation = NormalizedCardObservationV1 | NormalizedCardObservationV2;

export const normalizedCardObservationAnySchema = z.union([
  normalizedCardObservationSchema,
  normalizedCardObservationV2Schema,
]);

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
  latest: normalizedCardObservationAnySchema.nullable(),
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
    if (!consistent) context.addIssue({ code: z.ZodIssueCode.custom, message: "Stored card identity and observation are inconsistent." });
  } else if (record.observedAt !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["observedAt"], message: "A card without an observation cannot have an observation time." });
  }
  const validState = record.freshness === "current"
    ? Boolean(record.latest && !record.error && record.completeness === record.latest.completeness)
    : record.freshness === "stale_error"
      ? Boolean(record.latest && record.error && record.completeness === "failed")
      : Boolean(!record.latest && record.error && record.completeness === "failed");
  if (!validState) context.addIssue({ code: z.ZodIssueCode.custom, message: "Stored card freshness, completeness, data, and error state are inconsistent." });
});
export type StoredCardRecordV1 = z.infer<typeof storedCardRecordSchema>;

export const scanCardDispositionSchema = z.object({
  localCardId: z.string().uuid().nullable(),
  result: z.enum(["complete", "partial", "failed"]),
  issueCode: issueCodeSchema.nullable(),
}).strict();

export const scanSummarySchema = z.object({
  scanId: z.string().uuid().optional(),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }),
  status: z.enum(["complete", "partial", "interrupted", "failed"]),
  discoveredCardCount: z.number().int().nonnegative(),
  attemptedCardCount: z.number().int().nonnegative(),
  unknownAccountVariantCount: z.number().int().nonnegative(),
  cards: z.array(scanCardDispositionSchema).max(300),
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
