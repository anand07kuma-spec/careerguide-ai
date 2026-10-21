import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * The blog: markdown files on disk, read at request time.
 *
 * There is no CMS here and no database table, because nothing in the brief
 * asked for one and a blog with four posts does not need authoring tooling.
 * What it does need is a rule the rest of this app already follows: a page
 * shows what is on disk, or it says it has nothing.
 *
 * Frontmatter is parsed by the twenty lines below rather than by a library, for
 * one reason — the only files this reads are the ones in this repository. It
 * handles `key: value`, `key: "quoted value"` and `key: [a, b]`, and nothing
 * else. A post that needs more than that should get a parser, not a hack.
 *
 * Reading happens with `fs`, not `import`, so a post is data and not code: a
 * markdown file cannot execute anything when it is parsed, and it cannot be
 * reached except through `/blog/<slug>`.
 */

export const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  /** ISO date, `YYYY-MM-DD`. Required: a career-advice post with no date is a post that may be wrong and says so less. */
  date: string;
  updated?: string;
  tags: string[];
  /** Left optional on purpose. If nobody signed it, the site's own name is shown rather than a made-up person. */
  author?: string;
  /** The body, with the frontmatter removed — this is what `next-mdx-remote` renders. */
  content: string;
};

const KEY_LINE = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9-]+$/;

function stripQuotes(value: string): string {
  const first = value[0];
  if ((first === '"' || first === "'") && value.endsWith(first)) return value.slice(1, -1);
  return value;
}

function parseValue(value: string): string | string[] | boolean {
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }
  if (value === "true" || value === "false") return value === "true";
  return stripQuotes(value);
}

/** Split a markdown file into its frontmatter fields and its body. */
export function parseFrontmatter(raw: string): {
  metadata: Record<string, string | string[] | boolean>;
  content: string;
  hasBlock: boolean;
} {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(raw);
  if (!match) return { metadata: {}, content: raw, hasBlock: false };

  const metadata: Record<string, string | string[] | boolean> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const pair = KEY_LINE.exec(trimmed);
    if (!pair) continue;
    const [, key, rest] = pair;
    metadata[key] = parseValue(rest.trim());
  }

  return { metadata, content: raw.slice(match[0].length), hasBlock: true };
}

function text(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * True when a frontmatter block carries the four fields a post cannot be shown
 * without. `app/sitemap.ts` uses it so an unfinished draft never appears in a
 * crawler's list of promised URLs.
 */
export function hasFrontmatter(metadata: Record<string, unknown>): boolean {
  return Boolean(text(metadata, "title") && text(metadata, "description") && ISO_DATE.test(text(metadata, "date") ?? ""));
}

/** Turn a file's raw text into a post, or into `null` if it is not publishable. */
export function toPost(slug: string, raw: string): BlogPost | null {
  const { metadata, content } = parseFrontmatter(raw);
  if (!SLUG.test(slug) || metadata.draft === true || !hasFrontmatter(metadata)) return null;

  const date = text(metadata, "date");
  const updated = text(metadata, "updated");
  const tags = metadata.tags;

  return {
    slug,
    title: text(metadata, "title")!,
    description: text(metadata, "description")!,
    date: date!,
    updated: updated && ISO_DATE.test(updated) ? updated : undefined,
    tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [],
    author: text(metadata, "author"),
    content: content.trim(),
  };
}

async function readDir(): Promise<string[]> {
  try {
    return (await fs.readdir(BLOG_DIR)).filter((name) => name.endsWith(".md"));
  } catch {
    // No folder yet means no blog yet, which is a normal state for a checkout
    // that has not pulled content — not an error to show the reader.
    return [];
  }
}

/** Every publishable post, newest first. */
export async function listPosts(): Promise<BlogPost[]> {
  const names = await readDir();
  const posts = await Promise.all(
    names.map(async (name) => {
      const slug = name.replace(/\.md$/, "");
      try {
        const raw = await fs.readFile(path.join(BLOG_DIR, name), "utf8");
        return toPost(slug, raw);
      } catch {
        return null;
      }
    }),
  );

  return posts
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => (a.updated ?? a.date) < (b.updated ?? b.date) ? 1 : -1);
}

/** One post by slug, or `null`. A slug that is not a filename-safe string never touches the disk. */
export async function getPost(slug: string): Promise<BlogPost | null> {
  if (!SLUG.test(slug)) return null;
  try {
    const raw = await fs.readFile(path.join(BLOG_DIR, `${slug}.md`), "utf8");
    return toPost(slug, raw);
  } catch {
    return null;
  }
}

/** The date a reader should judge this advice by. */
export function freshness(post: Pick<BlogPost, "date" | "updated">): string {
  return post.updated ?? post.date;
}

/**
 * A rough reading time, from the prose only.
 *
 * It counts words rather than characters because that is the measure people
 * expect, and it is honest about being rough: the label in the UI says
 * "about N min read", not a promise.
 */
export function readingMinutes(post: Pick<BlogPost, "content">): number {
  const words = post.content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/![[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
