"use client";

/**
 * Cookie and storage consent.
 *
 * What this app keeps in the browser by itself is four `careerguide.*` keys it
 * cannot run without (and, only on a deployment that switches on the optional
 * email sign-in, whatever Clerk itself stores). What it *can* load with an
 * answer of "yes" is two named measurement services — see
 * `components/analytics/Analytics.tsx`, which refuses to load them without this
 * hook's `analytics` category, without configured project ids, and on any of the
 * signed-in screens.
 *
 * So this hook's job is three things: record an answer that a real control now
 * depends on, hand every future third-party script a single place to check
 * before it loads, and make that answer readable by more than one component at
 * once.
 *
 * The stored answer is one module-level record that every component reads
 * through `useSyncExternalStore`, the same way the interface language is held.
 * The server and the very first client render both say "nothing stored yet" —
 * which is why callers must wait for `settled` before showing the banner, or it
 * flashes at everyone who has already answered.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

export const CONSENT_CATEGORIES = ["necessary", "analytics", "marketing", "functional"] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];
export type ConsentState = "pending" | "accepted-all" | "rejected-all" | "custom";

export type ConsentRecord = {
  state: ConsentState;
  categories: Record<ConsentCategory, boolean>;
  savedAt: string;
};

const STORAGE_KEY = "careerguide.consent";

const ALL_ON: Record<ConsentCategory, boolean> = {
  necessary: true,
  analytics: true,
  marketing: true,
  functional: true,
};

const ONLY_NECESSARY: Record<ConsentCategory, boolean> = {
  necessary: true,
  analytics: false,
  marketing: false,
  functional: false,
};

function build(state: ConsentState, categories: Record<ConsentCategory, boolean>): ConsentRecord {
  return { state, categories, savedAt: new Date().toISOString() };
}

function read(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    const states: ConsentState[] = ["pending", "accepted-all", "rejected-all", "custom"];
    if (!states.includes(parsed.state as ConsentState) || !parsed.categories) return null;
    const categories = {} as Record<ConsentCategory, boolean>;
    for (const key of CONSENT_CATEGORIES) {
      // Necessary is never switchable off: without the device id and the
      // session token there is no app to serve, so an honest record stores it
      // as true whatever an older version of this file said.
      categories[key] = key === "necessary" ? true : Boolean(parsed.categories[key]);
    }
    return { state: parsed.state as ConsentState, categories, savedAt: parsed.savedAt ?? "" };
  } catch {
    return null;
  }
}

type View = { settled: boolean; record: ConsentRecord | null };

let view: View = { settled: false, record: null };
const listeners = new Set<() => void>();

function publish(record: ConsentRecord | null, settled: boolean) {
  view = { settled, record };
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function snapshot(): View {
  return view;
}

/** Read the device's stored answer once, on the first client that asks. */
function settle() {
  if (view.settled || typeof window === "undefined") return;
  publish(read(), true);
}

function write(record: ConsentRecord) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* private mode: the answer then lives for this page only, which is stated on the banner */
  }
  publish(record, true);
}

export type CookieConsent = {
  /** False until the stored answer has been read back. Nothing should render before it. */
  settled: boolean;
  state: ConsentState;
  categories: Record<ConsentCategory, boolean>;
  /** Whether the visitor has answered at all — the banner's own visibility rule. */
  answered: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  saveCustom: (categories: Record<ConsentCategory, boolean>) => void;
  hasConsent: (category: ConsentCategory) => boolean;
};

export function useCookieConsent(): CookieConsent {
  const { settled, record } = useSyncExternalStore(subscribe, snapshot, () => view);

  useEffect(settle, []);

  const categories = record?.categories ?? ONLY_NECESSARY;

  const acceptAll = useCallback(() => write(build("accepted-all", ALL_ON)), []);
  const rejectAll = useCallback(() => write(build("rejected-all", ONLY_NECESSARY)), []);
  const saveCustom = useCallback(
    (chosen: Record<ConsentCategory, boolean>) =>
      write(build("custom", { ...chosen, necessary: true })),
    [],
  );
  const hasConsent = useCallback(
    (category: ConsentCategory) => category === "necessary" || categories[category],
    [categories],
  );

  return {
    settled,
    state: record?.state ?? "pending",
    categories,
    answered: record !== null,
    acceptAll,
    rejectAll,
    saveCustom,
    hasConsent,
  };
}
