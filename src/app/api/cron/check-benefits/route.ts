import { NextResponse } from 'next/server';
import { BenefitFrequency, Prisma, type BenefitCycleAlignment } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import {
  planBenefitStatusMaterialization,
  type CustomMaterializationDefinition,
  type StandardMaterializationDefinition,
} from '@/lib/global-benefit-materialization';
import {
  INSERT_BATCH_SIZE,
  insertMissingBenefitStatuses,
} from '@/lib/cron/check-benefits';
import {
  amexSyncAuditRetentionCutoff,
  deleteExpiredAmexSyncRowAudits,
} from '@/lib/amex-sync/repository';
import { classifyGlobalBenefitCategoryRepairAuthority } from '@/lib/global-benefit-category-repair-authority';
import type { GlobalBenefitDefinition, GlobalCardDefinition } from '@/lib/global-benefit-migration';

export const maxDuration = 10;

const SOURCE_BATCH_SIZE = 500;

interface RawStandardDefinition {
  id: string;
  userId: string;
  creditCardId: string;
  cardOpenedDate: Date | null;
  description: string;
  frequency: BenefitFrequency;
  cycleAlignment: BenefitCycleAlignment | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number | null;
}

interface RawCustomDefinition {
  id: string;
  userId: string;
  cardOpenedDate: Date | null;
  startDate: Date;
  description: string;
  frequency: BenefitFrequency;
  cycleAlignment: BenefitCycleAlignment | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number | null;
}

interface RawCategoryRepairParent {
  sourceBenefitId: string;
  ledgerId: string;
  ledgerLegacyBenefitId: string;
  ledgerUserId: string;
  ledgerCreditCardId: string | null;
  ledgerPredefinedCardId: string | null;
  ledgerPredefinedBenefitId: string | null;
  ledgerClassification: string;
  ledgerPhase: string;
  ledgerDestinationFingerprint: string | null;
  repairId: string;
  repairLegacyBenefitId: string;
  repairLedgerId: string;
  repairUserId: string;
  repairCreditCardId: string;
  repairPredefinedCardId: string;
  repairPredefinedBenefitId: string;
  targetCardCatalogKey: string;
  targetBenefitCatalogKey: string;
  definitionFingerprint: string;
  evidenceVersion: number;
  repairPhase: string;
  repairRolledBackAt: Date | null;
  cardId: string;
  cardUserId: string;
  cardPredefinedCardId: string | null;
  productId: string;
  productCatalogKey: string;
  productName: string;
  productIssuer: string;
  productKey: string | null;
  productRetiredAt: Date | null;
  benefitId: string;
  benefitCatalogKey: string;
  benefitPredefinedCardId: string;
  benefitCategory: string;
  benefitDescription: string;
  benefitPercentage: number;
  benefitMaxAmount: number | null;
  benefitFrequency: string;
  benefitCycleAlignment: string | null;
  benefitFixedCycleStartMonth: number | null;
  benefitFixedCycleDurationMonths: number | null;
  benefitOccurrencesInCycle: number;
  benefitProductKey: string | null;
  benefitCreditFamilyKey: string | null;
  benefitPeriodKey: string | null;
  benefitRetiredAt: Date | null;
}

async function runCheckBenefitsLogic(dryRun = false) {
  const now = new Date();
  const startMs = Date.now();
  console.log(`check-benefits started at ${now.toISOString()}${dryRun ? ' [DRY RUN]' : ''}`);

  try {
    const [standardDefinitions, customAndLegacyCandidates] = await Promise.all([
      prisma.$queryRaw<RawStandardDefinition[]>`
        SELECT
          pb."id",
          c."userId",
          c."id" AS "creditCardId",
          c."openedDate" AS "cardOpenedDate",
          pb."description",
          pb."frequency",
          pb."cycleAlignment",
          pb."fixedCycleStartMonth",
          pb."fixedCycleDurationMonths",
          pb."occurrencesInCycle"
        FROM "CreditCard" c
        INNER JOIN "PredefinedCard" pc ON pc."id" = c."predefinedCardId"
        INNER JOIN "PredefinedBenefit" pb ON pb."predefinedCardId" = pc."id"
        WHERE c."lifecycleStatus" = 'ACTIVE'
          AND pc."retiredAt" IS NULL
          AND pb."retiredAt" IS NULL
          AND EXISTS (
            SELECT 1
            FROM generate_series(
              0,
              LEAST(GREATEST(COALESCE(pb."occurrencesInCycle", 1), 1), 13) - 1
            ) AS expected("occurrenceIndex")
            WHERE NOT EXISTS (
              SELECT 1
              FROM "BenefitStatus" bs
              WHERE bs."creditCardId" = c."id"
                AND bs."predefinedBenefitId" = pb."id"
                AND bs."userId" = c."userId"
                AND bs."occurrenceIndex" = expected."occurrenceIndex"
                AND (
                  pb."frequency" = ${BenefitFrequency.ONE_TIME}::"BenefitFrequency"
                  OR bs."cycleEndDate" >= ${now}
                )
            )
          )
        ORDER BY c."id", pb."id"
        LIMIT ${SOURCE_BATCH_SIZE}
      `,
      prisma.$queryRaw<RawCustomDefinition[]>`
        SELECT
          b."id",
          COALESCE(b."userId", c."userId") AS "userId",
          c."openedDate" AS "cardOpenedDate",
          b."startDate",
          b."description",
          b."frequency",
          b."cycleAlignment",
          b."fixedCycleStartMonth",
          b."fixedCycleDurationMonths",
          b."occurrencesInCycle"
        FROM "Benefit" b
        LEFT JOIN "CreditCard" c ON c."id" = b."creditCardId"
        WHERE b."frequency" <> ${BenefitFrequency.ONE_TIME}::"BenefitFrequency"
          AND COALESCE(b."userId", c."userId") IS NOT NULL
          AND (b."creditCardId" IS NULL OR c."lifecycleStatus" = 'ACTIVE')
          AND (b."userId" IS NULL OR b."creditCardId" IS NULL OR b."userId" = c."userId")
          AND NOT EXISTS (
            SELECT 1
            FROM "CatalogMigrationLedger" ledger
            WHERE ledger."legacyBenefitId" = b."id"
              AND ledger."classification" = 'STANDARD'
              AND ledger."phase" IN ('CLASSIFIED', 'BRIDGED', 'CLEANED')
          )
          AND EXISTS (
            SELECT 1
            FROM generate_series(
              0,
              LEAST(GREATEST(COALESCE(b."occurrencesInCycle", 1), 1), 13) - 1
            ) AS expected("occurrenceIndex")
            WHERE NOT EXISTS (
              SELECT 1
              FROM "BenefitStatus" bs
              WHERE bs."benefitId" = b."id"
                AND bs."userId" = COALESCE(b."userId", c."userId")
                AND bs."occurrenceIndex" = expected."occurrenceIndex"
                AND bs."cycleEndDate" >= ${now}
            )
          )
        ORDER BY EXISTS (
          SELECT 1
          FROM "GlobalBenefitCategoryRepair" repair_order
          WHERE repair_order."legacyBenefitId" = b."id"
            AND repair_order."phase" = 'APPLIED'
        ), b."id"
        LIMIT ${SOURCE_BATCH_SIZE}
      `,
    ]);

    const candidateBenefitIds = customAndLegacyCandidates.map((definition) => definition.id);
    const categoryRepairParents = candidateBenefitIds.length === 0
      ? []
      : await prisma.$queryRaw<RawCategoryRepairParent[]>`
        SELECT
          b."id" AS "sourceBenefitId",
          l."id" AS "ledgerId",
          l."legacyBenefitId" AS "ledgerLegacyBenefitId",
          l."userId" AS "ledgerUserId",
          l."creditCardId" AS "ledgerCreditCardId",
          l."predefinedCardId" AS "ledgerPredefinedCardId",
          l."predefinedBenefitId" AS "ledgerPredefinedBenefitId",
          l."classification"::text AS "ledgerClassification",
          l."phase"::text AS "ledgerPhase",
          l."destinationFingerprint" AS "ledgerDestinationFingerprint",
          r."id" AS "repairId",
          r."legacyBenefitId" AS "repairLegacyBenefitId",
          r."catalogMigrationLedgerId" AS "repairLedgerId",
          r."userId" AS "repairUserId",
          r."creditCardId" AS "repairCreditCardId",
          r."predefinedCardId" AS "repairPredefinedCardId",
          r."predefinedBenefitId" AS "repairPredefinedBenefitId",
          r."targetPredefinedCardCatalogKey" AS "targetCardCatalogKey",
          r."targetPredefinedBenefitCatalogKey" AS "targetBenefitCatalogKey",
          r."definitionFingerprint",
          r."evidenceVersion",
          r."phase"::text AS "repairPhase",
          r."rolledBackAt" AS "repairRolledBackAt",
          c."id" AS "cardId",
          c."userId" AS "cardUserId",
          c."predefinedCardId" AS "cardPredefinedCardId",
          pc."id" AS "productId",
          pc."catalogKey" AS "productCatalogKey",
          pc."name" AS "productName",
          pc."issuer" AS "productIssuer",
          pc."productKey",
          pc."retiredAt" AS "productRetiredAt",
          pb."id" AS "benefitId",
          pb."catalogKey" AS "benefitCatalogKey",
          pb."predefinedCardId" AS "benefitPredefinedCardId",
          pb."category" AS "benefitCategory",
          pb."description" AS "benefitDescription",
          pb."percentage" AS "benefitPercentage",
          pb."maxAmount" AS "benefitMaxAmount",
          pb."frequency"::text AS "benefitFrequency",
          pb."cycleAlignment"::text AS "benefitCycleAlignment",
          pb."fixedCycleStartMonth" AS "benefitFixedCycleStartMonth",
          pb."fixedCycleDurationMonths" AS "benefitFixedCycleDurationMonths",
          pb."occurrencesInCycle" AS "benefitOccurrencesInCycle",
          pb."productKey" AS "benefitProductKey",
          pb."creditFamilyKey" AS "benefitCreditFamilyKey",
          pb."periodKey" AS "benefitPeriodKey",
          pb."retiredAt" AS "benefitRetiredAt"
        FROM "GlobalBenefitCategoryRepair" r
        JOIN "Benefit" b ON b."id" = r."legacyBenefitId"
        JOIN "CatalogMigrationLedger" l ON l."id" = r."catalogMigrationLedgerId"
        JOIN "CreditCard" c ON c."id" = r."creditCardId"
        JOIN "PredefinedCard" pc ON pc."id" = r."predefinedCardId"
        JOIN "PredefinedBenefit" pb ON pb."id" = r."predefinedBenefitId"
        WHERE r."phase" = 'APPLIED'
          AND b."id" IN (${Prisma.join(candidateBenefitIds)})
        ORDER BY b."id"
      `;

    const validSuppressedBenefitIds = new Set(categoryRepairParents.flatMap((row) => {
      const benefit: GlobalBenefitDefinition = {
        id: row.benefitId,
        catalogKey: row.benefitCatalogKey,
        predefinedCardId: row.benefitPredefinedCardId,
        category: row.benefitCategory,
        description: row.benefitDescription,
        percentage: row.benefitPercentage,
        maxAmount: row.benefitMaxAmount,
        frequency: row.benefitFrequency,
        cycleAlignment: row.benefitCycleAlignment,
        fixedCycleStartMonth: row.benefitFixedCycleStartMonth,
        fixedCycleDurationMonths: row.benefitFixedCycleDurationMonths,
        occurrencesInCycle: row.benefitOccurrencesInCycle,
        productKey: row.benefitProductKey,
        creditFamilyKey: row.benefitCreditFamilyKey,
        periodKey: row.benefitPeriodKey,
        retiredAt: row.benefitRetiredAt,
      };
      const product: GlobalCardDefinition = {
        id: row.productId,
        catalogKey: row.productCatalogKey,
        name: row.productName,
        issuer: row.productIssuer,
        productKey: row.productKey,
        retiredAt: row.productRetiredAt,
        benefits: [benefit],
      };
      const state = classifyGlobalBenefitCategoryRepairAuthority({
        sourceBenefitId: row.sourceBenefitId,
        ledger: {
          id: row.ledgerId,
          legacyBenefitId: row.ledgerLegacyBenefitId,
          userId: row.ledgerUserId,
          creditCardId: row.ledgerCreditCardId,
          predefinedCardId: row.ledgerPredefinedCardId,
          predefinedBenefitId: row.ledgerPredefinedBenefitId,
          classification: row.ledgerClassification,
          phase: row.ledgerPhase,
          destinationFingerprint: row.ledgerDestinationFingerprint,
        },
        repair: {
          id: row.repairId,
          legacyBenefitId: row.repairLegacyBenefitId,
          catalogMigrationLedgerId: row.repairLedgerId,
          userId: row.repairUserId,
          creditCardId: row.repairCreditCardId,
          predefinedCardId: row.repairPredefinedCardId,
          predefinedBenefitId: row.repairPredefinedBenefitId,
          targetPredefinedCardCatalogKey: row.targetCardCatalogKey,
          targetPredefinedBenefitCatalogKey: row.targetBenefitCatalogKey,
          definitionFingerprint: row.definitionFingerprint,
          evidenceVersion: row.evidenceVersion,
          phase: row.repairPhase,
          rolledBackAt: row.repairRolledBackAt,
        },
        card: { id: row.cardId, userId: row.cardUserId, predefinedCardId: row.cardPredefinedCardId },
        product,
        benefit,
      });
      return state === 'APPLIED_VALID' ? [row.sourceBenefitId] : [];
    }));
    const customAndLegacyDefinitions = customAndLegacyCandidates
      .filter((definition) => !validSuppressedBenefitIds.has(definition.id))
      .slice(0, SOURCE_BATCH_SIZE);

    const fetchMs = Date.now() - startMs;
    const plan = planBenefitStatusMaterialization(
      standardDefinitions as StandardMaterializationDefinition[],
      customAndLegacyDefinitions as CustomMaterializationDefinition[],
      now
    );

    for (const warning of plan.warnings) {
      console.warn(`Benefit cycle validation warning: ${warning}`);
    }

    let rowsInserted = 0;
    if (dryRun) {
      rowsInserted = plan.rows.length;
    } else {
      for (let index = 0; index < plan.rows.length; index += INSERT_BATCH_SIZE) {
        rowsInserted += await insertMissingBenefitStatuses(
          plan.rows.slice(index, index + INSERT_BATCH_SIZE)
        );
      }
    }

    const amexSyncAuditsDeleted = dryRun
      ? 0
      : await deleteExpiredAmexSyncRowAudits(amexSyncAuditRetentionCutoff(now));
    const durationMs = Date.now() - startMs;

    return NextResponse.json({
      message: dryRun ? 'Cron job dry run completed.' : 'Cron job executed successfully.',
      dryRun,
      rowsCalculated: plan.rows.length,
      rowsInserted,
      // Preserve the existing response field while changing semantics to insert-only.
      rowsUpserted: rowsInserted,
      standardDefinitionsProcessed: standardDefinitions.length,
      customAndLegacyDefinitionsProcessed: customAndLegacyDefinitions.length,
      validationWarnings: plan.warnings.length,
      amexSyncAuditsDeleted,
      fetchMs,
      durationMs,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    const durationMs = Date.now() - startMs;
    console.error('check-benefits failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({
      message: 'Cron job failed.',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
      timestamp: now.toISOString(),
    }, { status: 500 });
  }
}

function parseDryRun(request: Request): boolean {
  return new URL(request.url).searchParams.get('dryRun') === 'true';
}

async function handleRequest(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error('CRON_SECRET is not set.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron attempt for check-benefits.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return runCheckBenefitsLogic(parseDryRun(request));
}

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}
