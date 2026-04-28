#!/usr/bin/env node

import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { Resend } from 'resend';
import fs from 'fs';

dotenv.config();

const prisma = new PrismaClient();

const SUBJECT = 'CouponCycle is now Perks Reminder';
const MAIN_URL = 'https://www.perks-reminder.com';
const LOYALTY_URL = 'https://loyalty.perks-reminder.com';
const OLD_DOMAIN_END_DATE = 'May 27, 2026';
const DEFAULT_FROM_EMAIL = 'Perks Reminder <notifications@perks-reminder.com>';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const dryRun = args.has('--dry-run') || !force;
const testToArg = process.argv.find((arg) => arg.startsWith('--to='));
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const onlyFileArg = process.argv.find((arg) => arg.startsWith('--only-file='));
const testTo = testToArg?.split('=')[1]?.trim();
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
const onlyFile = onlyFileArg?.split('=')[1]?.trim();

function usage() {
  console.log(`
Usage:
  node scripts/send-migration-announcement.js --dry-run
  node scripts/send-migration-announcement.js --to=you@example.com --force
  node scripts/send-migration-announcement.js --force

Options:
  --dry-run       Count and list what would be sent without sending email.
  --force         Send the announcement.
  --to=email      Send a single test announcement to the given address.
  --limit=N       Send to at most N users. Useful for a cautious rollout.
  --only-file=F   Send only to newline-delimited emails in file F.
`);
}

function buildText(name) {
  return `Hi ${name || 'there'},

CouponCycle has moved to a new home: ${MAIN_URL}

Please update your bookmarks before ${OLD_DOMAIN_END_DATE}. The old coupon-cycle.site domain is expected to stop working after that date.

Your account, saved cards, benefits, loyalty programs, and notification settings are unchanged. You can sign in with the same account at the new domain.

New links:

- Main app: ${MAIN_URL}
- Loyalty tracker: ${LOYALTY_URL}

Thanks for using Perks Reminder.

The Perks Reminder team

---
You received this service announcement because you have a Perks Reminder account.`;
}

function buildHtml(name) {
  const greeting = name || 'there';
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;line-height:1.6;">
      <h1 style="color:#2563eb;margin:0 0 16px;">CouponCycle is now Perks Reminder</h1>
      <p>Hi ${escapeHtml(greeting)},</p>
      <p>CouponCycle has moved to a new home:</p>
      <p>
        <a href="${MAIN_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700;">
          Open Perks Reminder
        </a>
      </p>
      <p>Please update your bookmarks before <strong>${OLD_DOMAIN_END_DATE}</strong>. The old <strong>coupon-cycle.site</strong> domain is expected to stop working after that date.</p>
      <p>Your account, saved cards, benefits, loyalty programs, and notification settings are unchanged. You can sign in with the same account at the new domain.</p>
      <h2 style="font-size:18px;margin:24px 0 8px;">New links</h2>
      <ul>
        <li>Main app: <a href="${MAIN_URL}" style="color:#2563eb;">${MAIN_URL}</a></li>
        <li>Loyalty tracker: <a href="${LOYALTY_URL}" style="color:#2563eb;">${LOYALTY_URL}</a></li>
      </ul>
      <p>Thanks for using Perks Reminder.</p>
      <p>The Perks Reminder team</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;">
      <p style="font-size:12px;color:#6b7280;">You received this service announcement because you have a Perks Reminder account.</p>
    </div>
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRecipients() {
  if (testTo) {
    return [{ email: testTo, name: null }];
  }

  if (onlyFile) {
    const emails = fs.readFileSync(onlyFile, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    const limitedEmails = Number.isFinite(limit) && limit > 0 ? emails.slice(0, limit) : emails;
    return limitedEmails.map((email) => ({ email, name: null }));
  }

  return prisma.user.findMany({
    where: {
      AND: [
        { email: { contains: '@' } },
        { email: { not: { endsWith: '@example.com' } } },
      ],
    },
    select: {
      email: true,
      name: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
    ...(Number.isFinite(limit) && limit > 0 ? { take: limit } : {}),
  });
}

async function main() {
  if (args.has('--help')) {
    usage();
    return;
  }

  if (!dryRun && !process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set.');
  }

  const fromEmail = process.env.ANNOUNCEMENT_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  if (!dryRun && fromEmail.includes('coupon-cycle.site')) {
    throw new Error('Refusing to send the migration announcement from the old coupon-cycle.site domain.');
  }

  const recipients = await getRecipients();
  const uniqueRecipients = Array.from(
    new Map(recipients.map((recipient) => [recipient.email.toLowerCase(), recipient])).values()
  );

  console.log(`Subject: ${SUBJECT}`);
  console.log(`From: ${fromEmail}`);
  console.log(`Mode: ${dryRun ? 'dry run' : 'send'}`);
  console.log(`Recipients: ${uniqueRecipients.length}${testTo ? ' (single test recipient)' : ''}`);

  if (dryRun) {
    for (const recipient of uniqueRecipients) {
      console.log(`  - ${recipient.email}`);
    }
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  let quotaHit = false;

  for (const recipient of uniqueRecipients) {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipient.email,
      subject: SUBJECT,
      html: buildHtml(recipient.name),
      text: buildText(recipient.name),
    });

    if (error) {
      failed += 1;
      console.error(`Failed: ${recipient.email}`, error);
      if (error.name === 'daily_quota_exceeded' || error.message?.includes('daily email sending quota')) {
        quotaHit = true;
        console.error('Daily quota reached. Stopping so this batch can be resumed later.');
        break;
      }
    } else {
      sent += 1;
      console.log(`Sent: ${recipient.email} (${data?.id || 'no id'})`);
    }

    await sleep(650);
  }

  console.log(`Done. Sent ${sent}/${uniqueRecipients.length}. Failed ${failed}.`);

  if (quotaHit) {
    process.exitCode = 2;
  } else if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
