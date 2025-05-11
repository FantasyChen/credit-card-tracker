"use client";

import { ThemeProvider } from "next-themes";
import Providers from "@/components/Providers"; // Your existing Providers
import React from "react";

export function ThemeProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Providers> {/* Your existing Providers now wrapped by ThemeProvider */}
        {children}
      </Providers>
    </ThemeProvider>
  );
} 