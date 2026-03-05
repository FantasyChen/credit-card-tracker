import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export const maxDuration = 10;

async function runSendNotificationsLogic(requestUrlForMockDate?: string, dryRun = false) {
  let today = new Date();
  if (requestUrlForMockDate) {
    const { searchParams } = new URL(requestUrlForMockDate);
    const mockDateString = searchParams.get('mockDate');
    if (process.env.NODE_ENV !== 'production' && mockDateString) {
      const parsedMockDate = new Date(mockDateString);
      if (!isNaN(parsedMockDate.getTime())) {
        today = parsedMockDate;
        console.log(`send-notifications: Using mock date: ${today.toISOString()}`);
      } else {
        console.warn(`send-notifications: Invalid mockDate: ${mockDateString}`);
      }
    }
  }

  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const startMs = Date.now();
  console.log(`🚀 send-notifications started for: ${today.toISOString()}${dryRun ? ' [DRY RUN]' : ''}`);

  try {
    const usersToNotify = await prisma.user.findMany({
      where: {
        AND: [
          { OR: [{ notifyNewBenefit: true }, { notifyBenefitExpiration: true }, { notifyPointsExpiration: true }] },
          { email: { contains: '@' } },
        ],
      },
      select: {
        id: true, email: true, name: true,
        notifyNewBenefit: true, notifyBenefitExpiration: true,
        notifyExpirationDays: true, notifyPointsExpiration: true,
        pointsExpirationDays: true,
      },
    });

    if (usersToNotify.length === 0) {
      console.log('No users with notification preferences.');
      return NextResponse.json({ message: 'No users to notify.' }, { status: 200 });
    }

    const userMap = new Map(usersToNotify.map(u => [u.id, u]));

    const newBenefitUserIds = usersToNotify.filter(u => u.notifyNewBenefit).map(u => u.id);
    const expirationUsers = usersToNotify.filter(u => u.notifyBenefitExpiration && u.notifyExpirationDays && u.notifyExpirationDays > 0);
    const expirationUserIds = expirationUsers.map(u => u.id);
    const maxExpirationDays = expirationUsers.length > 0
      ? Math.max(...expirationUsers.map(u => u.notifyExpirationDays!))
      : 0;
    const loyaltyUsers = usersToNotify.filter(u => u.notifyPointsExpiration && u.pointsExpirationDays && u.pointsExpirationDays > 0);
    const loyaltyUserIds = loyaltyUsers.map(u => u.id);
    const maxPointsDays = loyaltyUsers.length > 0
      ? Math.max(...loyaltyUsers.map(u => u.pointsExpirationDays!))
      : 0;

    // 3 bulk queries instead of N×3 per-user queries
    const maxWindow = new Date(today.getTime() + Math.max(maxExpirationDays, maxPointsDays) * 24 * 60 * 60 * 1000);
    maxWindow.setUTCHours(23, 59, 59, 999);

    const [newStatuses, expiringStatuses, expiringLoyalty] = await Promise.all([
      newBenefitUserIds.length > 0
        ? prisma.benefitStatus.findMany({
            where: {
              userId: { in: newBenefitUserIds },
              isCompleted: false,
              cycleStartDate: { gte: today, lt: tomorrow },
            },
            include: { benefit: { include: { creditCard: true } }, user: true },
          })
        : Promise.resolve([]),

      expirationUserIds.length > 0 && maxExpirationDays > 0
        ? prisma.benefitStatus.findMany({
            where: {
              userId: { in: expirationUserIds },
              isCompleted: false,
              cycleEndDate: { gte: today, lte: maxWindow },
            },
            include: { benefit: { include: { creditCard: true } }, user: true },
          })
        : Promise.resolve([]),

      loyaltyUserIds.length > 0 && maxPointsDays > 0
        ? prisma.loyaltyAccount.findMany({
            where: {
              userId: { in: loyaltyUserIds },
              isActive: true,
              expirationDate: { not: null, gte: today, lte: maxWindow },
            },
            include: { loyaltyProgram: true },
          })
        : Promise.resolve([]),
    ]);

    const fetchMs = Date.now() - startMs;
    console.log(`📊 Fetched ${newStatuses.length} new, ${expiringStatuses.length} expiring, ${expiringLoyalty.length} loyalty in ${fetchMs}ms`);

    // Group new statuses by user
    const newByUser = new Map<string, typeof newStatuses>();
    for (const s of newStatuses) {
      const list = newByUser.get(s.userId) || [];
      list.push(s);
      newByUser.set(s.userId, list);
    }

    // Filter expiring statuses per-user (each user has their own expirationDays)
    const expiringByUser = new Map<string, typeof expiringStatuses>();
    for (const s of expiringStatuses) {
      const user = userMap.get(s.userId);
      if (!user?.notifyExpirationDays) continue;
      const reminderDate = new Date(today);
      reminderDate.setDate(today.getDate() + user.notifyExpirationDays);
      const dayStart = new Date(Date.UTC(reminderDate.getUTCFullYear(), reminderDate.getUTCMonth(), reminderDate.getUTCDate(), 0, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(reminderDate.getUTCFullYear(), reminderDate.getUTCMonth(), reminderDate.getUTCDate(), 23, 59, 59, 999));
      if (s.cycleEndDate >= dayStart && s.cycleEndDate <= dayEnd) {
        const list = expiringByUser.get(s.userId) || [];
        list.push(s);
        expiringByUser.set(s.userId, list);
      }
    }

    // Filter loyalty accounts per-user (each user has their own pointsExpirationDays)
    const loyaltyByUser = new Map<string, typeof expiringLoyalty>();
    for (const a of expiringLoyalty) {
      const user = userMap.get(a.userId);
      if (!user?.pointsExpirationDays || !a.expirationDate) continue;
      const reminderDate = new Date(today);
      reminderDate.setDate(today.getDate() + user.pointsExpirationDays);
      const dayStart = new Date(Date.UTC(reminderDate.getUTCFullYear(), reminderDate.getUTCMonth(), reminderDate.getUTCDate(), 0, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(reminderDate.getUTCFullYear(), reminderDate.getUTCMonth(), reminderDate.getUTCDate(), 23, 59, 59, 999));
      if (a.expirationDate >= dayStart && a.expirationDate <= dayEnd) {
        const list = loyaltyByUser.get(a.userId) || [];
        list.push(a);
        loyaltyByUser.set(a.userId, list);
      }
    }

    // Build all email tasks, then send in parallel
    const emailTasks: { to: string; subject: string; html: string }[] = [];
    const baseUrl = process.env.NEXTAUTH_URL || '';

    for (const user of usersToNotify) {
      if (!user.email) continue;

      const newBenefits = newByUser.get(user.id);
      if (newBenefits && newBenefits.length > 0) {
        const benefitsHtml = newBenefits.map(s =>
          `<li><strong>${s.benefit.description}</strong> on your ${s.benefit.creditCard?.name ?? 'card'}. Cycle: ${fmtDate(s.cycleStartDate)} - ${fmtDate(s.cycleEndDate)}.</li>`
        ).join('');
        emailTasks.push({
          to: user.email,
          subject: 'Your New Benefit Cycles Have Started!',
          html: `<h1>New Benefit Cycles!</h1><p>Hi ${user.name || 'there'},</p><p>The following new benefit cycles have started for you:</p><ul>${benefitsHtml}</ul><p>Make sure to use them!</p><a href="${baseUrl}/benefits">View Your Benefits</a>`,
        });
      }

      const expiring = expiringByUser.get(user.id);
      if (expiring && expiring.length > 0) {
        const benefitsHtml = expiring.map(s =>
          `<li><strong>${s.benefit.description}</strong> on your ${s.benefit.creditCard?.name ?? 'card'}, expiring on ${fmtDate(s.cycleEndDate)} (in ${user.notifyExpirationDays} day(s)).</li>`
        ).join('');
        emailTasks.push({
          to: user.email,
          subject: 'Benefit Expiration Reminders',
          html: `<h1>Benefits Expiring Soon!</h1><p>Hi ${user.name || 'there'},</p><p>The following benefits are expiring soon for you:</p><ul>${benefitsHtml}</ul><p>Don't miss out!</p><a href="${baseUrl}/benefits">View Your Benefits</a>`,
        });
      }

      const loyalty = loyaltyByUser.get(user.id);
      if (loyalty && loyalty.length > 0) {
        const loyaltyHtml = loyalty.map(a => {
          const expDate = a.expirationDate ? fmtDate(a.expirationDate) : 'Unknown';
          return `<li><strong>${a.loyaltyProgram.displayName}</strong> points expiring on ${expDate} (in ${user.pointsExpirationDays} day(s)).${a.accountNumber ? ` Account: ${a.accountNumber}` : ''}</li>`;
        }).join('');
        emailTasks.push({
          to: user.email,
          subject: 'Loyalty Points Expiring Soon!',
          html: `<h1>Loyalty Points Expiring Soon!</h1><p>Hi ${user.name || 'there'},</p><p>The following loyalty program points are expiring soon:</p><ul>${loyaltyHtml}</ul><p>Consider earning or redeeming points to prevent expiration!</p><a href="${baseUrl}/loyalty">Manage Your Loyalty Accounts</a>`,
        });
      }
    }

    // Send all emails in parallel (batch of 10 to avoid rate limits)
    let emailsSent = 0;

    if (dryRun) {
      console.log(`🔍 [DRY RUN] Would send ${emailTasks.length} emails — skipping`);
      for (const task of emailTasks) {
        console.log(`  📧 → ${task.to}: ${task.subject}`);
      }
      emailsSent = emailTasks.length;
    } else {
      const BATCH = 10;
      for (let i = 0; i < emailTasks.length; i += BATCH) {
        const batch = emailTasks.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(task => sendEmail({ to: task.to, subject: task.subject, html: task.html }))
        );
        emailsSent += results.filter(r => r.status === 'fulfilled' && r.value).length;
      }
    }

    const totalMs = Date.now() - startMs;
    console.log(`✅ Done in ${totalMs}ms: ${usersToNotify.length} users, ${emailsSent}/${emailTasks.length} emails sent`);

    return NextResponse.json({
      message: dryRun ? 'Notification dry run completed.' : 'Notification cron job executed.',
      dryRun,
      usersProcessed: usersToNotify.length,
      emailsSent,
      emailsAttempted: emailTasks.length,
      durationMs: totalMs,
    }, { status: 200 });
  } catch (error) {
    const totalMs = Date.now() - startMs;
    console.error(`💥 send-notifications failed after ${totalMs}ms:`, error);
    return NextResponse.json({ message: 'Error executing cron job.', durationMs: totalMs }, { status: 500 });
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function parseDryRun(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  return searchParams.get('dryRun') === 'true';
}

export async function GET(request: Request) {
  const authorizationHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron attempt for send-notifications.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return await runSendNotificationsLogic(request.url, parseDryRun(request));
}

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET is not set.');
    return NextResponse.json({ message: 'Cron secret not configured.' }, { status: 500 });
  }

  if (authorizationHeader !== `Bearer ${expectedSecret}`) {
    console.warn('Unauthorized cron attempt for send-notifications.');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return await runSendNotificationsLogic(request.url, parseDryRun(request));
}
