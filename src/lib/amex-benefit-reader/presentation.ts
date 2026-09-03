import type { SourcePeriodV2 } from "./contract";

const NUMERIC_CHARACTER_REFERENCE = /&#(?:([0-9]+)|[xX]([0-9a-fA-F]+));/g;
const AMEX_SUPERSCRIPT_FOOTNOTE_MARKERS = ["<sup>‡</sup>", "<sup>®</sup>"] as const;
const STATEMENT_CREDIT_SUFFIX = " Statement Credit";
const COMPACT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

function isUnicodeScalarValue(value: number): boolean {
  return Number.isInteger(value)
    && value > 0
    && value <= 0x10ffff
    && (value < 0xd800 || value > 0xdfff);
}

export function decodeNumericCharacterReferences(value: string): string {
  return value.replace(
    NUMERIC_CHARACTER_REFERENCE,
    (reference, decimalDigits: string | undefined, hexadecimalDigits: string | undefined) => {
      const digits = decimalDigits ?? hexadecimalDigits;
      if (!digits) return reference;
      const codePoint = Number.parseInt(digits, decimalDigits ? 10 : 16);
      return isUnicodeScalarValue(codePoint) ? String.fromCodePoint(codePoint) : reference;
    },
  );
}

export function formatAmexBenefitTitle(value: string): string {
  const decoded = decodeNumericCharacterReferences(value).trimEnd();

  for (const marker of AMEX_SUPERSCRIPT_FOOTNOTE_MARKERS) {
    const markerBeforeStatementCredit = `${marker}${STATEMENT_CREDIT_SUFFIX}`;
    if (decoded.endsWith(markerBeforeStatementCredit)) {
      const prefix = decoded.slice(0, -markerBeforeStatementCredit.length).trimEnd();
      return prefix ? `${prefix}${STATEMENT_CREDIT_SUFFIX}` : STATEMENT_CREDIT_SUFFIX.trimStart();
    }
  }

  for (const marker of AMEX_SUPERSCRIPT_FOOTNOTE_MARKERS) {
    if (decoded.endsWith(marker)) {
      const withoutTerminalFootnote = decoded.slice(0, -marker.length).trimEnd();
      return withoutTerminalFootnote || decoded;
    }
  }

  if (decoded.endsWith("‡")) {
    const withoutStandaloneDagger = decoded.slice(0, -1).trimEnd();
    return withoutStandaloneDagger || decoded;
  }
  return decoded;
}

function calendarDateParts(value: string): CalendarDateParts {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function compactExplicitDateRange(start: CalendarDateParts, end: CalendarDateParts): string {
  const startMonth = COMPACT_MONTHS[start.month - 1];
  const endMonth = COMPACT_MONTHS[end.month - 1];
  if (start.year === end.year && start.month === end.month) {
    return `${startMonth} ${start.day}–${end.day}, ${start.year}`;
  }
  if (start.year === end.year) {
    return `${startMonth} ${start.day}–${endMonth} ${end.day}, ${start.year}`;
  }
  return `${startMonth} ${start.day}, ${start.year}–${endMonth} ${end.day}, ${end.year}`;
}

export function formatAmexSourcePeriod(period: SourcePeriodV2): string {
  const start = calendarDateParts(period.startDate);
  const end = calendarDateParts(period.endDate);
  const startsOnMonthBoundary = start.day === 1;
  const endsOnMonthBoundary = end.day === lastDayOfMonth(end.year, end.month);
  if (startsOnMonthBoundary && endsOnMonthBoundary && start.year === end.year) {
    if (start.month === 1 && end.month === 12) return String(start.year);
    if (start.month === end.month) return `${COMPACT_MONTHS[start.month - 1]} ${start.year}`;
    return `${COMPACT_MONTHS[start.month - 1]}–${COMPACT_MONTHS[end.month - 1]} ${start.year}`;
  }
  return compactExplicitDateRange(start, end);
}
