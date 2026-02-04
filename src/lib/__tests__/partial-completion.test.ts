import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  calculateCompletionState,
  calculateTotalUsedValue,
  validatePartialAmount,
  calculateRemainingAmount,
  calculateCompletionPercentage,
} from '../partial-completion';

describe('calculateCompletionState', () => {
  // Mock console to avoid test output clutter
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('returns "not_started" when usedAmount is 0', () => {
    expect(calculateCompletionState(0, 100)).toBe('not_started');
  });

  it('returns "not_started" when usedAmount is null', () => {
    expect(calculateCompletionState(null, 100)).toBe('not_started');
  });

  it('returns "not_started" when usedAmount is undefined', () => {
    expect(calculateCompletionState(undefined, 100)).toBe('not_started');
  });

  it('returns "partial" when 0 < usedAmount < maxAmount', () => {
    expect(calculateCompletionState(50, 100)).toBe('partial');
    expect(calculateCompletionState(1, 100)).toBe('partial');
    expect(calculateCompletionState(99, 100)).toBe('partial');
    expect(calculateCompletionState(25.50, 50)).toBe('partial');
  });

  it('returns "complete" when usedAmount >= maxAmount', () => {
    expect(calculateCompletionState(100, 100)).toBe('complete');
    expect(calculateCompletionState(150, 100)).toBe('complete'); // Over max still complete
  });

  it('handles null maxAmount gracefully (percentage-based benefits)', () => {
    // With null maxAmount, any positive amount is "complete", 0 is "not_started"
    expect(calculateCompletionState(0, null)).toBe('not_started');
    expect(calculateCompletionState(50, null)).toBe('complete');
  });

  it('handles zero maxAmount', () => {
    expect(calculateCompletionState(0, 0)).toBe('not_started');
    expect(calculateCompletionState(50, 0)).toBe('complete');
  });

  it('handles negative amounts by clamping to 0', () => {
    expect(calculateCompletionState(-10, 100)).toBe('not_started');
    expect(calculateCompletionState(-50, 0)).toBe('not_started');
  });

  it('handles floating point numbers correctly', () => {
    expect(calculateCompletionState(29.99, 50)).toBe('partial');
    expect(calculateCompletionState(50.00, 50)).toBe('complete');
    expect(calculateCompletionState(49.999, 50)).toBe('partial');
  });
});

describe('calculateTotalUsedValue', () => {
  it('sums usedAmount from all benefits (not maxAmount)', () => {
    const statuses = [
      { usedAmount: 30 },
      { usedAmount: 50 },
      { usedAmount: 20 },
    ];
    expect(calculateTotalUsedValue(statuses)).toBe(100);
  });

  it('includes partial completions in total', () => {
    const statuses = [
      { usedAmount: 25 }, // Partial
      { usedAmount: 100 }, // Complete
      { usedAmount: 0 }, // Not started
    ];
    expect(calculateTotalUsedValue(statuses)).toBe(125);
  });

  it('handles mix of complete and partial benefits', () => {
    const statuses = [
      { usedAmount: 100 },
      { usedAmount: 50 },
      { usedAmount: 75.50 },
    ];
    expect(calculateTotalUsedValue(statuses)).toBe(225.50);
  });

  it('returns 0 for empty benefit list', () => {
    expect(calculateTotalUsedValue([])).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(calculateTotalUsedValue(null as unknown as [])).toBe(0);
    expect(calculateTotalUsedValue(undefined as unknown as [])).toBe(0);
  });

  it('handles null usedAmount as 0', () => {
    const statuses = [
      { usedAmount: null },
      { usedAmount: 50 },
      { usedAmount: undefined as unknown as number },
    ];
    expect(calculateTotalUsedValue(statuses)).toBe(50);
  });

  it('handles negative usedAmount by clamping to 0', () => {
    const statuses = [
      { usedAmount: -10 },
      { usedAmount: 50 },
    ];
    expect(calculateTotalUsedValue(statuses)).toBe(50);
  });

  it('handles large numbers of benefits', () => {
    const statuses = Array.from({ length: 100 }, (_, i) => ({
      usedAmount: i + 1,
    }));
    // Sum of 1 to 100 = 5050
    expect(calculateTotalUsedValue(statuses)).toBe(5050);
  });
});

describe('validatePartialAmount', () => {
  it('rejects negative amounts', () => {
    const result = validatePartialAmount(-10, 0, 100);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Amount cannot be negative');
  });

  it('rejects zero amounts', () => {
    const result = validatePartialAmount(0, 0, 100);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Amount must be greater than zero');
  });

  it('rejects amounts exceeding remaining balance', () => {
    const result = validatePartialAmount(80, 30, 100);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('exceeds remaining balance');
  });

  it('accepts valid amounts within remaining balance', () => {
    const result = validatePartialAmount(30, 20, 100);
    expect(result.isValid).toBe(true);
    expect(result.clampedAmount).toBe(30);
  });

  it('allows exact remaining amount', () => {
    const result = validatePartialAmount(70, 30, 100);
    expect(result.isValid).toBe(true);
    expect(result.clampedAmount).toBe(70);
  });

  it('handles floating point precision (e.g., $29.99 + $20.01 = $50.00)', () => {
    // Current used: 29.99, trying to add: 20.01, max: 50
    const result = validatePartialAmount(20.01, 29.99, 50);
    expect(result.isValid).toBe(true);
  });

  it('handles floating point precision with small tolerance', () => {
    // Very close to remaining amount (within tolerance)
    const result = validatePartialAmount(70.0001, 30, 100);
    expect(result.isValid).toBe(true);
    expect(result.clampedAmount).toBe(70); // Clamped to exact remaining
  });

  it('accepts any positive amount when maxAmount is null', () => {
    const result = validatePartialAmount(1000, 0, null);
    expect(result.isValid).toBe(true);
    expect(result.clampedAmount).toBe(1000);
  });

  it('accepts any positive amount when maxAmount is 0', () => {
    const result = validatePartialAmount(50, 0, 0);
    expect(result.isValid).toBe(true);
    expect(result.clampedAmount).toBe(50);
  });

  it('handles null currentUsedAmount as 0', () => {
    const result = validatePartialAmount(50, null, 100);
    expect(result.isValid).toBe(true);
    expect(result.clampedAmount).toBe(50);
  });

  it('rejects amount when already at max', () => {
    const result = validatePartialAmount(10, 100, 100);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('exceeds remaining balance');
  });
});

describe('calculateRemainingAmount', () => {
  it('returns correct remaining amount', () => {
    expect(calculateRemainingAmount(30, 100)).toBe(70);
    expect(calculateRemainingAmount(0, 100)).toBe(100);
    expect(calculateRemainingAmount(100, 100)).toBe(0);
  });

  it('returns 0 when usedAmount exceeds maxAmount', () => {
    expect(calculateRemainingAmount(150, 100)).toBe(0);
  });

  it('returns 0 when maxAmount is null', () => {
    expect(calculateRemainingAmount(50, null)).toBe(0);
  });

  it('returns 0 when maxAmount is 0', () => {
    expect(calculateRemainingAmount(50, 0)).toBe(0);
  });

  it('handles null usedAmount', () => {
    expect(calculateRemainingAmount(null, 100)).toBe(100);
  });

  it('handles floating point numbers', () => {
    expect(calculateRemainingAmount(29.99, 50)).toBeCloseTo(20.01, 2);
  });
});

describe('calculateCompletionPercentage', () => {
  it('returns 0% for not started', () => {
    expect(calculateCompletionPercentage(0, 100)).toBe(0);
  });

  it('returns correct percentage for partial completion', () => {
    expect(calculateCompletionPercentage(50, 100)).toBe(50);
    expect(calculateCompletionPercentage(25, 100)).toBe(25);
    expect(calculateCompletionPercentage(75, 100)).toBe(75);
  });

  it('returns 100% for full completion', () => {
    expect(calculateCompletionPercentage(100, 100)).toBe(100);
  });

  it('caps at 100% when over max', () => {
    expect(calculateCompletionPercentage(150, 100)).toBe(100);
  });

  it('returns 0% when maxAmount is null and usedAmount is 0', () => {
    expect(calculateCompletionPercentage(0, null)).toBe(0);
  });

  it('returns 100% when maxAmount is null and usedAmount > 0', () => {
    expect(calculateCompletionPercentage(50, null)).toBe(100);
  });

  it('handles floating point percentages', () => {
    expect(calculateCompletionPercentage(33.33, 100)).toBeCloseTo(33.33, 2);
    expect(calculateCompletionPercentage(1, 3)).toBeCloseTo(33.33, 2);
  });

  it('handles null usedAmount', () => {
    expect(calculateCompletionPercentage(null, 100)).toBe(0);
  });
});
