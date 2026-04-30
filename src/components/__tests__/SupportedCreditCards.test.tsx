/**
 * SupportedCreditCards component tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SupportedCreditCards from '../SupportedCreditCards';

jest.mock('../SearchInput', () => ({
  __esModule: true,
  default: ({ placeholder }: { placeholder: string }) => (
    <input aria-label="Search supported cards" placeholder={placeholder} />
  ),
}));

describe('SupportedCreditCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the loaded catalog count without overstating support', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'card-1',
          name: 'Test Premium Card',
          issuer: 'Test Bank',
          annualFee: 95,
          imageUrl: null,
          benefits: [
            { id: 'benefit-1', description: '$50 travel credit', maxAmount: 50 },
          ],
        },
      ],
    });

    render(<SupportedCreditCards />);

    await waitFor(() => {
      expect(screen.getByText(/Track benefits from 1 popular credit card\./i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/1\+ popular credit cards/i)).not.toBeInTheDocument();
  });
});
