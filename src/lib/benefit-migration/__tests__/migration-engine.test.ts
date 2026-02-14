/**
 * Benefit Migration Engine Tests
 * 
 * Comprehensive tests for the migration framework
 */

import { BenefitMigrationEngine } from '../migration-engine';
import { MigrationPlanBuilder } from '../plan-builder';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    predefinedCard: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    creditCard: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    benefit: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    benefitStatus: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('BenefitMigrationEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Pre-migration checks', () => {
    it('should validate benefit definitions correctly', async () => {
      const engine = new BenefitMigrationEngine({ dryRun: true });
      
      const plan = new MigrationPlanBuilder()
        .setMetadata({
          id: 'test-migration',
          title: 'Test Migration',
          description: 'Test migration for validation'
        })
        .addCardUpdate('Test Card', 'Test Issuer')
        .addQuarterlyBenefit({
          quarter: 1,
          category: 'Dining',
          description: 'Test quarterly benefit',
          percentage: 100,
          maxAmount: 50
        })
        .finishCard()
        .build();

      mockPrisma.creditCard.count.mockImplementation((args) => {
        if (args?.where?.name === 'Test Card') {
          return Promise.resolve(5);
        }
        return Promise.resolve(0);
      });

      // Mock findMany to return empty array (no existing cards)
      mockPrisma.creditCard.findMany.mockResolvedValue([]);

      const result = await engine.executeMigration(plan);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid quarterly benefits', async () => {
      const engine = new BenefitMigrationEngine({ dryRun: true });
      
      // Create a plan with invalid quarterly alignment
      const plan = {
        id: 'invalid-test',
        title: 'Invalid Test',
        description: 'Test invalid quarterly benefit',
        version: '1.0.0',
        createdAt: new Date(),
        cardUpdates: [{
          cardName: 'Test Card',
          issuer: 'Test Issuer',
          effectiveDate: new Date(),
          benefits: [{
            category: 'Dining',
            description: 'Q1: Jan-Mar - Test Benefit',
            percentage: 100,
            maxAmount: 50,
            frequency: BenefitFrequency.QUARTERLY,
            cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED,
            fixedCycleStartMonth: 4, // Wrong month for Q1!
            fixedCycleDurationMonths: 3,
            occurrencesInCycle: 1
          }]
        }]
      };

      mockPrisma.creditCard.count.mockImplementation((args) => {
        if (args?.where?.name === 'Test Card') {
          return Promise.resolve(1);
        }
        return Promise.resolve(0);
      });

      // Mock findMany to return empty array (no existing cards)
      mockPrisma.creditCard.findMany.mockResolvedValue([]);

      const result = await engine.executeMigration(plan);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('validation');
    });
  });

  describe('Dry run mode', () => {
    it('should not modify data in dry run mode', async () => {
      const engine = new BenefitMigrationEngine({ dryRun: true });
      
      const plan = new MigrationPlanBuilder()
        .setMetadata({
          id: 'dry-run-test',
          title: 'Dry Run Test',
          description: 'Test dry run functionality'
        })
        .addCardUpdate('Test Card', 'Test Issuer')
        .addDiningBenefit({
          description: 'Test dining benefit',
          percentage: 100,
          maxAmount: 25
        })
        .finishCard()
        .build();

      // Mock existing cards
      mockPrisma.creditCard.count.mockImplementation((args) => {
        if (args?.where?.name === 'Test Card') {
          return Promise.resolve(2);
        }
        return Promise.resolve(0);
      });
      mockPrisma.creditCard.findMany.mockResolvedValue([
        {
          id: 'card1',
          name: 'Test Card',
          user: { id: 'user1', email: 'test@example.com' },
          benefits: [],
          openedDate: new Date('2024-01-01')
        },
        {
          id: 'card2', 
          name: 'Test Card',
          user: { id: 'user2', email: 'test2@example.com' },
          benefits: [],
          openedDate: new Date('2024-02-01')
        }
      ]);

      const result = await engine.executeMigration(plan);

      expect(result.success).toBe(true);
      expect(result.affectedUsers).toBe(2);
      expect(result.affectedCards).toBe(2);
      
      // Verify no actual database operations were called
      expect(mockPrisma.predefinedCard.create).not.toHaveBeenCalled();
      expect(mockPrisma.predefinedCard.update).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle Promise.allSettled failures gracefully', async () => {
      const engine = new BenefitMigrationEngine({ 
        dryRun: false,
        batchSize: 2,
        stopOnFirstError: false
      });
      
      const plan = new MigrationPlanBuilder()
        .setMetadata({
          id: 'error-handling-test',
          title: 'Error Handling Test',
          description: 'Test error handling in batch processing'
        })
        .addCardUpdate('Test Card', 'Test Issuer')
        .addDiningBenefit({
          description: 'Test benefit',
          percentage: 100,
          maxAmount: 25
        })
        .finishCard()
        .build();

      // Mock cards with one that will fail
      mockPrisma.creditCard.count.mockImplementation((args) => {
        if (args?.where?.name === 'Test Card') {
          return Promise.resolve(3);
        }
        return Promise.resolve(0);
      });
      mockPrisma.creditCard.findMany.mockResolvedValue([
        {
          id: 'card1',
          name: 'Test Card',
          user: { id: 'user1', email: 'test1@example.com' },
          benefits: [],
          openedDate: new Date('2024-01-01')
        },
        {
          id: 'card2',
          name: 'Test Card', 
          user: { id: 'user2', email: 'test2@example.com' },
          benefits: [],
          openedDate: new Date('2024-02-01')
        },
        {
          id: 'card3',
          name: 'Test Card',
          user: { id: 'user3', email: 'test3@example.com' },
          benefits: [],
          openedDate: new Date('2024-03-01')
        }
      ]);

      // Mock transaction to succeed for first two, fail for third
      let transactionCallCount = 0;
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        transactionCallCount++;
        if (transactionCallCount === 3) {
          throw new Error('Simulated database error');
        }
        return callback({
          creditCard: { update: jest.fn() },
          benefit: { create: jest.fn().mockResolvedValue({ id: 'benefit1' }) },
          benefitStatus: { create: jest.fn() }
        });
      });

      const result = await engine.executeMigration(plan);

      expect(result.success).toBe(false); // Has errors
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].type).toBe('user_data');
      expect(result.affectedUsers).toBe(2); // Two succeeded
      expect(result.affectedCards).toBe(2);
    });
  });

  describe('Benefit preservation', () => {
    it('should preserve completed benefits when preserveUserActions is true', async () => {
      const engine = new BenefitMigrationEngine({
        dryRun: false,
        preserveUserActions: true
      });

      const plan = new MigrationPlanBuilder()
        .setMetadata({
          id: 'preserve-test',
          title: 'Preserve Benefits Test',
          description: 'Test benefit preservation'
        })
        .addCardUpdate('Test Card', 'Test Issuer')
        .addDiningBenefit({
          description: 'New benefit',
          percentage: 100,
          maxAmount: 30
        })
        .finishCard()
        .build();

      mockPrisma.creditCard.count.mockImplementation((args) => {
        if (args?.where?.name === 'Test Card') {
          return Promise.resolve(1);
        }
        return Promise.resolve(0);
      });
      mockPrisma.creditCard.findMany.mockResolvedValue([
        {
          id: 'card1',
          name: 'Test Card',
          user: { id: 'user1', email: 'test@example.com' },
          benefits: [
            {
              id: 'benefit1',
              benefitStatuses: [
                { isCompleted: true, isNotUsable: false }
              ]
            },
            {
              id: 'benefit2', 
              benefitStatuses: [
                { isCompleted: false, isNotUsable: true }
              ]
            },
            {
              id: 'benefit3',
              benefitStatuses: [
                { isCompleted: false, isNotUsable: false }
              ]
            }
          ],
          openedDate: new Date('2024-01-01')
        }
      ]);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          benefitStatus: { 
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn().mockResolvedValue({ id: 'status1' })
          },
          benefit: { 
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn().mockResolvedValue({ id: 'new-benefit1' })
          },
          creditCard: { update: jest.fn().mockResolvedValue({ id: 'card1' }) }
        };
        return callback(tx);
      });

      const result = await engine.executeMigration(plan);

      expect(result.success).toBe(true);
      
      // Verify only deletable benefits were removed (benefit3)
      const transactionCall = mockPrisma.$transaction.mock.calls[0][0];
      const mockTx = {
        benefitStatus: { 
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue({ id: 'status1' })
        },
        benefit: { 
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue({ id: 'new-benefit1' })
        },
        creditCard: { update: jest.fn().mockResolvedValue({ id: 'card1' }) }
      };
      
      await transactionCall(mockTx);
      
      expect(mockTx.benefit.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['benefit3'] } } // Only non-completed/non-not-usable benefit
      });
    });
  });

  describe('Backup', () => {
    it('should call backupWriter for each user card when backupUserData is true', async () => {
      const backupWriter = jest.fn().mockResolvedValue(undefined);
      const engine = new BenefitMigrationEngine({
        dryRun: false,
        backupUserData: true,
        backupWriter,
      });

      const plan = new MigrationPlanBuilder()
        .setMetadata({
          id: 'backup-test',
          title: 'Backup Test',
          description: 'Test backup writer is called',
        })
        .addCardUpdate('Test Card', 'Test Issuer')
        .addDiningBenefit({
          description: 'Test benefit',
          percentage: 100,
          maxAmount: 50,
        })
        .finishCard()
        .build();

      mockPrisma.predefinedCard.findUnique.mockResolvedValue({
        id: 'predef1',
        name: 'Test Card',
        benefits: [],
      });
      mockPrisma.predefinedCard.update.mockResolvedValue({});

      mockPrisma.creditCard.count.mockImplementation((args) => {
        if (args?.where?.name === 'Test Card') return Promise.resolve(2);
        return Promise.resolve(0);
      });

      const card1 = {
        id: 'card1',
        name: 'Test Card',
        openedDate: new Date('2024-01-01'),
        user: { id: 'user1', email: 'u1@example.com' },
        benefits: [
          {
            id: 'b1',
            category: 'Dining',
            description: 'Old benefit',
            percentage: 100,
            maxAmount: 25,
            frequency: BenefitFrequency.MONTHLY,
            cycleAlignment: null,
            fixedCycleStartMonth: null,
            fixedCycleDurationMonths: null,
            occurrencesInCycle: 1,
            benefitStatuses: [
              {
                id: 's1',
                benefitId: 'b1',
                isCompleted: false,
                isNotUsable: false,
                completedAt: null,
                cycleStartDate: new Date('2024-01-01'),
                cycleEndDate: new Date('2024-01-31'),
                occurrenceIndex: 0,
              },
            ],
          },
        ],
      };
      mockPrisma.creditCard.findMany.mockResolvedValue([
        card1,
        {
          ...card1,
          id: 'card2',
          user: { id: 'user2', email: 'u2@example.com' },
        },
      ]);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          benefitStatus: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'ns1' }) },
          benefit: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'nb1' }) },
          creditCard: { update: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const result = await engine.executeMigration(plan);

      expect(result.success).toBe(true);
      expect(backupWriter).toHaveBeenCalledTimes(2);
      expect(backupWriter).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          userId: 'user1',
          userEmail: 'u1@example.com',
          cardId: 'card1',
          cardName: 'Test Card',
          currentBenefits: expect.any(Array),
          benefitStatuses: expect.any(Array),
        })
      );
      expect(backupWriter).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          userId: 'user2',
          userEmail: 'u2@example.com',
          cardId: 'card2',
        })
      );
    });
  });
});
