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
    <div className={`rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm shadow-black/[0.03] sm:p-10 ${className}`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <IconComponent className="h-8 w-8" strokeWidth={1.5} />
      </div>
      
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        {title}
      </h3>
      
      <p className="mx-auto mb-6 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background active:translate-y-px"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background active:translate-y-px"
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
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/5 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background active:translate-y-px"
          >
            {secondaryActionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
