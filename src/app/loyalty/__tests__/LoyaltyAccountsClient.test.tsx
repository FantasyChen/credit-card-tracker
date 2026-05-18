/**
 * LoyaltyAccountsClient component tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoyaltyAccountsClient } from '../LoyaltyAccountsClient';

jest.mock('../actions', () => ({
  addLoyaltyAccountAction: jest.fn(),
  updateLoyaltyAccountAction: jest.fn(),
  deleteLoyaltyAccountAction: jest.fn(),
}));

jest.mock('../AddLoyaltyAccountModal', () => ({
  AddLoyaltyAccountModal: () => <div>Add modal</div>,
}));

jest.mock('../EditLoyaltyAccountModal', () => ({
  EditLoyaltyAccountModal: () => <div>Edit modal</div>,
}));

const program = (overrides = {}) => ({
  id: 'program',
  name: 'program',
  displayName: 'Program',
  type: 'AIRLINE',
  company: 'Company',
  expirationMonths: 12,
  hasExpiration: true,
  expirationBasis: 'ACTIVITY',
  description: null,
  qualifyingActivities: null,
  website: null,
  ...overrides,
});

describe('LoyaltyAccountsClient', () => {
  it('orders loyalty accounts by expiration urgency by default', () => {
    const later = {
      id: 'later',
      accountNumber: null,
      pointsBalance: null,
      lastActivityDate: new Date('2026-01-01'),
      expirationDate: new Date('2026-12-31'),
      isActive: true,
      notes: null,
      certificates: [],
      loyaltyProgram: program({ id: 'later-program', displayName: 'Later Miles' }),
    };
    const soon = {
      id: 'soon',
      accountNumber: null,
      pointsBalance: null,
      lastActivityDate: new Date('2026-01-01'),
      expirationDate: new Date('2026-05-15'),
      isActive: true,
      notes: null,
      certificates: [],
      loyaltyProgram: program({ id: 'soon-program', displayName: 'Soon Miles' }),
    };

    render(<LoyaltyAccountsClient userAccounts={[later, soon]} availablePrograms={[]} />);

    const accountHeadings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(accountHeadings).toEqual(['Soon Miles', 'Later Miles']);
  });

  it('shows miles balance and hotel certificates', () => {
    const account = {
      id: 'hotel',
      accountNumber: null,
      pointsBalance: 125000,
      lastActivityDate: new Date('2026-01-01'),
      expirationDate: new Date('2026-12-31'),
      isActive: true,
      notes: null,
      certificates: [
        {
          id: 'certificate-1',
          label: 'Anniversary free night',
          quantity: 2,
          expirationDate: new Date('2026-06-15'),
          notes: null,
          isActive: true,
        },
      ],
      loyaltyProgram: program({ id: 'hotel-program', displayName: 'Hyatt', type: 'HOTEL' }),
    };

    render(<LoyaltyAccountsClient userAccounts={[account]} availablePrograms={[]} />);

    expect(screen.getByText('125,000')).toBeInTheDocument();
    expect(screen.getByText('Free Night Certificates')).toBeInTheDocument();
    expect(screen.getByText('Anniversary free night')).toBeInTheDocument();
    expect(screen.getByText('x2')).toBeInTheDocument();
  });

  it('orders loyalty accounts by certificate urgency when it is sooner than points expiration', () => {
    const certificateSoon = {
      id: 'certificate-soon',
      accountNumber: null,
      pointsBalance: null,
      lastActivityDate: new Date('2026-01-01'),
      expirationDate: new Date('2026-12-31'),
      isActive: true,
      notes: null,
      certificates: [
        {
          id: 'certificate-1',
          label: 'Free night',
          quantity: 1,
          expirationDate: new Date('2026-05-01'),
          notes: null,
          isActive: true,
        },
      ],
      loyaltyProgram: program({ id: 'hotel-program', displayName: 'Certificate Soon', type: 'HOTEL' }),
    };
    const pointsSoon = {
      id: 'points-soon',
      accountNumber: null,
      pointsBalance: null,
      lastActivityDate: new Date('2026-01-01'),
      expirationDate: new Date('2026-06-01'),
      isActive: true,
      notes: null,
      certificates: [],
      loyaltyProgram: program({ id: 'airline-program', displayName: 'Points Later' }),
    };

    render(<LoyaltyAccountsClient userAccounts={[pointsSoon, certificateSoon]} availablePrograms={[]} />);

    const accountHeadings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(accountHeadings).toEqual(['Certificate Soon', 'Points Later']);
  });
});
