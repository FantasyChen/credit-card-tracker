#!/usr/bin/env node

import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

const SUBJECT = 'CouponCycle is now Perks Reminder';
const FROM_DOMAIN = 'notifications@perks-reminder.com';
const STATE_DIR = 'announcement-state';
const sinceArg = process.argv.find((arg) => arg.startsWith('--since='));
const firstFailedArg = process.argv.find((arg) => arg.startsWith('--first-failed='));
const since = new Date(sinceArg?.split('=')[1] || '2026-04-27T00:00:00.000Z');
const firstFailed = firstFailedArg?.split('=')[1]?.trim().toLowerCase();

async function getExpectedRecipients() {
  return prisma.user.findMany({
    where: {
      AND: [
        { email: { contains: '@' } },
        { email: { not: { endsWith: '@example.com' } } },
      ],
    },
    select: {
      email: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

async function listAnnouncementEmails() {
  const sent = [];
  let after;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await resend.get('/emails', {
      query: {
        limit: 100,
        ...(after ? { after } : {}),
      },
    });

    if (error) {
      throw new Error(`Resend list failed: ${JSON.stringify(error)}`);
    }

    const rows = data?.data || [];
    for (const email of rows) {
      const createdAt = new Date(email.created_at);
      if (createdAt < since) {
        hasMore = false;
        break;
      }

      if (
        email.subject === SUBJECT &&
        String(email.from || '').includes(FROM_DOMAIN)
      ) {
        sent.push(email);
      }
    }

    if (!data?.has_more || rows.length === 0 || !hasMore) {
      break;
    }

    after = rows[rows.length - 1].id;
  }

  return sent;
}

function writeLines(filename, rows) {
  fs.writeFileSync(filename, `${rows.join('\n')}${rows.length ? '\n' : ''}`);
}

async function main() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set.');
  }

  const expected = await getExpectedRecipients();
  const expectedEmails = expected.map((user) => user.email.toLowerCase());
  let successful;
  let remaining;
  let resendRecordsMatched = null;

  if (firstFailed) {
    const failedIndex = expectedEmails.indexOf(firstFailed);
    if (failedIndex === -1) {
      throw new Error(`First failed email not found in recipient list: ${firstFailed}`);
    }
    successful = expectedEmails.slice(0, failedIndex);
    remaining = expectedEmails.slice(failedIndex);
  } else {
    const sentEmails = await listAnnouncementEmails();
    const sentSet = new Set(sentEmails.flatMap((email) => (email.to || []).map((to) => to.toLowerCase())));
    successful = expectedEmails.filter((email) => sentSet.has(email));
    remaining = expectedEmails.filter((email) => !sentSet.has(email));
    resendRecordsMatched = sentEmails.length;
  }

  fs.mkdirSync(STATE_DIR, { recursive: true });
  writeLines(path.join(STATE_DIR, 'migration-announcement-sent.txt'), successful);
  writeLines(path.join(STATE_DIR, 'migration-announcement-remaining.txt'), remaining);
  fs.writeFileSync(
    path.join(STATE_DIR, 'migration-announcement-summary.json'),
    JSON.stringify({
      subject: SUBJECT,
      since: since.toISOString(),
      expected: expectedEmails.length,
      sent: successful.length,
      remaining: remaining.length,
      firstFailed: firstFailed || null,
      resendRecordsMatched,
      generatedAt: new Date().toISOString(),
    }, null, 2)
  );

  console.log(`Expected recipients: ${expectedEmails.length}`);
  console.log(`Sent according to Resend: ${successful.length}`);
  console.log(`Remaining for next batch: ${remaining.length}`);
  console.log(`State written to ${STATE_DIR}/`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
