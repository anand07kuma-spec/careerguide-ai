"use client";

/**
 * Interface language.
 *
 * The conversation already follows whatever the student types (see
 * `services/language.py` on the backend). This is the other half: the buttons,
 * the navigation and the catalogue. It is deliberately a two-value choice —
 * English or हिन्दी — because a half-translated Hinglish interface would need
 * every string written twice anyway, and the student picks one by looking at it.
 *
 * The interface only ever changes when the student picks it in Settings → Language and voice, and
 * the choice is kept in this device's storage. It is deliberately *not* derived from the account's
 * `preferred_language`: a student who typed to the guide in Devanagari had the whole interface flip
 * to Hindi on the next load, which nobody asked for and which looks like the app misbehaving.
 * Conversation language stays automatic and server-side; interface language stays manual and local.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { HI } from "./hi";

export type UiLang = "en" | "hi";

const STORAGE_KEY = "careerguide.ui-lang";

/** The same key `request-lang.ts` reads on the public pages. Someone who picks
 * हिन्दी on `/careers` should not arrive in `/app` in English, and a public page
 * cannot read localStorage — so the toggle writes both stores and each half of
 * the site reads its own first. */
const LANG_COOKIE = "careerguide.ui-lang";

function fromCookie(): UiLang | null {
  if (typeof document === "undefined") return null;
  const pair = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANG_COOKIE}=`));
  const value = pair?.slice(LANG_COOKIE.length + 1);
  return value === "hi" || value === "en" ? value : null;
}

function read(): UiLang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "hi" || stored === "en") return stored;
    return fromCookie() ?? "en";
  } catch {
    // Storage can be closed to us in private mode; the cookie then decides.
    return fromCookie() ?? "en";
  }
}

let current: UiLang = "en";
let mounted = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

/** A screen reader given `lang="en"` reads Devanagari out as English gibberish,
 * so the document attribute has to follow the interface language. */
function applyDocumentLang(lang: UiLang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang === "hi" ? "hi-IN" : "en-IN";
}

export function setUiLang(lang: UiLang) {
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode: the choice then lasts for this page only, which is honest enough */
  }
  applyDocumentLang(lang);
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function snapshot() {
  // Until the first client render settles, every screen shows English, so the
  // HTML the server produced and the HTML React hydrates agree.
  return mounted ? current : "en";
}

export function useUiLang(): UiLang {
  useEffect(() => {
    if (!mounted) {
      mounted = true;
      current = read();
      applyDocumentLang(current);
      emit();
    }
  }, []);
  return useSyncExternalStore(subscribe, snapshot, () => "en" as UiLang);
}

/** `t("Careers")` → "करियर" when the interface is Hindi, the input otherwise.
 * English is the source text, so a missing translation degrades to English
 * rather than to a blank label. */
export function useT() {
  const lang = useUiLang();
  return useCallback(
    (en: string) => (lang === "hi" ? (HI[en] ?? en) : en),
    [lang],
  );
}

/** The same lookup for helpers that build a label outside a component, where no
 * hook can run. Only ever reads the value the mounted store already settled on. */
export function translate(en: string) {
  return mounted && current === "hi" ? (HI[en] ?? en) : en;
}

/** For a sentence that carries a value: `tf("Explorable from class {n}", { n })`.
 * The placeholder travels inside the key, so the Hindi entry can put the number
 * where Hindi grammar wants it instead of where English does. */
export function useTf() {
  const lang = useUiLang();
  return useCallback(
    (en: string, values: Record<string, string | number>) => {
      const template = lang === "hi" ? (HI[en] ?? en) : en;
      return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
        key in values ? String(values[key]) : whole,
      );
    },
    [lang],
  );
}
