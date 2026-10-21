import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import {
  CatalogueUnavailable,
  PublicLangNotice,
  PublicSiteHeader,
} from "@/components/careers/public-careers-shell";
import { Badge } from "@/components/ui/badge";
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
      <div className="min-h-dvh bg-canvas">
        <PublicSiteHeader current="/careers" lang={lang} path="/careers" keepQuery={query} />
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
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
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/careers" lang={lang} path="/careers" keepQuery={query} />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Badge tone="teal" className="mb-5">
          {t("Career profiles")}
        </Badge>
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
          {t("What the work is actually like")}
        </h1>
        <PublicLangNotice lang={lang} what="career descriptions" />
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
          {t(
            "Each profile says what someone in the job does on an ordinary day, which school subjects and class levels lead toward it, what the route costs, and what still has to be checked on an official site before a family plans around it.",
          )}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "These are written to a starter catalogue curated for this project. They are not a survey of the Indian job market, they carry no salary or placement figures, and a profile that needs a fact checked says so on the page.",
          )}
        </p>

        {/* Search + category filters: a GET form and links, so the filtering is
            done by the same code that renders the page. */}
        <form action="/careers" method="get" className="mt-8 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="career-search">
            {t("Search careers")}
          </label>
          <input
            id="career-search"
            name="search"
            type="search"
            defaultValue={search ?? ""}
            maxLength={80}
            placeholder={t("nurse, lawyer, data, pilot")}
            className="w-full max-w-xs rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
          {category ? <input type="hidden" name="category" value={category} /> : null}
          {/* The language rides along in the form, or searching would throw the
              reader back to English mid-visit. */}
          {lang === "hi" ? <input type="hidden" name="lang" value="hi" /> : null}
          <button
            type="submit"
            className="rounded-card bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            {t("Search")}
          </button>
          {search || category ? (
            <Link href="/careers" className="text-sm text-brand underline-offset-2 hover:underline">
              {t("Clear filters")}
            </Link>
          ) : null}
        </form>

        {categories.length > 0 ? (
          <nav aria-label={t("Career categories")} className="mt-4 flex flex-wrap gap-2">
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
                      ? "border-brand bg-brand-mist text-brand"
                      : "border-line bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {item.name}
                  <span className="ml-1.5 text-heading/70">{item.count}</span>
                </a>
              );
            })}
          </nav>
        ) : null}

        {search || category ? (
          <p className="mt-6 text-sm text-muted">
            {matchLine}
            {search ? tf(" for “{q}”", { q: search }) : ""}
            {category ? tf(" in {c}", { c: category }) : ""}.
          </p>
        ) : null}

        {groups.length === 0 ? (
          <Card className="mt-6 p-5">
            <h2 className="text-base font-semibold text-heading">{t("Nothing matched")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t(
                "No profile in this catalogue fits that filter. The list above is what exists here right now — an empty result means the search term is not in it, not that the career does not exist.",
              )}
            </p>
          </Card>
        ) : (
          groups.map(([name, items]) => (
            <section key={name} className="mt-10">
              <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">{name}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {items.map((career) => (
                  <Card key={career.slug} className="flex flex-col p-5">
                    <h3 className="text-base font-semibold text-heading">
                      <a
                        href={`/careers/${career.slug}${lang === "hi" ? "?lang=hi" : ""}`}
                        className="hover:text-brand hover:underline hover:underline-offset-2"
                      >
                        {t(career.title)}
                      </a>
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{career.summary}</p>
                    <p className="mt-3 text-xs text-muted">
                      {career.interest_themes.length > 0 ? (
                        <span className="mr-2">
                          {t("Interests:")}{" "}
                          {career.interest_themes
                            .slice(0, 3)
                            .map((theme) =>
                              // The catalogue stores the snake_case key; the app
                              // screens already have the label map, and using it
                              // here is what stops `helping_others` leaking onto a
                              // public page — and what makes the Hindi label exist.
                              t(THEME_LABELS[theme as ThemeKey] ?? theme),
                            )
                            .join(", ")}
                        </span>
                      ) : null}
                      <span>{tf("Open from class {n}", { n: career.min_class })}</span>
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
