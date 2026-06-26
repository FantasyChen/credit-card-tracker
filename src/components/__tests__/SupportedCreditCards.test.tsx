/**
 * SupportedCreditCards component tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import SupportedCreditCards from '../SupportedCreditCards';
import { getPublicStaticCards } from '@/lib/static-catalog';

describe('SupportedCreditCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the static catalog count without overstating support', () => {
    render(<SupportedCreditCards />);

    const cardCount = getPublicStaticCards().length;
    expect(screen.getByText(`Track benefits from ${cardCount} popular credit cards. We support cards from major issuers with detailed benefit tracking and automated cycle management.`)).toBeInTheDocument();

    expect(screen.queryByText(new RegExp(`${cardCount}\\\\+ popular credit cards`, 'i'))).not.toBeInTheDocument();
  });
});
