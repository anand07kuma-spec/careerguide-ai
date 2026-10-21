"use client";

import { setUiLang } from "@/lib/i18n";
import { langHref, type PublicLang } from "@/lib/public-i18n";

/**
 * English / हिन्दी on the pages that render on the server.
 *
 * It is links, not a `<select>` driven by a script, for the same reason the
 * search box on `/careers` is a `GET` form: this component sits inside
 * server-rendered HTML whose promise is that the answer arrives before
 * JavaScript does. With scripting off, हिन्दी still loads `/careers?lang=hi`, and
 * the server renders that page in Hindi. Nothing below is required for the
 * choice to work — the handler only *persists* it.
 *
 * What the click adds is the two stores the rest of the site reads:
 * `localStorage` for the app screens and the `careerguide.ui-lang` cookie for
 * the other public pages, so a Hindi reader who follows a link to `/blog` lands
 * in Hindi instead of being silently switched back to English.
 */

const OPTIONS: PublicLang[] = ["en", "hi"];

const LABEL: Record<PublicLang, string> = { en: "English", hi: "हिन्दी" };

/**
 * Remember the choice in every place the rest of the site looks.
 *
 * `setUiLang` is the app's own store — localStorage, the `lang` attribute on
 * `<html>` that a screen reader needs, and a notification to whatever client
 * screen is mounted. The cookie is the part the app does not have: it is how the
 * *next* server-rendered public page knows what to render, and it is why
 * following a link from a Hindi `/careers` lands on a Hindi `/blog`.
 *
 * A module-level function, not one inside the component, because that is what
 * `i18n.ts` does for the same job and React's lint rules are right that
 * touching the document from a render tree is the wrong shape.
 */
function persistChoice(code: PublicLang) {
  setUiLang(code);
  try {
    // First-party, same-site, and nothing but this choice is in it.
    document.cookie = `careerguide.ui-lang=${code}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* a browser that refuses cookies still gets the ?lang= in the link */
  }
}

export function LangToggle({
  lang,
  path,
  label,
  keepQuery,
}: {
  /** The language this page was rendered in, not what the browser prefers. */
  lang: PublicLang;
  /** This page's own path, so switching language reloads the same page. */
  path: string;
  /** Already-translated `aria-label`, because this file must stay free of the
   * server's cookie-reading module. */
  label: string;
  keepQuery?: Record<string, string | undefined>;
}) {
  return (
    <span
      role="group"
      aria-label={label}
      className="flex items-center gap-1 rounded-full border border-line bg-surface p-0.5 text-xs"
    >
      {OPTIONS.map((code) => {
        const active = code === lang;
        return (
          <a
            key={code}
            href={langHref(path, code, keepQuery)}
            aria-current={active ? "true" : undefined}
            onClick={() => persistChoice(code)}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
              active ? "bg-brand-mist text-brand" : "text-muted hover:text-ink"
            }`}
          >
            {LABEL[code]}
          </a>
        );
      })}
    </span>
  );
}
