import { Prisma, type BenefitCycleAlignment, type BenefitFrequency, type PrismaClient } from '@/generated/prisma';
import { classifyGlobalBenefitCategoryRepairAuthority } from './global-benefit-category-repair-authority';
import type { GlobalBenefitDefinition, GlobalCardDefinition } from './global-benefit-migration';

export type EffectiveBenefitSource =
  | { kind: 'standard'; predefinedBenefitId: string; creditCardId: string }
  | { kind: 'bridge'; predefinedBenefitId: string; creditCardId: string; legacyBenefitId: string }
  | { kind: 'custom'; benefitId: string; creditCardId: string | null }
  | { kind: 'legacy'; benefitId: string; creditCardId: string | null };

export interface EffectiveCreditCard {
  id: string;
  name: string;
  issuer: string;
  cardNumber: string | null;
  expiryDate: Date | null;
  openedDate: Date | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  lastFourDigits: string | null;
  nickname: string | null;
  lifecycleStatus: string;
  closedDate: Date | null;
  annualFeeAmount: number | null;
  annualFeeDueDate: Date | null;
  signupBonusDeadline: Date | null;
  spendDeadline: Date | null;
  productChangedFrom: string | null;
  productChangedTo: string | null;
  lifecycleNotes: string | null;
  productKey: string | null;
  predefinedCardId: string | null;
}

/**
 * Compatibility definition returned to existing browser components. Standard
 * definitions intentionally use the canonical predefined-benefit ID and fields.
 */
export interface EffectiveBenefitDefinition {
  id: string;
  category: string;
  description: string;
  percentage: number;
  maxAmount: number | null;
  startDate: Date;
  endDate: Date | null;
  frequency: BenefitFrequency;
  creditCardId: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  cycleAlignment: BenefitCycleAlignment | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number | null;
  productKey: string | null;
  creditFamilyKey: string | null;
  periodKey: string | null;
  creditCard: EffectiveCreditCard | null;
}

export interface EffectiveBenefitStatus {
  id: string;
  benefitId: string;
  creditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  usedAmount: number | null;
  createdAt: Date;
  updatedAt: Date;
  orderIndex: number | null;
  occurrenceIndex: number;
  benefit: EffectiveBenefitDefinition;
  source: EffectiveBenefitSource;
  usageWaySlug: string | null;
  isCustomBenefit: boolean;
  canMutateDefinition: boolean;
}

export function resolveAuthoritativeDefinition<TLegacy, TGlobal>(relations: {
  benefit: TLegacy | null;
  predefinedBenefit: TGlobal | null;
}): TLegacy | TGlobal {
  const definition = relations.predefinedBenefit ?? relations.benefit;
  if (!definition) throw new Error('Benefit status has no definition source.');
  return definition;
}

export interface EffectiveBenefitStatusFilters {
  userId?: string;
  userIds?: string[];
  cycleStartOnOrBefore?: Date;
  cycleStartOnOrAfter?: Date;
  cycleEndOnOrBefore?: Date;
  cycleEndOnOrAfter?: Date;
  completed?: boolean;
  notUsable?: boolean;
}

type EffectiveBenefitDatabase = Pick<PrismaClient, '$queryRaw'>;

export interface EffectiveCardTerms {
  creditCardId: string;
  name: string;
  issuer: string;
  annualFee: number;
  imageUrl: string | null;
}

export async function fetchEffectiveCardTerms(
  database: EffectiveBenefitDatabase,
  userId: string
): Promise<EffectiveCardTerms[]> {
  if (!userId) throw new Error('An owned userId is required.');

  return database.$queryRaw<EffectiveCardTerms[]>(Prisma.sql`
    SELECT
      c."id" AS "creditCardId",
      COALESCE(pc."name", fallback."name", c."name") AS "name",
      COALESCE(pc."issuer", fallback."issuer", c."issuer") AS "issuer",
      COALESCE(pc."annualFee", fallback."annualFee", c."annualFeeAmount", 0)::float8 AS "annualFee",
      COALESCE(pc."imageUrl", fallback."imageUrl") AS "imageUrl"
    FROM "CreditCard" c
    LEFT JOIN "PredefinedCard" pc ON pc."id" = c."predefinedCardId"
    LEFT JOIN "PredefinedCard" fallback
      ON c."predefinedCardId" IS NULL
      AND fallback."name" = c."name"
      AND fallback."issuer" = c."issuer"
    WHERE c."userId" = ${userId}
    ORDER BY c."id"
  `);
}

interface EffectiveBenefitRow {
  statusId: string;
  benefitId: string | null;
  statusCreditCardId: string | null;
  predefinedBenefitId: string | null;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  isCompleted: boolean;
  completedAt: Date | null;
  isNotUsable: boolean;
  usedAmount: number | null;
  statusCreatedAt: Date;
  statusUpdatedAt: Date;
  orderIndex: number | null;
  occurrenceIndex: number;

  legacyId: string | null;
  legacyCategory: string | null;
  legacyDescription: string | null;
  legacyPercentage: number | null;
  legacyMaxAmount: number | null;
  legacyStartDate: Date | null;
  legacyEndDate: Date | null;
  legacyFrequency: BenefitFrequency | null;
  legacyCreditCardId: string | null;
  legacyUserId: string | null;
  legacyCreatedAt: Date | null;
  legacyUpdatedAt: Date | null;
  legacyCycleAlignment: BenefitCycleAlignment | null;
  legacyFixedCycleStartMonth: number | null;
  legacyFixedCycleDurationMonths: number | null;
  legacyOccurrencesInCycle: number | null;
  legacyProductKey: string | null;
  legacyCreditFamilyKey: string | null;
  legacyPeriodKey: string | null;

  globalId: string | null;
  globalCatalogKey: string | null;
  globalPredefinedCardId: string | null;
  globalCategory: string | null;
  globalDescription: string | null;
  globalPercentage: number | null;
  globalMaxAmount: number | null;
  globalFrequency: BenefitFrequency | null;
  globalCreatedAt: Date | null;
  globalUpdatedAt: Date | null;
  globalCycleAlignment: BenefitCycleAlignment | null;
  globalFixedCycleStartMonth: number | null;
  globalFixedCycleDurationMonths: number | null;
  globalOccurrencesInCycle: number | null;
  globalProductKey: string | null;
  globalCreditFamilyKey: string | null;
  globalPeriodKey: string | null;
  globalRetiredAt: Date | null;
  globalUsageWaySlug: string | null;
  migrationLedgerId: string | null;
  migrationLegacyBenefitId: string | null;
  migrationUserId: string | null;
  migrationCreditCardId: string | null;
  migrationPredefinedCardId: string | null;
  migrationPredefinedBenefitId: string | null;
  migrationClassification: 'STANDARD' | 'CUSTOM' | null;
  migrationPhase: string | null;
  migrationDestinationFingerprint: string | null;
  repairId: string | null;
  repairLegacyBenefitId: string | null;
  repairLedgerId: string | null;
  repairUserId: string | null;
  repairCreditCardId: string | null;
  repairPredefinedCardId: string | null;
  repairPredefinedBenefitId: string | null;
  repairTargetCardCatalogKey: string | null;
  repairTargetBenefitCatalogKey: string | null;
  repairDefinitionFingerprint: string | null;
  repairEvidenceVersion: number | null;
  repairPhase: string | null;
  repairRolledBackAt: Date | null;
  occurrenceRepairId: string | null;
  occurrenceUserId: string | null;
  occurrenceCreditCardId: string | null;
  occurrencePredefinedBenefitId: string | null;
  occurrenceTargetBenefitCatalogKey: string | null;
  occurrenceAction: string | null;
  occurrenceKeeperSource: string | null;
  occurrenceKeeperStatusId: string | null;
  occurrenceCycleStartDate: Date | null;
  occurrenceCycleEndDate: Date | null;
  occurrenceIndexEvidence: number | null;
  occurrenceKeeperBaselineVersion: number | null;
  occurrenceRemovedPreimageVersion: number | null;
  occurrenceAuditMetadataVersion: number | null;

  cardId: string | null;
  cardName: string | null;
  cardIssuer: string | null;
  cardNumber: string | null;
  cardExpiryDate: Date | null;
  cardOpenedDate: Date | null;
  cardUserId: string | null;
  cardCreatedAt: Date | null;
  cardUpdatedAt: Date | null;
  cardLastFourDigits: string | null;
  cardNickname: string | null;
  cardLifecycleStatus: string | null;
  cardClosedDate: Date | null;
  cardAnnualFeeAmount: number | null;
  cardAnnualFeeDueDate: Date | null;
  cardSignupBonusDeadline: Date | null;
  cardSpendDeadline: Date | null;
  cardProductChangedFrom: string | null;
  cardProductChangedTo: string | null;
  cardLifecycleNotes: string | null;
  cardProductKey: string | null;
  cardPredefinedCardId: string | null;
  productCatalogKey: string | null;
  productName: string | null;
  productIssuer: string | null;
  productProductKey: string | null;
  productRetiredAt: Date | null;
}

export async function fetchEffectiveBenefitStatuses(
  database: EffectiveBenefitDatabase,
  filters: EffectiveBenefitStatusFilters
): Promise<EffectiveBenefitStatus[]> {
  if (filters.userId === undefined && filters.userIds === undefined) {
    throw new Error('An owned userId or userIds filter is required.');
  }
  if (filters.userId && filters.userIds) {
    throw new Error('Specify either userId or userIds, not both.');
  }
  if (filters.userIds?.length === 0) return [];

  const predicates: Prisma.Sql[] = [];
  if (filters.userId) predicates.push(Prisma.sql`bs."userId" = ${filters.userId}`);
  if (filters.userIds) predicates.push(Prisma.sql`bs."userId" IN (${Prisma.join(filters.userIds)})`);
  if (filters.cycleStartOnOrBefore) predicates.push(Prisma.sql`bs."cycleStartDate" <= ${filters.cycleStartOnOrBefore}`);
  if (filters.cycleStartOnOrAfter) predicates.push(Prisma.sql`bs."cycleStartDate" >= ${filters.cycleStartOnOrAfter}`);
  if (filters.cycleEndOnOrBefore) predicates.push(Prisma.sql`bs."cycleEndDate" <= ${filters.cycleEndOnOrBefore}`);
  if (filters.cycleEndOnOrAfter) predicates.push(Prisma.sql`bs."cycleEndDate" >= ${filters.cycleEndOnOrAfter}`);
  if (filters.completed !== undefined) predicates.push(Prisma.sql`bs."isCompleted" = ${filters.completed}`);
  if (filters.notUsable !== undefined) predicates.push(Prisma.sql`bs."isNotUsable" = ${filters.notUsable}`);

  const where = predicates.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(predicates, ' AND ')}`
    : Prisma.empty;

  const rows = await database.$queryRaw<EffectiveBenefitRow[]>(Prisma.sql`
    SELECT
      bs."id" AS "statusId",
      bs."benefitId",
      bs."creditCardId" AS "statusCreditCardId",
      bs."predefinedBenefitId",
      bs."userId",
      bs."cycleStartDate",
      bs."cycleEndDate",
      bs."isCompleted",
      bs."completedAt",
      bs."isNotUsable",
      bs."usedAmount",
      bs."createdAt" AS "statusCreatedAt",
      bs."updatedAt" AS "statusUpdatedAt",
      bs."orderIndex",
      bs."occurrenceIndex",

      b."id" AS "legacyId",
      b."category" AS "legacyCategory",
      b."description" AS "legacyDescription",
      b."percentage" AS "legacyPercentage",
      b."maxAmount" AS "legacyMaxAmount",
      b."startDate" AS "legacyStartDate",
      b."endDate" AS "legacyEndDate",
      b."frequency" AS "legacyFrequency",
      b."creditCardId" AS "legacyCreditCardId",
      b."userId" AS "legacyUserId",
      b."createdAt" AS "legacyCreatedAt",
      b."updatedAt" AS "legacyUpdatedAt",
      b."cycleAlignment" AS "legacyCycleAlignment",
      b."fixedCycleStartMonth" AS "legacyFixedCycleStartMonth",
      b."fixedCycleDurationMonths" AS "legacyFixedCycleDurationMonths",
      b."occurrencesInCycle" AS "legacyOccurrencesInCycle",
      b."productKey" AS "legacyProductKey",
      b."creditFamilyKey" AS "legacyCreditFamilyKey",
      b."periodKey" AS "legacyPeriodKey",

      pb."id" AS "globalId",
      pb."catalogKey" AS "globalCatalogKey",
      pb."predefinedCardId" AS "globalPredefinedCardId",
      pb."category" AS "globalCategory",
      pb."description" AS "globalDescription",
      pb."percentage" AS "globalPercentage",
      pb."maxAmount" AS "globalMaxAmount",
      pb."frequency" AS "globalFrequency",
      pb."createdAt" AS "globalCreatedAt",
      pb."updatedAt" AS "globalUpdatedAt",
      pb."cycleAlignment" AS "globalCycleAlignment",
      pb."fixedCycleStartMonth" AS "globalFixedCycleStartMonth",
      pb."fixedCycleDurationMonths" AS "globalFixedCycleDurationMonths",
      pb."occurrencesInCycle" AS "globalOccurrencesInCycle",
      pb."productKey" AS "globalProductKey",
      pb."creditFamilyKey" AS "globalCreditFamilyKey",
      pb."periodKey" AS "globalPeriodKey",
      pb."retiredAt" AS "globalRetiredAt",
      uw."slug" AS "globalUsageWaySlug",
      ledger."id" AS "migrationLedgerId",
      ledger."legacyBenefitId" AS "migrationLegacyBenefitId",
      ledger."userId" AS "migrationUserId",
      ledger."creditCardId" AS "migrationCreditCardId",
      ledger."predefinedCardId" AS "migrationPredefinedCardId",
      ledger."predefinedBenefitId" AS "migrationPredefinedBenefitId",
      ledger."classification"::text AS "migrationClassification",
      ledger."phase"::text AS "migrationPhase",
      ledger."destinationFingerprint" AS "migrationDestinationFingerprint",
      repair."id" AS "repairId",
      repair."legacyBenefitId" AS "repairLegacyBenefitId",
      repair."catalogMigrationLedgerId" AS "repairLedgerId",
      repair."userId" AS "repairUserId",
      repair."creditCardId" AS "repairCreditCardId",
      repair."predefinedCardId" AS "repairPredefinedCardId",
      repair."predefinedBenefitId" AS "repairPredefinedBenefitId",
      repair."targetPredefinedCardCatalogKey" AS "repairTargetCardCatalogKey",
      repair."targetPredefinedBenefitCatalogKey" AS "repairTargetBenefitCatalogKey",
      repair."definitionFingerprint" AS "repairDefinitionFingerprint",
      repair."evidenceVersion" AS "repairEvidenceVersion",
      repair."phase"::text AS "repairPhase",
      repair."rolledBackAt" AS "repairRolledBackAt",
      occurrence."repairId" AS "occurrenceRepairId",
      occurrence."userId" AS "occurrenceUserId",
      occurrence."creditCardId" AS "occurrenceCreditCardId",
      occurrence."predefinedBenefitId" AS "occurrencePredefinedBenefitId",
      occurrence."targetPredefinedBenefitCatalogKey" AS "occurrenceTargetBenefitCatalogKey",
      occurrence."action"::text AS "occurrenceAction",
      occurrence."keeperSource"::text AS "occurrenceKeeperSource",
      occurrence."keeperStatusId" AS "occurrenceKeeperStatusId",
      occurrence."cycleStartDate" AS "occurrenceCycleStartDate",
      occurrence."cycleEndDate" AS "occurrenceCycleEndDate",
      occurrence."occurrenceIndex" AS "occurrenceIndexEvidence",
      occurrence."keeperBaselineVersion" AS "occurrenceKeeperBaselineVersion",
      occurrence."removedStatusPreimageVersion" AS "occurrenceRemovedPreimageVersion",
      occurrence."repairAddedAuditMetadataVersion" AS "occurrenceAuditMetadataVersion",

      c."id" AS "cardId",
      COALESCE(pc."name", c."name") AS "cardName",
      COALESCE(pc."issuer", c."issuer") AS "cardIssuer",
      c."cardNumber" AS "cardNumber",
      c."expiryDate" AS "cardExpiryDate",
      c."openedDate" AS "cardOpenedDate",
      c."userId" AS "cardUserId",
      c."createdAt" AS "cardCreatedAt",
      c."updatedAt" AS "cardUpdatedAt",
      c."lastFourDigits" AS "cardLastFourDigits",
      c."nickname" AS "cardNickname",
      c."lifecycleStatus"::text AS "cardLifecycleStatus",
      c."closedDate" AS "cardClosedDate",
      c."annualFeeAmount" AS "cardAnnualFeeAmount",
      c."annualFeeDueDate" AS "cardAnnualFeeDueDate",
      c."signupBonusDeadline" AS "cardSignupBonusDeadline",
      c."spendDeadline" AS "cardSpendDeadline",
      c."productChangedFrom" AS "cardProductChangedFrom",
      c."productChangedTo" AS "cardProductChangedTo",
      c."lifecycleNotes" AS "cardLifecycleNotes",
      c."productKey" AS "cardProductKey",
      c."predefinedCardId" AS "cardPredefinedCardId",
      pc."catalogKey" AS "productCatalogKey",
      pc."name" AS "productName",
      pc."issuer" AS "productIssuer",
      pc."productKey" AS "productProductKey",
      pc."retiredAt" AS "productRetiredAt"
    FROM "BenefitStatus" bs
    LEFT JOIN "Benefit" b ON b."id" = bs."benefitId"
    LEFT JOIN "PredefinedBenefit" pb ON pb."id" = bs."predefinedBenefitId"
    LEFT JOIN "BenefitUsageWay" uw ON uw."id" = pb."usageWayId"
    LEFT JOIN "CatalogMigrationLedger" ledger ON ledger."legacyBenefitId" = b."id"
    LEFT JOIN "GlobalBenefitCategoryRepair" repair ON repair."legacyBenefitId" = b."id"
    LEFT JOIN "GlobalBenefitCategoryRepairOccurrence" occurrence
      ON occurrence."repairId" = repair."id"
      AND occurrence."keeperStatusId" = bs."id"
    LEFT JOIN "CreditCard" c
      ON c."id" = COALESCE(bs."creditCardId", b."creditCardId")
      AND c."userId" = bs."userId"
    LEFT JOIN "PredefinedCard" pc ON pc."id" = c."predefinedCardId"
    ${where}
    ORDER BY bs."orderIndex" ASC NULLS LAST, bs."cycleEndDate" ASC, bs."id" ASC
  `);

  return rows.map(projectEffectiveBenefitRow);
}

export async function findEffectiveBenefitStatus(
  database: EffectiveBenefitDatabase,
  userId: string,
  statusId: string
): Promise<EffectiveBenefitStatus | null> {
  const rows = await database.$queryRaw<EffectiveBenefitRow[]>(Prisma.sql`
    SELECT
      bs."id" AS "statusId",
      bs."benefitId",
      bs."creditCardId" AS "statusCreditCardId",
      bs."predefinedBenefitId",
      bs."userId",
      bs."cycleStartDate",
      bs."cycleEndDate",
      bs."isCompleted",
      bs."completedAt",
      bs."isNotUsable",
      bs."usedAmount",
      bs."createdAt" AS "statusCreatedAt",
      bs."updatedAt" AS "statusUpdatedAt",
      bs."orderIndex",
      bs."occurrenceIndex",
      b."id" AS "legacyId",
      b."category" AS "legacyCategory",
      b."description" AS "legacyDescription",
      b."percentage" AS "legacyPercentage",
      b."maxAmount" AS "legacyMaxAmount",
      b."startDate" AS "legacyStartDate",
      b."endDate" AS "legacyEndDate",
      b."frequency" AS "legacyFrequency",
      b."creditCardId" AS "legacyCreditCardId",
      b."userId" AS "legacyUserId",
      b."createdAt" AS "legacyCreatedAt",
      b."updatedAt" AS "legacyUpdatedAt",
      b."cycleAlignment" AS "legacyCycleAlignment",
      b."fixedCycleStartMonth" AS "legacyFixedCycleStartMonth",
      b."fixedCycleDurationMonths" AS "legacyFixedCycleDurationMonths",
      b."occurrencesInCycle" AS "legacyOccurrencesInCycle",
      b."productKey" AS "legacyProductKey",
      b."creditFamilyKey" AS "legacyCreditFamilyKey",
      b."periodKey" AS "legacyPeriodKey",
      pb."id" AS "globalId",
      pb."catalogKey" AS "globalCatalogKey",
      pb."predefinedCardId" AS "globalPredefinedCardId",
      pb."category" AS "globalCategory",
      pb."description" AS "globalDescription",
      pb."percentage" AS "globalPercentage",
      pb."maxAmount" AS "globalMaxAmount",
      pb."frequency" AS "globalFrequency",
      pb."createdAt" AS "globalCreatedAt",
      pb."updatedAt" AS "globalUpdatedAt",
      pb."cycleAlignment" AS "globalCycleAlignment",
      pb."fixedCycleStartMonth" AS "globalFixedCycleStartMonth",
      pb."fixedCycleDurationMonths" AS "globalFixedCycleDurationMonths",
      pb."occurrencesInCycle" AS "globalOccurrencesInCycle",
      pb."productKey" AS "globalProductKey",
      pb."creditFamilyKey" AS "globalCreditFamilyKey",
      pb."periodKey" AS "globalPeriodKey",
      pb."retiredAt" AS "globalRetiredAt",
      uw."slug" AS "globalUsageWaySlug",
      ledger."id" AS "migrationLedgerId",
      ledger."legacyBenefitId" AS "migrationLegacyBenefitId",
      ledger."userId" AS "migrationUserId",
      ledger."creditCardId" AS "migrationCreditCardId",
      ledger."predefinedCardId" AS "migrationPredefinedCardId",
      ledger."predefinedBenefitId" AS "migrationPredefinedBenefitId",
      ledger."classification"::text AS "migrationClassification",
      ledger."phase"::text AS "migrationPhase",
      ledger."destinationFingerprint" AS "migrationDestinationFingerprint",
      repair."id" AS "repairId",
      repair."legacyBenefitId" AS "repairLegacyBenefitId",
      repair."catalogMigrationLedgerId" AS "repairLedgerId",
      repair."userId" AS "repairUserId",
      repair."creditCardId" AS "repairCreditCardId",
      repair."predefinedCardId" AS "repairPredefinedCardId",
      repair."predefinedBenefitId" AS "repairPredefinedBenefitId",
      repair."targetPredefinedCardCatalogKey" AS "repairTargetCardCatalogKey",
      repair."targetPredefinedBenefitCatalogKey" AS "repairTargetBenefitCatalogKey",
      repair."definitionFingerprint" AS "repairDefinitionFingerprint",
      repair."evidenceVersion" AS "repairEvidenceVersion",
      repair."phase"::text AS "repairPhase",
      repair."rolledBackAt" AS "repairRolledBackAt",
      occurrence."repairId" AS "occurrenceRepairId",
      occurrence."userId" AS "occurrenceUserId",
      occurrence."creditCardId" AS "occurrenceCreditCardId",
      occurrence."predefinedBenefitId" AS "occurrencePredefinedBenefitId",
      occurrence."targetPredefinedBenefitCatalogKey" AS "occurrenceTargetBenefitCatalogKey",
      occurrence."action"::text AS "occurrenceAction",
      occurrence."keeperSource"::text AS "occurrenceKeeperSource",
      occurrence."keeperStatusId" AS "occurrenceKeeperStatusId",
      occurrence."cycleStartDate" AS "occurrenceCycleStartDate",
      occurrence."cycleEndDate" AS "occurrenceCycleEndDate",
      occurrence."occurrenceIndex" AS "occurrenceIndexEvidence",
      occurrence."keeperBaselineVersion" AS "occurrenceKeeperBaselineVersion",
      occurrence."removedStatusPreimageVersion" AS "occurrenceRemovedPreimageVersion",
      occurrence."repairAddedAuditMetadataVersion" AS "occurrenceAuditMetadataVersion",
      c."id" AS "cardId",
      COALESCE(pc."name", c."name") AS "cardName",
      COALESCE(pc."issuer", c."issuer") AS "cardIssuer",
      c."cardNumber" AS "cardNumber",
      c."expiryDate" AS "cardExpiryDate",
      c."openedDate" AS "cardOpenedDate",
      c."userId" AS "cardUserId",
      c."createdAt" AS "cardCreatedAt",
      c."updatedAt" AS "cardUpdatedAt",
      c."lastFourDigits" AS "cardLastFourDigits",
      c."nickname" AS "cardNickname",
      c."lifecycleStatus"::text AS "cardLifecycleStatus",
      c."closedDate" AS "cardClosedDate",
      c."annualFeeAmount" AS "cardAnnualFeeAmount",
      c."annualFeeDueDate" AS "cardAnnualFeeDueDate",
      c."signupBonusDeadline" AS "cardSignupBonusDeadline",
      c."spendDeadline" AS "cardSpendDeadline",
      c."productChangedFrom" AS "cardProductChangedFrom",
      c."productChangedTo" AS "cardProductChangedTo",
      c."lifecycleNotes" AS "cardLifecycleNotes",
      c."productKey" AS "cardProductKey",
      c."predefinedCardId" AS "cardPredefinedCardId",
      pc."catalogKey" AS "productCatalogKey",
      pc."name" AS "productName",
      pc."issuer" AS "productIssuer",
      pc."productKey" AS "productProductKey",
      pc."retiredAt" AS "productRetiredAt"
    FROM "BenefitStatus" bs
    LEFT JOIN "Benefit" b ON b."id" = bs."benefitId"
    LEFT JOIN "PredefinedBenefit" pb ON pb."id" = bs."predefinedBenefitId"
    LEFT JOIN "BenefitUsageWay" uw ON uw."id" = pb."usageWayId"
    LEFT JOIN "CatalogMigrationLedger" ledger ON ledger."legacyBenefitId" = b."id"
    LEFT JOIN "GlobalBenefitCategoryRepair" repair ON repair."legacyBenefitId" = b."id"
    LEFT JOIN "GlobalBenefitCategoryRepairOccurrence" occurrence
      ON occurrence."repairId" = repair."id"
      AND occurrence."keeperStatusId" = bs."id"
    LEFT JOIN "CreditCard" c
      ON c."id" = COALESCE(bs."creditCardId", b."creditCardId")
      AND c."userId" = bs."userId"
    LEFT JOIN "PredefinedCard" pc ON pc."id" = c."predefinedCardId"
    WHERE bs."id" = ${statusId} AND bs."userId" = ${userId}
    LIMIT 1
  `);

  return rows[0] ? projectEffectiveBenefitRow(rows[0]) : null;
}

function categoryRepairAuthorityForRow(row: EffectiveBenefitRow): ReturnType<typeof classifyGlobalBenefitCategoryRepairAuthority> {
  if (!row.benefitId || !row.globalId || !row.globalCatalogKey || !row.globalPredefinedCardId
    || !row.productCatalogKey || !row.productName || !row.productIssuer
    || !row.cardId || !row.cardUserId || !row.migrationLedgerId
    || !row.migrationLegacyBenefitId || !row.migrationUserId || !row.repairId
    || !row.repairLegacyBenefitId || !row.repairLedgerId || !row.repairUserId
    || !row.repairCreditCardId || !row.repairPredefinedCardId
    || !row.repairPredefinedBenefitId || !row.repairTargetCardCatalogKey
    || !row.repairTargetBenefitCatalogKey || !row.repairDefinitionFingerprint
    || row.repairEvidenceVersion === null || !row.repairPhase) return row.repairId ? 'APPLIED_INVALID' : 'NONE';

  const benefit: GlobalBenefitDefinition = {
    id: row.globalId,
    catalogKey: row.globalCatalogKey,
    predefinedCardId: row.globalPredefinedCardId,
    category: required(row.globalCategory, 'global category', row.statusId),
    description: required(row.globalDescription, 'global description', row.statusId),
    percentage: requiredNumber(row.globalPercentage, 'global percentage', row.statusId),
    maxAmount: row.globalMaxAmount,
    frequency: required(row.globalFrequency, 'global frequency', row.statusId),
    cycleAlignment: row.globalCycleAlignment,
    fixedCycleStartMonth: row.globalFixedCycleStartMonth,
    fixedCycleDurationMonths: row.globalFixedCycleDurationMonths,
    occurrencesInCycle: row.globalOccurrencesInCycle ?? 1,
    productKey: row.globalProductKey,
    creditFamilyKey: row.globalCreditFamilyKey,
    periodKey: row.globalPeriodKey,
    retiredAt: row.globalRetiredAt,
  };
  const product: GlobalCardDefinition = {
    id: row.globalPredefinedCardId,
    catalogKey: row.productCatalogKey,
    name: row.productName,
    issuer: row.productIssuer,
    productKey: row.productProductKey,
    retiredAt: row.productRetiredAt,
    benefits: [benefit],
  };
  const occurrence = row.occurrenceRepairId && row.occurrenceUserId
    && row.occurrenceCreditCardId && row.occurrencePredefinedBenefitId
    && row.occurrenceTargetBenefitCatalogKey && row.occurrenceAction
    && row.occurrenceKeeperSource && row.occurrenceKeeperStatusId
    && row.occurrenceCycleStartDate && row.occurrenceCycleEndDate
    && row.occurrenceIndexEvidence !== null
    && row.occurrenceKeeperBaselineVersion !== null
    && row.occurrenceAuditMetadataVersion !== null
    ? {
        repairId: row.occurrenceRepairId,
        userId: row.occurrenceUserId,
        creditCardId: row.occurrenceCreditCardId,
        predefinedBenefitId: row.occurrencePredefinedBenefitId,
        targetPredefinedBenefitCatalogKey: row.occurrenceTargetBenefitCatalogKey,
        action: row.occurrenceAction,
        keeperSource: row.occurrenceKeeperSource,
        keeperStatusId: row.occurrenceKeeperStatusId,
        cycleStartDate: row.occurrenceCycleStartDate,
        cycleEndDate: row.occurrenceCycleEndDate,
        occurrenceIndex: row.occurrenceIndexEvidence,
        keeperBaselineVersion: row.occurrenceKeeperBaselineVersion,
        removedStatusPreimageVersion: row.occurrenceRemovedPreimageVersion,
        repairAddedAuditMetadataVersion: row.occurrenceAuditMetadataVersion,
      }
    : null;
  return classifyGlobalBenefitCategoryRepairAuthority({
    sourceBenefitId: row.benefitId,
    ledger: {
      id: row.migrationLedgerId,
      legacyBenefitId: row.migrationLegacyBenefitId,
      userId: row.migrationUserId,
      creditCardId: row.migrationCreditCardId,
      predefinedCardId: row.migrationPredefinedCardId,
      predefinedBenefitId: row.migrationPredefinedBenefitId,
      classification: row.migrationClassification ?? '',
      phase: row.migrationPhase ?? '',
      destinationFingerprint: row.migrationDestinationFingerprint,
    },
    repair: {
      id: row.repairId,
      legacyBenefitId: row.repairLegacyBenefitId,
      catalogMigrationLedgerId: row.repairLedgerId,
      userId: row.repairUserId,
      creditCardId: row.repairCreditCardId,
      predefinedCardId: row.repairPredefinedCardId,
      predefinedBenefitId: row.repairPredefinedBenefitId,
      targetPredefinedCardCatalogKey: row.repairTargetCardCatalogKey,
      targetPredefinedBenefitCatalogKey: row.repairTargetBenefitCatalogKey,
      definitionFingerprint: row.repairDefinitionFingerprint,
      evidenceVersion: row.repairEvidenceVersion,
      phase: row.repairPhase,
      rolledBackAt: row.repairRolledBackAt,
    },
    card: { id: row.cardId, userId: row.cardUserId, predefinedCardId: row.cardPredefinedCardId },
    product,
    benefit,
    status: {
      id: row.statusId,
      benefitId: row.benefitId,
      creditCardId: row.statusCreditCardId,
      predefinedBenefitId: row.predefinedBenefitId,
      userId: row.userId,
      cycleStartDate: row.cycleStartDate,
      cycleEndDate: row.cycleEndDate,
      occurrenceIndex: row.occurrenceIndex,
    },
    occurrence,
  });
}

export function projectEffectiveBenefitRow(row: EffectiveBenefitRow): EffectiveBenefitStatus {
  const card = projectCard(row);
  const hasGlobal = row.predefinedBenefitId !== null;

  if (hasGlobal) {
    if (!row.globalId || !row.statusCreditCardId || !card) {
      throw new Error(`Invalid standard benefit status source for status ${row.statusId}.`);
    }
    if (card.predefinedCardId === null) {
      throw new Error(`Standard benefit status ${row.statusId} is linked to a card without a global product.`);
    }
    if (row.globalPredefinedCardId !== card.predefinedCardId) {
      throw new Error(`Standard benefit status ${row.statusId} links definitions from different global products.`);
    }
    if (row.benefitId) {
      const strictBridge = row.migrationLegacyBenefitId === row.benefitId
        && row.migrationUserId === row.userId
        && row.migrationCreditCardId === card.id
        && row.migrationPredefinedCardId === card.predefinedCardId
        && row.migrationPredefinedBenefitId === row.globalId
        && row.migrationClassification === 'STANDARD'
        && row.migrationPhase === 'BRIDGED';
      const repairAuthority = categoryRepairAuthorityForRow(row);
      if (!strictBridge && repairAuthority !== 'APPLIED_VALID') {
        throw new Error(`Benefit status ${row.statusId} has an invalid retained-benefit global authority.`);
      }
    }

    const source: EffectiveBenefitSource = row.benefitId
      ? {
          kind: 'bridge',
          predefinedBenefitId: row.globalId,
          creditCardId: card.id,
          legacyBenefitId: row.benefitId,
        }
      : {
          kind: 'standard',
          predefinedBenefitId: row.globalId,
          creditCardId: card.id,
        };

    return {
      ...projectStatusState(row),
      benefitId: row.benefitId ?? `standard:${row.globalId}`,
      creditCardId: card.id,
      predefinedBenefitId: row.globalId,
      benefit: {
        id: row.globalId,
        category: required(row.globalCategory, 'global category', row.statusId),
        description: required(row.globalDescription, 'global description', row.statusId),
        percentage: requiredNumber(row.globalPercentage, 'global percentage', row.statusId),
        maxAmount: row.globalMaxAmount,
        // Keep definition metadata stable across status cycles. Cycle boundaries
        // remain available only on the status DTO.
        startDate: card.openedDate ?? required(row.globalCreatedAt, 'global createdAt', row.statusId),
        endDate: null,
        frequency: required(row.globalFrequency, 'global frequency', row.statusId),
        creditCardId: card.id,
        userId: null,
        createdAt: required(row.globalCreatedAt, 'global createdAt', row.statusId),
        updatedAt: required(row.globalUpdatedAt, 'global updatedAt', row.statusId),
        cycleAlignment: row.globalCycleAlignment,
        fixedCycleStartMonth: row.globalFixedCycleStartMonth,
        fixedCycleDurationMonths: row.globalFixedCycleDurationMonths,
        occurrencesInCycle: row.globalOccurrencesInCycle,
        productKey: row.globalProductKey,
        creditFamilyKey: row.globalCreditFamilyKey,
        periodKey: row.globalPeriodKey,
        creditCard: card,
      },
      source,
      usageWaySlug: row.globalUsageWaySlug,
      isCustomBenefit: false,
      canMutateDefinition: false,
    };
  }

  if (!row.legacyId || !row.benefitId) {
    throw new Error(`Benefit status ${row.statusId} has no definition source.`);
  }
  if (row.legacyUserId !== null && row.legacyUserId !== row.userId) {
    throw new Error(`Custom benefit status ${row.statusId} has inconsistent ownership.`);
  }
  if (row.legacyCreditCardId !== null && !card) {
    throw new Error(`Benefit status ${row.statusId} references a card not owned by its user.`);
  }

  // A classifier-proven standard remains read-only even during the short
  // CLASSIFIED-before-BRIDGED window. Ownership alone is not sufficient to
  // grant definition mutation authority to a legacy row.
  const isCustom =
    row.migrationClassification === 'CUSTOM' ||
    (row.legacyUserId === row.userId && row.migrationClassification !== 'STANDARD');
  const source: EffectiveBenefitSource = isCustom
    ? { kind: 'custom', benefitId: row.legacyId, creditCardId: card?.id ?? null }
    : { kind: 'legacy', benefitId: row.legacyId, creditCardId: card?.id ?? null };

  return {
    ...projectStatusState(row),
    benefitId: row.legacyId,
    creditCardId: card?.id ?? null,
    predefinedBenefitId: null,
    benefit: {
      id: row.legacyId,
      category: required(row.legacyCategory, 'legacy category', row.statusId),
      description: required(row.legacyDescription, 'legacy description', row.statusId),
      percentage: requiredNumber(row.legacyPercentage, 'legacy percentage', row.statusId),
      maxAmount: row.legacyMaxAmount,
      startDate: required(row.legacyStartDate, 'legacy startDate', row.statusId),
      endDate: row.legacyEndDate,
      frequency: required(row.legacyFrequency, 'legacy frequency', row.statusId),
      creditCardId: card?.id ?? null,
      userId: row.legacyUserId,
      createdAt: required(row.legacyCreatedAt, 'legacy createdAt', row.statusId),
      updatedAt: required(row.legacyUpdatedAt, 'legacy updatedAt', row.statusId),
      cycleAlignment: row.legacyCycleAlignment,
      fixedCycleStartMonth: row.legacyFixedCycleStartMonth,
      fixedCycleDurationMonths: row.legacyFixedCycleDurationMonths,
      occurrencesInCycle: row.legacyOccurrencesInCycle,
      productKey: row.legacyProductKey,
      creditFamilyKey: row.legacyCreditFamilyKey,
      periodKey: row.legacyPeriodKey,
      creditCard: card,
    },
    source,
    usageWaySlug: null,
    isCustomBenefit: isCustom,
    canMutateDefinition: isCustom,
  };
}

function projectStatusState(row: EffectiveBenefitRow) {
  return {
    id: row.statusId,
    userId: row.userId,
    cycleStartDate: row.cycleStartDate,
    cycleEndDate: row.cycleEndDate,
    isCompleted: row.isCompleted,
    completedAt: row.completedAt,
    isNotUsable: row.isNotUsable,
    usedAmount: row.usedAmount,
    createdAt: row.statusCreatedAt,
    updatedAt: row.statusUpdatedAt,
    orderIndex: row.orderIndex,
    occurrenceIndex: row.occurrenceIndex,
  };
}

function projectCard(row: EffectiveBenefitRow): EffectiveCreditCard | null {
  if (!row.cardId) return null;
  return {
    id: row.cardId,
    name: required(row.cardName, 'card name', row.statusId),
    issuer: required(row.cardIssuer, 'card issuer', row.statusId),
    cardNumber: row.cardNumber,
    expiryDate: row.cardExpiryDate,
    openedDate: row.cardOpenedDate,
    userId: required(row.cardUserId, 'card userId', row.statusId),
    createdAt: required(row.cardCreatedAt, 'card createdAt', row.statusId),
    updatedAt: required(row.cardUpdatedAt, 'card updatedAt', row.statusId),
    lastFourDigits: row.cardLastFourDigits,
    nickname: row.cardNickname,
    lifecycleStatus: required(row.cardLifecycleStatus, 'card lifecycleStatus', row.statusId),
    closedDate: row.cardClosedDate,
    annualFeeAmount: row.cardAnnualFeeAmount,
    annualFeeDueDate: row.cardAnnualFeeDueDate,
    signupBonusDeadline: row.cardSignupBonusDeadline,
    spendDeadline: row.cardSpendDeadline,
    productChangedFrom: row.cardProductChangedFrom,
    productChangedTo: row.cardProductChangedTo,
    lifecycleNotes: row.cardLifecycleNotes,
    productKey: row.cardProductKey,
    predefinedCardId: row.cardPredefinedCardId,
  };
}

function required<T>(value: T | null, label: string, statusId: string): T {
  if (value === null) throw new Error(`Missing ${label} for benefit status ${statusId}.`);
  return value;
}

function requiredNumber(value: number | null, label: string, statusId: string): number {
  return required(value, label, statusId);
}
