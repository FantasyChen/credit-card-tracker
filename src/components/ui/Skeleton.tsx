import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200 dark:bg-gray-700',
        className
      )}
    />
  );
}

// Card skeleton for loading credit cards
export function CardSkeleton() {
  return (
    <div className="border rounded-lg p-4 shadow-md bg-white dark:bg-gray-800 dark:border-gray-700">
      {/* Card image placeholder */}
      <Skeleton className="h-40 w-full mb-4 rounded-lg" />
      
      {/* Title */}
      <Skeleton className="h-6 w-3/4 mb-2" />
      
      {/* Issuer info */}
      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      
      {/* Benefits section */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Skeleton className="h-4 w-24 mb-2" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="mt-6 flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 flex-1 rounded-md" />
      </div>
    </div>
  );
}

// Benefit card skeleton
export function BenefitCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6">
      {/* Status indicator */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gray-200 dark:bg-gray-700" />
      
      <div className="space-y-4">
        {/* Top section */}
        <div className="flex items-start space-x-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        
        {/* Card info */}
        <div className="pl-11 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        
        {/* Action buttons */}
        <div className="pl-11 flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Summary widget skeleton
export function SummaryWidgetSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center">
        <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
        <div className="ml-4 flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>
    </div>
  );
}

// Dashboard skeleton combining multiple elements
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Summary widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <SummaryWidgetSkeleton />
        <SummaryWidgetSkeleton />
        <SummaryWidgetSkeleton />
      </div>
      
      {/* Upcoming benefits */}
      <div>
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="space-y-4">
          <BenefitCardSkeleton />
          <BenefitCardSkeleton />
          <BenefitCardSkeleton />
        </div>
      </div>
    </div>
  );
}

// Cards page skeleton
export function CardsPageSkeleton() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

// Benefits page skeleton
export function BenefitsPageSkeleton() {
  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>
      
      {/* Summary widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <SummaryWidgetSkeleton />
        <SummaryWidgetSkeleton />
        <SummaryWidgetSkeleton />
        <SummaryWidgetSkeleton />
      </div>
      
      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-8">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      
      {/* Benefits list */}
      <div className="space-y-4">
        <BenefitCardSkeleton />
        <BenefitCardSkeleton />
        <BenefitCardSkeleton />
        <BenefitCardSkeleton />
      </div>
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// Loyalty account skeleton
export function LoyaltyAccountSkeleton() {
  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

