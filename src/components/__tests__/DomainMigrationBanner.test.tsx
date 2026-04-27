import { render, screen } from '@testing-library/react';
import DomainMigrationBanner from '../DomainMigrationBanner';

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { hostname },
    writable: true,
  });
}

describe('DomainMigrationBanner', () => {
  it('shows the cutoff message on the old main domain', () => {
    setHostname('www.coupon-cycle.site');

    render(<DomainMigrationBanner />);

    expect(screen.getByText(/CouponCycle is now Perks Reminder/i)).toBeInTheDocument();
    expect(screen.getByText(/May 27, 2026/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /www\.perks-reminder\.com/i })).toHaveAttribute(
      'href',
      'https://www.perks-reminder.com'
    );
  });

  it('does not show on the new domain', () => {
    setHostname('www.perks-reminder.com');

    const { container } = render(<DomainMigrationBanner />);

    expect(container).toBeEmptyDOMElement();
  });
});
