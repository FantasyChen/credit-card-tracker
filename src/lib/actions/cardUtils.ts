import type { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { materializeStandardBenefitStatusRows } from '@/lib/benefit-cycle-materialization';
import { deriveNextAnnualFeeDueDate } from '@/lib/card-lifecycle';

interface CreateCardResult {
  success: boolean;
  message?: string;
  cardId?: string;
}

interface GlobalBenefitForCardCreation {
  id: string;
  description: string;
  frequency: BenefitFrequency;
  cycleAlignment: BenefitCycleAlignment | null;
  fixedCycleStartMonth: number | null;
  fixedCycleDurationMonths: number | null;
  occurrencesInCycle: number | null;
}

interface GlobalCardForCreation {
  id: string;
  name: string;
  issuer: string;
  annualFee: number;
  productKey: string | null;
}

/**
 * Atomically creates one physical card, its opening event, and status rows for
 * active global definitions. Standard Benefit copies are never created.
 */
export async function createCardForUser(
  userId: string,
  predefinedCardId: string,
  openedDateInput: Date | null,
  lastFourDigits?: string | null,
  nickname?: string | null
): Promise<CreateCardResult> {
  const openedDate = openedDateInput ?? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const referenceDate = new Date();

  try {
    const cardId = await prisma.$transaction(async (transaction) => {
      const predefinedCards = await transaction.$queryRaw<GlobalCardForCreation[]>`
        SELECT "id", "name", "issuer", "annualFee", "productKey"
        FROM "PredefinedCard"
        WHERE "id" = ${predefinedCardId}
          AND "retiredAt" IS NULL
        LIMIT 1
      `;
      const predefinedCard = predefinedCards[0];
      if (!predefinedCard) {
        throw new Error('Predefined card not found or no longer active.');
      }

      const activeBenefits = await transaction.$queryRaw<GlobalBenefitForCardCreation[]>`
        SELECT
          "id",
          "description",
          "frequency",
          "cycleAlignment",
          "fixedCycleStartMonth",
          "fixedCycleDurationMonths",
          "occurrencesInCycle"
        FROM "PredefinedBenefit"
        WHERE "predefinedCardId" = ${predefinedCard.id}
          AND "retiredAt" IS NULL
        ORDER BY "id" ASC
      `;

      const newCreditCard = await transaction.creditCard.create({
        data: {
          name: predefinedCard.name,
          issuer: predefinedCard.issuer,
          userId,
          predefinedCardId: predefinedCard.id,
          openedDate,
          lastFourDigits: lastFourDigits || null,
          nickname: nickname || null,
          annualFeeAmount: predefinedCard.annualFee,
          annualFeeDueDate: predefinedCard.annualFee > 0
            ? deriveNextAnnualFeeDueDate(openedDate)
            : null,
          productKey: predefinedCard.productKey,
        },
      } as never);

      await transaction.creditCardEvent.create({
        data: {
          creditCardId: newCreditCard.id,
          userId,
          eventType: 'OPENED',
          eventDate: openedDate,
          description: `Opened ${predefinedCard.name}`,
        },
      });

      const statusRows = activeBenefits.flatMap((benefit) => {
        const materialized = materializeStandardBenefitStatusRows(
          { ...benefit, startDate: openedDate },
          { userId, creditCardId: newCreditCard.id },
          {
            referenceDate,
            cardOpenedDate: openedDate,
            validateCycles: true,
          }
        );

        for (const warning of materialized.warnings) {
          console.warn(`Benefit validation warning for "${benefit.description}": ${warning}`);
        }
        return materialized.rows.map((row) => ({
          ...row,
          isCompleted: false,
          usedAmount: 0,
        }));
      });

      if (statusRows.length > 0) {
        await transaction.benefitStatus.createMany({ data: statusRows } as never);
      }

      return newCreditCard.id;
    });

    return { success: true, cardId };
  } catch (error) {
    console.error('createCardForUser error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      message:
        error instanceof Error && error.message === 'Predefined card not found or no longer active.'
          ? error.message
          : 'Failed to create the card.',
    };
  }
}
