import { cookies } from "next/headers";

import type { PublicLang } from "./public-i18n";

/**
 * Which language this request asked for.
 *
 * Two inputs, in this order:
 *
 * 1. `?lang=hi` on the URL — what the toggle link carries, and the only path
 *    that works with scripting turned off.
 * 2. The `careerguide.ui-lang` cookie the toggle also writes, so that a Hindi
 *    reader who follows an internal link to `/blog` does not fall back to
 *    English halfway through the visit.
 *
 * Anything else, including a value that is not `en` or `hi`, is English. The
 * query string is untrusted input and this is a closed set, so nothing user
 * supplied ever reaches the HTML as a language tag.
 *
 * Reading the cookie makes the route dynamic, which is exactly what these pages
 * already are — each one awaits `connection()` and reads the catalogue at
 * request time, so none of them is prerendered with somebody else's language in
 * it.
 */

/** Same key the client store writes, so one choice covers both halves of the
 * site; `i18n.ts` reads localStorage first and this cookie second. */
export const LANG_COOKIE = "careerguide.ui-lang";

type SearchParams = Record<string, string | string[] | undefined>;

export async function publicLang(searchParams?: SearchParams): Promise<PublicLang> {
  const fromUrl = searchParams?.lang;
  if (fromUrl === "hi" || fromUrl === "en") return fromUrl;
  const stored = (await cookies()).get(LANG_COOKIE)?.value;
  if (stored === "hi" || stored === "en") return stored;
  return "en";
}
