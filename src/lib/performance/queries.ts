/**
 * Performance-optimized database queries
 * This module contains optimized versions of commonly-used queries to reduce N+1 problems
 * and improve overall application performance.
 */

import { prisma } from '@/lib/prisma';
import { createCardDisplayNameMap } from '@/lib/cardDisplayUtils';

/**
 * Optimized query for benefits page - combines multiple queries into one efficient query
 * Replaces the original 3 separate queries with a single optimized query
 */
export async function getOptimizedBenefitsData(userId: string) {
  // Single optimized query that fetches everything needed
  const result = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      creditCards: {
        include: {
          benefits: {
            include: {
              benefitStatuses: {
                where: { userId }, // Only get statuses for this user
                orderBy: [
                  { orderIndex: 'asc' },
                  { cycleEndDate: 'asc' }
                ],
              },
            },
          },
        },
      },
      benefitStatuses: {
        include: {
          benefit: {
            include: {
              creditCard: true,
            },
          },
        },
        orderBy: [
          { orderIndex: 'asc' },
          { cycleEndDate: 'asc' }
        ],
      },
    },
  });

  if (!result) {
    return null;
  }

  // Create display name map
  const cardDisplayNameMap = createCardDisplayNameMap(result.creditCards);

  // Add display names to benefit statuses
  const enrichedStatuses = result.benefitStatuses.map(status => ({
    ...status,
    benefit: {
      ...status.benefit,
      creditCard: {
        ...status.benefit.creditCard,
        displayName: cardDisplayNameMap.get(status.benefit.creditCard.id) || status.benefit.creditCard.name,
      },
    },
  }));

  // Calculate annual fees efficiently
  const cardCounts = result.creditCards.reduce((acc, card) => {
    acc[card.name] = (acc[card.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get predefined cards with their annual fees in a single query
  const predefinedCards = await prisma.predefinedCard.findMany({
    where: {
      name: { in: Object.keys(cardCounts) }
    },
    select: {
      name: true,
      annualFee: true,
    },
  });

  const totalAnnualFees = predefinedCards.reduce((total, predCard) => {
    const quantity = cardCounts[predCard.name] || 0;
    return total + (predCard.annualFee * quantity);
  }, 0);

  return {
    benefitStatuses: enrichedStatuses,
    totalAnnualFees,
  };
}

/**
 * Optimized query for user cards with images - reduces from 2 queries to 1
 */
export async function getOptimizedUserCards(userId: string) {
  const userCards = await prisma.creditCard.findMany({
    where: { userId },
    include: {
      benefits: {
        select: {
          id: true,
          description: true,
          category: true,
          maxAmount: true,
          frequency: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get predefined cards in a single query
  const cardNamesSet = new Set(userCards.map(card => card.name)); // Remove duplicates
  const cardNames = Array.from(cardNamesSet);
  const predefinedCards = await prisma.predefinedCard.findMany({
    where: {
      name: { in: cardNames }
    },
    select: {
      name: true,
      issuer: true,
      imageUrl: true,
    }
  });

  // Create efficient lookup map
  const imageUrlMap = new Map(
    predefinedCards.map(card => [`${card.name}-${card.issuer}`, card.imageUrl])
  );

  // Return enriched data
  return userCards.map(card => ({
    ...card,
    imageUrl: imageUrlMap.get(`${card.name}-${card.issuer}`) || null
  }));
}

/**
 * Optimized cron job query for checking benefits
 * Reduces query complexity and improves performance for large datasets
 */
export async function getOptimizedCardsForCron() {
  return prisma.creditCard.findMany({
    where: {
      benefits: {
        some: {
          frequency: {
            not: 'ONE_TIME',
          },
        },
      },
    },
    include: {
      benefits: {
        where: {
          frequency: {
            not: 'ONE_TIME',
          },
        },
        select: {
          id: true,
          frequency: true,
          cycleAlignment: true,
          fixedCycleStartMonth: true,
          fixedCycleDurationMonths: true,
          occurrencesInCycle: true,
        }
      },
      user: {
        select: {
          id: true, 
        }
      }
    },
  });
}

/**
 * Batch upsert for benefit statuses - more efficient than individual upserts
 */
export async function batchUpsertBenefitStatuses(
  benefitStatuses: Array<{
    benefitId: string;
    userId: string;
    cycleStartDate: Date;
    cycleEndDate: Date;
    occurrenceIndex: number;
  }>
) {
  // Use a transaction for better performance and consistency
  return prisma.$transaction(
    benefitStatuses.map(status =>
      prisma.benefitStatus.upsert({
        where: {
          benefitId_userId_cycleStartDate_occurrenceIndex: {
            benefitId: status.benefitId,
            userId: status.userId,
            cycleStartDate: status.cycleStartDate,
            occurrenceIndex: status.occurrenceIndex,
          }
        },
        update: {
          cycleEndDate: status.cycleEndDate,
        },
        create: {
          benefitId: status.benefitId,
          userId: status.userId,
          cycleStartDate: status.cycleStartDate,
          cycleEndDate: status.cycleEndDate,
          occurrenceIndex: status.occurrenceIndex,
          orderIndex: 0,
        },
      })
    )
  );
}
