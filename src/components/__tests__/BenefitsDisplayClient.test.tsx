/**
 * BenefitsDisplayClient component tests
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BenefitsDisplayClient from '../BenefitsDisplayClient';
import type { DisplayBenefitStatus } from '@/app/benefits/page';

jest.mock('../BenefitCardClient', () => {
  return function MockBenefitCardClient({ status }: { status: DisplayBenefitStatus }) {
    return <div data-testid="benefit-card">{status.benefit.description}</div>;
  };
});
jest.mock('../CategoryBenefitsGroup', () => ({
  __esModule: true,
  default: function MockCategoryBenefitsGroup({ benefits }: { benefits: DisplayBenefitStatus[] }) {
    return (
      <div data-testid="category-group">
        <div data-testid="category-count">{benefits.length}</div>
        {benefits.map((b) => (
          <div key={b.id}>{b.benefit.description}</div>
        ))}
      </div>
    );
  },
}));

const defaultProps = {
  upcomingBenefits: [] as DisplayBenefitStatus[],
  completedBenefits: [] as DisplayBenefitStatus[],
  notUsableBenefits: [] as DisplayBenefitStatus[],
  scheduledBenefits: [] as DisplayBenefitStatus[],
  totalUnusedValue: 0,
  totalUsedValue: 0,
  totalNotUsableValue: 0,
  totalAnnualFees: 0,
};

function benefitStatus(
  id: string,
  description: string,
  frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
): DisplayBenefitStatus {
  return {
    id,
    benefitId: `benefit-${id}`,
    userId: 'user-1',
    cycleStartDate: new Date('2026-04-01T00:00:00.000Z'),
    cycleEndDate: new Date('2026-04-30T00:00:00.000Z'),
    isCompleted: false,
    completedAt: null,
    isNotUsable: false,
    usedAmount: 0,
    notes: null,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    orderIndex: null,
    occurrenceIndex: 0,
    benefit: {
      id: `benefit-${id}`,
      category: 'Travel',
      description,
      percentage: 0,
      maxAmount: 100,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: null,
      frequency,
      creditCardId: 'card-1',
      userId: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      cycleAlignment: 'CARD_ANNIVERSARY',
      fixedCycleDurationMonths: null,
      fixedCycleStartMonth: null,
      occurrencesInCycle: 1,
      creditCard: {
        id: 'card-1',
        name: 'Test Travel Card',
        issuer: 'Test Bank',
        cardNumber: null,
        expiryDate: null,
        openedDate: null,
        userId: 'user-1',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        lastFourDigits: null,
        nickname: null,
        displayName: 'Test Travel Card',
      },
    },
    usageWaySlug: null,
    isCustomBenefit: false,
  };
}

describe('BenefitsDisplayClient', () => {
  it('renders tabs for Upcoming, Claimed, and Not usable', () => {
    render(<BenefitsDisplayClient {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Upcoming/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Claimed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Not Usable/i })).toBeInTheDocument();
  });

  it('renders summary widgets with value totals', () => {
    render(
      <BenefitsDisplayClient
        {...defaultProps}
        totalUnusedValue={100}
        totalUsedValue={50}
        totalAnnualFees={95}
      />
    );

    expect(screen.getByText('Claimed Benefits')).toBeInTheDocument();
    expect(screen.getByText('Annual Fee ROI')).toBeInTheDocument();
    expect(screen.getByText(/\$50\.00 earned vs \$95\.00 fees/)).toBeInTheDocument();
  });

  it('shows empty state when no upcoming benefits', () => {
    render(<BenefitsDisplayClient {...defaultProps} />);

    expect(
      screen.getByText(/You don't have any upcoming benefits|Add some credit cards to get started/i)
    ).toBeInTheDocument();
  });

  it('renders view mode toggle (Group by Category / Group by Card)', () => {
    render(<BenefitsDisplayClient {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Group by Category/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Group by Card/i })).toBeInTheDocument();
  });

  it('offers benefit sorting controls for daily prioritization', () => {
    render(<BenefitsDisplayClient {...defaultProps} />);

    expect(screen.getByLabelText('Sort benefits')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Expires soon' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Highest value' })).toBeInTheDocument();
  });

  it('offers frequency and free-night filters', () => {
    render(<BenefitsDisplayClient {...defaultProps} />);

    expect(screen.getByLabelText('Filter by frequency')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Quarterly' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Free Night \/ Cert/i })).toBeInTheDocument();
  });

  it('filters displayed benefits by frequency and free-night status', () => {
    render(
      <BenefitsDisplayClient
        {...defaultProps}
        upcomingBenefits={[
          benefitStatus('monthly', 'Monthly dining credit', 'MONTHLY'),
          benefitStatus('quarterly', 'Quarterly Hilton credit', 'QUARTERLY'),
          benefitStatus('yearly-fn', 'Annual Free Night Award', 'YEARLY'),
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText('Filter by frequency'), {
      target: { value: 'YEARLY' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Free Night \/ Cert/i }));

    expect(screen.getByText('Annual Free Night Award')).toBeInTheDocument();
    expect(screen.queryByText('Monthly dining credit')).not.toBeInTheDocument();
    expect(screen.queryByText('Quarterly Hilton credit')).not.toBeInTheDocument();
  });
});
