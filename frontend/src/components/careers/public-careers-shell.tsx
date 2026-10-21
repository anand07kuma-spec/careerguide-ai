import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { LangToggle } from "@/components/careers/lang-toggle";
import { ThemeToggle } from "@/components/careers/theme-toggle";
import { LinkButton } from "@/components/ui/button";
import { Wordmark } from "@/components/brand";
import { makeT, makeTf, type PublicLang } from "@/lib/public-i18n";

/**
 * The shared frame for the public career and blog pages.
 *
 * These screens are server-rendered: a crawler and a parent on a slow phone
 * both need the answer in the first HTML, and a client component here could not
 * export `metadata`. That has one consequence this file exists to handle — a
 * server component cannot show a retry button that refetches, because there is
 * nothing on the page to click. So every failure state below says what it
 * checked, what it could not reach, and gives a reload plus a link to the guide
 * itself, rather than pretending the catalogue is empty.
 *
 * An empty catalogue and an unreachable one are different facts. The seeded
 * careers live in the backend's database, so `0 rows` means either "the service
 * is down" or "nobody has seeded it". Both copy lines are written for that
 * ambiguity instead of hiding it.
 *
 * Hindi is resolved per request by `request-lang.ts` and passed down here as
 * `lang`. A page that does not pass it renders English and shows no language
 * control: the study-abroad pages still do that, because translating their
 * directory text is a separate job, and a Hindi navigation bar over an English
 * body would look like a broken app rather than an unfinished one.
 */

const NAV = [
  { href: "/careers", label: "Careers" },
  { href: "/study-abroad", label: "Study abroad" },
  { href: "/blog", label: "Guides" },
  { href: "/pricing", label: "Pricing" },
];

export function PublicSiteHeader({
  current,
  lang = "en",
  path,
  keepQuery,
}: {
  current?: string;
  /** Pass this on a page that has been translated, and the toggle appears. */
  lang?: PublicLang;
  /** The page the toggle should switch language *on*. Defaults to `current`. */
  path?: string;
  keepQuery?: Record<string, string | undefined>;
}): ReactNode {
  const t = makeT(lang);
  return (
    <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Wordmark />
        <nav aria-label={t("Public pages")} className="flex flex-wrap items-center gap-1 text-sm">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                current === item.href
                  ? "bg-brand-mist font-semibold text-brand"
                  : "bg-transparent text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              {t(item.label)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {path ? (
            <LangToggle
              lang={lang}
              path={path}
              label={t("Interface language")}
              keepQuery={keepQuery}
            />
          ) : null}
          <ThemeToggle label={t("Light or dark theme")} />
          <LinkButton size="sm" href="/onboarding">
            {t("Start exploring")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

/**
 * Says out loud which half of a Hindi public page is actually Hindi.
 *
 * The chrome here is translated; the career text comes from the backend
 * catalogue and the guide text comes from markdown on disk, both written in
 * English. Rendering Hindi headings over English paragraphs and staying quiet
 * about it would read as a half-finished translation, so the page names the
 * limit in the language the reader is already reading.
 */
export function PublicLangNotice({
  lang,
  what,
}: {
  lang: PublicLang;
  what: string;
}): ReactNode {
  if (lang !== "hi") return null;
  const t = makeT(lang);
  const tf = makeTf(lang);
  return (
    <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
      {tf(
        "The headings and buttons on this page are in Hindi. The {what} are written in English and are not translated yet.",
        { what: t(what) },
      )}
    </p>
  );
}

/**
 * Shown when the catalogue request failed. `what` names the request so the page
 * never blames the wrong service.
 */
export function CatalogueUnavailable({
  what,
  lang = "en",
}: {
  what: string;
  lang?: PublicLang;
}): ReactNode {
  const t = makeT(lang);
  const tf = makeTf(lang);
  return (
    <div className="rounded-card border border-warning/40 bg-warning-mist p-5">
      <h2 className="text-base font-semibold text-heading">{t("The career list could not be loaded")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink">
        {tf(
          "This page asked the catalogue API for {what} and got no usable answer. The careers themselves are stored in the backend database, so nothing here can be listed until that service is reachable again.",
          { what: t(what) },
        )}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {t(
          "This is not the app saying there are no careers to show — it is the app saying it does not know. Nothing has been filled in from a cached or invented list.",
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton size="sm" href="/careers">
          {t("Try again")}
        </LinkButton>
        <LinkButton variant="outline" size="sm" href="/onboarding">
          {t("Talk to the guide instead")}
        </LinkButton>
      </div>
    </div>
  );
}

/** A career page asked for by a slug that the catalogue does not have. */
export function CareerNotFound({
  slug,
  lang = "en",
}: {
  slug: string;
  lang?: PublicLang;
}): ReactNode {
  const t = makeT(lang);
  const tf = makeTf(lang);
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <h1 className="text-xl font-bold tracking-tight text-heading">
        {t("No career is listed under that name")}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {tf(
          "The career “{slug}” is not in the catalogue this deployment has seeded. It may have been renamed, or the link may have come from a different build.",
          { slug },
        )}
      </p>
      <div className="mt-4">
        <LinkButton size="sm" href="/careers">
          {t("Browse the careers that are listed")}
        </LinkButton>
      </div>
    </div>
  );
}
