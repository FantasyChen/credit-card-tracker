import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
// import { ensureCurrentBenefitStatuses } from "@/lib/actions/benefitActions"; // Keep import commented out or remove

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "CardTracker",
  description: "Track credit card benefits and cycles",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ensureCurrentBenefitStatuses(); // <-- REMOVE THIS CALL

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50`}
      >
        <Providers>
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
