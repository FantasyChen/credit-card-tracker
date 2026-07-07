'use client';

import React from 'react';
import Link from 'next/link';

const features = [
  'Unlimited card tracking',
  'Recurring benefit cycles',
  'Email reminders',
  'Custom reminder windows',
  'Loyalty point expiration tracking',
  'Free night certificate tracking',
  'Annual fee ROI analysis',
  'Data import and export',
];

function CheckIcon() {
  return (
    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface PricingSectionProps {
  headingLevel?: 'h1' | 'h2';
}

export default function PricingSection({ headingLevel = 'h2' }: PricingSectionProps) {
  const Heading = headingLevel;

  return (
    <section id="pricing" className="border-b border-border bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Heading className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Completely free
          </Heading>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Perks Reminder has no paid plan, no subscription, and no card or reminder limit.
          </p>
        </div>

        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-black/[0.03]">
          <div className="grid gap-8 p-8 md:grid-cols-[0.8fr_1.2fr] md:p-10">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Price
              </p>
              <div className="mt-2">
                <span className="text-5xl font-bold text-foreground">$0</span>
                <span className="ml-2 text-muted-foreground">forever</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Built as a free, open-source tracker for people who want reminders without bank-link access or another paid finance app.
              </p>
              <Link
                href="/auth/signup"
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/5 transition-colors hover:bg-primary/90 sm:w-auto"
              >
                Create Free Account
              </Link>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Everything included
              </h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 rounded-lg border border-border bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
                If the product needs limits for abuse prevention later, they should be operational safeguards, not paid feature gates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
