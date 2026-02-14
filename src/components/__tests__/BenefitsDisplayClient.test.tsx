/**
 * BenefitsDisplayClient component tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
