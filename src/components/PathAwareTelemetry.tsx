"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";

const AMEX_HANDOFF_PATH = "/integrations/amex-sync";

export default function PathAwareTelemetry({ googleAnalyticsId }: { googleAnalyticsId?: string }) {
  const pathname = usePathname();
  if (pathname === AMEX_HANDOFF_PATH) return null;

  return (
    <>
      {googleAnalyticsId && (
        <>
          <Script
            id="google-analytics-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAnalyticsId)}`}
          />
          <Script
            id="google-analytics-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', ${JSON.stringify(googleAnalyticsId)}, {
                  page_title: document.title,
                  page_location: window.location.origin + window.location.pathname,
                });
              `,
            }}
          />
        </>
      )}
      <Analytics />
    </>
  );
}
