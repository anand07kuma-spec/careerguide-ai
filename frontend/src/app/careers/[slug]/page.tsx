import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { connection } from "next/server";

import {
  CareerNotFound,
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

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
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

  if (!career) {
    return (
      <div className="min-h-dvh bg-canvas">
        <PublicSiteHeader current="/careers" lang={lang} path={`/careers/${slug}`} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <CareerNotFound slug={slug} lang={lang} />
        </main>
      </div>
    );
  }

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
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/careers" lang={lang} path={`/careers/${profile.slug}`} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label={t("Breadcrumb")} className="text-sm text-muted">
          <Link href={`/careers${qs}`} className="hover:text-brand hover:underline">
            {t("Careers")}
          </Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <a href={`/careers?category=${encodeURIComponent(profile.category)}${lang === "hi" ? "&lang=hi" : ""}`} className="hover:text-brand hover:underline">
            {profile.category}
          </a>
          <span aria-hidden className="mx-2">
            /
          </span>
          <span className="text-ink">{t(profile.title)}</span>
        </nav>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge tone="teal">{profile.category}</Badge>
          <Badge tone="neutral">{tf("From class {n}", { n: profile.min_class })}</Badge>
          {profile.needs_verification ? (
            <Badge tone="warning">{t("Figures to verify")}</Badge>
          ) : null}
        </div>

        <h1 className="mt-4 text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
          {t(profile.title)}
        </h1>
        <PublicLangNotice lang={lang} what="career description on this page" />
        <p className="mt-4 text-base leading-relaxed text-ink sm:text-lg">{profile.summary}</p>

        {profile.needs_verification ? (
          <p className="mt-5 rounded-card border border-warning/40 bg-warning-mist p-4 text-sm leading-relaxed text-ink">
            {t(
              "This record was written from general knowledge rather than read off a live official source. Treat the fees, exam names and route steps below as things to confirm with a recognising body or college before a family plans around them.",
            )}
          </p>
        ) : null}

        <Section title={t("What the work involves")} items={profile.typical_activities} />
        <Section title={t("Skills that help")} items={profile.useful_skills} />
        <Section title={t("School subjects behind it")} items={profile.school_subjects} />
        <Section title={t("How people reach it")} items={profile.education_pathways} />
        <Section title={t("What you need to get in")} items={profile.entry_requirements} />
        <Section title={t("Stages along the way")} items={profile.preparation_stages} />

        {profile.typical_day ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
              {t("An ordinary day")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink">{profile.typical_day}</p>
          </section>
        ) : null}

        {profile.costs_and_alternatives ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
              {t("Cost, and cheaper routes")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink">{profile.costs_and_alternatives}</p>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">{t("What people like")}</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
              {profile.benefits.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">{t("What is hard")}</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
              {profile.challenges.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Section title={t("Try it before choosing it")} items={profile.explore_activities} />

        {profile.official_links.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
              {t("Check the official source")}
            </h2>
            <div className="mt-3 space-y-3">
              {profile.official_links.map((link) => (
                <Card key={link.url} className="p-4">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-sm font-semibold text-brand hover:underline"
                  >
                    {link.label}
                  </a>
                  {link.note ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted">{link.note}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">{t("Related careers")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((item) => (
                <a
                  key={item.slug}
                  href={`/careers/${item.slug}${qs}`}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  {t(item.title)}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <Card className="mt-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-heading">
              {tf("Ask {site} about this career", { site: SITE_NAME })}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {t(
                "A conversation can go further than a profile: what to do in this class, in this language, with the subjects actually on your timetable.",
              )}
            </p>
          </div>
          <LinkButton href="/onboarding" className="shrink-0">
            {t("Start exploring")}
          </LinkButton>
        </Card>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          {t(
            "Nothing on this page is a promise about admission, marks, income or jobs. It describes a route people have taken, and it is sample data curated for this project rather than a verified survey.",
          )}
        </p>
      </main>

      <JsonLd data={structuredData} />
    </div>
  );
}
