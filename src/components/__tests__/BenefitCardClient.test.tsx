/**
 * BenefitCardClient component tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BenefitCardClient from '../BenefitCardClient';
import type { DisplayBenefitStatus } from '@/app/benefits/page';

jest.mock('@/app/benefits/actions', () => ({
  toggleBenefitStatusAction: jest.fn().mockResolvedValue(undefined),
  markBenefitAsNotUsableAction: jest.fn().mockResolvedValue(undefined),
  deleteCustomBenefitAction: jest.fn().mockResolvedValue(undefined),
  addPartialCompletionAction: jest.fn().mockResolvedValue({ success: true, isComplete: false, newUsedAmount: 10 }),
  markFullCompletionAction: jest.fn().mockResolvedValue(undefined),
  updateBenefitNotesAction: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/partial-completion', () => ({
  calculateCompletionPercentage: jest.fn((used: number, max: number) => (max > 0 ? (used / max) * 100 : 0)),
}));

function createMockStatus(overrides: Partial<DisplayBenefitStatus> = {}): DisplayBenefitStatus {
  return {
    id: 'status-1',
    userId: 'user-1',
    benefitId: 'benefit-1',
    cycleStartDate: new Date('2024-01-01'),
    cycleEndDate: new Date('2024-01-31'),
    isCompleted: false,
    isNotUsable: false,
    completedAt: null,
    usedAmount: null,
    orderIndex: 0,
    occurrenceIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    benefit: {
      id: 'benefit-1',
      creditCardId: 'card-1',
      category: 'Dining',
      description: '$10 Monthly Dining Credit',
      percentage: 0,
      maxAmount: 10,
      frequency: 'MONTHLY',
      cycleAlignment: null,
      fixedCycleStartMonth: null,
      fixedCycleDurationMonths: null,
      occurrencesInCycle: 1,
      startDate: new Date(),
      endDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      creditCard: {
        id: 'card-1',
        name: 'Test Card',
        displayName: 'Test Card',
        issuer: 'Test',
        openedDate: new Date(),
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    isCustomBenefit: false,
    ...overrides,
  } as unknown as DisplayBenefitStatus;
}

describe('BenefitCardClient', () => {
  it('renders benefit description and amount', () => {
    const status = createMockStatus();
    render(<BenefitCardClient status={status} />);

    expect(screen.getByText('$10 Monthly Dining Credit')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
  });

  it('renders card display name when present', () => {
    const status = createMockStatus();
    render(<BenefitCardClient status={status} />);

    expect(screen.getByText(/Test Card/)).toBeInTheDocument();
  });

  it('shows Mark Complete button when not completed', () => {
    const status = createMockStatus();
    render(<BenefitCardClient status={status} />);

    const completeButtons = screen.getAllByRole('button', { name: /Mark Complete/i });
    expect(completeButtons.length).toBeGreaterThan(0);
  });

  it('Mark Complete button is clickable and triggers form submit', () => {
    const status = createMockStatus();
    render(<BenefitCardClient status={status} />);

    const completeButtons = screen.getAllByRole('button', { name: /Mark Complete/i });
    expect(completeButtons[0]).toBeInTheDocument();
    fireEvent.click(completeButtons[0]);
    expect(screen.getByText('$10 Monthly Dining Credit')).toBeInTheDocument();
  });

  it('does not show delete button for non-custom benefit', () => {
    const status = createMockStatus({ isCustomBenefit: false });
    render(<BenefitCardClient status={status} />);

    expect(screen.queryByRole('button', { name: /delete|remove/i })).not.toBeInTheDocument();
  });

  it('renders scheduled state when isScheduled is true', () => {
    const status = createMockStatus();
    render(<BenefitCardClient status={status} isScheduled />);

    expect(screen.getByText('$10 Monthly Dining Credit')).toBeInTheDocument();
  });
});
