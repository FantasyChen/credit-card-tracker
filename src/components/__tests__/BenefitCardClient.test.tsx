/**
 * BenefitCardClient component tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BenefitCardClient from '../BenefitCardClient';
import type { DisplayBenefitStatus } from '@/lib/benefit-dashboard-client';

jest.mock('@/app/benefits/actions', () => ({
  toggleBenefitStatusAction: jest.fn().mockResolvedValue(undefined),
  deleteCustomBenefitAction: jest.fn().mockResolvedValue(undefined),
  addPartialCompletionAction: jest.fn().mockResolvedValue({ success: true, isComplete: false, newUsedAmount: 10 }),
  markFullCompletionAction: jest.fn().mockResolvedValue({ success: true, usedAmount: 10 }),
  setBenefitTrackingModeAction: jest.fn().mockResolvedValue(undefined),
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

  it('renders a compact usage guide link when available', () => {
    const status = createMockStatus({ usageWaySlug: 'brilliant-doordash-amazon-gift-card' });
    render(<BenefitCardClient status={status} />);

    expect(screen.getByRole('link', { name: /How to use/i })).toHaveAttribute(
      'href',
      '/benefits/how-to-use/brilliant-doordash-amazon-gift-card'
    );
  });

  it('shows the current tracking mode in the trigger and marks it selected', () => {
    const status = createMockStatus({ trackingMode: 'IGNORE' });
    render(<BenefitCardClient status={status} />);

    const trigger = screen.getByRole('button', { name: /Tracking mode: Ignore this benefit/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    const selectedOption = screen.getByRole('button', { name: /Ignore this benefit.*Current/i });
    expect(selectedOption).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Track every cycle/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps ignored cards read-only while allowing tracking restoration', () => {
    const status = createMockStatus({ trackingMode: 'IGNORE' });
    render(<BenefitCardClient status={status} isIgnoredView />);

    expect(screen.getByText('Ignored')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Complete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Amount/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tracking mode: Ignore this benefit/i })).toBeInTheDocument();
  });

  it('updates the visible mode after a successful tracking choice', async () => {
    const status = createMockStatus();
    render(<BenefitCardClient status={status} />);

    fireEvent.click(screen.getByRole('button', { name: /Tracking mode: Track every cycle/i }));
    fireEvent.click(screen.getByRole('button', { name: /Always claim it for me/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tracking mode: Always claim it for me/i })).toBeInTheDocument();
    });
  });

  it('does not expose the deprecated cycle-level not-usable action', () => {
    const status = createMockStatus();
    render(<BenefitCardClient status={status} />);

    expect(screen.queryByRole('button', { name: /Not usable this cycle|Mark usable this cycle/i })).not.toBeInTheDocument();
  });

  it('does not present a legacy not-usable status differently', () => {
    const status = createMockStatus({ isNotUsable: true });
    render(<BenefitCardClient status={status} />);

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark Complete/i })).toBeInTheDocument();
  });
});
