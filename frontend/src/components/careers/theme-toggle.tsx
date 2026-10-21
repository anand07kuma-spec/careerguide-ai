"use client";

import { Moon, Sun } from "lucide-react";

import { toggleTheme, useTheme } from "@/lib/theme";

/**
 * The one appearance button on the public pages, next to the language toggle.
 *
 * It lives here rather than only in Settings for the same reason the language
 * toggle does: `/careers` and `/blog` are read by people who have no account on
 * this device, and an appearance choice is not something to make them sign up or
 * dig through a settings accordion for. One press switches between light and
 * dark — it does not cycle through System, which is a decision rather than a
 * station on a loop, and that choice stays in Settings.
 *
 * The label comes in as a prop because these pages are server-rendered in
 * whichever language the request asked for (`request-lang.ts`), and a component
 * that reads the *interface* language from this device's storage would disagree
 * with the page around it. Same arrangement as `LangToggle`.
 */
export function ThemeToggle({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:border-brand-light hover:text-ink"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
