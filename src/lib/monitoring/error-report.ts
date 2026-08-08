import { z } from 'zod';

const AMEX_HANDOFF_PATH = '/integrations/amex-sync';

export const MONITORING_ERROR_MAX_BYTES = 32 * 1024;

const errorReportSchema = z.object({
  errorId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  message: z.string().min(1).max(4_096),
  stack: z.string().max(16_384).optional(),
  componentStack: z.string().max(16_384).nullable().optional(),
  url: z.string().min(1).max(2_048).refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }),
  timestamp: z.string().datetime({ offset: true }),
}).strict();

export type MonitoringErrorReport = z.infer<typeof errorReportSchema>;

export function sanitizeMonitoringUrl(value: string | null | undefined): string {
  if (!value) return 'unknown';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'unknown';
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'unknown';
  }
}

export function isAmexHandoffUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).pathname === AMEX_HANDOFF_PATH;
  } catch {
    return false;
  }
}

export function parseMonitoringErrorReport(value: unknown): MonitoringErrorReport | null {
  const parsed = errorReportSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
