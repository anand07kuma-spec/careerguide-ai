/**
 * Interface language on the pages that have no client state.
 *
 * `i18n.ts` is a `"use client"` store: it settles on English in the HTML the
 * server sends and flips to Hindi during hydration. That is fine inside `/app`,
 * where there is a signed-in device and a Settings screen, and wrong on
 * `/careers` and `/blog`, whose whole purpose is to be readable before a single
 * script runs — a crawler would index English and a parent on a slow phone would
 * never see the Hindi at all. So the public pages resolve the language per
 * request (see `request-lang.ts`) and translate here, before the HTML exists.
 *
 * Nothing in this file may import `next/headers` or any other server-only
 * module: the language toggle is a client component and it needs `makeT` too.
 *
 * The translation reuses the single `HI` map the app screens use, so a label
 * never disagrees with itself between `/app/careers` and `/careers`.
 */

import { HI } from "./hi";

export type PublicLang = "en" | "hi";

export type T = (en: string) => string;
export type TF = (en: string, values: Record<string, string | number>) => string;

/** `t("Careers")` → "करियर" in Hindi, the input otherwise. English is the source
 * text, so an untranslated string shows in English rather than as a hole. */
export function makeT(lang: PublicLang): T {
  if (lang === "en") return (en) => en;
  return (en) => HI[en] ?? en;
}

/** For a sentence carrying a value: `tf("Open from class {n}", { n })`. The
 * placeholder travels inside the key so Hindi can put the number where Hindi
 * grammar wants it. */
export function makeTf(lang: PublicLang): TF {
  const t = makeT(lang);
  return (en, values) =>
    t(en).replace(/\{(\w+)\}/g, (whole, key: string) =>
      key in values ? String(values[key]) : whole,
    );
}

/** The link a language control points at. `?lang=` is the whole mechanism on a
 * browser with scripting turned off, so it is built here rather than by some
 * client-side state. `keepQuery` carries the filters already applied, so
 * switching language never resets a search. */
export function langHref(
  path: string,
  lang: PublicLang,
  keepQuery?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(keepQuery ?? {})) {
    if (value) params.set(key, value);
  }
  params.set("lang", lang);
  return `${path}?${params.toString()}`;
}
