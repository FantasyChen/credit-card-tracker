import Link from 'next/link';
import {
  CreditCardIcon,
  ClockIcon,
  GiftIcon,
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  BellIcon,
} from '@heroicons/react/24/outline';

type IconType = 
  | 'credit-card' 
  | 'clock' 
  | 'gift' 
  | 'star' 
  | 'check' 
  | 'x-circle' 
  | 'calendar'
  | 'bell';

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  className?: string;
}

const iconMap = {
  'credit-card': CreditCardIcon,
  'clock': ClockIcon,
  'gift': GiftIcon,
  'star': StarIcon,
  'check': CheckCircleIcon,
  'x-circle': XCircleIcon,
  'calendar': CalendarIcon,
  'bell': BellIcon,
};

export default function EmptyState({
  icon = 'gift',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  className = '',
}: EmptyStateProps) {
  const IconComponent = iconMap[icon];

  return (
    <div className={`rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-10 ${className}`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-500">
        <IconComponent className="h-8 w-8" strokeWidth={1.5} />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      
      <p className="mx-auto mb-6 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
        {description}
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {actionLabel}
            </button>
          )
        )}
        
        {secondaryActionLabel && secondaryActionHref && (
          <Link
            href={secondaryActionHref}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900"
          >
            {secondaryActionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
