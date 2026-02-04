/**
 * Partial Completion Utilities
 * 
 * Provides functions for handling partial benefit completion:
 * - State calculation (not_started, partial, complete)
 * - Total value calculation from multiple benefits
 * - Amount validation for partial completion inputs
 */

/**
 * Completion states for benefits
 */
export type CompletionState = 'not_started' | 'partial' | 'complete';

/**
 * Benefit status with completion information
 */
export interface BenefitStatusWithAmount {
  usedAmount: number | null;
  isCompleted: boolean;
  benefit: {
    maxAmount: number | null;
  };
}

/**
 * Calculates the completion state based on usedAmount and maxAmount.
 * 
 * @param usedAmount The amount that has been used (can be null or 0)
 * @param maxAmount The maximum amount available (can be null for percentage-based benefits)
 * @returns The completion state
 */
export function calculateCompletionState(
  usedAmount: number | null | undefined,
  maxAmount: number | null | undefined
): CompletionState {
  const used = usedAmount ?? 0;
  const max = maxAmount ?? 0;

  // Clamp negative values to 0
  const clampedUsed = Math.max(0, used);

  // If maxAmount is null/0, we can't determine partial state
  // Consider it complete if any amount is used, or not_started if 0
  if (max <= 0) {
    return clampedUsed > 0 ? 'complete' : 'not_started';
  }

  if (clampedUsed <= 0) {
    return 'not_started';
  }

  if (clampedUsed >= max) {
    return 'complete';
  }

  return 'partial';
}

/**
 * Calculates the total used value from a list of benefit statuses.
 * This sums usedAmount from ALL benefits (not just completed ones)
 * since partial completions also contribute to ROI.
 * 
 * @param benefitStatuses Array of benefit statuses with usedAmount
 * @returns Total used value
 */
export function calculateTotalUsedValue(
  benefitStatuses: Array<{ usedAmount?: number | null }>
): number {
  if (!benefitStatuses || benefitStatuses.length === 0) {
    return 0;
  }

  return benefitStatuses.reduce((sum, status) => {
    const amount = status.usedAmount ?? 0;
    return sum + Math.max(0, amount); // Clamp negative values
  }, 0);
}

/**
 * Result of amount validation
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  clampedAmount?: number;
}

/**
 * Validates a partial amount input.
 * 
 * @param amount The amount to validate
 * @param currentUsedAmount The current used amount
 * @param maxAmount The maximum amount allowed
 * @returns Validation result with error message if invalid
 */
export function validatePartialAmount(
  amount: number,
  currentUsedAmount: number | null | undefined,
  maxAmount: number | null | undefined
): ValidationResult {
  const currentUsed = currentUsedAmount ?? 0;
  const max = maxAmount ?? 0;

  // Check for negative amount
  if (amount < 0) {
    return {
      isValid: false,
      error: 'Amount cannot be negative',
    };
  }

  // Check for zero amount
  if (amount === 0) {
    return {
      isValid: false,
      error: 'Amount must be greater than zero',
    };
  }

  // If no max amount, any positive amount is valid
  if (max <= 0) {
    return {
      isValid: true,
      clampedAmount: amount,
    };
  }

  // Calculate remaining balance
  const remainingBalance = max - currentUsed;

  // Check if amount exceeds remaining balance
  if (amount > remainingBalance) {
    // Allow exact remaining (with floating point tolerance)
    const tolerance = 0.001; // Small tolerance for floating point
    if (Math.abs(amount - remainingBalance) <= tolerance) {
      return {
        isValid: true,
        clampedAmount: remainingBalance,
      };
    }

    return {
      isValid: false,
      error: `Amount exceeds remaining balance of $${remainingBalance.toFixed(2)}`,
    };
  }

  return {
    isValid: true,
    clampedAmount: amount,
  };
}

/**
 * Calculates the remaining amount for a benefit.
 * 
 * @param usedAmount Current used amount
 * @param maxAmount Maximum amount
 * @returns Remaining amount (0 if fully used or no max)
 */
export function calculateRemainingAmount(
  usedAmount: number | null | undefined,
  maxAmount: number | null | undefined
): number {
  const used = usedAmount ?? 0;
  const max = maxAmount ?? 0;

  if (max <= 0) {
    return 0;
  }

  return Math.max(0, max - used);
}

/**
 * Calculates the completion percentage for a benefit.
 * 
 * @param usedAmount Current used amount
 * @param maxAmount Maximum amount
 * @returns Percentage (0-100), clamped to 100 max
 */
export function calculateCompletionPercentage(
  usedAmount: number | null | undefined,
  maxAmount: number | null | undefined
): number {
  const used = usedAmount ?? 0;
  const max = maxAmount ?? 0;

  if (max <= 0) {
    return used > 0 ? 100 : 0;
  }

  const percentage = (used / max) * 100;
  return Math.min(100, Math.max(0, percentage));
}
