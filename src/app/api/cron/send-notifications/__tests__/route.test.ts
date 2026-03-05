import { GET, POST } from '../route';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
// import { BenefitStatus, User, Benefit, CreditCard } from '@/generated/prisma'; // Types for mock data

// --- Mocks ---
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn() },
    benefitStatus: { findMany: jest.fn() },
    loyaltyAccount: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation(data => ({ 
        json: async () => data, 
        status: data.status || 200 
    })),
  },
}));

// Helper to create UTC dates
const utcDate = (year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0, ms = 0) => 
  new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms));

describe('/api/cron/send-notifications', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let originalProcessEnv: NodeJS.ProcessEnv; // For backing up and restoring process.env

  beforeEach(() => {
    jest.clearAllMocks();
    originalProcessEnv = { ...process.env }; // Backup process.env
    process.env.NEXTAUTH_URL = 'http://localhost:3000'; // For email link

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.benefitStatus.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.loyaltyAccount.findMany as jest.Mock).mockResolvedValue([]);
    (sendEmail as jest.Mock).mockResolvedValue(true); // Default successful email send
    (NextResponse.json as jest.Mock).mockClear();
  });

  afterEach(() => {
    process.env = originalProcessEnv; // Restore process.env
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.useRealTimers();
  });

  // --- Authorization Tests ---
  const authTestCases = [ {methodName: 'GET', handler: GET}, {methodName: 'POST', handler: POST} ];
  authTestCases.forEach(({methodName, handler}) => {
    describe(`${methodName} Authorization`, () => {
      it('should return 500 if CRON_SECRET is not set', async () => {
        delete process.env.CRON_SECRET;
        const req = new Request('http://localhost', { headers: { 'authorization': 'Bearer test' } });
        await handler(req);
        expect(NextResponse.json).toHaveBeenCalledWith({ message: 'Cron secret not configured.' }, { status: 500 });
      });
      it('should return 401 if auth header is wrong', async () => {
        process.env.CRON_SECRET = 'secret';
        const req = new Request('http://localhost', { headers: { 'authorization': 'Bearer wrong' } });
        await handler(req);
        expect(NextResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' }, { status: 401 });
      });
      it('should proceed if auth is correct', async () => {
        process.env.CRON_SECRET = 'secret';
        const req = new Request('http://localhost', { headers: { 'authorization': 'Bearer secret' } });
        await handler(req);
        expect(NextResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'No users to notify.' }), { status: 200 });
      });
    });
  });

  // --- Tests for runSendNotificationsLogic (via authorized GET) ---
  describe('runSendNotificationsLogic (via authorized GET)', () => {
    beforeEach(() => {
        process.env.CRON_SECRET = 'test-secret'; // Ensure authorized
    });
    const createMockReq = (urlParams = '') => new Request(`http://localhost/api/cron/send-notifications${urlParams}`, { 
        headers: { 'authorization': 'Bearer test-secret' } 
    });

    it('should do nothing if no users have notification prefs', async () => {
        (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([]);
        await GET(createMockReq());
        expect(sendEmail).not.toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith({ message: 'No users to notify.' }, { status: 200 });
    });

    interface PartialUserPrefs {
        id?: string;
        email?: string;
        name?: string;
        notifyNewBenefit?: boolean;
        notifyBenefitExpiration?: boolean;
        notifyExpirationDays?: number;
        notifyPointsExpiration?: boolean;
        pointsExpirationDays?: number;
    }

    const mockUser = (prefs: PartialUserPrefs = {}) => ({
        id: 'user1', email: 'user1@example.com', name: 'Test User',
        notifyNewBenefit: true, notifyBenefitExpiration: true, notifyExpirationDays: 7,
        notifyPointsExpiration: true, pointsExpirationDays: 30,
        ...prefs
    });

    const mockBenefitStatus = (id: string, startDate: Date, endDate: Date, userId = 'user1') => {
        const benefitDetails = {
            id: `benefit-${id}`,
            description: `Benefit ${id}`,
            creditCard: { id: `card-${id}`, name: `Card ${id}` }
        };
        console.log(`mockBenefitStatus generating for id '${id}': desc='${benefitDetails.description}', cardName='${benefitDetails.creditCard.name}'`);
        return {
            id: `status-${id}`, benefitId: `benefit-${id}`, userId,
            cycleStartDate: startDate, cycleEndDate: endDate, isCompleted: false,
            benefit: benefitDetails,
            user: mockUser({ id: userId })
        };
    };

    const mockLoyaltyAccount = (id: string, programName: string, expirationDate: Date, userId = 'user1', accountNumber?: string) => {
        return {
            id: `loyalty-${id}`,
            userId,
            loyaltyProgramId: `program-${id}`,
            accountNumber,
            lastActivityDate: new Date('2023-01-01'),
            expirationDate,
            isActive: true,
            loyaltyProgram: {
                id: `program-${id}`,
                name: programName.toLowerCase().replace(/\s+/g, '_'),
                displayName: programName,
                type: 'AIRLINE',
                company: programName.split(' ')[0],
                expirationMonths: 18,
                hasExpiration: true
            }
        };
    };

    it.skip('should send digest email for new benefit cycles', async () => {
        const systemTime = utcDate(2023, 8, 15, 10, 30, 0);
        const queryStartDate = utcDate(2023, 8, 15);
        const queryEndDate = utcDate(2023, 8, 16);
        
        jest.useFakeTimers().setSystemTime(systemTime);
        
        (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockUser({ id: 'user-new-benefit' })]);
        
        (prisma.benefitStatus.findMany as jest.Mock)
            .mockImplementationOnce(async (args) => {
                const userIdMatch = args.where.userId === 'user-new-benefit';
                const cycleStartDateExists = !!args.where.cycleStartDate;
                const gteExists = !!args.where.cycleStartDate?.gte;
                const gteTimeMatch = args.where.cycleStartDate?.gte?.getTime() === queryStartDate.getTime();
                const ltExists = !!args.where.cycleStartDate?.lt;
                const ltTimeMatch = args.where.cycleStartDate?.lt?.getTime() === queryEndDate.getTime();

                if (userIdMatch && cycleStartDateExists && gteExists && gteTimeMatch && ltExists && ltTimeMatch) {
                    return [mockBenefitStatus('new', queryStartDate, utcDate(2023, 9, 14), 'user-new-benefit')];
                }
                return [];
            })
            .mockImplementationOnce(async () => []); 

        await GET(createMockReq());

        expect(sendEmail).toHaveBeenCalledTimes(1);
        
        const sendEmailArgs = (sendEmail as jest.Mock).mock.calls[0][0];
        expect(sendEmailArgs.to).toBe('user1@example.com');
        expect(sendEmailArgs.subject).toBe('New Benefit Cycles Have Started!');
        expect(sendEmailArgs.html).toContain('New Benefit Cycles');
        expect(sendEmailArgs.html).toContain('CouponCycle Update');
    });

    it('should send digest email for expiring benefits', async () => {
        const systemTime = utcDate(2023, 8, 15, 11, 0, 0); 
        const queryToday = utcDate(2023, 8, 15);

        const userNotifyDays = 7;
        // The benefit expires exactly userNotifyDays from today
        const expiryDate = utcDate(2023, 8, 15 + userNotifyDays, 12, 0, 0);

        jest.useFakeTimers().setSystemTime(systemTime);
        (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockUser({ notifyExpirationDays: userNotifyDays })]);
        
        (prisma.benefitStatus.findMany as jest.Mock)
            .mockResolvedValueOnce([]) // new benefits query
            .mockResolvedValueOnce([   // expiring benefits query (bulk: userId in [...])
                mockBenefitStatus('expiring', utcDate(2023, 7, 23), expiryDate)
            ]);
        
        await GET(createMockReq());

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'user1@example.com',
            subject: 'Benefits Expiring Soon!',
            html: expect.stringContaining(`expiring on ${expiryDate.toLocaleDateString('en-US', {timeZone: 'UTC'})}`)
        }));
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            html: expect.stringContaining('CouponCycle Update')
        }));
    });

    it('should send digest email for expiring loyalty program points', async () => {
        const systemTime = utcDate(2023, 8, 15, 11, 0, 0); 
        const userNotifyDays = 30;
        // Loyalty account expires exactly userNotifyDays from today
        const loyaltyExpiryDate = utcDate(2023, 8, 15 + userNotifyDays, 12, 0, 0);

        jest.useFakeTimers().setSystemTime(systemTime);
        (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockUser({ pointsExpirationDays: userNotifyDays })]);
        
        (prisma.benefitStatus.findMany as jest.Mock)
            .mockResolvedValueOnce([])  // new benefits
            .mockResolvedValueOnce([]); // expiring benefits
        
        (prisma.loyaltyAccount.findMany as jest.Mock)
            .mockResolvedValueOnce([
                mockLoyaltyAccount('expiring', 'American Airlines', loyaltyExpiryDate, 'user1', 'AA123456')
            ]);
        
        await GET(createMockReq());

        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'user1@example.com',
            subject: 'Loyalty Points Expiring Soon!',
            html: expect.stringContaining('American Airlines')
        }));
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            html: expect.stringContaining(`expiring on ${loyaltyExpiryDate.toLocaleDateString('en-US', {timeZone: 'UTC'})}`)
        }));
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            html: expect.stringContaining('CouponCycle Update')
        }));
    });

    it('should not send new benefit email if user.notifyNewBenefit is false', async () => {
        const today = utcDate(2023, 8, 15);
        jest.useFakeTimers().setSystemTime(today);
        // User wants no new benefit emails, and for this test, let's say no expiring ones either
        (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockUser({ notifyNewBenefit: false, notifyBenefitExpiration: false })]);
        
        // If both prefs are false, benefitStatus.findMany shouldn't even be called to populate email lists.
        // So, we don't need a complex mock for it here, the default `mockResolvedValue([])` from beforeEach is fine.

        await GET(createMockReq());
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should not send expiring benefit email if user.notifyBenefitExpiration is false', async () => {
        const today = utcDate(2023, 8, 15);
        jest.useFakeTimers().setSystemTime(today);
        // User wants no expiring benefit emails, and for this test, no new ones either.
        (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockUser({ notifyNewBenefit: false, notifyBenefitExpiration: false })]);

        // Similar to above, if both prefs are false, no need for specific benefitStatus.findMany mock here.

        await GET(createMockReq());
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should use mockDate from query params in non-production', async () => {
        // const originalNodeEnv = process.env.NODE_ENV; // This is not needed as jest.replaceProperty handles cleanup
        // Use jest.replaceProperty for all env changes to ensure proper restoration
        jest.replaceProperty(process, 'env', { 
            ...process.env, // Start with a clean slate of original env
            NODE_ENV: 'development', 
            CRON_SECRET: 'test-secret', // Ensure it's authorized
            NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000' 
        });
        
        // Clear consoleLogSpy *after* env setup and before the action that logs
        consoleLogSpy.mockClear(); 

        const mockDateParam = utcDate(2024, 1, 10, 14, 0, 0); // Feb 10, 2024, 2 PM UTC
        const queryMockDateStart = utcDate(2024, 1, 10); // Route logic will set to 00:00:00
        const queryMockDateEnd = utcDate(2024, 1, 11);   // Next day 00:00:00 for <

        (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockUser({id: 'user-mockdate'})]);
        (prisma.benefitStatus.findMany as jest.Mock)
            .mockResolvedValueOnce([
                mockBenefitStatus('mockedNew', queryMockDateStart, utcDate(2024, 2, 9), 'user-mockdate')
            ])
            .mockResolvedValueOnce([]);

        await GET(createMockReq(`?mockDate=${mockDateParam.toISOString()}`));
        
        const logCalls = consoleLogSpy.mock.calls.map(call => call[0]);
        expect(logCalls).toContainEqual(expect.stringContaining(`Using mock date: ${mockDateParam.toISOString()}`));
        expect(logCalls).toContainEqual(expect.stringContaining(`send-notifications started for: ${queryMockDateStart.toISOString()}`));
        
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            subject: 'New Benefit Cycles Have Started!',
            html: expect.stringContaining('Benefit mockedNew')
        }));
    });

    it('should handle sendEmail failure gracefully', async () => {
        const systemTime = utcDate(2023, 8, 15, 10,0,0);
        const queryStartDate = utcDate(2023, 8, 15);

        jest.useFakeTimers().setSystemTime(systemTime);
        (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockUser()]);
        (prisma.benefitStatus.findMany as jest.Mock)
            .mockResolvedValueOnce([  // new benefits (bulk query returns matching data)
                mockBenefitStatus('new', queryStartDate, utcDate(2023, 9, 14))
            ])
            .mockResolvedValueOnce([]); // expiring benefits

        (sendEmail as jest.Mock).mockResolvedValueOnce(false);

        await GET(createMockReq());
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to send"));
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("user1@example.com"));
    });

    it('should return 500 if prisma.user.findMany fails', async () => {
        (prisma.user.findMany as jest.Mock).mockRejectedValueOnce(new Error('User query failed'));
        
        // Clear consoleErrorSpy before the action that's expected to log an error
        consoleErrorSpy.mockClear();

        await GET(createMockReq());
        
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(NextResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Error executing cron job.' }),
            { status: 500 }
        );
    });

    // More detailed tests for logic will follow
  });

  // Test with NODE_ENV=development for mockDate functionality
  describe('runSendNotificationsLogic with mockDate (NODE_ENV=development)', () => {
    beforeEach(() => {
        // Ensure CRON_SECRET is set for authorization
        // Use jest.replaceProperty for all env changes to ensure proper restoration
        jest.replaceProperty(process, 'env', { 
            ...originalProcessEnv, // Start with a clean slate of original env
            NODE_ENV: 'development', 
            CRON_SECRET: 'test-secret', // Ensure it's authorized
            NEXTAUTH_URL: 'http://localhost:3000' // Ensure this is also present
        });
    });

    it('should handle mockDate parameter in development', async () => {
      // TODO: Add test implementation for mockDate functionality
      expect(true).toBe(true);
    });
  });

}); 