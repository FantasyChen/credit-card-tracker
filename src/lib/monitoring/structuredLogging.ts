/**
 * Structured logging utilities for better monitoring and debugging
 */

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  action?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    operation: string;
  };
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private baseContext: LogContext = {};

  private constructor() {}

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  setContext(context: Partial<LogContext>) {
    this.baseContext = { ...this.baseContext, ...context };
  }

  clearContext() {
    this.baseContext = {};
  }

  debug(message: string, context?: Partial<LogContext>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Partial<LogContext>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Partial<LogContext>) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Partial<LogContext>) {
    const errorContext = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : {};

    this.log('error', message, { ...context, ...errorContext });
  }

  performance(operation: string, duration: number, context?: Partial<LogContext>) {
    this.log('info', `Performance: ${operation}`, {
      ...context,
      performance: { operation, duration }
    });
  }

  private log(level: LogEntry['level'], message: string, context?: Partial<LogContext & { error?: { name: string; message: string; stack?: string }, performance?: { operation: string; duration: number } }>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.baseContext, ...context },
    };

    // Add error info if present
    if (context?.error) {
      entry.error = context.error;
    }

    // Add performance info if present
    if (context?.performance) {
      entry.performance = context.performance;
    }

    // Output based on environment
    if (process.env.NODE_ENV === 'development') {
      this.developmentLog(entry);
    } else {
      this.productionLog(entry);
    }
  }

  private developmentLog(entry: LogEntry) {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level];

    console.log(
      `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} ${entry.message}`
    );

    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log('Context:', entry.context);
    }

    if (entry.error) {
      console.error('Error:', entry.error);
    }

    if (entry.performance) {
      console.log(`⚡ ${entry.performance.operation}: ${entry.performance.duration}ms`);
    }
  }

  private productionLog(entry: LogEntry) {
    // In production, log as structured JSON
    console.log(JSON.stringify(entry));

    // Send to external logging service if configured
    this.sendToExternalService(entry);
  }

  private async sendToExternalService(entry: LogEntry) {
    // Implement based on your logging service (e.g., DataDog, LogRocket, etc.)
    if (process.env.LOGGING_ENDPOINT) {
      try {
        await fetch(process.env.LOGGING_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
      } catch (error) {
        // Fallback to console if external service fails
        console.error('Failed to send log to external service:', error);
      }
    }
  }
}

// Create singleton instance
export const logger = StructuredLogger.getInstance();

/**
 * Performance monitoring decorator
 */
export function logPerformance(operationName?: string) {
  return function (target: object, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operation = operationName || `${(target as { constructor: { name: string } }).constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: unknown[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        logger.performance(operation, duration, {
          action: propertyName,
          resource: target.constructor.name,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`${operation} failed`, error as Error, {
          action: propertyName,
          resource: target.constructor.name,
          metadata: { duration, args: args.length },
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Request logging middleware for API routes
 */
export function withRequestLogging<T extends (...args: unknown[]) => Promise<Response>>(handler: T) {
  return async function (request: Request, ...args: Parameters<T>[]) {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    // Extract useful request info
    const url = new URL(request.url);
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    logger.setContext({
      requestId,
      action: method,
      resource: url.pathname,
    });

    logger.info(`${method} ${url.pathname}`, {
      metadata: {
        userAgent: userAgent.substring(0, 100), // Limit length
        query: url.search,
      }
    });

    try {
      const response = await handler(request, ...args);
      const duration = Date.now() - startTime;
      
      logger.performance(`${method} ${url.pathname}`, duration, {
        metadata: {
          status: response.status,
          ok: response.ok,
        }
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`${method} ${url.pathname} failed`, error as Error, {
        metadata: { duration }
      });
      
      throw error;
    } finally {
      logger.clearContext();
    }
  };
}

/**
 * Database query logging
 */
export function logDatabaseQuery(query: string, params?: unknown[], duration?: number) {
  logger.debug('Database Query', {
    action: 'database_query',
    metadata: {
      query: query.substring(0, 500), // Limit query length
      paramCount: params?.length || 0,
      duration,
    }
  });
}

/**
 * User action logging
 */
export function logUserAction(action: string, userId: string, metadata?: Record<string, unknown>) {
  logger.info(`User Action: ${action}`, {
    userId,
    action,
    metadata,
  });
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Hook for React components to log user interactions
 */
export function useActionLogger(userId?: string) {
  return {
    logClick: (element: string, metadata?: Record<string, unknown>) => {
      logger.info(`User clicked: ${element}`, {
        userId,
        action: 'click',
        resource: element,
        metadata,
      });
    },
    logView: (page: string, metadata?: Record<string, unknown>) => {
      logger.info(`User viewed: ${page}`, {
        userId,
        action: 'view',
        resource: page,
        metadata,
      });
    },
    logAction: (action: string, metadata?: Record<string, unknown>) => {
      logger.info(`User action: ${action}`, {
        userId,
        action,
        metadata,
      });
    },
  };
}
