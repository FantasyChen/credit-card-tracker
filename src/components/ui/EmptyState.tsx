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
    <div className={`rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center bg-gray-50/50 dark:bg-gray-800/50 ${className}`}>
      <div className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4">
        <IconComponent className="w-full h-full" strokeWidth={1} />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        {description}
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 dark:focus:ring-offset-gray-900"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 dark:focus:ring-offset-gray-900"
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
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 dark:focus:ring-offset-gray-900"
          >
            {secondaryActionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

