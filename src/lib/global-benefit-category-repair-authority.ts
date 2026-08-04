import {
  globalDefinitionFingerprint,
  type GlobalBenefitDefinition,
  type GlobalCardDefinition,
} from './global-benefit-migration';

export type GlobalBenefitCategoryRepairAuthorityState =
  | 'NONE'
  | 'ROLLED_BACK'
  | 'APPLIED_VALID'
  | 'APPLIED_INVALID';

export type GlobalBenefitCategoryRepairStatusAction =
  | 'PROMOTE_LEGACY_STATUS'
  | 'RETAIN_CANONICAL_STATUS';

export type GlobalBenefitCategoryRepairStatusSource =
  | 'LEGACY_CUSTOM'
  | 'CANONICAL_STANDARD';

export interface RuntimeCategoryRepairLedgerSnapshot {
  id: string;
  legacyBenefitId: string;
  userId: string;
  creditCardId: string | null;
  predefinedCardId: string | null;
  predefinedBenefitId: string | null;
  classification: string;
  phase: string;
  destinationFingerprint: string | null;
}

export interface RuntimeCategoryRepairSnapshot {
  id: string;
  legacyBenefitId: string;
  catalogMigrationLedgerId: string;
  userId: string;
  creditCardId: string;
  predefinedCardId: string;
  predefinedBenefitId: string;
  targetPredefinedCardCatalogKey: string;
  targetPredefinedBenefitCatalogKey: string;
  definitionFingerprint: string;
  evidenceVersion: number;
  phase: string;
  rolledBackAt: Date | null;
}

export interface RuntimeCategoryRepairOccurrenceSnapshot {
  repairId: string;
  userId: string;
  creditCardId: string;
  predefinedBenefitId: string;
  targetPredefinedBenefitCatalogKey: string;
  action: string;
  keeperSource: string;
  keeperStatusId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  keeperBaselineVersion: number;
  removedStatusPreimageVersion: number | null;
  repairAddedAuditMetadataVersion: number;
}

export interface RuntimeCategoryRepairStatusSnapshot {
  id: string;
  benefitId: string | null;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
}

export interface RuntimeCategoryRepairAuthorityInput {
  sourceBenefitId: string;
  ledger: RuntimeCategoryRepairLedgerSnapshot | null;
  repair: RuntimeCategoryRepairSnapshot | null;
  card: { id: string; userId: string; predefinedCardId: string | null };
  product: GlobalCardDefinition;
  benefit: GlobalBenefitDefinition;
  status?: RuntimeCategoryRepairStatusSnapshot | null;
  occurrence?: RuntimeCategoryRepairOccurrenceSnapshot | null;
}

function exactDate(left: Date, right: Date): boolean {
  return left instanceof Date
    && right instanceof Date
    && !Number.isNaN(left.getTime())
    && left.getTime() === right.getTime();
}

/**
 * The only in-memory semantic classifier for category-repair runtime authority.
 * It deliberately validates persisted evidence by exact identity; it never does
 * category/content discovery and never consumes a private manifest.
 */
export function classifyGlobalBenefitCategoryRepairAuthority(
  input: RuntimeCategoryRepairAuthorityInput,
): GlobalBenefitCategoryRepairAuthorityState {
  const { repair } = input;
  if (!repair) return 'NONE';
  if (repair.phase === 'ROLLED_BACK') return 'ROLLED_BACK';
  if (repair.phase !== 'APPLIED' || repair.rolledBackAt !== null) return 'APPLIED_INVALID';

  const { ledger, card, product, benefit } = input;
  const parentValid = repair.evidenceVersion === 1
    && repair.legacyBenefitId === input.sourceBenefitId
    && ledger !== null
    && repair.catalogMigrationLedgerId === ledger.id
    && ledger.legacyBenefitId === input.sourceBenefitId
    && ledger.userId === repair.userId
    && ledger.creditCardId === repair.creditCardId
    && ledger.predefinedCardId === null
    && ledger.predefinedBenefitId === null
    && ledger.classification === 'CUSTOM'
    && ledger.phase === 'CLASSIFIED'
    && ledger.destinationFingerprint === null
    && card.id === repair.creditCardId
    && card.userId === repair.userId
    && card.predefinedCardId === repair.predefinedCardId
    && product.id === repair.predefinedCardId
    && product.catalogKey === repair.targetPredefinedCardCatalogKey
    && benefit.id === repair.predefinedBenefitId
    && benefit.predefinedCardId === product.id
    && benefit.catalogKey === repair.targetPredefinedBenefitCatalogKey
    && globalDefinitionFingerprint(benefit) === repair.definitionFingerprint;
  if (!parentValid) return 'APPLIED_INVALID';

  const status = input.status;
  const occurrence = input.occurrence;
  if (status === undefined && occurrence === undefined) return 'APPLIED_VALID';
  if (!status || !occurrence) return 'APPLIED_INVALID';

  const actionIsPromote = occurrence.action === 'PROMOTE_LEGACY_STATUS'
    && occurrence.keeperSource === 'LEGACY_CUSTOM'
    && status.benefitId === input.sourceBenefitId;
  const actionIsRetain = occurrence.action === 'RETAIN_CANONICAL_STATUS'
    && occurrence.keeperSource === 'CANONICAL_STANDARD'
    && status.benefitId === null;
  const occurrenceValid = occurrence.repairId === repair.id
    && occurrence.userId === repair.userId
    && occurrence.creditCardId === repair.creditCardId
    && occurrence.predefinedBenefitId === repair.predefinedBenefitId
    && occurrence.targetPredefinedBenefitCatalogKey === repair.targetPredefinedBenefitCatalogKey
    && occurrence.keeperStatusId === status.id
    && occurrence.keeperBaselineVersion === 1
    && (occurrence.removedStatusPreimageVersion === null
      || occurrence.removedStatusPreimageVersion === 1)
    && occurrence.repairAddedAuditMetadataVersion === 1
    && status.userId === repair.userId
    && status.creditCardId === repair.creditCardId
    && status.predefinedBenefitId === repair.predefinedBenefitId
    && exactDate(status.cycleStartDate, occurrence.cycleStartDate)
    && exactDate(status.cycleEndDate, occurrence.cycleEndDate)
    && status.occurrenceIndex === occurrence.occurrenceIndex
    && (actionIsPromote || actionIsRetain);
  return occurrenceValid ? 'APPLIED_VALID' : 'APPLIED_INVALID';
}

export function isAppliedCategoryRepairPhase(
  repair: Pick<RuntimeCategoryRepairSnapshot, 'phase'> | null | undefined,
): boolean {
  return repair?.phase === 'APPLIED';
}
