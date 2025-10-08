import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers"; // Reinstate original Providers
import Footer from "@/components/Footer";
import { Analytics } from '@vercel/analytics/next';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ErrorBoundary } from "@/lib/monitoring/errorBoundary";
// import { ThemeProviders } from "@/components/ThemeProviders"; // Removed
// import { ensureCurrentBenefitStatuses } from "@/lib/actions/benefitActions"; // Keep import commented out or remove

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: {
    default: "CouponCycle - Credit Card Benefits Tracker | Never Miss Rewards Again",
    template: "%s | CouponCycle"
  },
  description: "Track credit card benefits, maximize rewards, and never miss expiring perks again. Free tool for Chase, Amex, Capital One, and 50+ premium cards. Get ROI insights and smart notifications.",
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
  authors: [{ name: "CouponCycle Team" }],
  creator: "CouponCycle",
  publisher: "CouponCycle",
  formatDetection: {
    telephone: false,
  },
  metadataBase: new URL('https://www.coupon-cycle.site'),
  openGraph: {
    title: "CouponCycle - Credit Card Benefits Tracker",
    description: "Never miss a credit card benefit again. Track every perk and maximize your annual fees.",
    url: 'https://www.coupon-cycle.site',
    siteName: 'CouponCycle',
    images: [
      {
        url: '/hero-image.jpg',
        width: 1200,
        height: 630,
        alt: 'CouponCycle - Credit Card Benefits Tracker',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "CouponCycle - Credit Card Benefits Tracker",
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
    title: "CouponCycle",
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
    // Remove suppressHydrationWarning if not needed by original Providers
    // <html lang="en" className="h-full" suppressHydrationWarning>
    <html lang="en" className="h-full">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CouponCycle" />
        <meta name="application-name" content="CouponCycle" />
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
            <div className="flex min-h-full flex-col bg-gray-50 dark:bg-gray-950">
              <Navbar />
              <main className="container mx-auto flex-grow px-4 py-8">
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
