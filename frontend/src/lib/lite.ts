"use client";

/**
 * Lite mode: the lighter version of this app, chosen per device.
 *
 * The three states are Automatic, Lite and Full, and Automatic is the only one
 * that looks outside this app: it asks the browser what the connection is doing
 * right now. It is also the state nobody has to pick, because it is what a first
 * visit gets — a phone on `2g`, or one that has told every app it wants to save
 * data, starts lite without being asked, and a phone on a good link starts with
 * the full interface. Pressing either other button is remembered, so a student
 * who once said "Full" is never quietly put back into Lite when their signal
 * drops.
 *
 * This is the same shape as `theme.ts` and `i18n.ts`: one device, one stored
 * choice, nothing sent to the server. It is not a `Settings` column on purpose.
 * The connection a family's phone has is not a fact about the student, and two
 * children sharing one account on one handset may have opposite answers — the
 * older one on mobile data in the evening, the younger one on the household
 * Wi-Fi. What belongs to the device stays on the device.
 *
 * `apply()` writes `data-lite` on `<html>`, which is what `globals.css` reads to
 * flatten every animation and hide the decorative pictures. The attribute is set
 * before the first paint by the inline script in `app/layout.tsx`, which reads
 * this same `careerguide.lite` key the same way, so a lite visit does not start
 * by animating. What that script cannot do is stop a download — the React-side
 * gates in `useLite()` are the ones that keep the chart library and the route
 * prefetches off a slow connection.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type LiteChoice = "auto" | "lite" | "full";

const STORAGE_KEY = "careerguide.lite";

/** What a visitor who has never opened Settings gets: ask the connection. */
export const DEFAULT_CHOICE: LiteChoice = "auto";

/** The two `effectiveType` values that mean "this link is not carrying a
 * chart library", plus `3g`, which on a shared handset in a small town has
 * never once meant what the specification says it means. */
export const SLOW_EFFECTIVE_TYPES = ["slow-2g", "2g", "3g"];

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

function connection(): NetworkInformation | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { connection?: NetworkInformation };
  return nav.connection ?? null;
}

/** The browser's own read on how good this link is, right now.
 *
 * `connection` is a Chromium feature; on Safari and Firefox it is simply absent,
 * and an absent answer is not a slow one. A visitor on those browsers starts
 * with the full interface and can press Lite, which is the honest outcome of
 * building on a signal only some of them publish. */
export function connectionIsSlow(): boolean {
  const info = connection();
  if (!info) return false;
  if (info.saveData === true) return true;
  return SLOW_EFFECTIVE_TYPES.includes(info.effectiveType ?? "");
}

export function resolveLite(choice: LiteChoice, slow = connectionIsSlow()): boolean {
  if (choice === "lite") return true;
  if (choice === "full") return false;
  return slow;
}

function isChoice(value: unknown): value is LiteChoice {
  return value === "auto" || value === "lite" || value === "full";
}

function read(): LiteChoice {
  if (typeof window === "undefined") return DEFAULT_CHOICE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isChoice(stored) ? stored : DEFAULT_CHOICE;
  } catch {
    // Storage can be closed to us in private mode; the page then simply paints
    // whatever the connection says for this one visit.
    return DEFAULT_CHOICE;
  }
}

let choice: LiteChoice = DEFAULT_CHOICE;
let lite = false;
let mounted = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function apply() {
  if (typeof document === "undefined") return;
  lite = resolveLite(choice);
  document.documentElement.dataset.lite = String(lite);
}

export function setLiteChoice(next: LiteChoice) {
  if (!isChoice(next)) return;
  choice = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode: the choice holds until the tab closes */
  }
  apply();
  emit();
}

/** The stored choice, or `null` when this device has never been asked — which is
 * the difference Settings has to show, because "Automatic" and "nobody has set
 * this yet" look the same everywhere else. */
export function storedLiteChoice(): LiteChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isChoice(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** The answer the paint is using, before React has had a chance to read the
 * device. A hook that returned `true` here would make the server's HTML and the
 * client's first render disagree about what is on screen. */
export function currentLite(): boolean {
  return lite && mounted;
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
  // Deliberately not a `change` listener on `navigator.connection`. On these
  // handsets the reported type flips between `3g` and `4g` every few minutes, and
  // following it would take a chart or a picture away from under a student in the
  // middle of reading it. Automatic means "whatever the link said when this screen
  // was opened"; a reload is how the answer changes.
  emit();
}

/** Until the first client render settles, every screen is the full interface, so
 * the HTML the server produced and the HTML React hydrates agree — the same rule
 * `theme.ts` follows for light and dark. */
function useLiteStore<T>(select: () => T, server: T): T {
  useEffect(mount, []);
  return useSyncExternalStore(subscribe, select, () => server);
}

function snapshotChoice(): LiteChoice {
  return mounted ? choice : DEFAULT_CHOICE;
}

function snapshotLite(): boolean {
  return mounted ? lite : false;
}

export function useLiteChoice(): LiteChoice {
  return useLiteStore(snapshotChoice, DEFAULT_CHOICE);
}

/** `true` only once the device has actually said so, which is one render after
 * hydration. Anything rendered from this must therefore look the same in both
 * answers, or the two will flash. */
export function useLite(): boolean {
  return useLiteStore(snapshotLite, false);
}

/** For the handful of places that need the answer inside a callback rather than
 * during a render — the chat screen decides how to ask its next question with
 * this, not with a hook it cannot call from an event handler. */
export function isLiteNow(): boolean {
  if (!mounted) return false;
  return lite;
}

/** The label a switch needs: what this button is about to do, not what it
 * already did. */
export function useLiteToggleLabel(): string {
  const value = useLite();
  return useCallback(() => (value ? "Use the full interface" : "Use the lighter interface"), [value])();
}
