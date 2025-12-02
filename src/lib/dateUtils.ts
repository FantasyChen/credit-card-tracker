// Helper to format date for display
export const formatDate = (date: Date | null): string => {
  if (!date) return 'N/A';
  // Ensure it's a Date object (Prisma might return string)
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'N/A'; // Invalid date

  // Use UTC methods to avoid timezone conversion issues
  return new Intl.DateTimeFormat('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    timeZone: 'UTC' // Force UTC timezone
  }).format(dateObj);
};

/**
 * Normalize a date to midnight UTC (00:00:00.000Z)
 * 
 * This is critical for BenefitStatus.cycleStartDate to ensure the unique constraint
 * works correctly. Without normalization, the same logical date can have different
 * times (e.g., 2025-10-01T08:00:00Z vs 2025-10-01T00:00:00Z), bypassing the constraint.
 * 
 * @param date - The date to normalize
 * @returns A new Date object at midnight UTC on the same calendar date
 */
export function normalizeCycleDate(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * Check if a date is at midnight UTC
 * 
 * @param date - The date to check
 * @returns true if the date is at exactly 00:00:00.000 UTC
 */
export function isMidnightUTC(date: Date): boolean {
  return date.getUTCHours() === 0 &&
         date.getUTCMinutes() === 0 &&
         date.getUTCSeconds() === 0 &&
         date.getUTCMilliseconds() === 0;
} 