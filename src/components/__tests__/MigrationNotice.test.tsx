import { render, screen } from '@testing-library/react';
import MigrationNotice from '../MigrationNotice';

describe('MigrationNotice', () => {
  it('tells users the new domain, cutoff date, and unchanged account status', () => {
    render(<MigrationNotice />);

    expect(screen.getByText(/CouponCycle is now Perks Reminder/i)).toBeInTheDocument();
    expect(screen.getByText(/May 27, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Your account and data are unchanged/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /www\.perks-reminder\.com/i })).toHaveAttribute(
      'href',
      'https://www.perks-reminder.com'
    );
  });
});
