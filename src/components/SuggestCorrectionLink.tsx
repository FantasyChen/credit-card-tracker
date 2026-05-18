import { SUPPORT_EMAIL } from '@/lib/site';

interface SuggestCorrectionLinkProps {
  subject: string;
  context: string;
  label?: string;
  className?: string;
}

export default function SuggestCorrectionLink({
  subject,
  context,
  label = 'Suggest a correction',
  className = '',
}: SuggestCorrectionLinkProps) {
  const body = [
    'What should be corrected?',
    '',
    '',
    'What source or data point supports the change?',
    '',
    '',
    'Perks Reminder context:',
    context,
  ].join('\n');

  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300 ${className}`}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
      {label}
    </a>
  );
}
