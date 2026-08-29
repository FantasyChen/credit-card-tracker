import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { SITE_NAME } from '@/lib/site';
import { BenefitFrequency } from '@/generated/prisma';
import { fetchTrackedBenefitStatuses } from '@/lib/benefit-tracking-preferences';

const MIN_EMAILABLE_BENEFIT_CYCLE_MS = 28 * 24 * 60 * 60 * 1000 - 1;

export interface NotificationDigestRunOptions {
  today?: Date;
  dryRun?: boolean;
  baseUrl?: string;
}

export interface NotificationDigestRunResult {
  body: Record<string, unknown>;
  status: number;
}

export async function runNotificationDigest({
  today: inputToday = new Date(),
  dryRun = false,
  baseUrl = process.env.NEXTAUTH_URL || '',
}: NotificationDigestRunOptions = {}): Promise<NotificationDigestRunResult> {
  const today = new Date(inputToday);
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
      return { body: { message: 'No users to notify.' }, status: 200 };
    }

    const userMap = new Map(usersToNotify.map((user) => [user.id, user]));
    const newBenefitUserIds = usersToNotify.filter((user) => user.notifyNewBenefit).map((user) => user.id);
    const effectiveExpirationDaysByUser = new Map(
      usersToNotify.map((user) => [
        user.id,
        user.notifyExpirationDays,
      ])
    );

    const expirationUsers = usersToNotify.filter((user) => {
      const effectiveDays = effectiveExpirationDaysByUser.get(user.id);
      return user.notifyBenefitExpiration && effectiveDays && effectiveDays > 0;
    });
    const expirationUserIds = expirationUsers.map((user) => user.id);
    const maxExpirationDays = expirationUsers.length > 0
      ? Math.max(...expirationUsers.map((user) => effectiveExpirationDaysByUser.get(user.id)!))
      : 0;
    const loyaltyUsers = usersToNotify.filter((user) =>
      user.notifyPointsExpiration && user.pointsExpirationDays && user.pointsExpirationDays > 0
    );
    const loyaltyUserIds = loyaltyUsers.map((user) => user.id);
    const maxPointsDays = loyaltyUsers.length > 0
      ? Math.max(...loyaltyUsers.map((user) => user.pointsExpirationDays!))
      : 0;

    const maxWindow = new Date(today.getTime() + Math.max(maxExpirationDays, maxPointsDays) * 24 * 60 * 60 * 1000);
    maxWindow.setUTCHours(23, 59, 59, 999);

    const [newStatuses, expiringStatuses, expiringLoyalty, expiringCertificates] = await Promise.all([
      newBenefitUserIds.length > 0
        ? fetchTrackedBenefitStatuses(prisma, {
            userIds: newBenefitUserIds,
            completed: false,
            notUsable: false,
            cycleStartOnOrAfter: today,
            cycleStartOnOrBefore: new Date(tomorrow.getTime() - 1),
          })
        : Promise.resolve([]),

      expirationUserIds.length > 0 && maxExpirationDays > 0
        ? fetchTrackedBenefitStatuses(prisma, {
            userIds: expirationUserIds,
            completed: false,
            notUsable: false,
            cycleEndOnOrAfter: today,
            cycleEndOnOrBefore: maxWindow,
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

      loyaltyUserIds.length > 0 && maxPointsDays > 0
        ? prisma.loyaltyCertificate.findMany({
            where: {
              userId: { in: loyaltyUserIds },
              isActive: true,
              expirationDate: { gte: today, lte: maxWindow },
              loyaltyAccount: { isActive: true },
            },
            include: {
              loyaltyAccount: {
                include: { loyaltyProgram: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const emailEligibleNewStatuses = newStatuses.filter(isEmailEligibleBenefitStatus);
    const emailEligibleExpiringStatuses = expiringStatuses.filter(isEmailEligibleBenefitStatus);

    const fetchMs = Date.now() - startMs;
    console.log(
      `📊 Fetched ${newStatuses.length} new (${emailEligibleNewStatuses.length} email-eligible), ` +
      `${expiringStatuses.length} expiring (${emailEligibleExpiringStatuses.length} email-eligible), ` +
      `${expiringLoyalty.length} loyalty, ${expiringCertificates.length} certificates in ${fetchMs}ms`
    );

    const newByUser = groupByUserId(emailEligibleNewStatuses);
    const expiringByUser = filterByReminderWindow(
      emailEligibleExpiringStatuses,
      userMap,
      today,
      (user) => effectiveExpirationDaysByUser.get(user.id),
      (status) => status.cycleEndDate,
    );
    const loyaltyByUser = filterByReminderWindow(
      expiringLoyalty,
      userMap,
      today,
      (user) => user.pointsExpirationDays,
      (account) => account.expirationDate,
    );
    const certificatesByUser = filterByReminderWindow(
      expiringCertificates,
      userMap,
      today,
      (user) => user.pointsExpirationDays,
      (certificate) => certificate.expirationDate,
    );
    const emailTasks = buildDigestEmailTasks({
      usersToNotify,
      newByUser,
      expiringByUser,
      loyaltyByUser,
      certificatesByUser,
      effectiveExpirationDaysByUser,
      baseUrl,
    });

    let emailsSent = 0;
    const emailsSkippedByLimit = 0;

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
          batch.map(async (task) => {
            return sendEmail({ to: task.to, subject: task.subject, html: task.html });
          })
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          if (result.status === 'fulfilled' && result.value) {
            emailsSent++;
          } else if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value === false)) {
            console.warn(`Failed to send '${batch[j].subject}' email to ${batch[j].to}`);
          }
        }
      }
    }

    const totalMs = Date.now() - startMs;
    console.log(`✅ Done in ${totalMs}ms: ${usersToNotify.length} users, ${emailsSent}/${emailTasks.length} digest emails sent, ${emailsSkippedByLimit} skipped`);

    return {
      body: {
        message: dryRun ? 'Notification dry run completed.' : 'Notification cron job executed.',
        dryRun,
        usersProcessed: usersToNotify.length,
        emailsSent,
        emailsAttempted: emailTasks.length,
        emailsSkippedByLimit,
        durationMs: totalMs,
      },
      status: 200,
    };
  } catch (error) {
    const totalMs = Date.now() - startMs;
    console.error(`💥 send-notifications failed after ${totalMs}ms:`, error);
    return {
      body: { message: 'Error executing cron job.', durationMs: totalMs },
      status: 500,
    };
  }
}

function groupByUserId<T extends { userId: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const list = grouped.get(item.userId) ?? [];
    list.push(item);
    grouped.set(item.userId, list);
  }
  return grouped;
}

function filterByReminderWindow<T extends { userId: string }>(
  items: T[],
  userMap: Map<string, NotificationUser>,
  today: Date,
  daysForUser: (user: NotificationUser) => number | null | undefined,
  dateForItem: (item: T) => Date | null | undefined,
): Map<string, T[]> {
  const itemsByUser = new Map<string, T[]>();

  for (const item of items) {
    const user = userMap.get(item.userId);
    const days = user ? daysForUser(user) : undefined;
    const expirationDate = dateForItem(item);
    if (!days || !expirationDate) continue;

    const { dayStart, dayEnd } = reminderWindow(today, days);
    if (!(expirationDate >= dayStart && expirationDate <= dayEnd)) continue;

    const list = itemsByUser.get(item.userId) ?? [];
    list.push(item);
    itemsByUser.set(item.userId, list);
  }
  return itemsByUser;
}

function buildDigestEmailTasks({
  usersToNotify,
  newByUser,
  expiringByUser,
  loyaltyByUser,
  certificatesByUser,
  effectiveExpirationDaysByUser,
  baseUrl,
}: {
  usersToNotify: NotificationUser[];
  newByUser: Map<string, EmailBenefitStatus[]>;
  expiringByUser: Map<string, EmailBenefitStatus[]>;
  loyaltyByUser: Map<string, EmailLoyaltyAccount[]>;
  certificatesByUser: Map<string, EmailLoyaltyCertificate[]>;
  effectiveExpirationDaysByUser: Map<string, number>;
  baseUrl: string;
}): Array<{ to: string; userId: string; subject: string; html: string }> {
  const emailTasks: Array<{ to: string; userId: string; subject: string; html: string }> = [];

  for (const user of usersToNotify) {
    if (!user.email) continue;

    const newBenefits = newByUser.get(user.id);
    const expiring = expiringByUser.get(user.id);
    const loyalty = loyaltyByUser.get(user.id);
    const certificates = certificatesByUser.get(user.id);

    const hasNew = Boolean(newBenefits?.length);
    const hasExpiring = Boolean(expiring?.length);
    const hasLoyalty = Boolean(loyalty?.length);
    const hasCertificates = Boolean(certificates?.length);
    if (!hasNew && !hasExpiring && !hasLoyalty && !hasCertificates) continue;

    const sections: string[] = [];
    const sectionLabels: string[] = [];

    if (hasNew && newBenefits) {
      sectionLabels.push('New Benefits');
      const items = newBenefits.map((status) =>
        `<li><strong>${escapeHtml(status.benefit.description)}</strong> on your ${escapeHtml(status.benefit.creditCard?.name ?? 'card')}. Cycle: ${fmtDate(status.cycleStartDate)} – ${fmtDate(status.cycleEndDate)}.</li>`
      ).join('');
      sections.push(
        `<h2 style="color:#4F46E5;margin:24px 0 8px;">New Benefit Cycles</h2>` +
        `<p>The following benefit cycles have started:</p><ul>${items}</ul>` +
        `<p><a href="${escapeHtml(baseUrl)}/benefits" style="color:#4F46E5;">View Your Benefits &rarr;</a></p>`
      );
    }

    if (hasExpiring && expiring) {
      sectionLabels.push('Expiring Benefits');
      const effectiveExpirationDays = effectiveExpirationDaysByUser.get(user.id) ?? user.notifyExpirationDays;
      const items = expiring.map((status) =>
        `<li><strong>${escapeHtml(status.benefit.description)}</strong> on your ${escapeHtml(status.benefit.creditCard?.name ?? 'card')}, expiring on ${fmtDate(status.cycleEndDate)} (in ${effectiveExpirationDays} day(s)).</li>`
      ).join('');
      sections.push(
        `<h2 style="color:#DC2626;margin:24px 0 8px;">Benefits Expiring Soon</h2>` +
        `<p>Don't miss out on these benefits:</p><ul>${items}</ul>` +
        `<p><a href="${escapeHtml(baseUrl)}/benefits" style="color:#4F46E5;">View Your Benefits &rarr;</a></p>`
      );
    }

    if (hasLoyalty && loyalty) {
      sectionLabels.push('Expiring Points');
      const items = loyalty.map((account) => {
        const expDate = account.expirationDate ? fmtDate(account.expirationDate) : 'Unknown';
        return `<li><strong>${escapeHtml(account.loyaltyProgram.displayName)}</strong> points expiring on ${expDate} (in ${user.pointsExpirationDays} day(s)).${account.accountNumber ? ` Account: ${escapeHtml(account.accountNumber)}` : ''}</li>`;
      }).join('');
      sections.push(
        `<h2 style="color:#D97706;margin:24px 0 8px;">Loyalty Points Expiring Soon</h2>` +
        `<p>Consider earning or redeeming to prevent expiration:</p><ul>${items}</ul>` +
        `<p><a href="${escapeHtml(baseUrl)}/loyalty" style="color:#4F46E5;">Manage Loyalty Accounts &rarr;</a></p>`
      );
    }

    if (hasCertificates && certificates) {
      sectionLabels.push('Expiring Certificates');
      const items = certificates.map((certificate) => {
        const expDate = fmtDate(certificate.expirationDate);
        const programName = escapeHtml(certificate.loyaltyAccount.loyaltyProgram.displayName);
        const label = escapeHtml(certificate.label || 'Free night certificate');
        const quantity = certificate.quantity > 1 ? ` (${certificate.quantity} available)` : '';
        return `<li><strong>${label}</strong>${quantity} for ${programName}, expiring on ${expDate} (in ${user.pointsExpirationDays} day(s)).</li>`;
      }).join('');
      sections.push(
        `<h2 style="color:#D97706;margin:24px 0 8px;">Free Night Certificates Expiring Soon</h2>` +
        `<p>Use these certificates before their expiration dates:</p><ul>${items}</ul>` +
        `<p><a href="${escapeHtml(baseUrl)}/loyalty" style="color:#4F46E5;">Manage Loyalty Accounts &rarr;</a></p>`
      );
    }

    const subject = sectionLabels.length === 1
      ? digestSubjectForSection(sectionLabels[0])
      : `Your ${SITE_NAME} Daily Update`;

    emailTasks.push({
      to: user.email,
      userId: user.id,
      subject,
      html: buildDigestHtml(user.name || 'there', sections, baseUrl),
    });
  }

  return emailTasks;
}

function isEmailEligibleBenefitStatus(status: EmailBenefitStatus): boolean {
  if (status.benefit.creditCard === null || status.benefit.creditCardId === null) {
    return false;
  }

  if (status.benefit.frequency === BenefitFrequency.WEEKLY) {
    return false;
  }

  return status.cycleEndDate.getTime() - status.cycleStartDate.getTime() >= MIN_EMAILABLE_BENEFIT_CYCLE_MS;
}

function reminderWindow(today: Date, days: number): { dayStart: Date; dayEnd: Date } {
  const reminderDate = new Date(today);
  reminderDate.setDate(today.getDate() + days);
  return {
    dayStart: new Date(Date.UTC(reminderDate.getUTCFullYear(), reminderDate.getUTCMonth(), reminderDate.getUTCDate(), 0, 0, 0, 0)),
    dayEnd: new Date(Date.UTC(reminderDate.getUTCFullYear(), reminderDate.getUTCMonth(), reminderDate.getUTCDate(), 23, 59, 59, 999)),
  };
}

function digestSubjectForSection(label: string): string {
  switch (label) {
    case 'New Benefits': return 'New Benefit Cycles Have Started!';
    case 'Expiring Benefits': return 'Benefits Expiring Soon!';
    case 'Expiring Points': return 'Loyalty Points Expiring Soon!';
    case 'Expiring Certificates': return 'Free Night Certificates Expiring Soon!';
    default: return `Your ${SITE_NAME} Daily Update`;
  }
}

function buildDigestHtml(name: string, sections: string[], baseUrl: string): string {
  return [
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1F2937;">`,
    `<h1 style="color:#4F46E5;border-bottom:2px solid #E5E7EB;padding-bottom:12px;">${escapeHtml(SITE_NAME)} Update</h1>`,
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p>Here's what needs your attention today:</p>`,
    sections.join('<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">'),
    `<hr style="border:none;border-top:2px solid #E5E7EB;margin:32px 0 16px;">`,
    `<p style="color:#6B7280;font-size:13px;">You're receiving this because you enabled notifications in your ` +
      `<a href="${escapeHtml(baseUrl)}/settings" style="color:#4F46E5;">${escapeHtml(SITE_NAME)} settings</a>.</p>`,
    `</div>`,
  ].join('');
}

export function escapeNotificationHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

const escapeHtml = escapeNotificationHtml;

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

interface NotificationUser {
  id: string;
  email: string | null;
  name: string | null;
  notifyNewBenefit: boolean;
  notifyBenefitExpiration: boolean;
  notifyExpirationDays: number;
  notifyPointsExpiration: boolean | null;
  pointsExpirationDays: number | null;
}

interface EmailBenefitStatus {
  userId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  benefit: {
    description: string;
    creditCard?: { name: string } | null;
    creditCardId?: string | null;
    frequency?: BenefitFrequency | string | null;
  };
}

interface EmailLoyaltyAccount {
  userId: string;
  loyaltyProgram: {
    displayName: string;
  };
  accountNumber?: string | null;
  expirationDate: Date | null;
}

interface EmailLoyaltyCertificate {
  userId: string;
  label: string | null;
  quantity: number;
  expirationDate: Date;
  loyaltyAccount: {
    loyaltyProgram: {
      displayName: string;
    };
  };
}
