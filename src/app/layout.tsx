import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers"; // Reinstate original Providers
import Footer from "@/components/Footer";
import SkipLink from "@/components/ui/SkipLink";
import { Analytics } from '@vercel/analytics/next';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ErrorBoundary } from "@/lib/monitoring/errorBoundary";
import { PRIMARY_SITE_URL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import DomainMigrationBanner from "@/components/DomainMigrationBanner";
// import { ThemeProviders } from "@/components/ThemeProviders"; // Removed
// import { ensureCurrentBenefitStatuses } from "@/lib/actions/benefitActions"; // Keep import commented out or remove

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} - Credit Card Benefits Tracker | Never Miss Rewards Again`,
    template: `%s | ${SITE_NAME}`
  },
  description: `${SITE_DESCRIPTION} Free tool for Chase, Amex, Capital One, and a growing catalog of premium cards. Get ROI insights and smart notifications.`,
  keywords: [
    "credit card benefits tracker",
    "credit card rewards tracker", 
    "credit card perks manager",
    "Chase Sapphire benefits",
    "American Express benefits",
    "Capital One benefits",
    "credit card annual fee ROI",
    "travel credit tracker",
    "dining credit tracker",
    "Uber credit tracker",
    "free credit card tool",
    "maximize credit card rewards",
    "credit card benefit calendar",
    "premium credit card tracker"
  ],
  authors: [{ name: `${SITE_NAME} Team` }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    telephone: false,
  },
  metadataBase: new URL(PRIMARY_SITE_URL),
  openGraph: {
    title: `${SITE_NAME} - Credit Card Benefits Tracker`,
    description: "Never miss a credit card benefit again. Track every perk and maximize your annual fees.",
    url: PRIMARY_SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: '/hero-image.jpg',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - Credit Card Benefits Tracker`,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} - Credit Card Benefits Tracker`,
    description: "Never miss a credit card benefit again. Track every perk and maximize your annual fees.",
    images: ['/hero-image.jpg'],
    creator: '@fantasy_c',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: {
      url: "/favicon.png",
      sizes: "any",
    },
    apple: {
      url: "/favicon.png",
      sizes: "180x180",
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3b82f6",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ensureCurrentBenefitStatuses(); // <-- REMOVE THIS CALL

  // Get the session server-side to prevent authentication flash
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
        <meta name="application-name" content={SITE_NAME} />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        
        {/* Google Analytics */}
        {process.env.GOOGLE_ANALYTICS_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.GOOGLE_ANALYTICS_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.GOOGLE_ANALYTICS_ID}', {
                    page_title: document.title,
                    page_location: window.location.href,
                  });
                `,
              }}
            />
          </>
        )}
        
        {/* Google Search Console Verification */}
        {process.env.GOOGLE_SEARCH_CONSOLE_VERIFICATION && (
          <meta name="google-site-verification" content={process.env.GOOGLE_SEARCH_CONSOLE_VERIFICATION} />
        )}
      </head>
      {/* <ThemeProviders> */}
      <Providers session={session}>{/* Use original Providers */}
        <ErrorBoundary>
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
          >
            <SkipLink />
            <div className="flex min-h-full flex-col bg-gray-50 dark:bg-gray-950">
              <Navbar />
              <DomainMigrationBanner />
              <main 
                id="main-content" 
                className="container mx-auto flex-grow px-4 py-8"
                tabIndex={-1}
                role="main"
                aria-label="Main content"
              >
                {children}
              </main>
              <Footer />
              <Analytics />
            </div>
          </body>
        </ErrorBoundary>
      </Providers>
      {/* </ThemeProviders> */}
    </html>
  );
}
