'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'perks-reminder-ios-install-dismissed';

function isIosSafari() {
  if (typeof window === 'undefined') return false;

  const { userAgent, platform, maxTouchPoints } = window.navigator;
  const isIosDevice = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && window.navigator.standalone === true);

  return isIosDevice && isSafari && !isStandalone;
}

export default function IosInstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isIosSafari()) return;

    try {
      if (window.localStorage.getItem(DISMISS_KEY) === 'true') return;
    } catch {
      return;
    }

    const timer = window.setTimeout(() => setIsVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setIsVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // Ignore private browsing storage failures.
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-indigo-100 bg-white p-3 text-sm shadow-lg dark:border-indigo-900 dark:bg-gray-900 sm:bottom-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-base font-semibold text-white">
          PR
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">Add Perks Reminder to your Home Screen</p>
          <p className="mt-1 text-gray-600 dark:text-gray-300">Tap Share, then Add to Home Screen for a faster iPhone experience.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <span className="sr-only">Dismiss install prompt</span>
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
