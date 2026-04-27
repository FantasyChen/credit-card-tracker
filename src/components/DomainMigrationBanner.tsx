'use client';

import { useEffect, useState } from 'react';

const OLD_DOMAIN = 'coupon-cycle.site';
const NEW_DOMAIN = 'perks-reminder.com';

export default function DomainMigrationBanner() {
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  if (!hostname.includes(OLD_DOMAIN)) {
    return null;
  }

  const href = hostname.startsWith('loyalty.')
    ? `https://loyalty.${NEW_DOMAIN}`
    : `https://www.${NEW_DOMAIN}`;

  return (
    <div className="bg-indigo-50 px-4 py-2 text-center text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
      <span className="font-semibold">CouponCycle is now Perks Reminder.</span>{' '}
      Please update your bookmarks to{' '}
      <a className="font-semibold underline" href={href}>
        {href.replace('https://', '')}
      </a>{' '}
      before May 27, 2026. Your account and data are unchanged.
    </div>
  );
}
