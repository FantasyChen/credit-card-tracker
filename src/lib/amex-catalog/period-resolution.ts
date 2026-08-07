import type { AmexPeriodKey } from "./catalog-registry";

export function periodKeysForExactRange(startDate: string, endDate: string): AmexPeriodKey[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start
    || start.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate) return [];
  const endOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const keys: AmexPeriodKey[] = [];
  if (start.getUTCDate() === 1 && end.getTime() === endOfMonth.getTime()) {
    keys.push("calendar-month");
    if (start.getUTCMonth() === 11) keys.push("calendar-month-december");
  }
  const quarter = Math.floor(start.getUTCMonth() / 3);
  const quarterEnd = new Date(Date.UTC(start.getUTCFullYear(), quarter * 3 + 3, 0));
  if (start.getUTCMonth() === quarter * 3 && start.getUTCDate() === 1 && end.getTime() === quarterEnd.getTime()) {
    keys.push("calendar-quarter", `calendar-quarter-q${quarter + 1}` as AmexPeriodKey, "card-anniversary-quarter");
  }
  const half = start.getUTCMonth() < 6 ? 0 : 1;
  const halfEnd = new Date(Date.UTC(start.getUTCFullYear(), half ? 12 : 6, 0));
  if (start.getUTCMonth() === half * 6 && start.getUTCDate() === 1 && end.getTime() === halfEnd.getTime()) {
    keys.push(`calendar-half-h${half + 1}` as AmexPeriodKey);
  }
  const yearEnd = new Date(Date.UTC(start.getUTCFullYear(), 11, 31));
  if (start.getUTCMonth() === 0 && start.getUTCDate() === 1 && end.getTime() === yearEnd.getTime()) {
    keys.push("calendar-year", "card-anniversary-year");
  }
  const plusThreeMonths = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, start.getUTCDate()));
  plusThreeMonths.setUTCDate(plusThreeMonths.getUTCDate() - 1);
  if (plusThreeMonths.getTime() === end.getTime() && !keys.includes("card-anniversary-quarter")) keys.push("card-anniversary-quarter");
  const plusYear = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
  plusYear.setUTCDate(plusYear.getUTCDate() - 1);
  if (plusYear.getTime() === end.getTime() && !keys.includes("card-anniversary-year")) keys.push("card-anniversary-year");
  return keys;
}

export function periodKeyForExactRange(startDate: string, endDate: string): string | null {
  return periodKeysForExactRange(startDate, endDate).find((key) => key.startsWith("calendar-quarter-q")) ?? null;
}
