export interface BenefitStatusTransitionInput {
  isCompleted: boolean;
  isNotUsable?: boolean;
  completedAt?: Date | null;
  usedAmount: number | null;
  benefit: {
    maxAmount: number | null;
  };
}

export interface BenefitStatusTransitionData {
  isCompleted: boolean;
  completedAt: Date | null;
  usedAmount: number;
  isNotUsable?: boolean;
}

export function transitionToggleCompletion(
  status: BenefitStatusTransitionInput,
  completedAt: Date = new Date()
): BenefitStatusTransitionData {
  const isCompleted = !status.isCompleted;
  return isCompleted
    ? transitionFullCompletion(status, completedAt)
    : transitionResetCompletion();
}

export function transitionAddPartialCompletion(
  status: BenefitStatusTransitionInput,
  amount: number,
  completedAt: Date = new Date()
): BenefitStatusTransitionData {
  if (amount <= 0 || Number.isNaN(amount)) {
    throw new Error('Amount must be a positive number.');
  }

  const maxAmount = status.benefit.maxAmount ?? 0;
  const currentUsedAmount = Math.max(0, status.usedAmount ?? 0);
  const usedAmount = maxAmount > 0
    ? Math.min(currentUsedAmount + amount, maxAmount)
    : currentUsedAmount + amount;
  const isCompleted = maxAmount > 0 && usedAmount >= maxAmount;

  return {
    usedAmount,
    isCompleted,
    completedAt: isCompleted ? completedAt : null,
  };
}

export function transitionFullCompletion(
  status: BenefitStatusTransitionInput,
  completedAt: Date = new Date()
): BenefitStatusTransitionData {
  return {
    usedAmount: Math.max(0, status.benefit.maxAmount ?? 0),
    isCompleted: true,
    completedAt,
  };
}

export function transitionResetCompletion(): BenefitStatusTransitionData {
  return {
    usedAmount: 0,
    isCompleted: false,
    completedAt: null,
  };
}

export function transitionSetUsedAmount(
  status: BenefitStatusTransitionInput,
  amount: number,
  completedAt: Date = new Date()
): BenefitStatusTransitionData {
  if (amount < 0 || Number.isNaN(amount)) {
    throw new Error('Amount must be a non-negative number.');
  }

  const maxAmount = status.benefit.maxAmount ?? 0;
  const usedAmount = maxAmount > 0 ? Math.min(amount, maxAmount) : amount;
  const isCompleted = maxAmount > 0 && usedAmount >= maxAmount;

  return {
    usedAmount,
    isCompleted,
    completedAt: isCompleted ? (status.completedAt ?? completedAt) : null,
  };
}

export function transitionToggleNotUsable(
  status: BenefitStatusTransitionInput
): Pick<BenefitStatusTransitionData, 'isCompleted' | 'completedAt' | 'isNotUsable'> {
  const isNotUsable = !Boolean(status.isNotUsable);
  return {
    isNotUsable,
    isCompleted: isNotUsable ? false : status.isCompleted,
    completedAt: isNotUsable ? null : status.completedAt ?? null,
  };
}
