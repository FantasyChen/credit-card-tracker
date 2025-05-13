import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers"; // Reinstate original Providers
import Footer from "@/components/Footer";
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
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ensureCurrentBenefitStatuses(); // <-- REMOVE THIS CALL

  return (
    // Remove suppressHydrationWarning if not needed by original Providers
    // <html lang="en" className="h-full" suppressHydrationWarning>
    <html lang="en" className="h-full">
      {/* <ThemeProviders> */}
      <Providers> { /* Use original Providers */}
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
        >
          <div className="flex min-h-full flex-col bg-gray-50 dark:bg-gray-950">
            <Navbar />
            <main className="container mx-auto flex-grow px-4 py-8">
              {children}
            </main>
            <Footer />
          </div>
        </body>
      </Providers>
      {/* </ThemeProviders> */}
    </html>
  );
}
