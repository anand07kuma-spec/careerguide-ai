import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Compass,
  ExternalLink,
  Footprints,
  Lightbulb,
  ListChecks,
  Route,
  Sun,
  ThumbsUp,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  PublicLangNotice,
  PublicSiteHeader,
} from "@/components/careers/public-careers-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { publicLang } from "@/lib/request-lang";
import { makeT, makeTf } from "@/lib/public-i18n";
import { SITE_NAME, absolute, pageMeta, siteOrigin } from "@/lib/site";
import type { Career } from "@/lib/types";

/**
 * One public career profile: `/careers/<slug>`.
 *
 * Server-rendered for the same reason as the index — this is the page a parent
 * or a search engine arrives at, and it has to be readable before any script
 * runs. The data is the backend's own record, field by field, with nothing
 * added: no salary, no placement rate, no "average package", because this
 * catalogue does not store any of those and inventing one for a schema block
 * would be the fastest way to make this page a lie twice over (once to the
 * reader, once to Google).
 *
 * Hindi covers the page's own words: breadcrumb, headings, badges, the
 * verification notice and the calls to action. The career text itself — summary,
 * activities, pathways, the official-link notes — is the catalogue's English
 * record, and the page says so in Hindi rather than leaving the reader to wonder
 * whether the translation broke halfway down.
 *
 * `needs_verification` is the catalogue's own flag, set when a record contains a
 * figure that was written down rather than looked up in a live official source.
 * It is shown as a badge on the page, because a profile that quietly omits its
 * own uncertainty is the kind of page a family then plans on.
 */

type Params = Promise<{ slug: string }>;
type PageQuery = Promise<{ lang?: string }>;

const loadCareer = cache(async (slug: string): Promise<Career | null> => {
  try {
    return await api.career(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

const loadTitles = cache(async (): Promise<Map<string, string>> => {
  try {
    const rows = await api.careers();
    return new Map(rows.map((row) => [row.slug, row.title]));
  } catch {
    // Related links are decoration; a catalogue outage must not hide the profile.
    return new Map();
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  let career: Career | null = null;
  try {
    career = await loadCareer(slug);
  } catch {
    career = null;
  }
  if (!career) {
    return pageMeta({
      title: "Career profile | CareerGuide",
      absoluteTitle: true,
      path: `/careers/${slug}`,
      description:
        "This career is not in the catalogue on this deployment. Browse the profiles that are.",
      robots: { index: false, follow: true },
    });
  }

  return pageMeta({
    title: `${career.title} — what the work is, and how to reach it`,
    description: career.summary,
    path: `/careers/${career.slug}`,
    keywords: [career.title.toLowerCase(), career.category, "career profile India"],
  });
}

function Section({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="cg-card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">{title}</h2>
      </div>
      <ul
        className={`mt-4 grid gap-x-8 gap-y-2.5 text-sm leading-relaxed text-ink ${
          items.length > 4 ? "sm:grid-cols-2" : ""
        }`}
      >
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One catalogue row, fetched at request time from a slug that is a runtime
 * value — so this route renders the profile itself instead of a shell. */
export const instant = false;

export default async function CareerProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: PageQuery;
}) {
  const { slug } = await params;
  await connection();
  const lang = await publicLang(await searchParams);
  const t = makeT(lang);
  const tf = makeTf(lang);

  let career: Career | null;
  try {
    career = await loadCareer(slug);
  } catch {
    career = null;
  }

  // A missing slug is a missing page. The friendly screen lives in this
  // segment's `not-found.tsx`, and Next answers it with a real 404 status
  // instead of the 200 a rendered "not found" card used to return.
  if (!career) notFound();

  const profile = career;
  const titles = await loadTitles();
  const related = profile.related_slugs.slice(0, 6).map((item) => ({
    slug: item,
    title: titles.get(item) ?? item,
  }));
  const url = absolute(`/careers/${profile.slug}`);
  // Every internal link from a Hindi page carries the language, because there
  // is no client store on this route to remember it.
  const qs = lang === "hi" ? "?lang=hi" : "";
  const categoryHref = `/careers?category=${encodeURIComponent(profile.category)}${
    lang === "hi" ? "&lang=hi" : ""
  }`;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "EducationalOccupationalProgram",
      "@id": `${url}#program`,
      name: profile.title,
      description: profile.summary,
      url,
      inLanguage: "en",
      educationalLevel: `From class ${profile.min_class}`,
      occupationalCategory: profile.category,
      ...(profile.entry_requirements.length > 0
        ? {
            prerequisites: {
              "@type": "ListItem",
              itemList: profile.entry_requirements.map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: item,
              })),
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteOrigin() },
        { "@type": "ListItem", position: 2, name: "Careers", item: absolute("/careers") },
        { "@type": "ListItem", position: 3, name: profile.title, item: url },
      ],
    },
  ];

  return (
    <div lang={lang === "hi" ? "hi-IN" : "en-IN"} className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/careers" lang={lang} path={`/careers/${profile.slug}`} />

      <main id="main-content" tabIndex={-1}>
        {/* Profile header — the answer first, then the sections that support it. */}
        <section className="relative overflow-hidden border-b border-line bg-surface">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand-mist/80 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-28 top-32 h-72 w-72 rounded-full bg-teal-mist/50 blur-3xl"
          />

          <div className="relative mx-auto max-w-page px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10">
            <nav aria-label={t("Breadcrumb")} className="text-sm text-muted">
              <Link href={`/careers${qs}`} className="hover:text-brand hover:underline">
                {t("Careers")}
              </Link>
              <span aria-hidden className="mx-2">
                /
              </span>
              <a href={categoryHref} className="hover:text-brand hover:underline">
                {profile.category}
              </a>
              <span aria-hidden className="mx-2">
                /
              </span>
              <span className="text-ink">{t(profile.title)}</span>
            </nav>

            <div className="mt-6 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="teal">{profile.category}</Badge>
                <Badge tone="neutral">{tf("From class {n}", { n: profile.min_class })}</Badge>
                {profile.needs_verification ? (
                  <Badge tone="warning">{t("Figures to verify")}</Badge>
                ) : null}
              </div>

              <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-heading sm:text-5xl">
                {t(profile.title)}
              </h1>
              <PublicLangNotice lang={lang} what="career description on this page" />
              <p className="mt-5 text-base leading-relaxed text-ink sm:text-lg">{profile.summary}</p>

              {profile.needs_verification ? (
                <div className="mt-5 flex gap-3 rounded-card border border-warning/40 bg-warning-mist p-4">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                  <p className="text-sm leading-relaxed text-ink">
                    {t(
                      "This record was written from general knowledge rather than read off a live official source. Treat the fees, exam names and route steps below as things to confirm with a recognising body or college before a family plans around them.",
                    )}
                  </p>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-2">
                <LinkButton href="/onboarding">
                  {t("Start exploring")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </LinkButton>
                <a
                  href={categoryHref}
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
                >
                  {tf("Browse {category}", { category: profile.category })}
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-page px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-12">
            <div className="min-w-0 space-y-4">
              <Section
                icon={ListChecks}
                title={t("What the work involves")}
                items={profile.typical_activities}
              />
              <Section icon={Lightbulb} title={t("Skills that help")} items={profile.useful_skills} />
              <Section
                icon={BookOpen}
                title={t("School subjects behind it")}
                items={profile.school_subjects}
              />
              <Section
                icon={Route}
                title={t("How people reach it")}
                items={profile.education_pathways}
              />
              <Section
                icon={ClipboardCheck}
                title={t("What you need to get in")}
                items={profile.entry_requirements}
              />
              <Section
                icon={Footprints}
                title={t("Stages along the way")}
                items={profile.preparation_stages}
              />

              {profile.typical_day ? (
                <section className="cg-card p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-mist text-warning">
                      <Sun className="h-4 w-4" aria-hidden />
                    </span>
                    <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
                      {t("An ordinary day")}
                    </h2>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-ink">{profile.typical_day}</p>
                </section>
              ) : null}

              {profile.costs_and_alternatives ? (
                <section className="cg-card p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-mist text-teal">
                      <Wallet className="h-4 w-4" aria-hidden />
                    </span>
                    <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
                      {t("Cost, and cheaper routes")}
                    </h2>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-ink">{profile.costs_and_alternatives}</p>
                </section>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="cg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-mist text-success">
                      <ThumbsUp className="h-4 w-4" aria-hidden />
                    </span>
                    <h2 className="text-lg font-bold tracking-tight text-heading">
                      {t("What people like")}
                    </h2>
                  </div>
                  <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink">
                    {profile.benefits.map((item) => (
                      <li key={item} className="flex gap-2.5">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="cg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-mist text-warning">
                      <TriangleAlert className="h-4 w-4" aria-hidden />
                    </span>
                    <h2 className="text-lg font-bold tracking-tight text-heading">{t("What is hard")}</h2>
                  </div>
                  <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink">
                    {profile.challenges.map((item) => (
                      <li key={item} className="flex gap-2.5">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <Section
                icon={Compass}
                title={t("Try it before choosing it")}
                items={profile.explore_activities}
              />

              <p className="text-xs leading-relaxed text-muted">
                {t(
                  "Nothing on this page is a promise about admission, marks, income or jobs. It describes a route people have taken, and it is sample data curated for this project rather than a verified survey.",
                )}
              </p>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
              {profile.official_links.length > 0 ? (
                <Card className="p-5">
                  <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                    {t("Check the official source")}
                  </h2>
                  <ul className="mt-4 space-y-2.5">
                    {profile.official_links.map((link) => (
                      <li key={link.url} className="rounded-control border border-line bg-canvas p-3">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="flex items-start gap-2 text-sm font-semibold text-brand hover:underline"
                        >
                          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>{link.label}</span>
                        </a>
                        {link.note ? (
                          <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted">{link.note}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {related.length > 0 ? (
                <Card className="p-5">
                  <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                    {t("Related careers")}
                  </h2>
                  <ul className="mt-3 space-y-0.5">
                    {related.map((item) => (
                      <li key={item.slug}>
                        <a
                          href={`/careers/${item.slug}${qs}`}
                          className="group flex items-center justify-between gap-2 rounded-control px-2.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas hover:text-brand"
                        >
                          <span>{t(item.title)}</span>
                          <ArrowRight
                            className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                            aria-hidden
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <div className="relative overflow-hidden rounded-card bg-navy p-6 text-white shadow-lift">
                <div aria-hidden className="pointer-events-none absolute inset-0 cg-aurora opacity-70" />
                <div className="relative">
                  <h2 className="text-base font-semibold">
                    {tf("Ask {site} about this career", { site: SITE_NAME })}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    {t(
                      "A conversation can go further than a profile: what to do in this class, in this language, with the subjects actually on your timetable.",
                    )}
                  </p>
                  <LinkButton href="/onboarding" className="mt-4 w-full">
                    {t("Start exploring")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </LinkButton>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <JsonLd data={structuredData} />
    </div>
  );
}
