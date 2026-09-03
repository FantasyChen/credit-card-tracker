import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
  AMEX_GREASY_FORK_URL,
  AMEX_READER_SETUP_PATH,
  AMEX_READER_SUPPORT_URL,
} from "@/lib/amex-benefit-reader/public-links";

export const metadata: Metadata = {
  title: "Set up the Amex benefit reader",
  description:
    "Install the Perks Reminder Amex benefit reader from Greasy Fork and review the manual, local-only setup.",
  alternates: {
    canonical: AMEX_READER_SETUP_PATH,
  },
};

const setupSteps = [
  {
    title: "Install the userscript",
    description:
      "Install the userscript from Greasy Fork in Tampermonkey or another compatible userscript manager.",
  },
  {
    title: "Open Amex while signed in",
    description:
      "Visit the American Express benefits page in the same browser where the userscript is enabled. The reader uses your existing session and never asks for your password or MFA code.",
  },
  {
    title: "Start a manual scan",
    description:
      "Open the reader and choose Scan all cards. Nothing runs on page load, in the background, or on a timer.",
  },
  {
    title: "Review before syncing",
    description:
      "If you choose Sync reviewed, Perks Reminder previews the normalized observations first. A destination card must match the exact five ending digits shown by Amex before it can be considered for sync.",
  },
];

export default function AmexReaderSetupPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-black/[0.04]">
        <div className="border-b border-border bg-muted/35 px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1">
              <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
              Read-only browser setup
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1">
              Greasy Fork
            </span>
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Set up the Perks Reminder Amex benefit reader
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Use the published userscript to read normalized benefit progress from
            your signed-in American Express session. You choose every scan, and
            the reader keeps observations on this device until you explicitly
            review a handoff to Perks Reminder.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={AMEX_GREASY_FORK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background"
            >
              Install from Greasy Fork
              <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background"
            >
              Read the privacy policy
            </Link>
          </div>
        </div>

        <div className="grid gap-10 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Four steps to your first scan
            </h2>
            <ol className="mt-6 space-y-6">
              {setupSteps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="space-y-4" aria-label="Reader safety notes">
            <div className="rounded-xl border border-border bg-muted/30 p-5">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-foreground">What stays local</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    The reader stores normalized observations and a local identity
                    fingerprint. It does not save raw Amex responses, passwords,
                    cookies, MFA values, or provider tokens.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-amber-950 dark:text-amber-100">
                    Enable one reader edition
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-amber-900 dark:text-amber-200">
                    The Chrome extension and Greasy Fork userscript are alternate
                    distributions of the same reader. Use one at a time so the
                    panel does not mount twice.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="border-t border-border px-6 py-6 sm:px-10">
          <p className="text-sm leading-6 text-muted-foreground">
            Need help with installation or a scan? Visit{" "}
            <a
              href={AMEX_READER_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              reader support
            </a>
            . Perks Reminder is independent and is not affiliated with or endorsed
            by American Express.
          </p>
        </div>
      </section>
    </div>
  );
}
