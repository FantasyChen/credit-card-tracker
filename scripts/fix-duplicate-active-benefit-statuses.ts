#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { PrismaClient, type BenefitStatus } from '../src/generated/prisma';
import { materializeBenefitStatusRows } from '../src/lib/benefit-cycle-materialization';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

let cardName: string | null = null;
let referenceDate = new Date();

const cardArgIndex = args.findIndex((arg) => arg === '--card' || arg.startsWith('--card='));
if (cardArgIndex !== -1) {
  const cardArg = args[cardArgIndex];
  if (cardArg.startsWith('--card=')) {
    cardName = cardArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  } else if (cardArgIndex + 1 < args.length) {
    cardName = args[cardArgIndex + 1].replace(/^["']|["']$/g, '');
  }
}

const dateArgIndex = args.findIndex((arg) => arg === '--date' || arg.startsWith('--date='));
if (dateArgIndex !== -1) {
  const dateArg = args[dateArgIndex];
  const dateValue = dateArg.startsWith('--date=') ? dateArg.split('=').slice(1).join('=') : args[dateArgIndex + 1];
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    console.error(`Invalid --date value: ${dateValue}`);
    process.exit(1);
  }
  referenceDate = parsedDate;
}

type ActiveStatus = Pick<
  BenefitStatus,
  | 'id'
  | 'benefitId'
  | 'userId'
  | 'cycleStartDate'
  | 'cycleEndDate'
  | 'occurrenceIndex'
  | 'isCompleted'
  | 'isNotUsable'
  | 'usedAmount'
  | 'orderIndex'
>;

type RepairCreate = {
  benefitId: string;
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  occurrenceIndex: number;
  orderIndex: number | null;
};

type RepairGroup = {
  cardId: string;
  benefitId: string;
  description: string;
  occurrenceIndex: number;
  statusCount: number;
  deleteIds: string[];
  createCanonical: RepairCreate | null;
  skippedStateful: number;
};

function sameDate(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function isStateful(status: ActiveStatus): boolean {
  return status.isCompleted || status.isNotUsable || Number(status.usedAmount) > 0;
}

function groupByOccurrence(statuses: ActiveStatus[]): Map<number, ActiveStatus[]> {
  const groups = new Map<number, ActiveStatus[]>();
  for (const status of statuses) {
    const current = groups.get(status.occurrenceIndex) ?? [];
    current.push(status);
    groups.set(status.occurrenceIndex, current);
  }
  return groups;
}

async function buildRepairPlan(): Promise<RepairGroup[]> {
  if (!cardName) {
    throw new Error('--card is required');
  }

  const cards = await prisma.creditCard.findMany({
    where: { name: cardName },
    include: {
      user: { select: { id: true } },
      benefits: {
        include: {
          benefitStatuses: {
            where: {
              cycleStartDate: { lte: referenceDate },
              cycleEndDate: { gte: referenceDate },
            },
            select: {
              id: true,
              benefitId: true,
              userId: true,
              cycleStartDate: true,
              cycleEndDate: true,
              occurrenceIndex: true,
              isCompleted: true,
              isNotUsable: true,
              usedAmount: true,
              orderIndex: true,
            },
            orderBy: [{ cycleStartDate: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });

  const repairs: RepairGroup[] = [];

  for (const card of cards) {
    for (const benefit of card.benefits) {
      const materialized = materializeBenefitStatusRows(
        {
          ...benefit,
          userId: card.user.id,
        },
        {
          referenceDate,
          cardOpenedDate: card.openedDate,
          validateCycles: true,
        }
      );

      const expectedByOccurrence = new Map(materialized.rows.map((row) => [row.occurrenceIndex, row]));
      const activeByOccurrence = groupByOccurrence(benefit.benefitStatuses);

      for (const [occurrenceIndex, activeStatuses] of Array.from(activeByOccurrence.entries())) {
        if (activeStatuses.length <= 1) continue;

        const expected = expectedByOccurrence.get(occurrenceIndex);
        if (!expected) continue;

        const canonical = activeStatuses.find(
          (status) =>
            sameDate(status.cycleStartDate, expected.cycleStartDate) &&
            sameDate(status.cycleEndDate, expected.cycleEndDate)
        );
        const statefulStatuses = activeStatuses.filter(isStateful);
        const statelessStatuses = activeStatuses.filter((status) => !isStateful(status));

        let createCanonical: RepairCreate | null = null;
        let keepId = canonical?.id ?? null;

        if (!canonical && statefulStatuses.length === 0) {
          createCanonical = {
            benefitId: expected.benefitId,
            userId: expected.userId,
            cycleStartDate: expected.cycleStartDate,
            cycleEndDate: expected.cycleEndDate,
            occurrenceIndex: expected.occurrenceIndex,
            orderIndex: statelessStatuses[0]?.orderIndex ?? null,
          };
        } else if (!canonical && statefulStatuses.length > 0) {
          keepId = statefulStatuses[0].id;
        }

        const deleteIds = statelessStatuses
          .filter((status) => status.id !== keepId)
          .filter(
            (status) =>
              !sameDate(status.cycleStartDate, expected.cycleStartDate) ||
              !sameDate(status.cycleEndDate, expected.cycleEndDate)
          )
          .map((status) => status.id);

        if (deleteIds.length === 0 && !createCanonical) continue;

        repairs.push({
          cardId: card.id,
          benefitId: benefit.id,
          description: benefit.description,
          occurrenceIndex,
          statusCount: activeStatuses.length,
          deleteIds,
          createCanonical,
          skippedStateful: Math.max(0, statefulStatuses.length - (keepId && statefulStatuses.some((s) => s.id === keepId) ? 1 : 0)),
        });
      }
    }
  }

  return repairs;
}

async function applyRepairPlan(repairs: RepairGroup[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const repair of repairs) {
      if (repair.createCanonical) {
        await tx.benefitStatus.upsert({
          where: {
            benefitId_userId_cycleStartDate_occurrenceIndex: {
              benefitId: repair.createCanonical.benefitId,
              userId: repair.createCanonical.userId,
              cycleStartDate: repair.createCanonical.cycleStartDate,
              occurrenceIndex: repair.createCanonical.occurrenceIndex,
            },
          },
          update: {},
          create: {
            benefitId: repair.createCanonical.benefitId,
            userId: repair.createCanonical.userId,
            cycleStartDate: repair.createCanonical.cycleStartDate,
            cycleEndDate: repair.createCanonical.cycleEndDate,
            occurrenceIndex: repair.createCanonical.occurrenceIndex,
            orderIndex: repair.createCanonical.orderIndex,
            isCompleted: false,
          },
        });
      }

      if (repair.deleteIds.length > 0) {
        await tx.benefitStatus.deleteMany({
          where: {
            id: { in: repair.deleteIds },
            isCompleted: false,
            isNotUsable: false,
            usedAmount: 0,
          },
        });
      }
    }
  });
}

async function main(): Promise<void> {
  if (!cardName) {
    console.error('Usage: node --import tsx scripts/fix-duplicate-active-benefit-statuses.ts --card "Card Name" --dry-run');
    process.exit(1);
  }

  if (!isDryRun && !isForce) {
    console.error('Either --dry-run or --force is required');
    process.exit(1);
  }

  console.log(`Card: ${cardName}`);
  console.log(`Reference date: ${referenceDate.toISOString()}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'FORCE'}`);

  const repairs = await buildRepairPlan();
  const deleteCount = repairs.reduce((sum, repair) => sum + repair.deleteIds.length, 0);
  const createCount = repairs.filter((repair) => repair.createCanonical).length;
  const skippedStateful = repairs.reduce((sum, repair) => sum + repair.skippedStateful, 0);

  console.log(`Repair groups: ${repairs.length}`);
  console.log(`Canonical statuses to create: ${createCount}`);
  console.log(`Stateless duplicate statuses to delete: ${deleteCount}`);
  console.log(`Stateful statuses preserved: ${skippedStateful}`);

  for (const repair of repairs.slice(0, 10)) {
    console.log(
      `- card=${repair.cardId} benefit=${repair.benefitId} occurrence=${repair.occurrenceIndex} active=${repair.statusCount} delete=${repair.deleteIds.length} create=${repair.createCanonical ? 1 : 0} desc="${repair.description}"`
    );
  }
  if (repairs.length > 10) {
    console.log(`... ${repairs.length - 10} more repair group(s)`);
  }

  if (isDryRun) {
    console.log('Dry run only. Run with --force to apply.');
    return;
  }

  await applyRepairPlan(repairs);
  console.log('Repair applied.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
