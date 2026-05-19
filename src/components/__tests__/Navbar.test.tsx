/**
 * Navbar tests
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Navbar from '../Navbar';
import { signOut, useSession } from 'next-auth/react';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/components/ui/ThemeToggle', () => ({
  __esModule: true,
  default: () => <button type="button">Theme</button>,
}));

const mockUseSession = jest.mocked(useSession);
const mockSignOut = jest.mocked(signOut);

describe('Navbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an Account link for signed-in users', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          subscriptionTier: 'PRO',
          isBetaUser: true,
        },
        expires: '2026-12-31',
      },
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Navbar />);

    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/settings');
    expect(screen.getByText('Beta Pro')).toBeInTheDocument();
  });

  it('hides the Account link for signed-out users', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<Navbar />);

    expect(screen.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs out to a neutral page instead of returning to the current protected page', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          subscriptionTier: 'FREE',
        },
        expires: '2026-12-31',
      },
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<Navbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });
});
