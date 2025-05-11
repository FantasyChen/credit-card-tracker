import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { BenefitStatus, User, Benefit, CreditCard } from '@/generated/prisma';

// Extend Prisma types to ensure relations are included for type safety
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface UserWithNotificationPrefs extends User {}
interface BenefitStatusWithDetails extends BenefitStatus {
  benefit: Benefit & { creditCard: CreditCard };
  user: UserWithNotificationPrefs;
}

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get('x-vercel-cron-authorization');
  const expectedSecret = process.env.CRON_SECRET;

  console.log(`send-notifications: Received x-vercel-cron-authorization header: "${authorizationHeader}"`);
  console.log(`send-notifications: Expected CRON_SECRET from env: "${expectedSecret}"`);

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set in send-notifications POST handler.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron job attempt for send-notifications.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mockDateString = searchParams.get('mockDate');
  let today = new Date();

  if (process.env.NODE_ENV !== 'production' && mockDateString) {
    const parsedMockDate = new Date(mockDateString);
    if (!isNaN(parsedMockDate.getTime())) {
      today = parsedMockDate;
      console.log(`Using mock date for send-notifications: ${today.toISOString()}`);
    } else {
      console.warn(`Invalid mockDate format received: ${mockDateString}. Using current date.`);
    }
  }

  today.setHours(0, 0, 0, 0); // Normalize to start of day for comparisons

  let emailsSent = 0;
  let usersProcessed = 0;

  try {
    // 1. Fetch users who want notifications
    const usersToNotify = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { notifyNewBenefit: true },
              { notifyBenefitExpiration: true },
            ],
          },
          {
            email: { contains: '@' }
          },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        notifyNewBenefit: true,
        notifyBenefitExpiration: true,
        notifyExpirationDays: true,
      },
    });

    usersProcessed = usersToNotify.length;
    if (usersProcessed === 0) {
      console.log('send-notifications: No users with notification preferences enabled.');
      return NextResponse.json({ message: 'No users to notify.' }, { status: 200 });
    }

    for (const user of usersToNotify) {
      if (!user.email) continue; // Should be filtered by query, but double check

      const newBenefitCyclesToNotify: BenefitStatusWithDetails[] = [];
      const expiringBenefitsToNotify: BenefitStatusWithDetails[] = [];

      // --- Collect "New Benefit Cycle" Notifications ---
      if (user.notifyNewBenefit) {
        const newBenefitStatuses = await prisma.benefitStatus.findMany({
          where: {
            userId: user.id,
            isCompleted: false,
            cycleStartDate: { 
              gte: today, // Cycle started today
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // And before tomorrow
            }
            // Optional: Add a flag like `notifiedNewCycle: false` to BenefitStatus
            // and update it here to prevent re-notifying.
          },
          include: {
            benefit: { include: { creditCard: true } },
            user: true 
          },
        }) as BenefitStatusWithDetails[];
        newBenefitCyclesToNotify.push(...newBenefitStatuses);
      }

      // --- Collect "Benefit Expiration Reminder" Notifications ---
      if (user.notifyBenefitExpiration && user.notifyExpirationDays && user.notifyExpirationDays > 0) {
        const reminderDate = new Date(today);
        reminderDate.setDate(today.getDate() + user.notifyExpirationDays);
        const reminderDateStart = new Date(reminderDate);
        reminderDateStart.setHours(0,0,0,0);
        const reminderDateEnd = new Date(reminderDate);
        reminderDateEnd.setHours(23,59,59,999);

        const expiringStatuses = await prisma.benefitStatus.findMany({
          where: {
            userId: user.id,
            isCompleted: false,
            cycleEndDate: { 
              gte: reminderDateStart, 
              lte: reminderDateEnd
            }
            // Optional: Add a flag like `notifiedExpiration: false` to BenefitStatus
          },
          include: {
            benefit: { include: { creditCard: true } },
            user: true
          },
        }) as BenefitStatusWithDetails[];
        expiringBenefitsToNotify.push(...expiringStatuses);
      }

      // --- Send Summary Email for New Benefit Cycles ---
      if (newBenefitCyclesToNotify.length > 0) {
        const subject = "Your New Benefit Cycles Have Started!";
        const benefitsListHtml = newBenefitCyclesToNotify.map(status => 
          `<li>
             <strong>${status.benefit.description}</strong> on your ${status.benefit.creditCard.name} card.
             Cycle: ${status.cycleStartDate.toLocaleDateString()} - ${status.cycleEndDate.toLocaleDateString()}.
           </li>`
        ).join('');

        const htmlBody = `
          <h1>New Benefit Cycles!</h1>
          <p>Hi ${user.name || 'there'},</p>
          <p>The following new benefit cycles have started for you:</p>
          <ul>${benefitsListHtml}</ul>
          <p>Make sure to use them!</p>
          <a href="${process.env.NEXTAUTH_URL}/benefits">View Your Benefits</a>
        `;
        const success = await sendEmail({ to: user.email, subject, html: htmlBody });
        if (success) {
          emailsSent++;
          // TODO: Mark these statuses as notified (e.g., update notifiedNewCycle: true)
        }
      }

      // --- Send Summary Email for Expiring Benefits ---
      if (expiringBenefitsToNotify.length > 0) {
        const subject = "Benefit Expiration Reminders";
        const benefitsListHtml = expiringBenefitsToNotify.map(status => 
          `<li>
             <strong>${status.benefit.description}</strong> on your ${status.benefit.creditCard.name} card,
             expiring on ${status.cycleEndDate.toLocaleDateString()} (in ${user.notifyExpirationDays} day(s)).
           </li>`
        ).join('');
        
        const htmlBody = `
          <h1>Benefits Expiring Soon!</h1>
          <p>Hi ${user.name || 'there'},</p>
          <p>The following benefits are expiring soon for you:</p>
          <ul>${benefitsListHtml}</ul>
          <p>Don\'t miss out!</p>
          <a href="${process.env.NEXTAUTH_URL}/benefits">View Your Benefits</a>
        `;
        const success = await sendEmail({ to: user.email, subject, html: htmlBody });
        if (success) {
          emailsSent++;
          // TODO: Mark these statuses as notified (e.g., update notifiedExpiration: true)
        }
      }
    }

    console.log(`send-notifications: Processed ${usersProcessed} users. Sent ${emailsSent} emails.`);
    return NextResponse.json({ message: 'Notification cron job executed.', usersProcessed, emailsSent }, { status: 200 });

  } catch (error) {
    console.error('Error executing send-notifications cron job:', error);
    return NextResponse.json({ message: 'Error executing cron job.' }, { status: 500 });
  }
}