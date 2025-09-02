/**
 * Health check endpoint for monitoring system status
 * Provides comprehensive health information about the application
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    environment: HealthCheck;
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
  details?: Record<string, unknown>;
}

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Perform health checks
    const [databaseCheck, memoryCheck, environmentCheck] = await Promise.allSettled([
      checkDatabase(),
      checkMemory(),
      checkEnvironment(),
    ]);

    const checks = {
      database: getCheckResult(databaseCheck),
      memory: getCheckResult(memoryCheck),
      environment: getCheckResult(environmentCheck),
    };

    // Determine overall status
    const allChecks = Object.values(checks);
    const hasFailures = allChecks.some(check => check.status === 'fail');
    const hasWarnings = allChecks.some(check => check.status === 'warn');
    
    const overallStatus = hasFailures 
      ? 'unhealthy' 
      : hasWarnings 
        ? 'degraded' 
        : 'healthy';

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      checks,
    };

    const responseTime = Date.now() - startTime;

    // Log health check results
    console.log(`Health check completed in ${responseTime}ms - Status: ${overallStatus}`);

    // Return appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthStatus, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
      }
    });

  } catch (healthCheckError) {
    console.error('Health check failed:', healthCheckError);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure',
      responseTime: Date.now() - startTime,
    }, { status: 503 });
  }
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Simple query to test database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Test a more complex query to ensure performance is acceptable
    const userCount = await prisma.user.count();
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: responseTime < 1000 ? 'pass' : 'warn',
      responseTime,
      details: {
        userCount: userCount < 10000 ? userCount : '10000+', // Don't expose exact counts in prod
        connectionPool: 'active',
      }
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.message : 'Database connection failed',
      }
    };
  }
}

/**
 * Check memory usage
 */
async function checkMemory(): Promise<HealthCheck> {
  try {
    const memUsage = process.memoryUsage();
    const totalMB = Math.round(memUsage.rss / 1024 / 1024);
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    // Warning if using more than 512MB, fail if more than 1GB
    const status = totalMB > 1024 ? 'fail' : totalMB > 512 ? 'warn' : 'pass';
    
    return {
      status,
      details: {
        rss: `${totalMB}MB`,
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      }
    };
  } catch {
    return {
      status: 'fail',
      details: { error: 'Memory check failed' }
    };
  }
}

/**
 * Check environment configuration
 */
async function checkEnvironment(): Promise<HealthCheck> {
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    return {
      status: 'fail',
      details: {
        missing: missingVars,
        message: 'Required environment variables are missing'
      }
    };
  }
  
  // Check optional but important vars
  const optionalVars = ['RESEND_API_KEY', 'CRON_SECRET'];
  const missingOptional = optionalVars.filter(varName => !process.env[varName]);
  
  return {
    status: missingOptional.length > 0 ? 'warn' : 'pass',
    details: {
      environment: process.env.NODE_ENV || 'unknown',
      missingOptional: missingOptional.length > 0 ? missingOptional : undefined,
      timezone: process.env.TZ || 'system default',
    }
  };
}

/**
 * Extract result from Promise.allSettled
 */
function getCheckResult(result: PromiseSettledResult<HealthCheck>): HealthCheck {
  if (result.status === 'fulfilled') {
    return result.value;
  } else {
    return {
      status: 'fail',
      details: {
        error: result.reason instanceof Error ? result.reason.message : 'Check failed'
      }
    };
  }
}
