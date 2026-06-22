/**
 * PricingSection tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import PricingSection from '../PricingSection';

describe('PricingSection', () => {
  it('presents the product as completely free without Pro upsells', () => {
    render(<PricingSection />);

    expect(screen.getByRole('heading', { name: 'Completely free' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Free Account' })).toHaveAttribute('href', '/auth/signup');
    expect(screen.queryByText(/\bPro\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/beta/i)).not.toBeInTheDocument();
  });
});
