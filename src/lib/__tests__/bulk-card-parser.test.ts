import { parseBulkCardInput } from '../bulk-card-parser';

const catalog = [
  { id: 'amex-plat', name: 'American Express Platinum Card', issuer: 'American Express' },
  { id: 'amex-gold', name: 'American Express Gold Card', issuer: 'American Express' },
  { id: 'csr', name: 'Chase Sapphire Reserve', issuer: 'Chase' },
  { id: 'aspire', name: 'Hilton Honors American Express Aspire Card', issuer: 'American Express' },
];

describe('parseBulkCardInput', () => {
  it('expands power-user shorthand with counts', () => {
    const result = parseBulkCardInput('plat x2, gold, csr, aspire x3', catalog);

    expect(result).toHaveLength(7);
    expect(result.map((item) => item.matchedCard?.id)).toEqual([
      'amex-plat',
      'amex-plat',
      'amex-gold',
      'csr',
      'aspire',
      'aspire',
      'aspire',
    ]);
    expect(result[0]).toMatchObject({ copyIndex: 1, totalCopies: 2 });
    expect(result[1]).toMatchObject({ copyIndex: 2, totalCopies: 2 });
  });

  it('returns candidates and an error for unclear entries', () => {
    const result = parseBulkCardInput('mystery premium card', catalog);

    expect(result).toHaveLength(1);
    expect(result[0].matchedCard).toBeNull();
    expect(result[0].error).toContain('Could not confidently match');
  });
});
