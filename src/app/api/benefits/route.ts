import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { BenefitCycleAlignment, BenefitFrequency } from '@/generated/prisma';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { materializeBenefitStatusRows } from '@/lib/benefit-cycle-materialization';
import {
  applyTrackingModesToPlannedRows,
  fetchTrackedBenefitStatuses,
} from '@/lib/benefit-tracking-preferences';

const createCardLinkedCustomBenefitSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  percentage: z.number().finite().min(0).max(100).default(0),
  maxAmount: z.number().finite().min(0).nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  creditCardId: z.string().cuid(),
  frequency: z.nativeEnum(BenefitFrequency).default(BenefitFrequency.ONE_TIME),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const statuses = await fetchTrackedBenefitStatuses(prisma, {
      userId: session.user.id,
    });
    const definitions = new Map<string, (typeof statuses)[number]['benefit']>();
    for (const status of statuses) {
      if (!status.benefit.creditCard) continue;
      definitions.set(`${status.benefit.creditCard.id}:${status.benefit.id}`, status.benefit);
    }

    return NextResponse.json(Array.from(definitions.values()));
  } catch (error) {
    console.error('Error fetching benefits:', error instanceof Error ? error.message : error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const parsed = createCardLinkedCustomBenefitSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid benefit input.' }, { status: 400 });
    }

    const input = parsed.data;
    const benefit = await prisma.$transaction(async (transaction) => {
      const card = await transaction.creditCard.findFirst({
        where: { id: input.creditCardId, userId: session.user.id },
        select: { openedDate: true },
      });
      if (!card) throw new Error('CARD_NOT_FOUND');

      const created = await transaction.benefit.create({
        data: {
          category: input.category,
          description: input.description,
          percentage: input.percentage,
          maxAmount: input.maxAmount ?? null,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          frequency: input.frequency,
          cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
          occurrencesInCycle: 1,
          userId: session.user.id,
          creditCardId: input.creditCardId,
        },
      });

      const materialized = materializeBenefitStatusRows(
        {
          ...created,
          userId: session.user.id,
        },
        {
          referenceDate: input.startDate,
          cardOpenedDate: card.openedDate,
        }
      );
      if (materialized.rows.length > 0) {
        const defaults = await applyTrackingModesToPlannedRows(transaction, materialized.rows);
        await transaction.benefitStatus.createMany({
          data: materialized.rows.map((row, index) => ({ ...row, ...defaults[index] })),
        });
      }
      return created;
    });

    return NextResponse.json(benefit);
  } catch (error) {
    if (error instanceof Error && error.message === 'CARD_NOT_FOUND') {
      return NextResponse.json({ error: 'Card not found or permission denied.' }, { status: 404 });
    }
    console.error('Error creating benefit:', error instanceof Error ? error.message : error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
