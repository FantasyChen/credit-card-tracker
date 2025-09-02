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
  title: "CouponCycle - Maximize Your Card Benefits",
  description: "Never miss a credit card benefit again. CouponCycle helps you track every perk and maximize your annual fees.",
  icons: {
    icon: {
      url: "/favicon.png",
      sizes: "any", // Hint that the icon can be scaled
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
  formatDetection: {
    telephone: false,
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
