"use client";

import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-6 w-6 rounded-md p-2" />; // Placeholder to maintain layout and style
  }

  const toggleTheme = () => {
    // Simple toggle: Light -> Dark -> System -> Light ...
    if (resolvedTheme === 'light') {
      setTheme('dark');
    } else if (resolvedTheme === 'dark') {
      setTheme('system');
    } else { // theme is 'system' (could be light or dark based on OS)
      setTheme('light');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="rounded-md p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:focus:ring-gray-500 dark:focus:ring-offset-gray-800 transition-colors duration-150"
      aria-label="Toggle theme"
    >
      {/* Adjust icon based on resolvedTheme for better UX when 'system' is active */}
      {resolvedTheme === "dark" ? (
        <SunIcon className="h-5 w-5" />
      ) : resolvedTheme === "light" ? (
        <MoonIcon className="h-5 w-5" />
      ) : (
        // When theme is 'system', show an icon indicating it can be changed
        // Or, show icon based on what system theme resolves to
        <ComputerDesktopIcon className="h-5 w-5" /> 
      )}
    </button>
  );
} 