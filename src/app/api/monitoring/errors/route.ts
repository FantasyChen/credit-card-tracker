/**
 * Error monitoring endpoint
 * Receives and logs frontend errors for monitoring and debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface ErrorReport {
  errorId: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  userId?: string | null;
  additionalInfo?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const errorReport: ErrorReport = await request.json();

    // Add server-side context
    const enrichedError = {
      ...errorReport,
      sessionUserId: session?.user?.id || null,
      serverTimestamp: new Date().toISOString(),
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      referer: request.headers.get('referer') || 'unknown',
    };

    // Log structured error
    console.error('Frontend Error Report:', JSON.stringify(enrichedError, null, 2));

    // In production, you would send this to your monitoring service
    // Examples:
    // - Sentry: Sentry.captureException(new Error(errorReport.message), { extra: enrichedError });
    // - DataDog: logger.error('Frontend Error', enrichedError);
    // - Custom monitoring: await sendToMonitoringService(enrichedError);

    // For now, we'll store critical errors in the console and potentially database
    if (isCriticalError(errorReport)) {
      console.error('🚨 CRITICAL ERROR DETECTED:', enrichedError);
      
      // Could store in database for later analysis
      // await storeCriticalError(enrichedError);
    }

    return NextResponse.json({ 
      success: true, 
      errorId: errorReport.errorId 
    });

  } catch (error) {
    console.error('Error processing error report:', error);
    return NextResponse.json(
      { error: 'Failed to process error report' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'error-monitoring'
  });
}

/**
 * Determine if an error is critical and requires immediate attention
 */
function isCriticalError(errorReport: ErrorReport): boolean {
  const criticalPatterns = [
    /database.*connection/i,
    /auth.*failed/i,
    /payment.*error/i,
    /network.*error/i,
    /Cannot read propert.*of undefined/i,
    /TypeError.*undefined/i,
  ];

  return criticalPatterns.some(pattern => 
    pattern.test(errorReport.message) || 
    pattern.test(errorReport.stack || '')
  );
}

/**
 * Store critical errors for later analysis (implement based on your needs)
 */
// async function storeCriticalError(errorReport: Record<string, unknown>) {
//   // Example implementation - store in database
//   // const { prisma } = await import('@/lib/prisma');
//   // await prisma.errorLog.create({
//   //   data: {
//   //     errorId: errorReport.errorId,
//   //     message: errorReport.message,
//   //     stack: errorReport.stack,
//   //     url: errorReport.url,
//   //     userId: errorReport.sessionUserId,
//   //     timestamp: new Date(errorReport.timestamp),
//   //     metadata: errorReport,
//   //   }
//   // });
// }
