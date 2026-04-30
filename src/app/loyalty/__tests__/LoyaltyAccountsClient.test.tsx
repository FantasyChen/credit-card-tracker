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
      lastActivityDate: new Date('2026-01-01'),
      expirationDate: new Date('2026-12-31'),
      isActive: true,
      notes: null,
      loyaltyProgram: program({ id: 'later-program', displayName: 'Later Miles' }),
    };
    const soon = {
      id: 'soon',
      accountNumber: null,
      lastActivityDate: new Date('2026-01-01'),
      expirationDate: new Date('2026-05-15'),
      isActive: true,
      notes: null,
      loyaltyProgram: program({ id: 'soon-program', displayName: 'Soon Miles' }),
    };

    render(<LoyaltyAccountsClient userAccounts={[later, soon]} availablePrograms={[]} />);

    const accountHeadings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(accountHeadings).toEqual(['Soon Miles', 'Later Miles']);
  });
});
