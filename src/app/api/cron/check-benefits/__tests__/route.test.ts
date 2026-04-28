import { GET, POST } from '../route'; // Adjust path as necessary
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateBenefitCycle } from '@/lib/benefit-cycle';
import { BenefitFrequency, BenefitCycleAlignment } from '@/generated/prisma';

// --- Mocks ---
jest.mock('@/lib/prisma', () => ({
  prisma: {
    creditCard: {
      findMany: jest.fn(),
    },
    benefitStatus: {
      upsert: jest.fn(),
    },
    benefit: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    loyaltyAccount: {
      findMany: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
  },
}));

jest.mock('@/lib/benefit-cycle', () => ({
  calculateBenefitCycle: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation(data => ({ // Simple mock for NextResponse.json
        json: async () => data, 
        status: data.status || 200
    })),
  },
}));

// Helper to create UTC dates for test data
const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

describe('/api/cron/check-benefits', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let originalProcessEnv: NodeJS.ProcessEnv; // For backing up and restoring process.env

  beforeEach(() => {
    jest.clearAllMocks();
    originalProcessEnv = { ...process.env }; // Backup original process.env

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Default successful calculation
    (calculateBenefitCycle as jest.Mock).mockReturnValue({
      cycleStartDate: utcDate(2023, 1, 1),
      cycleEndDate: utcDate(2023, 1, 31),
    });
    (prisma.creditCard.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.benefit.findMany as jest.Mock).mockResolvedValue([]); // Standalone benefits
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]); // Notification users
    (prisma.loyaltyAccount.findMany as jest.Mock).mockResolvedValue([]); // Loyalty accounts
    (prisma.benefitStatus.upsert as jest.Mock).mockResolvedValue({});
    (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(0);
    (NextResponse.json as jest.Mock).mockClear(); // Clear call history for NextResponse.json
  });

  afterEach(() => {
    process.env = originalProcessEnv; // Restore original process.env
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.useRealTimers(); // If any test uses jest.useFakeTimers()
  });

  // --- Authorization Tests for GET and POST ---
  const testCases = [ {methodName: 'GET', handler: GET}, {methodName: 'POST', handler: POST} ];

  testCases.forEach(({methodName, handler}) => {
    describe(`${methodName} Authorization`, () => {
      it('should return 401 if CRON_SECRET is not set in env', async () => {
        const currentCronSecret = process.env.CRON_SECRET;
        delete process.env.CRON_SECRET;
        const mockRequest = new Request('http://localhost', { headers: { 'authorization': 'Bearer test-secret' } });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _response = await handler(mockRequest);
        expect(NextResponse.json).toHaveBeenCalledWith({ message: 'Cron secret not configured.' }, { status: 500 });
        if (currentCronSecret !== undefined) {
          process.env.CRON_SECRET = currentCronSecret;
        } else {
        }
      });

      it('should return 401 if authorization header is missing', async () => {
        jest.replaceProperty(process.env, 'CRON_SECRET', 'test-secret');
        const mockRequest = new Request('http://localhost', { headers: {} });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _response = await handler(mockRequest);
        expect(NextResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' }, { status: 401 });
      });

      it('should return 401 if authorization header has wrong secret', async () => {
        jest.replaceProperty(process.env, 'CRON_SECRET', 'test-secret');
        const mockRequest = new Request('http://localhost', { headers: { 'authorization': 'Bearer wrong-secret' } });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _response = await handler(mockRequest);
        expect(NextResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' }, { status: 401 });
      });

      it('should proceed if authorization is correct', async () => {
        jest.replaceProperty(process.env, 'CRON_SECRET', 'test-secret');
        (prisma.creditCard.findMany as jest.Mock).mockResolvedValueOnce([]); // No data, just testing auth
        const mockRequest = new Request('http://localhost', { headers: { 'authorization': 'Bearer test-secret' } });
        await handler(mockRequest);
        expect(prisma.creditCard.findMany).toHaveBeenCalled(); // Core logic was reached
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cron job executed successfully.' }));
      });
    });
  });

  // --- Tests for runCheckBenefitsLogic (via authorized GET) ---
  describe('runCheckBenefitsLogic (via authorized GET)', () => {
    beforeEach(() => {
        jest.replaceProperty(process.env, 'CRON_SECRET', 'test-secret'); // Ensure authorized for these tests
    });

    const createMockRequest = () => new Request('http://localhost', { 
        headers: { 'authorization': 'Bearer test-secret' } 
    });

    it('should log "No recurring benefits found" if no cards exist', async () => {
        (prisma.creditCard.findMany as jest.Mock).mockResolvedValueOnce([]);
        await GET(createMockRequest());
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ 
            message: 'Cron job executed successfully.', 
            rowsCalculated: 0,
            rowsUpserted: 0,
            cardsProcessed: 0,
            standaloneBenefitsProcessed: 0,
            skipped: 0,
            calcErrors: 0,
        }));
    });

    it('should process a monthly benefit and call upsert', async () => {
        const mockCard = {
            id: 'card1', openedDate: null, user: {id: 'user1'},
            benefits: [{ id: 'b1', frequency: BenefitFrequency.MONTHLY, cycleAlignment: null, fixedCycleStartMonth: null, fixedCycleDurationMonths: null }]
        };
        (prisma.creditCard.findMany as jest.Mock).mockResolvedValueOnce([mockCard]);
        (calculateBenefitCycle as jest.Mock).mockReturnValueOnce({ cycleStartDate: utcDate(2023,7,1), cycleEndDate: utcDate(2023,7,31) });
        
        // Mock Date to control 'now' for predictable cycle calculation
        const fakeNow = utcDate(2023, 7, 15);
        jest.useFakeTimers().setSystemTime(fakeNow);

        await GET(createMockRequest());

        expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
        const rawArgs = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
        expect(rawArgs[0]).toContain('INSERT INTO "BenefitStatus"');
        expect(rawArgs.slice(2, 7)).toEqual(['b1', 'user1', utcDate(2023,7,1), utcDate(2023,7,31), 0]);
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ 
            message: 'Cron job executed successfully.', 
            rowsCalculated: 1,
            cardsProcessed: 1,
            skipped: 0,
            calcErrors: 0,
        }));
    });

    it('should skip YEARLY anniversary benefit if card openedDate is missing', async () => {
        const mockCard = {
            id: 'card2', openedDate: null, user: {id: 'user1'},
            benefits: [{ id: 'b2', frequency: BenefitFrequency.YEARLY, cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY }]
        };
        (prisma.creditCard.findMany as jest.Mock).mockResolvedValueOnce([mockCard]);
        await GET(createMockRequest());
        expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ 
            message: 'Cron job executed successfully.', 
            rowsCalculated: 0,
            rowsUpserted: 0,
            cardsProcessed: 1,
            skipped: 1,
        }));
    });
    
    it('should process YEARLY CALENDAR_FIXED benefit even if card openedDate is missing', async () => {
        const mockCard = {
            id: 'card3', openedDate: null, user: {id: 'user1'},
            benefits: [{
                id: 'b3', frequency: BenefitFrequency.YEARLY, 
                cycleAlignment: BenefitCycleAlignment.CALENDAR_FIXED, 
                fixedCycleStartMonth: 1, fixedCycleDurationMonths: 12
            }]
        };
        (prisma.creditCard.findMany as jest.Mock).mockResolvedValueOnce([mockCard]);
        (calculateBenefitCycle as jest.Mock).mockReturnValueOnce({ cycleStartDate: utcDate(2023,1,1), cycleEndDate: utcDate(2023,12,31) });
        
        await GET(createMockRequest());
        expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ 
            message: 'Cron job executed successfully.', 
            rowsCalculated: 1,
            cardsProcessed: 1,
        }));
    });

    it('should log and return 500 if prisma.creditCard.findMany fails', async () => {
        (prisma.creditCard.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB findMany failed'));
        await GET(createMockRequest());
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('💥 Failed after'), 'DB findMany failed');
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ 
            message: 'Cron job failed.', 
            error: 'DB findMany failed'
        }), { status: 500 });
    });

    it('should log error and continue if calculateBenefitCycle fails for one benefit', async () => {
        const mockCards = [
            { id: 'cardA', openedDate: utcDate(2022,1,1), user: {id: 'userA'}, benefits: [{ id: 'bA1', frequency: BenefitFrequency.YEARLY, cycleAlignment: BenefitCycleAlignment.CARD_ANNIVERSARY }] },
            { id: 'cardB', openedDate: null, user: {id: 'userB'}, benefits: [{ id: 'bB1', frequency: BenefitFrequency.MONTHLY }] }
        ];
        (prisma.creditCard.findMany as jest.Mock).mockResolvedValueOnce(mockCards);
        (calculateBenefitCycle as jest.Mock)
            .mockImplementationOnce(() => { throw new Error('Calc fail for bA1'); })
            .mockReturnValueOnce({ cycleStartDate: utcDate(2023,8,1), cycleEndDate: utcDate(2023,8,31) }); // Success for bB1

        const fakeNow = utcDate(2023, 8, 15);
        jest.useFakeTimers().setSystemTime(fakeNow);

        await GET(createMockRequest());

        expect(consoleErrorSpy).toHaveBeenCalledWith('Cycle error benefit bA1:', 'Calc fail for bA1');
        expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1); // Only bB1 should be upserted
        const rawArgs = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
        expect(rawArgs.slice(2, 7)).toEqual(['bB1', 'userB', utcDate(2023,8,1), utcDate(2023,8,31), 0]);
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ 
            message: 'Cron job executed successfully.', 
            rowsCalculated: 1,
            cardsProcessed: 2,
            calcErrors: 1,
        }));
    });

    it('should return 500 if the bulk upsert fails', async () => {
        const mockCards = [
            { id: 'cardC', openedDate: null, user: {id: 'userC'}, benefits: [{ id: 'bC1', frequency: BenefitFrequency.MONTHLY }] },
            { id: 'cardD', openedDate: null, user: {id: 'userD'}, benefits: [{ id: 'bD1', frequency: BenefitFrequency.QUARTERLY }] }
        ];
        (prisma.creditCard.findMany as jest.Mock).mockResolvedValueOnce(mockCards);
        (calculateBenefitCycle as jest.Mock)
            .mockReturnValueOnce({ cycleStartDate: utcDate(2023,9,1), cycleEndDate: utcDate(2023,9,30) }) // For bC1
            .mockReturnValueOnce({ cycleStartDate: utcDate(2023,10,1), cycleEndDate: utcDate(2023,12,31) }); // For bD1
        
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValueOnce(new Error('Bulk upsert failed'));

        await GET(createMockRequest());
        
        expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ 
            message: 'Cron job failed.', 
            error: 'Bulk upsert failed',
        }), { status: 500 });
    });

    // More tests for runCheckBenefitsLogic will be added here
  });
}); 
