/**
 * PricingSection tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import PricingSection from '../PricingSection';

describe('PricingSection', () => {
  it('routes subscription actions to sign up instead of sign in', () => {
    render(<PricingSection />);

    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/auth/signup');
    expect(screen.getByRole('link', { name: 'Sign Up — Get Pro Free' })).toHaveAttribute('href', '/auth/signup');
  });
});
