import { NextResponse } from 'next/server';
import { runNotificationDigest } from '@/lib/notification-digest';

export const maxDuration = 10;

function parseDryRun(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  return searchParams.get('dryRun') === 'true';
}

function parseNotificationDate(requestUrl: string): Date {
  let today = new Date();
  const { searchParams } = new URL(requestUrl);
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

  return today;
}

async function handleNotificationCron(request: Request) {
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

  const result = await runNotificationDigest({
    today: parseNotificationDate(request.url),
    dryRun: parseDryRun(request),
    baseUrl: process.env.NEXTAUTH_URL || '',
  });

  return NextResponse.json(result.body, { status: result.status });
}

export async function GET(request: Request) {
  return handleNotificationCron(request);
}

export async function POST(request: Request) {
  return handleNotificationCron(request);
}
