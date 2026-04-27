'use client';

import { useEffect, useState } from 'react';

const OLD_DOMAIN = 'coupon-cycle.site';
const NEW_DOMAIN = 'perks-reminder.com';

export default function DomainMigrationBanner() {
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  if (!hostname.includes(OLD_DOMAIN) && !hostname.includes(NEW_DOMAIN)) {
    return null;
  }

  const isOldDomain = hostname.includes(OLD_DOMAIN);
  const href = hostname.startsWith('loyalty.')
    ? `https://loyalty.${NEW_DOMAIN}`
    : `https://www.${NEW_DOMAIN}`;

  return (
    <div className="bg-indigo-50 px-4 py-2 text-center text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
      {isOldDomain ? (
        <>
          CouponCycle is moving to{' '}
          <a className="font-semibold underline" href={href}>
            {href.replace('https://', '')}
          </a>
          . Your account and data will stay the same.
        </>
      ) : (
        <>CouponCycle is now Perks Reminder. Your account and data stayed the same.</>
      )}
    </div>
  );
}
