import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, ChevronDown, Search } from "lucide-react";

import {
  CatalogueUnavailable,
  PublicLangNotice,
  PublicSiteHeader,
} from "@/components/careers/public-careers-shell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { publicLang } from "@/lib/request-lang";
import { makeT, makeTf } from "@/lib/public-i18n";
import { pageMeta } from "@/lib/site";
import type { Career, Category } from "@/lib/types";
import { THEME_LABELS, type ThemeKey } from "@/lib/types";

/**
 * The public career index: `/careers`.
 *
 * This page exists because a sitemap cannot point at `/app/careers`, which is
 * behind a device session and disallowed in `robots.txt`. A parent searching for
 * "what does an oceanographer do" needs an HTML answer they can read without
 * becoming a user of the app, so this is the same catalogue the student sees,
 * rendered on the server with no sign-in and no JavaScript.
 *
 * Search and category filters are plain `GET` form fields and links rather than
 * client state. A server component cannot refetch on click, so a button that
 * filtered locally would be a dead control; a form that reloads the page is the
 * honest version and works with scripting turned off. The language toggle works
 * the same way — it is a link carrying `?lang=hi`, resolved on the server.
 *
 * What the catalogue is, is stated on the page. These records are seeded sample
 * data curated into this repository, not a verified survey of the Indian
 * labour market, and no salary or placement figure is shown because none is
 * stored.
 *
 * The `<title>` and description stay English, including on the Hindi render.
 * Translating them would mean reading the cookie inside `generateMetadata`, and
 * a Hindi page whose OpenGraph card is English is a smaller wrong than a shared
 * crawler hitting the same page under two different titles.
 */

export const metadata: Metadata = pageMeta({
  title: "Career profiles | CareerGuide",
  absoluteTitle: true,
  path: "/careers",
  description:
    "Plain-language profiles of careers an Indian student can aim at: what the work is, which subjects and class levels lead to it, what the route costs, and what still has to be checked on an official site.",
  keywords: [
    "career profiles for students",
    "careers after class 12 India",
    "what does the job involve",
    "career options India",
  ],
});

type PageQuery = Promise<{ search?: string; category?: string; lang?: string }>;

/** The catalogue comes from the backend at request time, and the search and
 * category filters arrive as query params, so this route blocks and renders the
 * real list into the HTML — a crawler has to see the careers it is being sent. */
export const instant = false;

export default async function CareersPage({ searchParams }: { searchParams: PageQuery }) {
  // The list is read from the running backend at request time, so this route is
  // never prerendered with somebody else's catalogue snapshot in it.
  await connection();
  const query = await searchParams;
  const lang = await publicLang(query);
  const { search, category } = query;
  const t = makeT(lang);
  const tf = makeTf(lang);
  const langSuffix = lang === "hi" ? "lang=hi" : "";
  const allHref = `/careers${langSuffix ? `?${langSuffix}` : ""}`;

  let careers: Career[] = [];
  let categories: Category[] = [];
  try {
    [careers, categories] = await Promise.all([
      api.careers({ search, category }),
      api.categories(),
    ]);
  } catch (error) {
    // A 4xx here is a bug in this page's own query, not an outage — say which,
    // because "could not be loaded" would send an operator to the wrong service.
    const reason =
      error instanceof ApiError && error.status >= 400 && error.status < 500
        ? tf("The catalogue replied {status} to this filter.", { status: error.status })
        : t("The catalogue service could not be reached.");
    return (
      <div lang={lang === "hi" ? "hi-IN" : "en-IN"} className="min-h-dvh bg-canvas">
        <PublicSiteHeader current="/careers" lang={lang} path="/careers" keepQuery={query} />
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-reading px-4 py-10 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">{t("Careers")}</h1>
          <div className="mt-6">
            <CatalogueUnavailable what={t("the list of career profiles")} lang={lang} />
          </div>
          <p className="mt-3 text-sm text-muted">{reason}</p>
        </main>
      </div>
    );
  }

  const grouped = new Map<string, Career[]>();
  for (const career of careers) {
    const bucket = grouped.get(career.category);
    if (bucket) bucket.push(career);
    else grouped.set(career.category, [career]);
  }
  const groups = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const matchLine =
    careers.length === 1
      ? tf("{n} career matches", { n: careers.length })
      : tf("{n} careers match", { n: careers.length });

  return (
    <div lang={lang === "hi" ? "hi-IN" : "en-IN"} className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/careers" lang={lang} path="/careers" keepQuery={query} />

      <main id="main-content" tabIndex={-1}>
        {/* Catalogue header — light, so the reading text keeps its contrast in
            both themes; the search panel below overlaps its edge. */}
        <section className="relative overflow-hidden border-b border-line bg-surface">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand-mist/80 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full bg-teal-mist/60 blur-3xl"
          />

          <div className="relative mx-auto max-w-page px-4 pb-24 pt-12 sm:px-6 lg:pb-28 lg:pt-16">
            <div className="max-w-3xl">
              <Badge tone="teal">{t("Career profiles")}</Badge>
              <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-heading sm:text-5xl">
                {t("What the work is actually like")}
              </h1>
              <PublicLangNotice lang={lang} what="career descriptions" />
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
                {t(
                  "Each profile says what someone in the job does on an ordinary day, which school subjects and class levels lead toward it, what the route costs, and what still has to be checked on an official site before a family plans around it.",
                )}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {t(
                  "These are written to a starter catalogue curated for this project. They are not a survey of the Indian job market, they carry no salary or placement figures, and a profile that needs a fact checked says so on the page.",
                )}
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-page px-4 sm:px-6">
          {/* Search + category filters: a GET form and links, so the filtering is
              done by the same code that renders the page. */}
          <div className="relative -mt-16 rounded-card border border-line bg-surface p-4 shadow-lift sm:p-5">
            <form action="/careers" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="career-search"
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-muted"
                >
                  {t("Search careers")}
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-control border border-line bg-canvas px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
                  <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <input
                    id="career-search"
                    name="search"
                    type="search"
                    defaultValue={search ?? ""}
                    maxLength={80}
                    placeholder={t("nurse, lawyer, data, pilot")}
                    className="min-h-11 w-full bg-transparent py-2 text-sm text-ink outline-none placeholder:text-muted"
                  />
                </div>
              </div>
              {category ? <input type="hidden" name="category" value={category} /> : null}
              {/* The language rides along in the form, or searching would throw the
                  reader back to English mid-visit. */}
              {lang === "hi" ? <input type="hidden" name="lang" value="hi" /> : null}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-solid px-6 text-sm font-semibold text-on-brand shadow-[0_10px_24px_-12px_rgb(37_99_235/0.75)] transition-colors hover:bg-brand-dark"
                >
                  {t("Search")}
                </button>
                {search || category ? (
                  <Link
                    href={allHref}
                    className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-brand underline-offset-4 hover:underline"
                  >
                    {t("Clear filters")}
                  </Link>
                ) : null}
              </div>
            </form>

            {categories.length > 0 ? (
              <nav
                aria-label={t("Career categories")}
                className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"
              >
                <span className="mr-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {t("Career categories")}
                </span>
                <a
                  href={allHref}
                  aria-current={!category ? "page" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    !category
                      ? "border-brand bg-brand-mist text-brand-dark"
                      : "border-line bg-canvas text-muted hover:border-brand/40 hover:text-ink"
                  }`}
                >
                  {t("All")}
                </a>
                {categories.map((item) => {
                  const active = category === item.name;
                  const suffix = `${item.name ? `category=${encodeURIComponent(item.name)}` : ""}${
                    lang === "hi" ? `${item.name ? "&" : ""}lang=hi` : ""
                  }`;
                  return (
                    <a
                      key={item.name}
                      href={`/careers${suffix ? `?${suffix}` : ""}`}
                      aria-current={active ? "page" : undefined}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-brand bg-brand-mist text-brand-dark"
                          : "border-line bg-canvas text-muted hover:border-brand/40 hover:text-ink"
                      }`}
                    >
                      {item.name}
                      <span className="ml-1.5 tabular-nums opacity-70">{item.count}</span>
                    </a>
                  );
                })}
              </nav>
            ) : null}
          </div>

          <div className="pb-16 pt-8 sm:pt-10">
            {search || category ? (
              <p className="text-sm text-muted">
                {matchLine}
                {search ? tf(" for “{q}”", { q: search }) : ""}
                {category ? tf(" in {c}", { c: category }) : ""}.
              </p>
            ) : (
              <p className="text-sm text-muted">
                {tf("{n} profiles, grouped by the field they belong to.", { n: careers.length })}
              </p>
            )}

            {groups.length === 0 ? (
              <Card className="mt-6 flex flex-col items-center px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark">
                  <Search className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-heading">{t("Nothing matched")}</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                  {t(
                    "No profile in this catalogue fits that filter. The list above is what exists here right now — an empty result means the search term is not in it, not that the career does not exist.",
                  )}
                </p>
                <LinkButton size="sm" href={allHref} className="mt-5">
                  {t("Clear filters")}
                </LinkButton>
              </Card>
            ) : (
              groups.map(([name, items], groupIndex) => (
                <section key={name} className="mt-8 first:mt-5">
                  {/* A native disclosure keeps every profile in the HTML for crawlers
                      and no-JS readers, while the phone sees a short directory instead
                      of a 20,000px wall. The first group starts open. */}
                  <details open={groupIndex === 0} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-full border border-line bg-surface px-4 py-3 transition-colors hover:border-brand/40 sm:px-5 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-3">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                        <h2 className="truncate text-base font-bold tracking-tight text-heading sm:text-lg">
                          {name}
                        </h2>
                        <span className="shrink-0 rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">
                          {items.length}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted">
                        <span className="hidden sm:inline">{tf("{n} profiles", { n: items.length })}</span>
                        <ChevronDown
                          className="h-4 w-4 transition-transform group-open:rotate-180"
                          aria-hidden
                        />
                      </span>
                    </summary>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((career) => (
                        <a
                          key={career.slug}
                          href={`/careers/${career.slug}${lang === "hi" ? "?lang=hi" : ""}`}
                          className="cg-card cg-lift group/card flex flex-col p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span
                              aria-hidden
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-base font-bold text-brand-dark"
                            >
                              {career.title.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-muted">
                              {tf("From class {n}", { n: career.min_class })}
                            </span>
                          </div>

                          <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-heading transition-colors group-hover/card:text-brand">
                            {t(career.title)}
                          </h3>
                          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{career.summary}</p>

                          {career.interest_themes.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {career.interest_themes.slice(0, 3).map((theme) => (
                                <span
                                  key={theme}
                                  className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-medium text-muted"
                                >
                                  {/* The catalogue stores the snake_case key; the app
                                      screens already have the label map, and using it
                                      here is what stops `helping_others` leaking onto a
                                      public page — and what makes the Hindi label exist. */}
                                  {t(THEME_LABELS[theme as ThemeKey] ?? theme)}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <span className="mt-4 inline-flex items-center gap-1.5 border-t border-line pt-3 text-sm font-semibold text-brand">
                            {t("Read the profile")}
                            <ArrowRight
                              className="h-4 w-4 transition-transform group-hover/card:translate-x-0.5"
                              aria-hidden
                            />
                          </span>
                        </a>
                      ))}
                    </div>
                  </details>
                </section>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
