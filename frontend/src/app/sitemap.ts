import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { backendBase, PUBLIC_PAGES, siteOrigin } from "@/lib/site";
import { freshness, listPosts } from "@/lib/blog";

/**
 * `/sitemap.xml`.
 *
 * Three sources, in order of how much this repository controls them:
 *
 * 1. `PUBLIC_PAGES` — the hand-written marketing and legal pages.
 * 2. The career catalogue and the study-abroad directory, both read live from the
 *    backend. Seeding lives in Python, so the slugs are not knowable at build time; a
 *    build that baked them in would go stale the moment a career or a destination is
 *    added.
 * 3. The blog, read from `src/content/blog/*.md` on disk.
 *
 * A sitemap is a promise that the listed URL is a real page. So when the
 * backend is unreachable, the careers section is dropped and the rest of the
 * file is still published — an empty or failed sitemap punishes every page for
 * one service being down. This route runs at request time (see `connection()`)
 * for exactly that reason: it can recover on the next crawl without a redeploy.
 */

type CareerRow = { slug?: unknown };

async function careerPaths(): Promise<string[]> {
  let rows: unknown;
  try {
    const res = await fetch(`${backendBase()}/api/careers?limit=400`, {
      // Short, because a crawler is waiting on this response.
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    rows = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row as CareerRow).slug)
    .filter((slug): slug is string => typeof slug === "string" && /^[a-z0-9-]+$/.test(slug))
    .map((slug) => `/careers/${slug}`);
}

/**
 * The study-abroad directory's own pages, read the same way as the careers.
 *
 * Destinations and services both live in the backend database, so neither list is
 * knowable at build time. An unknown country or service slug would be a sitemap entry
 * that renders "not in our directory", which is why the slugs come from the API and
 * not from a hand-typed list that rots the first time one is renamed.
 */
async function studyAbroadPaths(): Promise<string[]> {
  const paths: string[] = [];
  const read = async (endpoint: "countries" | "services", prefix: string) => {
    try {
      const res = await fetch(`${backendBase()}/api/study-abroad/${endpoint}`, {
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      if (!res.ok) return;
      const rows: unknown = await res.json();
      if (!Array.isArray(rows)) return;
      for (const row of rows as { slug?: unknown }[]) {
        if (typeof row.slug === "string" && /^[a-z0-9-]+$/.test(row.slug)) {
          paths.push(`${prefix}${row.slug}`);
        }
      }
    } catch {
      // One section missing from a sitemap is a smaller error than a sitemap that
      // fails to answer at all.
    }
  };
  await read("countries", "/study-abroad/");
  await read("services", "/study-abroad/services/");
  return paths;
}

async function blogEntries(origin: string) {
  // `listPosts` already drops a file with no frontmatter, a `draft: true` file
  // and anything missing a title, description or date — a sitemap must not
  // promise a URL that renders as "post not found".
  const posts = await listPosts();
  return posts.map((post) => ({
    url: `${origin}/blog/${post.slug}`,
    lastModified: new Date(freshness(post)),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Mark this route as request-time work under `cacheComponents`, so a
  // prerender cannot freeze the catalogue list at build time.
  await connection();

  const origin = siteOrigin();
  const [careers, studyAbroad] = await Promise.all([careerPaths(), studyAbroadPaths()]);

  const staticEntries = PUBLIC_PAGES.map((page) => ({
    url: `${origin}${page.path}`,
    lastModified: page.lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const careerEntries = [...careers, ...studyAbroad].map((path) => ({
    url: `${origin}${path}`,
    // No lastModified: neither the career catalogue nor the study-abroad directory
    // carries a modified timestamp, and a date invented from "today" would tell a
    // search engine the page had changed when it had not.
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...careerEntries, ...(await blogEntries(origin))];
}
