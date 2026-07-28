import { createHash } from "node:crypto";
import { canonicalJson, isSyncEnvelopeFresh, type AmexSyncEnvelope, type AmexSyncRow } from "@/lib/amex-benefit-reader/sync-contract";

export const WRITABLE_AMEX_PRODUCT_KEY = "american-express-platinum-card" as const;
export const WRITABLE_AMEX_CREDIT_FAMILIES = new Set([
  "american-express-platinum-card:lululemon",
  "american-express-platinum-card:resy",
]);

export type AmexSyncReason =
  | "proposed_update"
  | "already_current"
  | "unchanged_replay"
  | "stale_replay"
  | "source_conflict"
  | "scan_expired"
  | "product_not_allowlisted"
  | "credit_family_not_allowlisted"
  | "manual_mapping_required"
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

export interface ManualCardSelection {
  sourceLocalCardId: string;
  destinationCardId: string;
}

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
  productKey: string | null;
  lastFourDigits: string | null;
  lifecycleStatus: "ACTIVE" | "CLOSED" | "PRODUCT_CHANGED";
  benefits: DestinationBenefitSnapshot[];
}

export interface SavedCardMappingSnapshot {
  sourceLocalCardId: string;
  sourceProductKey: string;
  creditCardId: string;
  inactiveAt: Date | null;
}

export interface AmexSyncDestinationContext {
  cards: DestinationCardSnapshot[];
  savedMappings: SavedCardMappingSnapshot[];
}

export interface StatusStateProjection {
  usedAmount: number;
  isCompleted: boolean;
  completedAt: string | null;
  isNotUsable: boolean;
}

export interface AmexSyncPlanRow {
  sourceRowIdentity: string;
  sourceObservationIdentity: string;
  sourceObservationDigest: string;
  sourceLocalCardId: string;
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
  manualMappingsDigest: string;
  beforeStateDigest: string;
}

function hash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function canonicalManualMappings(selections: ManualCardSelection[]): ManualCardSelection[] {
  return [...selections]
    .map((selection) => ({ ...selection }))
    .sort((left, right) => left.sourceLocalCardId.localeCompare(right.sourceLocalCardId));
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function periodKeyForExactRange(startDate: string, endDate: string): string | null {
  const year = Number(startDate.slice(0, 4));
  const starts = ["01-01", "04-01", "07-01", "10-01"];
  const ends = ["03-31", "06-30", "09-30", "12-31"];
  const startSuffix = startDate.slice(5);
  const quarter = starts.indexOf(startSuffix);
  if (!Number.isInteger(year) || quarter < 0 || endDate !== `${year}-${ends[quarter]}`) return null;
  return `calendar-quarter-q${quarter + 1}`;
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
  sourceObservationIdentity: string;
  sourceObservationDigest: string;
  sourceLocalCardId: string;
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
  const targetMinor = parseUsdMinorUnits(row.targetOrLimit);
  if (row.targetOrLimit && targetMinor === null) return "amount_incompatible";

  const amountCompletion = usedMinor !== null && targetMinor !== null && targetMinor > 0
    ? usedMinor >= targetMinor
    : null;
  const explicitCompletion = row.completionState === "complete"
    ? true
    : row.completionState === "incomplete" ? false : null;
  if (explicitCompletion !== null && amountCompletion !== null && explicitCompletion !== amountCompletion) {
    return "completion_conflict";
  }
  const completion = explicitCompletion ?? amountCompletion;
  if (completion === null) return "status_unavailable";

  const usedAmount = usedMinor === null ? status.usedAmount : usedMinor / 100;
  const completedAt = completion
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
  selectionBySourceId: ReadonlyMap<string, string>,
): DestinationCardSnapshot | AmexSyncReason {
  const activeCompatible = context.cards.filter((card) =>
    card.userId
    && card.lifecycleStatus === "ACTIVE"
    && card.productKey === sourceCard.productKey);
  const selectedId = selectionBySourceId.get(sourceCard.sourceLocalCardId);
  if (selectedId) {
    return activeCompatible.find((card) => card.id === selectedId) ?? "mapping_invalid";
  }
  const saved = context.savedMappings.find((mapping) =>
    mapping.sourceLocalCardId === sourceCard.sourceLocalCardId
    && mapping.sourceProductKey === sourceCard.productKey
    && mapping.inactiveAt === null);
  if (saved) return activeCompatible.find((card) => card.id === saved.creditCardId) ?? "mapping_invalid";
  const automatic = activeCompatible.filter((card) => card.lastFourDigits === sourceCard.endingDigits);
  if (automatic.length === 1) return automatic[0];
  return automatic.length > 1 ? "ambiguous_card" : "manual_mapping_required";
}

function rowIdentityParts(
  envelope: AmexSyncEnvelope,
  card: AmexSyncEnvelope["cards"][number],
  row: AmexSyncRow,
  rowIndex: number,
): {
  sourceRowIdentity: string;
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
  return {
    sourceRowIdentity: hash({ ...observation, rowIndex }),
    sourceObservationIdentity: hash({ ...observation, identityVersion: 1 }),
    sourceObservationDigest: hash({ ...observation, digestVersion: 1 }),
  };
}

export function planAmexSync(input: {
  envelope: AmexSyncEnvelope;
  context: AmexSyncDestinationContext;
  manualMappings: ManualCardSelection[];
  userId: string;
  now: Date;
  transitionTime: Date;
}): AmexSyncPlan {
  const { envelope, context, userId, now, transitionTime } = input;
  const manualMappings = canonicalManualMappings(input.manualMappings);
  const selectionBySourceId = new Map(manualMappings.map((mapping) => [mapping.sourceLocalCardId, mapping.destinationCardId]));
  const envelopeDigest = hash(envelope);
  const manualMappingsDigest = hash(manualMappings);
  const rows: AmexSyncPlanRow[] = [];

  envelope.cards.forEach((sourceCard) => {
    const cardResolution = resolveCard(sourceCard, context, selectionBySourceId);
    sourceCard.rows.forEach((row, rowIndex) => {
      const identities = rowIdentityParts(envelope, sourceCard, row, rowIndex);
      const base = {
        ...identities,
        sourceLocalCardId: sourceCard.sourceLocalCardId,
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
      if (sourceCard.productKey !== WRITABLE_AMEX_PRODUCT_KEY) {
        rows.push(skippedRow({ ...base, reason: "product_not_allowlisted" }));
        return;
      }
      if (!WRITABLE_AMEX_CREDIT_FAMILIES.has(row.creditFamilyKey)) {
        rows.push(skippedRow({ ...base, reason: "credit_family_not_allowlisted" }));
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
      const periodKey = periodKeyForExactRange(row.sourcePeriod.startDate, row.sourcePeriod.endDate);
      if (!periodKey) {
        rows.push(skippedRow({ ...base, reason: "period_key_mismatch", destinationCardId: cardResolution.id }));
        return;
      }
      const today = dateOnly(now);
      if (today < row.sourcePeriod.startDate || today > row.sourcePeriod.endDate) {
        rows.push(skippedRow({ ...base, periodKey, reason: "period_not_current", destinationCardId: cardResolution.id }));
        return;
      }
      const benefits = cardResolution.benefits.filter((benefit) =>
        benefit.productKey === sourceCard.productKey
        && benefit.creditFamilyKey === row.creditFamilyKey
        && benefit.periodKey === periodKey);
      if (benefits.length !== 1) {
        rows.push(skippedRow({
          ...base,
          periodKey,
          reason: benefits.length ? "destination_benefit_ambiguous" : "destination_benefit_missing",
          destinationCardId: cardResolution.id,
        }));
        return;
      }
      const benefit = benefits[0];
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

  const beforeStateDigest = hash(rows.map((row) => ({
    sourceRowIdentity: row.sourceRowIdentity,
    destinationStatusId: row.destinationStatusId,
    disposition: row.disposition,
    reason: row.reason,
    before: row.before,
    after: row.after,
  })));
  return { rows, envelopeDigest, manualMappingsDigest, beforeStateDigest };
}

export function syncIdempotencyKey(userId: string, plan: AmexSyncPlan): string {
  return hash({ userId, envelopeDigest: plan.envelopeDigest, manualMappingsDigest: plan.manualMappingsDigest });
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
