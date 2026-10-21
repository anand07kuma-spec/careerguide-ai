import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";

import {
  PublicLangNotice,
  PublicSiteHeader,
} from "@/components/careers/public-careers-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { freshness, getPost, readingMinutes } from "@/lib/blog";
import { publicLang } from "@/lib/request-lang";
import { makeT, makeTf, type PublicLang } from "@/lib/public-i18n";
import { SITE_NAME, absolute, pageMeta, siteOrigin } from "@/lib/site";

/**
 * One guide: `/blog/<slug>`.
 *
 * Rendered on the server from a markdown file with `next-mdx-remote`, which
 * means the prose is the whole page — there is no component syntax in these
 * documents and no script in the HTML that came from them. The element map below
 * is the only styling the article body gets, and every tag a writer can produce
 * from markdown is listed in it, so nothing renders unstyled.
 *
 * `generateMetadata` reads the same file, so a post's title, description and
 * dates cannot drift away from its OpenGraph card the way a hand-written second
 * copy always eventually does.
 *
 * In Hindi this page translates its own frame — breadcrumb, byline, the
 * "not a verified source" card and the buttons around it. The article body is
 * the English markdown file, because a guide is a document rather than a label,
 * and half-translating one would produce two versions that drift apart every
 * time the prose is edited. The notice at the top says exactly that.
 */

type Params = Promise<{ slug: string }>;
type PageQuery = Promise<{ lang?: string }>;

const dateFmt: Record<PublicLang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
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

/**
 * Internal links are typed as plain paths in the markdown, so the router can
 * handle them; an external link gets `nofollow` because this project takes no
 * money for a listing and does not want to imply that it endorses whatever a
 * writer pasted.
 */
function ProseLink({
  href,
  children,
}: {
  href: string;
  children?: ReactNode;
}) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
      className="font-medium text-brand underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

const MDX_COMPONENTS = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-10 text-xl font-bold tracking-tight text-heading sm:text-2xl">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-7 text-base font-semibold text-heading sm:text-lg">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mt-4 text-base leading-relaxed text-ink">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink marker:text-brand">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-relaxed text-ink marker:text-brand marker:font-semibold">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  a: ProseLink,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-heading">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => <em>{children}</em>,
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="mt-5 border-l-2 border-brand bg-brand-mist/40 pl-4 text-base leading-relaxed text-ink">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="mt-10 border-line" />,
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-sm">{children}</code>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="mt-4 overflow-x-auto rounded-card bg-canvas p-4 font-mono text-sm leading-relaxed text-ink">
      {children}
    </pre>
  ),
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const post = await getPost(slug);

  if (!post) {
    return pageMeta({
      title: "Guide not found | CareerGuide",
      absoluteTitle: true,
      path: `/blog/${slug}`,
      description: "This guide is not published on this deployment. Browse the guides that are.",
      robots: { index: false, follow: true },
    });
  }

  return pageMeta({
    title: post.title,
    absoluteTitle: true,
    path: `/blog/${post.slug}`,
    description: post.description,
    type: "article",
    publishedTime: post.date,
    modifiedTime: freshness(post),
    author: post.author ?? SITE_NAME,
    keywords: post.tags,
  });
}

/** The post is read from disk at request time, so this route answers once with
 * the prose in the HTML rather than prerendering a shell around it. */
export const instant = false;

export default async function BlogPostPage({
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
  const qs = lang === "hi" ? "?lang=hi" : "";
  const post = await getPost(slug);
  if (!post) notFound();

  const url = absolute(`/blog/${post.slug}`);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#article`,
      headline: post.title,
      description: post.description,
      url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      inLanguage: "en",
      datePublished: post.date,
      dateModified: freshness(post),
      keywords: post.tags.join(", "),
      // The project publishes these, not a named person. There is no counsellor
      // on staff to credit, and inventing an author is how a document like this
      // starts carrying authority it does not have.
      author: { "@type": "Organization", name: post.author ?? SITE_NAME, url: siteOrigin() },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: siteOrigin(),
        logo: { "@type": "ImageObject", url: absolute("/icon-512.png") },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteOrigin() },
        { "@type": "ListItem", position: 2, name: "Guides", item: absolute("/blog") },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/blog" lang={lang} path={`/blog/${post.slug}`} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label={t("Breadcrumb")} className="text-sm text-muted">
          <Link href={`/blog${qs}`} className="hover:text-brand hover:underline">
            {t("Guides")}
          </Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <span className="text-ink">{post.title}</span>
        </nav>

        <h1 className="mt-5 text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
          {post.title}
        </h1>
        <PublicLangNotice lang={lang} what="guide article below" />

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone="neutral">
            {post.updated
              ? tf("Updated {date}", { date: label(post.updated, lang) })
              : tf("Published {date}", { date: label(post.date, lang) })}
          </Badge>
          <span>{tf("about {n} min read", { n: readingMinutes(post) })}</span>
          <span aria-hidden>·</span>
          <span>{tf("Published by {site}", { site: SITE_NAME })}</span>
        </div>

        <p className="mt-5 text-lg leading-relaxed text-ink">{post.description}</p>

        <article className="mt-6">
          <MDXRemote source={post.content} components={MDX_COMPONENTS} />
        </article>

        <Card className="mt-10 p-5">
          <h2 className="text-base font-semibold text-heading">
            {t("This is written guidance, not a verified source")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t(
              "Nothing here was checked by a career counsellor, and no fee, cutoff, seat count or deadline in this project should be trusted from a page like this one. For anything that costs money or decides a seat, open the document published by the body that conducts the exam or runs the course.",
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton size="sm" href="/onboarding">
              {t("Ask the guide")}
            </LinkButton>
            <LinkButton size="sm" variant="outline" href={`/careers${qs}`}>
              {t("Browse career profiles")}
            </LinkButton>
            <LinkButton size="sm" variant="ghost" href="/disclaimer">
              {t("Read the disclaimer")}
            </LinkButton>
          </div>
        </Card>
      </main>

      <JsonLd data={structuredData} />
    </div>
  );
}
