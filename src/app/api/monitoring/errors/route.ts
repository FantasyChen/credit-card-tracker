/**
 * Error monitoring endpoint
 * Receives and logs bounded, sanitized frontend error reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  isAmexHandoffUrl,
  MONITORING_ERROR_MAX_BYTES,
  parseMonitoringErrorReport,
  sanitizeMonitoringUrl,
} from '@/lib/monitoring/error-report';
import type { MonitoringErrorReport } from '@/lib/monitoring/error-report';

class MonitoringRequestError extends Error {
  constructor(readonly code: 'request_invalid' | 'request_too_large') {
    super(code);
  }
}

async function readBoundedJson(request: NextRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MONITORING_ERROR_MAX_BYTES) {
    throw new MonitoringRequestError('request_too_large');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MONITORING_ERROR_MAX_BYTES) {
    throw new MonitoringRequestError('request_too_large');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MonitoringRequestError('request_invalid');
  }
}

export async function POST(request: NextRequest) {
  const rawReferer = request.headers.get('referer');
  if (isAmexHandoffUrl(rawReferer)) {
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const session = await getServerSession(authOptions);
    const rawReport = await readBoundedJson(request);
    const errorReport = parseMonitoringErrorReport(rawReport);
    if (!errorReport) {
      return NextResponse.json(
        { error: 'Invalid error report' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (isAmexHandoffUrl(errorReport.url)) {
      return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    const enrichedError = {
      ...errorReport,
      url: sanitizeMonitoringUrl(errorReport.url),
      sessionUserId: session?.user?.id || null,
      serverTimestamp: new Date().toISOString(),
      referer: sanitizeMonitoringUrl(rawReferer),
    };

    console.error('Frontend Error Report:', JSON.stringify(enrichedError, null, 2));
    if (isCriticalError(errorReport)) {
      console.error('CRITICAL ERROR DETECTED:', enrichedError);
    }

    return NextResponse.json(
      { success: true, errorId: errorReport.errorId },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof MonitoringRequestError) {
      const status = error.code === 'request_too_large' ? 413 : 400;
      return NextResponse.json(
        { error: status === 413 ? 'Error report too large' : 'Invalid error report' },
        { status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { error: 'Failed to process error report' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'error-monitoring',
  });
}

function isCriticalError(errorReport: MonitoringErrorReport): boolean {
  const criticalPatterns = [
    /database.*connection/i,
    /auth.*failed/i,
    /payment.*error/i,
    /network.*error/i,
    /Cannot read propert.*of undefined/i,
    /TypeError.*undefined/i,
  ];

  return criticalPatterns.some((pattern) =>
    pattern.test(errorReport.message)
      || pattern.test(errorReport.stack || ''),
  );
}
