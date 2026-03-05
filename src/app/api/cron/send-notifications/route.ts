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

    // Build one digest email per user (consolidates up to 3 notification types into 1 email)
    const emailTasks: { to: string; subject: string; html: string }[] = [];
    const baseUrl = process.env.NEXTAUTH_URL || '';

    for (const user of usersToNotify) {
      if (!user.email) continue;

      const newBenefits = newByUser.get(user.id);
      const expiring = expiringByUser.get(user.id);
      const loyalty = loyaltyByUser.get(user.id);

      const hasNew = newBenefits && newBenefits.length > 0;
      const hasExpiring = expiring && expiring.length > 0;
      const hasLoyalty = loyalty && loyalty.length > 0;
      if (!hasNew && !hasExpiring && !hasLoyalty) continue;

      const sections: string[] = [];
      const sectionLabels: string[] = [];

      if (hasNew) {
        sectionLabels.push('New Benefits');
        const items = newBenefits.map(s =>
          `<li><strong>${s.benefit.description}</strong> on your ${s.benefit.creditCard?.name ?? 'card'}. Cycle: ${fmtDate(s.cycleStartDate)} – ${fmtDate(s.cycleEndDate)}.</li>`
        ).join('');
        sections.push(
          `<h2 style="color:#4F46E5;margin:24px 0 8px;">New Benefit Cycles</h2>` +
          `<p>The following benefit cycles have started:</p><ul>${items}</ul>` +
          `<p><a href="${baseUrl}/benefits" style="color:#4F46E5;">View Your Benefits &rarr;</a></p>`
        );
      }

      if (hasExpiring) {
        sectionLabels.push('Expiring Benefits');
        const items = expiring.map(s =>
          `<li><strong>${s.benefit.description}</strong> on your ${s.benefit.creditCard?.name ?? 'card'}, expiring on ${fmtDate(s.cycleEndDate)} (in ${user.notifyExpirationDays} day(s)).</li>`
        ).join('');
        sections.push(
          `<h2 style="color:#DC2626;margin:24px 0 8px;">Benefits Expiring Soon</h2>` +
          `<p>Don't miss out on these benefits:</p><ul>${items}</ul>` +
          `<p><a href="${baseUrl}/benefits" style="color:#4F46E5;">View Your Benefits &rarr;</a></p>`
        );
      }

      if (hasLoyalty) {
        sectionLabels.push('Expiring Points');
        const items = loyalty.map(a => {
          const expDate = a.expirationDate ? fmtDate(a.expirationDate) : 'Unknown';
          return `<li><strong>${a.loyaltyProgram.displayName}</strong> points expiring on ${expDate} (in ${user.pointsExpirationDays} day(s)).${a.accountNumber ? ` Account: ${a.accountNumber}` : ''}</li>`;
        }).join('');
        sections.push(
          `<h2 style="color:#D97706;margin:24px 0 8px;">Loyalty Points Expiring Soon</h2>` +
          `<p>Consider earning or redeeming to prevent expiration:</p><ul>${items}</ul>` +
          `<p><a href="${baseUrl}/loyalty" style="color:#4F46E5;">Manage Loyalty Accounts &rarr;</a></p>`
        );
      }

      const subject = sectionLabels.length === 1
        ? digestSubjectForSection(sectionLabels[0])
        : 'Your CouponCycle Daily Update';

      const html = buildDigestHtml(user.name || 'there', sections, baseUrl);

      emailTasks.push({ to: user.email, subject, html });
    }

    // Send all emails in parallel (batch of 10 to stay under 2 req/s rate limit)
    let emailsSent = 0;

    if (dryRun) {
      console.log(`🔍 [DRY RUN] Would send ${emailTasks.length} digest emails — skipping`);
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
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === 'fulfilled' && r.value) {
            emailsSent++;
          } else {
            console.warn(`Failed to send '${batch[j].subject}' email to ${batch[j].to}`);
          }
        }
      }
    }

    const totalMs = Date.now() - startMs;
    console.log(`✅ Done in ${totalMs}ms: ${usersToNotify.length} users, ${emailsSent}/${emailTasks.length} digest emails sent`);

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

function digestSubjectForSection(label: string): string {
  switch (label) {
    case 'New Benefits': return 'New Benefit Cycles Have Started!';
    case 'Expiring Benefits': return 'Benefits Expiring Soon!';
    case 'Expiring Points': return 'Loyalty Points Expiring Soon!';
    default: return 'Your CouponCycle Daily Update';
  }
}

function buildDigestHtml(name: string, sections: string[], baseUrl: string): string {
  return [
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1F2937;">`,
    `<h1 style="color:#4F46E5;border-bottom:2px solid #E5E7EB;padding-bottom:12px;">CouponCycle Update</h1>`,
    `<p>Hi ${name},</p>`,
    `<p>Here's what needs your attention today:</p>`,
    sections.join('<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">'),
    `<hr style="border:none;border-top:2px solid #E5E7EB;margin:32px 0 16px;">`,
    `<p style="color:#6B7280;font-size:13px;">You're receiving this because you enabled notifications in your ` +
      `<a href="${baseUrl}/settings" style="color:#4F46E5;">CouponCycle settings</a>.</p>`,
    `</div>`,
  ].join('');
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
