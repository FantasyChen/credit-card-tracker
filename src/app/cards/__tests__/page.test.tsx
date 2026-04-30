/**
 * Cards page UI tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import UserCardsPage from '../page';

describe('UserCardsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a helpful signed-out callout when cards require authentication', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
    });

    render(<UserCardsPage />);

    await waitFor(() => {
      expect(screen.getByText('Track your card perks in one place')).toBeInTheDocument();
    });

    expect(screen.getByText(/Add your cards once, then let Perks Reminder calculate every cycle/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to view cards' })).toHaveAttribute(
      'href',
      '/auth/signin?callbackUrl=/cards'
    );
    expect(screen.getByRole('link', { name: 'Create free account' })).toHaveAttribute(
      'href',
      '/auth/signup?callbackUrl=/cards'
    );
  });
});
