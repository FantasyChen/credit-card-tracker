const NUMERIC_CHARACTER_REFERENCE = /&#(?:([0-9]+)|[xX]([0-9a-fA-F]+));/g;

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

const AMEX_SUPERSCRIPT_FOOTNOTE_MARKERS = ["<sup>‡</sup>", "<sup>®</sup>"] as const;
const STATEMENT_CREDIT_SUFFIX = " Statement Credit";

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
