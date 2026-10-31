import type { Metadata } from "next";
import { connection } from "next/server";

import {
  PublicLangNotice,
  PublicSiteHeader,
} from "@/components/careers/public-careers-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { freshness, listPosts, readingMinutes } from "@/lib/blog";
import { publicLang } from "@/lib/request-lang";
import { makeT, makeTf, type PublicLang } from "@/lib/public-i18n";
import { SITE_NAME, absolute, pageMeta, siteOrigin } from "@/lib/site";

/**
 * The public guide index: `/blog`.
 *
 * Posts are markdown files in `src/content/blog`, read from disk at request
 * time — no CMS and no database table, because four documents do not need
 * authoring infrastructure. What they do need is the rule the rest of the site
 * follows: show what exists, and if nothing is on disk, say there is nothing
 * rather than rendering a placeholder article.
 *
 * The Hindi render translates this page's own words and the dates, not the
 * guides. The articles are English documents on disk, and saying so at the top
 * of the list is cheaper and clearer than a reader discovering it after clicking
 * through four times.
 */

export const metadata: Metadata = pageMeta({
  title: "Career guides for students and parents | CareerGuide",
  absoluteTitle: true,
  path: "/blog",
  description:
    "Longer written guides: how to choose a stream after class 10, what an interest test can and cannot tell you, how to read an entrance exam notification, and how a parent can stay useful in the decision.",
  keywords: [
    "career guidance articles for students",
    "stream choice after class 10",
    "RIASEC interest test",
    "entrance exam notification",
  ],
});

const dateFmt: Record<PublicLang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
  // hi-IN gives Devanagari month names, so a Hindi reader is not handed
  // "15 January" inside an otherwise Hindi sentence.
  hi: new Intl.DateTimeFormat("hi-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
};

function label(iso: string, lang: PublicLang): string {
  return dateFmt[lang].format(new Date(iso));
}

type PageQuery = Promise<{ lang?: string }>;

/** The post list is read from disk at request time, so this route answers once
 * with the real list rather than prerendering a shell around it. */
export const instant = false;

export default async function BlogIndexPage({ searchParams }: { searchParams: PageQuery }) {
  await connection();
  const lang = await publicLang(await searchParams);
  const t = makeT(lang);
  const tf = makeTf(lang);
  const posts = await listPosts();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${SITE_NAME} guides`,
    url: absolute("/blog"),
    description: metadata.description,
    publisher: { "@type": "Organization", name: SITE_NAME, url: siteOrigin() },
    ...(posts.length > 0
      ? {
          blogPost: posts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            url: absolute(`/blog/${post.slug}`),
            datePublished: post.date,
            dateModified: freshness(post),
          })),
        }
      : {}),
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/blog" lang={lang} path="/blog" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Badge tone="teal" className="mb-5">
          {t("Guides")}
        </Badge>
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
          {t("Things worth reading slowly")}
        </h1>
        <PublicLangNotice lang={lang} what="guide articles" />
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
          {t(
            "The conversation in this app answers a question in a few sentences. These pages are for the questions that need a parent and a student to sit with the same document — how a stream choice works, what an interest test really measures, how to read an exam bulletin.",
          )}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "Written by this project, not by a career counsellor. There is no expert on staff who has reviewed them, and nothing here states a fee, a cutoff, a deadline or a salary — those change every year and belong in an official document.",
          )}
        </p>

        {posts.length === 0 ? (
          <Card className="mt-8 p-5">
            <h2 className="text-base font-semibold text-heading">{t("No guides published yet")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t(
                "This page lists the guide files that exist in this deployment. There are none, so there is nothing to link to — the conversation is still available.",
              )}
            </p>
          </Card>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {posts.map((post) => (
              <Card key={post.slug} className="flex flex-col p-5">
                <p className="text-xs text-muted">
                  {label(freshness(post), lang)} · {tf("about {n} min read", { n: readingMinutes(post) })}
                </p>
                <h2 className="mt-2 text-lg font-bold leading-snug tracking-tight text-heading">
                  <a
                    href={`/blog/${post.slug}${lang === "hi" ? "?lang=hi" : ""}`}
                    className="hover:text-brand hover:underline hover:underline-offset-2"
                  >
                    {post.title}
                  </a>
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{post.description}</p>
                {post.tags.length > 0 ? (
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-heading">
              {t("Have a question these pages do not cover")}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {t(
                "The guide answers in Hindi, English or Hinglish, and does not need a name, a phone number or a school.",
              )}
            </p>
          </div>
          <a
            href="/onboarding"
            className="shrink-0 rounded-card bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            {t("Start exploring")}
          </a>
        </Card>
      </main>

      <JsonLd data={structuredData} />
    </div>
  );
}
