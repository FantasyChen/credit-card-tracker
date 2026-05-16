import { cn } from "@/lib/utils";
import type React from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
