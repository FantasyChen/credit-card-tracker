import { createHash } from "node:crypto";
import { canonicalJson, isSyncEnvelopeFresh, type AmexSyncEnvelope, type AmexSyncRow } from "@/lib/amex-benefit-reader/sync-contract";

import { AMEX_WRITABLE_DESTINATIONS } from "./catalog-registry";
import {
  resolveServerAmexCredit,
  resolveServerAmexProduct,
  SERVER_AMEX_SOURCE_CREDITS,
} from "./server-evidence";
import { periodKeysForExactRange } from "./period-resolution";

export { periodKeyForExactRange, periodKeysForExactRange } from "./period-resolution";

// Destination tuples come from the reviewed catalog, while provider evidence
// authority is separately enumerated by the server and never trusts browser claims.
export const WRITABLE_AMEX_PRODUCT_KEYS = new Set(SERVER_AMEX_SOURCE_CREDITS.map((entry) => entry.productKey));
export const WRITABLE_AMEX_CREDIT_FAMILIES = new Set(AMEX_WRITABLE_DESTINATIONS.map((entry) => entry.creditFamilyKey));
export const WRITABLE_AMEX_SOURCE_CREDITS = new Set(SERVER_AMEX_SOURCE_CREDITS.map((entry) => `${entry.productKey}:${entry.sourceCreditKey}`));

export type AmexSyncReason =
  | "proposed_update"
  | "already_current"
  | "unchanged_replay"
  | "stale_replay"
  | "source_conflict"
  | "scan_expired"
  | "product_not_allowlisted"
  | "credit_family_not_allowlisted"
  | "source_evidence_mismatch"
  | "source_mapping_ambiguous"
  | "source_last_five_required"
  | "destination_last_five_required"
  | "destination_card_missing"
  | "ambiguous_card"
  | "mapping_invalid"
  | "destination_key_missing"
  | "destination_benefit_missing"
  | "destination_benefit_ambiguous"
  | "destination_status_missing"
  | "destination_status_ambiguous"
  | "period_not_structured"
  | "period_not_current"
  | "period_key_mismatch"
  | "enrollment_required"
  | "linking_required"
  | "status_unavailable"
  | "amount_incompatible"
  | "completion_conflict"
  | "destination_not_usable"
  | "conflict_repreview_required"
  | "persistence_failed";

export interface DestinationStatusSnapshot {
  id: string;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  usedAmount: number;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  updatedAt: Date;
  provenance: {
    observedAt: Date;
    sourceObservationIdentity: string;
    sourceObservationDigest: string;
  } | null;
}

export interface DestinationBenefitSnapshot {
  id: string;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
  startDate: Date;
  endDate: Date | null;
  statuses: DestinationStatusSnapshot[];
}

export interface DestinationCardSnapshot {
  id: string;
  userId: string;
  displayName?: string;
  issuer: string;
  productKey: string | null;
  lastFourDigits: string | null;
  lifecycleStatus: "ACTIVE" | "CLOSED" | "PRODUCT_CHANGED";
  benefits: DestinationBenefitSnapshot[];
}

export interface AmexSyncDestinationContext {
  cards: DestinationCardSnapshot[];
}

export interface StatusStateProjection {
  usedAmount: number;
  isCompleted: boolean;
  completedAt: string | null;
  isNotUsable: boolean;
}

export interface AmexSyncPlanRow {
  sourceRowIdentity: string;
  atomicGroupIdentity: string;
  sourceObservationIdentity: string;
  sourceObservationDigest: string;
  sourceLocalCardId: string;
  sourceEndingDigits: string;
  productKey: string;
  creditFamilyKey: string;
  observedAt: string;
  parserVersion: string;
  periodKey: string | null;
  sourcePeriodStartDate: string | null;
  sourcePeriodEndDate: string | null;
  disposition: "proposed" | "unchanged" | "skipped";
  reason: AmexSyncReason;
  destinationCardId: string | null;
  destinationBenefitId: string | null;
  destinationStatusId: string | null;
  before: StatusStateProjection | null;
  after: StatusStateProjection | null;
  changes: {
    amountDecrease: boolean;
    amountIncrease: boolean;
    completionSet: boolean;
    completionCleared: boolean;
  };
}

export interface AmexSyncPlan {
  rows: AmexSyncPlanRow[];
  envelopeDigest: string;
  beforeStateDigest: string;
}

function hash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function snapshot(status: DestinationStatusSnapshot): StatusStateProjection {
  return {
    usedAmount: status.usedAmount,
    isCompleted: status.isCompleted,
    completedAt: status.completedAt?.toISOString() ?? null,
    isNotUsable: status.isNotUsable,
  };
}

function skippedRow(input: {
  sourceRowIdentity: string;
  atomicGroupIdentity: string;
  sourceObservationIdentity: string;
  sourceObservationDigest: string;
  sourceLocalCardId: string;
  sourceEndingDigits: string;
  productKey: string;
  creditFamilyKey: string;
  observedAt: string;
  parserVersion: string;
  sourcePeriodStartDate: string | null;
  sourcePeriodEndDate: string | null;
  periodKey?: string | null;
  reason: AmexSyncReason;
  destinationCardId?: string | null;
  destinationBenefitId?: string | null;
  destinationStatusId?: string | null;
  before?: StatusStateProjection | null;
}): AmexSyncPlanRow {
  return {
    ...input,
    periodKey: input.periodKey ?? null,
    disposition: "skipped",
    destinationCardId: input.destinationCardId ?? null,
    destinationBenefitId: input.destinationBenefitId ?? null,
    destinationStatusId: input.destinationStatusId ?? null,
    before: input.before ?? null,
    after: null,
    changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
  };
}

function parseUsdMinorUnits(quantity: AmexSyncRow["earnedOrUsed"]): number | null {
  if (!quantity || quantity.unit !== "USD" || quantity.currency !== "USD") return null;
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(quantity.value);
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(whole) || whole > 10_000_000) return null;
  return whole * 100 + cents;
}

function resolveTransition(
  row: AmexSyncRow,
  status: DestinationStatusSnapshot,
  transitionTime: Date,
): { after: StatusStateProjection; changes: AmexSyncPlanRow["changes"] } | AmexSyncReason {
  if (status.isNotUsable) return "destination_not_usable";
  if (row.enrollmentState === "required") return "enrollment_required";
  if (row.enrollmentState === "linking_required") return "linking_required";

  const usedMinor = parseUsdMinorUnits(row.earnedOrUsed);
  if (row.earnedOrUsed && usedMinor === null) return "amount_incompatible";
  if (row.targetOrLimit && parseUsdMinorUnits(row.targetOrLimit) === null) return "amount_incompatible";

  const explicitCompletion = row.completionState === "complete"
    ? true
    : row.completionState === "incomplete" ? false : null;
  if (usedMinor === null && explicitCompletion === null) return "status_unavailable";

  const usedAmount = usedMinor === null ? status.usedAmount : usedMinor / 100;
  const completion = explicitCompletion ?? status.isCompleted;
  const completedAt = explicitCompletion === null
    ? status.completedAt?.toISOString() ?? null
    : completion
      ? status.isCompleted && status.completedAt ? status.completedAt.toISOString() : transitionTime.toISOString()
      : null;
  const after: StatusStateProjection = {
    usedAmount,
    isCompleted: completion,
    completedAt,
    isNotUsable: status.isNotUsable,
  };
  return {
    after,
    changes: {
      amountDecrease: usedAmount < status.usedAmount,
      amountIncrease: usedAmount > status.usedAmount,
      completionSet: !status.isCompleted && completion,
      completionCleared: status.isCompleted && !completion,
    },
  };
}

function resolveCard(
  sourceCard: AmexSyncEnvelope["cards"][number],
  context: AmexSyncDestinationContext,
  userId: string,
): DestinationCardSnapshot | AmexSyncReason {
  if (!/^\d{5}$/.test(sourceCard.endingDigits)) return "source_last_five_required";
  const productCards = context.cards.filter((card) =>
    card.userId === userId
    && card.issuer === "American Express"
    && card.lifecycleStatus === "ACTIVE"
    && card.productKey === sourceCard.productKey);
  if (productCards.some((card) => !/^\d{5}$/.test(card.lastFourDigits ?? ""))
    && !productCards.some((card) => card.lastFourDigits === sourceCard.endingDigits)) {
    return "destination_last_five_required";
  }
  const exact = productCards.filter((card) =>
    /^\d{5}$/.test(card.lastFourDigits ?? "")
    && card.lastFourDigits === sourceCard.endingDigits);
  if (exact.length === 1) return exact[0];
  return exact.length > 1 ? "ambiguous_card" : "destination_card_missing";
}

function rowIdentityParts(
  envelope: AmexSyncEnvelope,
  card: AmexSyncEnvelope["cards"][number],
  row: AmexSyncRow,
  rowIndex: number,
): {
  sourceRowIdentity: string;
  atomicGroupIdentity: string;
  sourceObservationIdentity: string;
  sourceObservationDigest: string;
} {
  const observation = {
    scanId: envelope.scanId,
    sourceLocalCardId: card.sourceLocalCardId,
    productKey: card.productKey,
    observedAt: card.observedAt,
    parserVersion: card.parserVersion,
    row,
  };
  const sourceRowIdentity = hash({ ...observation, rowIndex });
  return {
    sourceRowIdentity,
    atomicGroupIdentity: hash({ sourceRowIdentity, groupVersion: 1 }),
    sourceObservationIdentity: hash({ ...observation, identityVersion: 1 }),
    sourceObservationDigest: hash({ ...observation, digestVersion: 1 }),
  };
}

const PLATINUM_PRODUCT_KEY = "american-express-platinum-card";
const PLATINUM_UBER_FAMILY = `${PLATINUM_PRODUCT_KEY}:uber-cash`;
const PLATINUM_UBER_DECEMBER_BONUS_FAMILY = `${PLATINUM_PRODUCT_KEY}:uber-cash-december-bonus`;

function expandPlatinumDecemberUber(input: {
  sourceCard: AmexSyncEnvelope["cards"][number];
  sourceRow: AmexSyncRow;
  baseRow: AmexSyncPlanRow;
  context: AmexSyncDestinationContext;
  userId: string;
  transitionTime: Date;
}): AmexSyncPlanRow[] {
  const { sourceCard, sourceRow, baseRow, context, userId, transitionTime } = input;
  if (sourceCard.productKey !== PLATINUM_PRODUCT_KEY
    || sourceRow.sourceCreditKey !== PLATINUM_UBER_FAMILY
    || sourceRow.creditFamilyKey !== PLATINUM_UBER_FAMILY
    || sourceRow.sourcePeriod?.startDate.slice(5) !== "12-01"
    || periodKeysForExactRange(
      sourceRow.sourcePeriod.startDate,
      sourceRow.sourcePeriod.endDate,
    ).includes("calendar-month-december") === false
    || !baseRow.destinationCardId) return [baseRow];

  const groupIdentity = hash({
    splitVersion: 1,
    sourceObservationIdentity: baseRow.sourceObservationIdentity,
    destinationFamilies: [PLATINUM_UBER_FAMILY, PLATINUM_UBER_DECEMBER_BONUS_FAMILY],
  });
  const aggregateMinor = parseUsdMinorUnits(sourceRow.earnedOrUsed);
  const variants = [
    {
      creditFamilyKey: PLATINUM_UBER_FAMILY,
      periodKey: "calendar-month",
      targetMinor: 1_500,
      usedMinor: aggregateMinor === null ? null : Math.min(aggregateMinor, 1_500),
    },
    {
      creditFamilyKey: PLATINUM_UBER_DECEMBER_BONUS_FAMILY,
      periodKey: "calendar-month-december",
      targetMinor: 2_000,
      usedMinor: aggregateMinor === null ? null : Math.min(Math.max(aggregateMinor - 1_500, 0), 2_000),
    },
  ] as const;
  const splitBase = (variant: typeof variants[number]) => ({
    ...baseRow,
    sourceRowIdentity: hash({
      splitVersion: 1,
      sourceRowIdentity: baseRow.sourceRowIdentity,
      creditFamilyKey: variant.creditFamilyKey,
      periodKey: variant.periodKey,
    }),
    atomicGroupIdentity: groupIdentity,
    creditFamilyKey: variant.creditFamilyKey,
    periodKey: variant.periodKey,
    destinationBenefitId: null,
    destinationStatusId: null,
    before: null,
    after: null,
    changes: { amountDecrease: false, amountIncrease: false, completionSet: false, completionCleared: false },
  });
  const skippedVariants = (reason: AmexSyncReason): AmexSyncPlanRow[] => variants.map((variant) => ({
    ...splitBase(variant),
    disposition: "skipped" as const,
    reason,
  }));

  // The provider row is an aggregate for two fixed destinations. Truncating an
  // out-of-range or omitted value would silently lose authority, so fail closed.
  if (aggregateMinor === null || aggregateMinor > 3_500) return skippedVariants("amount_incompatible");

  const card = context.cards.find((candidate) => candidate.id === baseRow.destinationCardId);
  if (!card || card.userId !== userId) return skippedVariants("destination_card_missing");

  const resolved: Array<{
    variant: typeof variants[number];
    benefit: DestinationBenefitSnapshot;
    status: DestinationStatusSnapshot;
  }> = [];
  for (const variant of variants) {
    const benefits = card.benefits.filter((benefit) => benefit.productKey === PLATINUM_PRODUCT_KEY
      && benefit.creditFamilyKey === variant.creditFamilyKey
      && benefit.periodKey === variant.periodKey);
    if (benefits.length !== 1) {
      return skippedVariants(benefits.length ? "destination_benefit_ambiguous" : "destination_benefit_missing");
    }
    const benefit = benefits[0];
    const statuses = benefit.statuses.filter((status) => status.userId === userId
      && status.occurrenceIndex === 0
      && dateOnly(status.cycleStartDate) === sourceRow.sourcePeriod!.startDate
      && dateOnly(status.cycleEndDate) === sourceRow.sourcePeriod!.endDate);
    if (statuses.length !== 1) {
      return skippedVariants(statuses.length ? "destination_status_ambiguous" : "destination_status_missing");
    }
    resolved.push({ variant, benefit, status: statuses[0] });
  }

  let exactReplayCount = 0;
  for (const { status } of resolved) {
    if (!status.provenance) continue;
    const observedAt = Date.parse(sourceCard.observedAt);
    const previousAt = status.provenance.observedAt.getTime();
    if (observedAt < previousAt) return skippedVariants("stale_replay");
    if (observedAt === previousAt
      && status.provenance.sourceObservationDigest !== baseRow.sourceObservationDigest) {
      return skippedVariants("source_conflict");
    }
    if (observedAt === previousAt) exactReplayCount += 1;
  }
  if (exactReplayCount && exactReplayCount !== resolved.length) {
    return skippedVariants("source_conflict");
  }
  if (exactReplayCount === resolved.length) {
    return resolved.map(({ variant, benefit, status }) => {
      const before = snapshot(status);
      return {
        ...splitBase(variant),
        disposition: "unchanged",
        reason: "unchanged_replay",
        destinationBenefitId: benefit.id,
        destinationStatusId: status.id,
        before,
        after: before,
      };
    });
  }

  const transitions: Array<{
    variant: typeof variants[number];
    benefit: DestinationBenefitSnapshot;
    before: StatusStateProjection;
    transition: Exclude<ReturnType<typeof resolveTransition>, AmexSyncReason>;
  }> = [];
  for (const { variant, benefit, status } of resolved) {
    const before = snapshot(status);
    const usedMinor = variant.usedMinor!;
    const splitSourceRow: AmexSyncRow = {
      ...sourceRow,
      creditFamilyKey: variant.creditFamilyKey,
      earnedOrUsed: { value: (usedMinor / 100).toFixed(2), unit: "USD", currency: "USD" },
      targetOrLimit: { value: (variant.targetMinor / 100).toFixed(2), unit: "USD", currency: "USD" },
      completionState: usedMinor >= variant.targetMinor ? "complete" : "incomplete",
    };
    const transition = resolveTransition(splitSourceRow, status, transitionTime);
    if (typeof transition === "string") return skippedVariants(transition);
    transitions.push({ variant, benefit, before, transition });
  }

  return transitions.map(({ variant, benefit, before, transition }) => {
    const unchanged = canonicalJson(before) === canonicalJson(transition.after);
    return {
      ...splitBase(variant),
      disposition: unchanged ? "unchanged" : "proposed",
      reason: unchanged ? "already_current" : "proposed_update",
      destinationBenefitId: benefit.id,
      destinationStatusId: resolved.find((entry) => entry.variant === variant)!.status.id,
      before,
      after: transition.after,
      changes: transition.changes,
    };
  });
}

export function planAmexSync(input: {
  envelope: AmexSyncEnvelope;
  context: AmexSyncDestinationContext;
  userId: string;
  now: Date;
  transitionTime: Date;
}): AmexSyncPlan {
  const { envelope, context, userId, now, transitionTime } = input;
  const envelopeDigest = hash(envelope);
  const rows: AmexSyncPlanRow[] = [];
  const sourceByRowIdentity = new Map<string, {
    sourceCard: AmexSyncEnvelope["cards"][number];
    sourceRow: AmexSyncRow;
  }>();

  envelope.cards.forEach((sourceCard) => {
    const cardResolution = resolveCard(sourceCard, context, userId);
    const sourceMappingKey = (row: AmexSyncRow): string => {
      const period = row.sourcePeriod
        ? `${row.sourcePeriod.startDate}|${row.sourcePeriod.endDate}`
        : "unstructured";
      return `${row.sourceCreditKey}|${period}`;
    };
    const sourceCreditCounts = new Map<string, number>();
    sourceCard.rows.forEach((row) => {
      const key = sourceMappingKey(row);
      sourceCreditCounts.set(key, (sourceCreditCounts.get(key) ?? 0) + 1);
    });
    sourceCard.rows.forEach((row, rowIndex) => {
      const identities = rowIdentityParts(envelope, sourceCard, row, rowIndex);
      sourceByRowIdentity.set(identities.sourceRowIdentity, { sourceCard, sourceRow: row });
      const base = {
        ...identities,
        sourceLocalCardId: sourceCard.sourceLocalCardId,
        sourceEndingDigits: sourceCard.endingDigits,
        productKey: sourceCard.productKey,
        creditFamilyKey: row.creditFamilyKey,
        observedAt: sourceCard.observedAt,
        parserVersion: sourceCard.parserVersion,
        sourcePeriodStartDate: row.sourcePeriod?.startDate ?? null,
        sourcePeriodEndDate: row.sourcePeriod?.endDate ?? null,
      };
      if (!isSyncEnvelopeFresh(envelope, now)) {
        rows.push(skippedRow({ ...base, reason: "scan_expired" }));
        return;
      }
      if ((sourceCreditCounts.get(sourceMappingKey(row)) ?? 0) > 1) {
        rows.push(skippedRow({ ...base, reason: "source_mapping_ambiguous" }));
        return;
      }
      if (!WRITABLE_AMEX_PRODUCT_KEYS.has(sourceCard.productKey)) {
        rows.push(skippedRow({ ...base, reason: "product_not_allowlisted" }));
        return;
      }
      if (!WRITABLE_AMEX_CREDIT_FAMILIES.has(row.creditFamilyKey)
        || !WRITABLE_AMEX_SOURCE_CREDITS.has(`${sourceCard.productKey}:${row.sourceCreditKey}`)) {
        rows.push(skippedRow({ ...base, reason: "credit_family_not_allowlisted" }));
        return;
      }
      const resolvedProduct = resolveServerAmexProduct(sourceCard.providerProductName);
      const resolvedBenefit = resolvedProduct
        ? resolveServerAmexCredit(resolvedProduct, row.providerTitle, {
          sourcePeriod: row.sourcePeriod,
          // December Uber aggregate bounds are validated by the split planner so
          // it can return two destination-specific, atomic skip rows.
          earnedOrUsed: row.sourceCreditKey === PLATINUM_UBER_FAMILY
            ? null
            : row.earnedOrUsed,
        })
        : null;
      if (row.providerCategory !== "usage"
        || resolvedProduct !== sourceCard.productKey
        || !resolvedBenefit
        || resolvedBenefit.productKey !== sourceCard.productKey
        || resolvedBenefit.sourceCreditKey !== row.sourceCreditKey
        || resolvedBenefit.creditFamilyKey !== row.creditFamilyKey) {
        rows.push(skippedRow({ ...base, reason: "source_evidence_mismatch" }));
        return;
      }
      if (typeof cardResolution === "string") {
        rows.push(skippedRow({ ...base, reason: cardResolution }));
        return;
      }
      if (cardResolution.userId !== userId) {
        rows.push(skippedRow({ ...base, reason: "mapping_invalid" }));
        return;
      }
      if (!row.sourcePeriod) {
        rows.push(skippedRow({ ...base, reason: "period_not_structured", destinationCardId: cardResolution.id }));
        return;
      }
      const periodKeys = periodKeysForExactRange(row.sourcePeriod.startDate, row.sourcePeriod.endDate);
      if (!periodKeys.length) {
        rows.push(skippedRow({ ...base, reason: "period_key_mismatch", destinationCardId: cardResolution.id }));
        return;
      }
      const today = dateOnly(now);
      if (today < row.sourcePeriod.startDate || today > row.sourcePeriod.endDate) {
        rows.push(skippedRow({ ...base, reason: "period_not_current", destinationCardId: cardResolution.id }));
        return;
      }
      const benefits = cardResolution.benefits.filter((benefit) =>
        benefit.productKey === sourceCard.productKey
        && benefit.creditFamilyKey === row.creditFamilyKey
        && benefit.periodKey !== null
        && periodKeys.some((periodKey) => periodKey === benefit.periodKey));
      if (benefits.length !== 1) {
        rows.push(skippedRow({
          ...base,
          reason: benefits.length ? "destination_benefit_ambiguous" : "destination_benefit_missing",
          destinationCardId: cardResolution.id,
        }));
        return;
      }
      const benefit = benefits[0];
      const periodKey = benefit.periodKey!;
      const statuses = benefit.statuses.filter((status) =>
        status.userId === userId
        && status.occurrenceIndex === 0
        && dateOnly(status.cycleStartDate) === row.sourcePeriod!.startDate
        && dateOnly(status.cycleEndDate) === row.sourcePeriod!.endDate);
      if (statuses.length !== 1) {
        rows.push(skippedRow({
          ...base,
          periodKey,
          reason: statuses.length ? "destination_status_ambiguous" : "destination_status_missing",
          destinationCardId: cardResolution.id,
          destinationBenefitId: benefit.id,
        }));
        return;
      }
      const status = statuses[0];
      const before = snapshot(status);
      const observedAt = Date.parse(sourceCard.observedAt);
      if (status.provenance) {
        const previousAt = status.provenance.observedAt.getTime();
        if (observedAt < previousAt) {
          rows.push(skippedRow({ ...base, periodKey, reason: "stale_replay", destinationCardId: cardResolution.id, destinationBenefitId: benefit.id, destinationStatusId: status.id, before }));
          return;
        }
        if (observedAt === previousAt && status.provenance.sourceObservationDigest === identities.sourceObservationDigest) {
          rows.push({
            ...skippedRow({ ...base, periodKey, reason: "unchanged_replay", destinationCardId: cardResolution.id, destinationBenefitId: benefit.id, destinationStatusId: status.id, before }),
            disposition: "unchanged",
            after: before,
          });
          return;
        }
        if (observedAt === previousAt) {
          rows.push(skippedRow({ ...base, periodKey, reason: "source_conflict", destinationCardId: cardResolution.id, destinationBenefitId: benefit.id, destinationStatusId: status.id, before }));
          return;
        }
      }
      const transition = resolveTransition(row, status, transitionTime);
      if (typeof transition === "string") {
        rows.push(skippedRow({ ...base, periodKey, reason: transition, destinationCardId: cardResolution.id, destinationBenefitId: benefit.id, destinationStatusId: status.id, before }));
        return;
      }
      const unchanged = canonicalJson(before) === canonicalJson(transition.after);
      rows.push({
        ...base,
        periodKey,
        disposition: unchanged ? "unchanged" : "proposed",
        reason: unchanged ? "already_current" : "proposed_update",
        destinationCardId: cardResolution.id,
        destinationBenefitId: benefit.id,
        destinationStatusId: status.id,
        before,
        after: transition.after,
        changes: transition.changes,
      });
    });
  });

  const plannedRows = rows.flatMap((row) => {
    const source = sourceByRowIdentity.get(row.sourceRowIdentity);
    return source ? expandPlatinumDecemberUber({
      ...source,
      baseRow: row,
      context,
      userId,
      transitionTime,
    }) : [row];
  });
  const beforeStateDigest = hash(plannedRows.map((row) => ({
    sourceRowIdentity: row.sourceRowIdentity,
    atomicGroupIdentity: row.atomicGroupIdentity,
    destinationStatusId: row.destinationStatusId,
    disposition: row.disposition,
    reason: row.reason,
    before: row.before,
    after: row.after,
  })));
  return { rows: plannedRows, envelopeDigest, beforeStateDigest };
}

export function syncIdempotencyKey(userId: string, plan: AmexSyncPlan): string {
  return hash({ userId, envelopeDigest: plan.envelopeDigest });
}

export type AmexCompensationReason =
  | "compensation_proposed"
  | "audit_not_applied"
  | "newer_status_edit"
  | "newer_source_provenance";

export interface AmexCompensationPlan {
  disposition: "proposed" | "refused";
  reason: AmexCompensationReason;
  statusId: string;
  before: StatusStateProjection;
  after: StatusStateProjection | null;
}

/**
 * Plans, but never executes, a reviewed compensation. A caller must separately
 * authorize any write and re-run the same compare-and-set checks transactionally.
 */
export function planReviewedAmexCompensation(input: {
  auditDisposition: "UPDATED" | "UNCHANGED" | "SKIPPED" | "FAILED";
  attemptId: string;
  auditAppliedAt: Date;
  auditBefore: StatusStateProjection | null;
  auditAfter: StatusStateProjection | null;
  currentStatus: DestinationStatusSnapshot;
  currentProvenance: { attemptId: string; appliedAt: Date } | null;
}): AmexCompensationPlan {
  const current = snapshot(input.currentStatus);
  if (input.auditDisposition !== "UPDATED" || !input.auditBefore || !input.auditAfter) {
    return { disposition: "refused", reason: "audit_not_applied", statusId: input.currentStatus.id, before: current, after: null };
  }
  if (input.currentStatus.updatedAt.getTime() > input.auditAppliedAt.getTime()
    || canonicalJson(current) !== canonicalJson(input.auditAfter)) {
    return { disposition: "refused", reason: "newer_status_edit", statusId: input.currentStatus.id, before: current, after: null };
  }
  if (!input.currentProvenance
    || input.currentProvenance.attemptId !== input.attemptId
    || input.currentProvenance.appliedAt.getTime() > input.auditAppliedAt.getTime()) {
    return { disposition: "refused", reason: "newer_source_provenance", statusId: input.currentStatus.id, before: current, after: null };
  }
  return {
    disposition: "proposed",
    reason: "compensation_proposed",
    statusId: input.currentStatus.id,
    before: current,
    after: input.auditBefore,
  };
}
