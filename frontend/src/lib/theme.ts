"use client";

/**
 * Light or dark, chosen per device.
 *
 * The three states are Light, Dark and System, and System is the only one that
 * looks outside this app: it follows what the phone or browser is set to, live.
 *
 * This is deliberately the same shape as the interface language in `i18n.ts`:
 * one device, one stored choice, nothing sent to the server. The choice is *not*
 * a `Settings` column, because a family sharing an account between a bright
 * office and a dark bedroom would then fight over it, and because the appearance
 * of a screen belongs to the screen. It is also not applied automatically on a
 * first visit: the starting appearance is the one that was designed and
 * reviewed, and following the operating system is something a student opts into
 * by picking System.
 *
 * `apply()` writes `data-theme` on `<html>`, which is the only thing
 * `globals.css` needs to see — every colour in the app is a token, so that one
 * attribute moves the whole interface. The same attribute is set before the first
 * paint by the inline script in `app/layout.tsx`, which reads this same
 * `careerguide.theme` key, so a dark visit does not start white.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const STORAGE_KEY = "careerguide.theme";

/** What a visitor who has never opened Settings sees. */
export const DEFAULT_CHOICE: ThemeChoice = "light";

function isChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(choice: ThemeChoice, prefersDark = systemPrefersDark()): Theme {
  if (choice !== "system") return choice;
  return prefersDark ? "dark" : "light";
}

function read(): ThemeChoice {
  if (typeof window === "undefined") return DEFAULT_CHOICE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isChoice(stored) ? stored : DEFAULT_CHOICE;
  } catch {
    // Storage can be closed to us in private mode; the page then simply paints
    // the starting theme.
    return DEFAULT_CHOICE;
  }
}

let choice: ThemeChoice = DEFAULT_CHOICE;
let resolved: Theme = "light";
let mounted = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function apply() {
  if (typeof document === "undefined") return;
  resolved = resolveTheme(choice);
  document.documentElement.dataset.theme = resolved;
}

export function setThemeChoice(next: ThemeChoice) {
  if (!isChoice(next)) return;
  choice = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode: the appearance holds until the tab closes */
  }
  apply();
  emit();
}

/** One press goes the other way and lands on a fixed theme, never on System —
 * following the operating system is a decision, not a stop on a cycle. */
export function toggleTheme() {
  setThemeChoice(currentTheme() === "dark" ? "light" : "dark");
}

/** The theme the paint is using, which is light or dark even when the student
 * picked System. */
export function currentTheme(): Theme {
  return mounted ? resolved : "light";
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function mount() {
  if (mounted) return;
  mounted = true;
  choice = read();
  apply();
  if (typeof window !== "undefined" && window.matchMedia) {
    // A System choice is a promise to keep following the OS, including when the
    // phone switches to dark at sunset while the app is open.
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener?.("change", () => {
        if (choice !== "system") return;
        apply();
        emit();
      });
  }
  emit();
}

/** Until the first client render settles every screen is light, so the HTML the
 * server produced and the HTML React hydrates agree — the same rule `i18n.ts`
 * follows for the language. */
function useThemeStore<T>(select: () => T, server: T): T {
  useEffect(mount, []);
  return useSyncExternalStore(subscribe, select, () => server);
}

function snapshotChoice(): ThemeChoice {
  return mounted ? choice : DEFAULT_CHOICE;
}

function snapshotTheme(): Theme {
  return mounted ? resolved : "light";
}

export function useThemeChoice(): ThemeChoice {
  return useThemeStore(snapshotChoice, DEFAULT_CHOICE);
}

export function useTheme(): Theme {
  return useThemeStore(snapshotTheme, "light");
}

/** The label a switch needs: what this button is about to do, not what it
 * already did. */
export function useThemeToggleLabel(): string {
  const theme = useTheme();
  return useCallback(() => (theme === "dark" ? "Switch to light theme" : "Switch to dark theme"), [theme])();
}
