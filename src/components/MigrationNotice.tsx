import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';

const NEW_SITE_URL = 'https://www.perks-reminder.com';

export default function MigrationNotice() {
  return (
    <section
      aria-label="Domain migration notice"
      className="border-b border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">CouponCycle is now Perks Reminder</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Please update your bookmarks to{' '}
            <a
              href={NEW_SITE_URL}
              className="font-semibold underline decoration-amber-500 underline-offset-2 hover:text-amber-950 dark:hover:text-white"
            >
              www.perks-reminder.com
            </a>{' '}
            before May 27, 2026. Your account and data are unchanged.
          </p>
        </div>
        <a
          href={NEW_SITE_URL}
          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-amber-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
        >
          Open new site
          <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
