import { createHash } from "node:crypto";

export const GLOBAL_BENEFIT_BRIDGE_CONFIRMATION = "BRIDGE_EXACT_GLOBAL_BENEFITS" as const;
export const GLOBAL_BENEFIT_CLEANUP_CONFIRMATION = "CLEANUP_LEDGER_PROVEN_GLOBAL_BENEFITS" as const;
export const GLOBAL_BENEFIT_ROLLBACK_CONFIRMATION = "ROLLBACK_LEDGER_PROVEN_GLOBAL_BENEFITS" as const;
export const GLOBAL_BENEFIT_MIGRATION_DEFAULT_LIMIT = 100;
export const GLOBAL_BENEFIT_MIGRATION_MAX_LIMIT = 500;

export type GlobalBenefitMigrationMode = "dry-run" | "apply" | "cleanup" | "rollback";
export type LegacyBenefitDisposition = "standard" | "custom" | "unresolved";

export type LegacyMigrationReason =
  | "exact_standard_match"
  | "standalone_custom"
  | "unmatched_card_custom"
  | "unmatched_benefit_custom"
  | "card_product_ambiguous"
  | "card_identity_conflict"
  | "benefit_match_ambiguous"
  | "benefit_identity_conflict"
  | "ownership_inconsistent"
  | "relationship_inconsistent"
  | "duplicate_standard_destination"
  | "ledger_conflict";

export interface LegacyBenefitShape {
  category: string;
  description: string;
  percentage: number;
  maxAmount: number | null;
  frequency: string;
  cycleAlignment: string | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number;
}

export interface GlobalBenefitDefinition extends LegacyBenefitShape {
  id: string;
  catalogKey: string;
  predefinedCardId: string;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
  retiredAt: Date | null;
}

export interface GlobalCardDefinition {
  id: string;
  catalogKey: string;
  name: string;
  issuer: string;
  productKey: string | null;
  retiredAt: Date | null;
  benefits: GlobalBenefitDefinition[];
}

export interface LegacyStatusRelation {
  id: string;
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  stateFingerprint: string;
}

export interface LegacyAuditRelation {
  id: string;
  attemptUserId: string;
  destinationCardId: string | null;
  destinationBenefitId: string | null;
  destinationPredefinedBenefitId: string | null;
  destinationStatusId: string | null;
  destinationDefinitionFingerprint: string | null;
  stateFingerprint: string;
}

export interface LegacyProvenanceRelation {
  id: string;
  benefitStatusId: string;
  attemptUserId: string | null;
}

export interface ExistingMigrationLedger {
  legacyBenefitId: string;
  userId: string;
  creditCardId: string | null;
  predefinedCardId: string | null;
  predefinedBenefitId: string | null;
  classification: "STANDARD" | "CUSTOM";
  phase: "CLASSIFIED" | "BRIDGED" | "CLEANED" | "ROLLED_BACK";
  sourceFingerprint: string;
  destinationFingerprint: string | null;
}

export interface LegacyBenefitRecord extends LegacyBenefitShape {
  id: string;
  creditCardId: string | null;
  userId: string | null;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
  statuses: LegacyStatusRelation[];
  audits: LegacyAuditRelation[];
  provenance: LegacyProvenanceRelation[];
  ledger: ExistingMigrationLedger | null;
}

export interface LegacyCardRecord {
  id: string;
  name: string;
  issuer: string;
  userId: string;
  productKey: string | null;
  predefinedCardId: string | null;
}

export interface LegacyMigrationUnit {
  /** Private stable key. It must never be copied into an aggregate report. */
  key: string;
  card: LegacyCardRecord | null;
  benefits: LegacyBenefitRecord[];
  /** Card-only audits are ownership evidence, not benefit bridge targets. */
  cardAudits?: LegacyAuditRelation[];
}

export interface LegacyMigrationSnapshot {
  definitions: GlobalCardDefinition[];
  units: LegacyMigrationUnit[];
  hasMore: boolean;
}

export interface ClassifiedLegacyBenefit {
  legacyBenefitId: string;
  disposition: LegacyBenefitDisposition;
  reason: LegacyMigrationReason;
  sourceFingerprint: string;
  destinationFingerprint: string | null;
  predefinedBenefitId: string | null;
  ledgerPhase: ExistingMigrationLedger["phase"] | null;
}

export interface ClassifiedMigrationUnit {
  privateUnitKey: string;
  unitFingerprint: string;
  card: LegacyCardRecord | null;
  predefinedCardId: string | null;
  benefits: ClassifiedLegacyBenefit[];
  blocked: boolean;
}

export interface MigrationWriteResult {
  standard: number;
  custom: number;
  cleaned: number;
  rolledBack: number;
  idempotent: number;
}

export interface GlobalBenefitMigrationDatabase {
  readBatch(input: { afterCursorDigest: string | null; limit: number }): Promise<LegacyMigrationSnapshot>;
  applyBridge(unit: ClassifiedMigrationUnit): Promise<MigrationWriteResult>;
  cleanupBridge(unit: ClassifiedMigrationUnit): Promise<MigrationWriteResult>;
  rollbackBridge(unit: ClassifiedMigrationUnit): Promise<MigrationWriteResult>;
}

export interface GlobalBenefitMigrationReport {
  mode: GlobalBenefitMigrationMode;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  sourceFingerprint: string;
  counts: {
    unitsExamined: number;
    benefitsExamined: number;
    standard: number;
    custom: number;
    unresolved: number;
    blockedUnits: number;
    bridged: number;
    classifiedCustom: number;
    cleaned: number;
    rolledBack: number;
    idempotent: number;
  };
  reasons: Partial<Record<LegacyMigrationReason, number>>;
}

export class GlobalBenefitMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlobalBenefitMigrationError";
  }
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function migrationFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function cursorDigest(privateKey: string): string {
  // PostgreSQL provides the same built-in MD5 projection, allowing the database
  // adapter to resolve the cursor without placing the private row key in reports.
  // Unit keys are generated high-entropy IDs; the digest is pagination opacity,
  // not an authorization or integrity boundary.
  return createHash("md5")
    .update(`global-benefit-migration/v2:${privateKey}`)
    .digest("hex");
}

export function encodeGlobalBenefitMigrationCursor(privateKey: string): string {
  return `v2.${cursorDigest(privateKey)}`;
}

export function decodeGlobalBenefitMigrationCursor(cursor: string | undefined): string | null {
  if (cursor === undefined) return null;
  if (!/^v2\.[a-f0-9]{32}$/.test(cursor)) {
    throw new GlobalBenefitMigrationError("The migration cursor is invalid.");
  }
  return cursor.slice("v2.".length);
}

const shapeFields: Array<keyof LegacyBenefitShape> = [
  "category",
  "description",
  "percentage",
  "maxAmount",
  "frequency",
  "cycleAlignment",
  "fixedCycleStartMonth",
  "fixedCycleDurationMonths",
  "occurrencesInCycle",
];

function shapesEqual(legacy: LegacyBenefitRecord, definition: GlobalBenefitDefinition): boolean {
  return shapeFields.every((field) => legacy[field] === definition[field]);
}

function sourceFingerprint(benefit: LegacyBenefitRecord): string {
  return migrationFingerprint({
    id: benefit.id,
    creditCardId: benefit.creditCardId,
    userId: benefit.userId,
    shape: Object.fromEntries(shapeFields.map((field) => [field, benefit[field]])),
    identity: [benefit.productKey, benefit.creditFamilyKey, benefit.periodKey],
    statuses: benefit.statuses.map((status) => ({
      id: status.id,
      benefitId: status.benefitId,
      userId: status.userId,
      cycleStartDate: status.cycleStartDate,
      cycleEndDate: status.cycleEndDate,
      occurrenceIndex: status.occurrenceIndex,
      stateFingerprint: status.stateFingerprint,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    audits: benefit.audits.map((audit) => ({
      id: audit.id,
      attemptUserId: audit.attemptUserId,
      destinationCardId: audit.destinationCardId,
      destinationBenefitId: audit.destinationBenefitId,
      destinationStatusId: audit.destinationStatusId,
      stateFingerprint: audit.stateFingerprint,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    provenance: benefit.provenance.map((row) => ({ ...row })).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export function globalDefinitionFingerprint(definition: GlobalBenefitDefinition): string {
  return migrationFingerprint({
    // Catalog keys, not environment-local database IDs, are the durable global
    // identity and keep bridge/audit fingerprints valid after clone rebinding.
    catalogKey: definition.catalogKey,
    shape: Object.fromEntries(shapeFields.map((field) => [field, definition[field]])),
    identity: [definition.productKey, definition.creditFamilyKey, definition.periodKey],
    retiredAt: definition.retiredAt,
  });
}

function identityAgrees(legacy: LegacyBenefitRecord, definition: GlobalBenefitDefinition): boolean {
  return (legacy.productKey === null || legacy.productKey === definition.productKey)
    && (legacy.creditFamilyKey === null || legacy.creditFamilyKey === definition.creditFamilyKey)
    && (legacy.periodKey === null || legacy.periodKey === definition.periodKey);
}

function ledgerAgrees(
  benefit: LegacyBenefitRecord,
  disposition: "standard" | "custom",
  card: LegacyCardRecord | null,
  predefinedCardId: string | null,
  definition: GlobalBenefitDefinition | null,
  source: string,
  destination: string | null,
): boolean {
  const ledger = benefit.ledger;
  if (!ledger) return true;
  if (ledger.phase === "CLEANED") return false;
  return ledger.legacyBenefitId === benefit.id
    && ledger.userId === (card?.userId ?? benefit.userId)
    && ledger.creditCardId === (card?.id ?? null)
    && ledger.predefinedCardId === predefinedCardId
    && ledger.predefinedBenefitId === (definition?.id ?? null)
    && ledger.classification === (disposition === "standard" ? "STANDARD" : "CUSTOM")
    && ledger.sourceFingerprint === source
    && ledger.destinationFingerprint === destination;
}

function relationGraphIsConsistent(
  benefit: LegacyBenefitRecord,
  ownerId: string,
  cardId: string | null,
  definition: GlobalBenefitDefinition | null,
): boolean {
  const statusIds = new Set(benefit.statuses.map((status) => status.id));
  const bridgeIsRecorded = definition !== null
    && benefit.ledger?.classification === "STANDARD"
    && benefit.ledger.phase === "BRIDGED";
  const expectedDefinitionId = bridgeIsRecorded ? definition.id : null;
  const expectedCardId = bridgeIsRecorded ? cardId : null;
  const expectedDefinitionFingerprint = bridgeIsRecorded
    ? globalDefinitionFingerprint(definition)
    : null;

  // Exact pre-existing global links without a bridge ledger are not adopted: the
  // rollback operator could not prove that it had added those fields itself.
  if (benefit.statuses.some((status) => status.userId !== ownerId
    || status.benefitId !== benefit.id
    || status.creditCardId !== expectedCardId
    || status.predefinedBenefitId !== expectedDefinitionId)) return false;
  if (benefit.provenance.some((row) => !statusIds.has(row.benefitStatusId)
    || (row.attemptUserId !== null && row.attemptUserId !== ownerId))) return false;
  return !benefit.audits.some((audit) => audit.attemptUserId !== ownerId
    || (audit.destinationCardId !== null && audit.destinationCardId !== cardId)
    || (audit.destinationBenefitId !== null && audit.destinationBenefitId !== benefit.id)
    || (audit.destinationStatusId !== null && !statusIds.has(audit.destinationStatusId))
    || audit.destinationPredefinedBenefitId !== expectedDefinitionId
    || audit.destinationDefinitionFingerprint !== expectedDefinitionFingerprint);
}

function unresolved(
  benefit: LegacyBenefitRecord,
  reason: LegacyMigrationReason,
): ClassifiedLegacyBenefit {
  return {
    legacyBenefitId: benefit.id,
    disposition: "unresolved",
    reason,
    sourceFingerprint: sourceFingerprint(benefit),
    destinationFingerprint: null,
    predefinedBenefitId: null,
    ledgerPhase: benefit.ledger?.phase ?? null,
  };
}

function custom(
  benefit: LegacyBenefitRecord,
  reason: "standalone_custom" | "unmatched_card_custom" | "unmatched_benefit_custom",
  card: LegacyCardRecord | null,
): ClassifiedLegacyBenefit {
  const source = sourceFingerprint(benefit);
  if (!ledgerAgrees(benefit, "custom", card, null, null, source, null)) return unresolved(benefit, "ledger_conflict");
  return {
    legacyBenefitId: benefit.id,
    disposition: "custom",
    reason,
    sourceFingerprint: source,
    destinationFingerprint: null,
    predefinedBenefitId: null,
    ledgerPhase: benefit.ledger?.phase ?? null,
  };
}

function classifyStandalone(unit: LegacyMigrationUnit): ClassifiedMigrationUnit {
  const benefits = unit.benefits.map((benefit) => {
    if (benefit.creditCardId !== null || benefit.userId === null) return unresolved(benefit, "ownership_inconsistent");
    if (!relationGraphIsConsistent(benefit, benefit.userId, null, null)) return unresolved(benefit, "relationship_inconsistent");
    return custom(benefit, "standalone_custom", null);
  });
  return finishClassification(unit, null, benefits);
}

function finishClassification(
  unit: LegacyMigrationUnit,
  predefinedCardId: string | null,
  benefits: ClassifiedLegacyBenefit[],
): ClassifiedMigrationUnit {
  const blocked = benefits.some((benefit) => benefit.disposition === "unresolved");
  const unitFingerprint = migrationFingerprint({
    privateUnitKey: unit.key,
    card: unit.card ? {
      id: unit.card.id,
      name: unit.card.name,
      issuer: unit.card.issuer,
      userId: unit.card.userId,
      productKey: unit.card.productKey,
    } : null,
    cardAudits: (unit.cardAudits ?? []).map((audit) => ({
      id: audit.id,
      attemptUserId: audit.attemptUserId,
      destinationCardId: audit.destinationCardId,
      destinationBenefitId: audit.destinationBenefitId,
      destinationStatusId: audit.destinationStatusId,
      stateFingerprint: audit.stateFingerprint,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    predefinedCardId,
    benefits: benefits.map((benefit) => ({
      legacyBenefitId: benefit.legacyBenefitId,
      disposition: benefit.disposition,
      reason: benefit.reason,
      sourceFingerprint: benefit.sourceFingerprint,
      destinationFingerprint: benefit.destinationFingerprint,
      predefinedBenefitId: benefit.predefinedBenefitId,
    })),
  });
  return {
    privateUnitKey: unit.key,
    unitFingerprint,
    card: unit.card,
    predefinedCardId,
    benefits,
    blocked,
  };
}

export function classifyLegacyMigrationUnit(
  unit: LegacyMigrationUnit,
  definitions: readonly GlobalCardDefinition[],
): ClassifiedMigrationUnit {
  if (!unit.card) return classifyStandalone(unit);
  const card = unit.card;
  if (unit.benefits.some((benefit) => benefit.creditCardId !== card.id
    || (benefit.userId !== null && benefit.userId !== card.userId))) {
    return finishClassification(unit, null, unit.benefits.map((benefit) => unresolved(benefit, "ownership_inconsistent")));
  }
  if ((unit.cardAudits ?? []).some((audit) => audit.attemptUserId !== card.userId
    || audit.destinationCardId !== card.id
    || audit.destinationBenefitId !== null
    || audit.destinationStatusId !== null
    || audit.destinationPredefinedBenefitId !== null
    || audit.destinationDefinitionFingerprint !== null)) {
    return finishClassification(unit, null, unit.benefits.map((benefit) => unresolved(benefit, "relationship_inconsistent")));
  }

  const candidates = definitions.filter((definition) => definition.name === card.name && definition.issuer === card.issuer);
  if (candidates.length === 0) {
    const benefits = unit.benefits.map((benefit) => relationGraphIsConsistent(benefit, card.userId, card.id, null)
      ? custom(benefit, "unmatched_card_custom", card)
      : unresolved(benefit, "relationship_inconsistent"));
    return finishClassification(unit, null, benefits);
  }
  if (candidates.length !== 1) {
    return finishClassification(unit, null, unit.benefits.map((benefit) => unresolved(benefit, "card_product_ambiguous")));
  }
  const globalCard = candidates[0];
  const cardLinkHasMigrationLedger = unit.benefits.length > 0
    && unit.benefits.every((benefit) => {
      const ledger = benefit.ledger;
      return ledger?.creditCardId === card.id
        && ((ledger.classification === "STANDARD"
          && ledger.phase === "BRIDGED"
          && ledger.predefinedCardId === globalCard.id)
          || (ledger.classification === "CUSTOM" && ledger.phase === "CLASSIFIED"));
    });
  if ((card.productKey !== null && card.productKey !== globalCard.productKey)
    || (card.predefinedCardId !== null && card.predefinedCardId !== globalCard.id)
    || (card.predefinedCardId !== null && !cardLinkHasMigrationLedger)) {
    return finishClassification(unit, null, unit.benefits.map((benefit) => unresolved(benefit, "card_identity_conflict")));
  }

  const benefits = unit.benefits.map((benefit): ClassifiedLegacyBenefit => {
    // New card-linked custom definitions carry an explicit same-owner userId.
    // That marker is authoritative custom identity even if the mutable terms
    // happen to equal a global definition; only legacy card-owned copies with a
    // null userId are eligible for exact standard adoption.
    if (benefit.userId === card.userId) {
      if (!relationGraphIsConsistent(benefit, card.userId, card.id, null)) {
        return unresolved(benefit, "relationship_inconsistent");
      }
      return custom(benefit, "unmatched_benefit_custom", card);
    }
    const shapeMatches = globalCard.benefits.filter((definition) => shapesEqual(benefit, definition));
    if (shapeMatches.length === 0) {
      if (!relationGraphIsConsistent(benefit, card.userId, card.id, null)) return unresolved(benefit, "relationship_inconsistent");
      return custom(benefit, "unmatched_benefit_custom", card);
    }
    if (shapeMatches.length !== 1) return unresolved(benefit, "benefit_match_ambiguous");
    const definition = shapeMatches[0];
    if (!identityAgrees(benefit, definition)) return unresolved(benefit, "benefit_identity_conflict");
    if (!relationGraphIsConsistent(benefit, card.userId, card.id, definition)) {
      return unresolved(benefit, "relationship_inconsistent");
    }
    const source = sourceFingerprint(benefit);
    const destination = globalDefinitionFingerprint(definition);
    if (!ledgerAgrees(benefit, "standard", card, globalCard.id, definition, source, destination)) {
      return unresolved(benefit, "ledger_conflict");
    }
    return {
      legacyBenefitId: benefit.id,
      disposition: "standard",
      reason: "exact_standard_match",
      sourceFingerprint: source,
      destinationFingerprint: destination,
      predefinedBenefitId: definition.id,
      ledgerPhase: benefit.ledger?.phase ?? null,
    };
  });

  const destinationOccurrences = new Map<string, number>();
  for (const benefit of benefits) {
    if (benefit.disposition !== "standard" || !benefit.predefinedBenefitId) continue;
    const source = unit.benefits.find((item) => item.id === benefit.legacyBenefitId)!;
    for (const status of source.statuses) {
      const key = [benefit.predefinedBenefitId, status.cycleStartDate.toISOString(), status.occurrenceIndex].join("|");
      destinationOccurrences.set(key, (destinationOccurrences.get(key) ?? 0) + 1);
    }
  }
  const duplicateBenefits = new Set<string>();
  for (const benefit of benefits) {
    if (benefit.disposition !== "standard" || !benefit.predefinedBenefitId) continue;
    const source = unit.benefits.find((item) => item.id === benefit.legacyBenefitId)!;
    if (source.statuses.some((status) => (destinationOccurrences.get([
      benefit.predefinedBenefitId,
      status.cycleStartDate.toISOString(),
      status.occurrenceIndex,
    ].join("|")) ?? 0) > 1)) duplicateBenefits.add(benefit.legacyBenefitId);
  }
  const finalBenefits = benefits.map((benefit) => duplicateBenefits.has(benefit.legacyBenefitId)
    ? unresolved(unit.benefits.find((item) => item.id === benefit.legacyBenefitId)!, "duplicate_standard_destination")
    : benefit);
  return finishClassification(unit, globalCard.id, finalBenefits);
}

function validateModeGates(input: {
  mode: GlobalBenefitMigrationMode;
  targetVerified?: boolean;
  confirmation?: string;
  parityVerified?: boolean;
  recoveryPointVerified?: boolean;
}): void {
  if (input.mode === "dry-run") return;
  if (input.targetVerified !== true) throw new GlobalBenefitMigrationError("The operation requires target verification.");
  const expected = input.mode === "apply"
    ? GLOBAL_BENEFIT_BRIDGE_CONFIRMATION
    : input.mode === "cleanup"
      ? GLOBAL_BENEFIT_CLEANUP_CONFIRMATION
      : GLOBAL_BENEFIT_ROLLBACK_CONFIRMATION;
  if (input.confirmation !== expected) throw new GlobalBenefitMigrationError("The operation requires its exact confirmation phrase.");
  if (input.mode === "cleanup" && (input.parityVerified !== true || input.recoveryPointVerified !== true)) {
    throw new GlobalBenefitMigrationError("Cleanup requires verified hybrid parity and a verified recovery point.");
  }
}

function incrementReason(
  reasons: Partial<Record<LegacyMigrationReason, number>>,
  reason: LegacyMigrationReason,
): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

export async function runGlobalBenefitMigrationOperator(input: {
  mode?: GlobalBenefitMigrationMode;
  limit?: number;
  after?: string;
  targetVerified?: boolean;
  confirmation?: string;
  parityVerified?: boolean;
  recoveryPointVerified?: boolean;
  expectedSourceFingerprint?: string;
  database: GlobalBenefitMigrationDatabase;
}): Promise<GlobalBenefitMigrationReport> {
  const mode = input.mode ?? "dry-run";
  validateModeGates({ ...input, mode });
  const limit = input.limit ?? GLOBAL_BENEFIT_MIGRATION_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > GLOBAL_BENEFIT_MIGRATION_MAX_LIMIT) {
    throw new GlobalBenefitMigrationError(`The migration limit must be between 1 and ${GLOBAL_BENEFIT_MIGRATION_MAX_LIMIT}.`);
  }
  const afterCursorDigest = decodeGlobalBenefitMigrationCursor(input.after);
  const snapshot = await input.database.readBatch({ afterCursorDigest, limit });
  if (snapshot.units.length > limit) throw new GlobalBenefitMigrationError("The database returned an unbounded migration batch.");
  const sorted = [...snapshot.units].sort((left, right) => left.key.localeCompare(right.key));
  if (sorted.some((unit, index) => unit !== snapshot.units[index])) {
    throw new GlobalBenefitMigrationError("The database returned a non-deterministic migration batch.");
  }
  const classified = sorted.map((unit) => classifyLegacyMigrationUnit(unit, snapshot.definitions));
  const batchSourceFingerprint = migrationFingerprint(classified.map((unit) => unit.unitFingerprint));
  if (mode !== "dry-run" && input.expectedSourceFingerprint !== batchSourceFingerprint) {
    throw new GlobalBenefitMigrationError("The source fingerprint does not match the reviewed dry-run.");
  }
  const counts: GlobalBenefitMigrationReport["counts"] = {
    unitsExamined: classified.length,
    benefitsExamined: 0,
    standard: 0,
    custom: 0,
    unresolved: 0,
    blockedUnits: 0,
    bridged: 0,
    classifiedCustom: 0,
    cleaned: 0,
    rolledBack: 0,
    idempotent: 0,
  };
  const reasons: Partial<Record<LegacyMigrationReason, number>> = {};
  for (const unit of classified) {
    if (unit.blocked) counts.blockedUnits += 1;
    for (const benefit of unit.benefits) {
      counts.benefitsExamined += 1;
      counts[benefit.disposition] += 1;
      incrementReason(reasons, benefit.reason);
    }
    if (mode === "dry-run" || unit.blocked) continue;
    const standard = unit.benefits.filter((benefit) => benefit.disposition === "standard");
    if (mode === "cleanup" && standard.some((benefit) => benefit.ledgerPhase !== "BRIDGED")) {
      throw new GlobalBenefitMigrationError("Cleanup requires an exact bridged ledger for every standard row.");
    }
    if (mode === "rollback" && standard.some((benefit) =>
      benefit.ledgerPhase !== "BRIDGED" && benefit.ledgerPhase !== "ROLLED_BACK")) {
      throw new GlobalBenefitMigrationError("Rollback requires an exact bridged ledger for every standard row.");
    }
    const result = mode === "apply"
      ? await input.database.applyBridge(unit)
      : mode === "cleanup"
        ? await input.database.cleanupBridge(unit)
        : await input.database.rollbackBridge(unit);
    counts.bridged += result.standard;
    counts.classifiedCustom += result.custom;
    counts.cleaned += result.cleaned;
    counts.rolledBack += result.rolledBack;
    counts.idempotent += result.idempotent;
  }
  const lastKey = sorted.at(-1)?.key ?? null;
  return {
    mode,
    limit,
    hasMore: snapshot.hasMore,
    nextCursor: snapshot.hasMore && lastKey ? encodeGlobalBenefitMigrationCursor(lastKey) : null,
    sourceFingerprint: batchSourceFingerprint,
    counts,
    reasons,
  };
}
