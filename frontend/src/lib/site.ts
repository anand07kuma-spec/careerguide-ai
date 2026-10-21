import type { Metadata } from "next";

/**
 * One place that knows what this site is called, where it lives, and which pages
 * are public.
 *
 * Three things had to stop being written per-page:
 *
 * * **The origin.** A canonical of `/pricing` is a relative URL a crawler has to
 *   resolve itself, and an OpenGraph image of `/opengraph-image` is a URL that
 *   Twitter's card validator cannot fetch at all — it needs a scheme and a host.
 *   Both come from `siteOrigin()` here, so a deployment that forgets to set
 *   `NEXT_PUBLIC_SITE_URL` produces absolute URLs pointing at one known default
 *   rather than a mix of half-resolved ones.
 * * **The list of public pages.** `app/sitemap.ts` and `app/robots.ts` disagree
 *   most often when the second one is written by hand, so the sitemap is built
 *   from `PUBLIC_PAGES` and nothing else decides what is indexable.
 * * **Whether a screen is for a child or about the project.** Everything under
 *   `/app`, plus the entry and account screens, is a session shell with nothing
 *   in its HTML — those get `NOINDEX` so a search result can never promise a
 *   stranger "the career guide for your child" and deliver an empty page.
 */

export const SITE_NAME = "CareerGuide AI";

/**
 * Used when the deployment has not said who it is. The live Vercel frontend is
 * the only origin this project has ever been served from, so an unset variable
 * still produces a canonical that resolves — which is better than the alternative
 * of guessing `localhost` on a public site.
 */
export const DEFAULT_ORIGIN = "https://careerguide-web.vercel.app";

export const DEFAULT_DESCRIPTION =
  "A voice and chat guide for Indian students from class 6 to 12: explore careers, choose a stream, prepare for an entrance exam and involve a parent — in Hindi, English or Hinglish.";

export function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  const value = raw || DEFAULT_ORIGIN;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function absolute(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The backend origin, for a server component that reads the public catalogue.
 *
 * Server-only, so it prefers `BACKEND_INTERNAL_URL`: inside a container the
 * public address is the container itself, and a sitemap built that way silently
 * lists no careers at all. See `apiBase()` in `lib/api.ts` for the same split. */
export function backendBase(): string {
  const value =
    process.env.BACKEND_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:8000";
  return value.trim().replace(/\/+$/, "");
}

/**
 * The hosts a school's or practice's own logo may be loaded from.
 *
 * A portal's branding stores a URL rather than a file — the platform does not want to
 * hold a school's identity, its backups or its deletion requests — so the picture is
 * fetched from wherever the school put it, which is a third-party origin and therefore
 * a `img-src` question. Two sides read this one list: `src/middleware.ts` opens those
 * hosts in the policy, and the screens that would draw the logo refuse to draw it
 * unless the address is on the list. That pairing is the point. A CSP that blocked the
 * host silently would leave an admin staring at a saved logo that never appears, and a
 * component that rendered any URL would produce exactly that blocked request — so the
 * link is tested against the same allowlist the browser will use, and the logo is
 * simply not shown when it fails.
 *
 * Unset means no external logo host is allowed anywhere, which is the state this
 * project ships in: the name and the welcome note carry a portal's identity, and a
 * picture is a nicety nobody has been asked for yet.
 *
 * Entries are bare hostnames, optionally with a leading `*.` for a school that hosts
 * its files on a subdomain (`*.img.school.ac.in`).
 */
export function allowedLogoHosts(): string[] {
  return (process.env.NEXT_PUBLIC_ALLOWED_LOGO_HOSTS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");
}

/**
 * Whether a stored logo address may be drawn here.
 *
 * `https` only, no credentials in the URL (the backend already refuses those, and a
 * link with a password in it is not a logo), and the hostname has to match an entry
 * from the list above. Anything that fails is treated as absent rather than as an
 * error — the name of the portal is still on the screen, and a family does not need to
 * learn that a school's CDN was never allowlisted.
 */
export function logoSrcIsAllowed(url: string | null | undefined): boolean {
  if (!url) return false;
  const hosts = allowedLogoHosts();
  if (hosts.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username !== "" || parsed.password !== "") return false;
  return hosts.some((host) =>
    host.startsWith("*.")
      ? parsed.hostname.endsWith(host.slice(1))
      : parsed.hostname === host,
  );
}

/**
 * Pages a crawler may see. `lastModified` is only filled from something the
 * repository actually knows — a blog post's own date, or a legal page's stated
 * "Last updated" line — because a sitemap full of build dates teaches a
 * search engine nothing and a lie about freshness is worse than no date.
 */
export type PublicPage = {
  path: string;
  lastModified?: Date;
  changeFrequency?: "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

/** The hand-written half of the sitemap. Careers and blog posts are appended by `app/sitemap.ts`. */
export const PUBLIC_PAGES: PublicPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/careers", changeFrequency: "weekly", priority: 0.8 },
  { path: "/study-abroad", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.4 },
  { path: "/privacy", lastModified: new Date("2026-10-18"), changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms", lastModified: new Date("2026-10-18"), changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund", lastModified: new Date("2026-10-18"), changeFrequency: "yearly", priority: 0.3 },
  { path: "/disclaimer", lastModified: new Date("2026-10-18"), changeFrequency: "yearly", priority: 0.3 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
];

/**
 * Paths a crawler is told to stay out of, and the same list as a `noindex` rule.
 *
 * `/app` and `/api` are the obvious ones. `/parent` is here because a parent's
 * dashboard is reached with a share code that lives in their browser, so the URL
 * is meaningless to anyone else and indexing it would only create a dead result.
 * `/onboarding`, `/sign-in`, `/sign-up` and `/account/*` are session shells.
 *
 * `/school` and `/counsellor` join them for the same reason as `/parent`: a portal
 * is only ever painted for a member, so an indexed dashboard is a page that shows
 * a stranger a locked door. `/join` is on the list because a live invitation is a
 * URL with a token in it, and a token in a search result is an invitation that was
 * meant for one address and is now public.
 */
export const DISALLOWED_PATHS = [
  "/app",
  "/api",
  "/admin",
  "/parent",
  "/school",
  "/counsellor",
  "/join",
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/account",
];

export function isPrivateSurface(pathname: string): boolean {
  return DISALLOWED_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const NOINDEX: Metadata["robots"] = { index: false, follow: true };
export const INDEX: Metadata["robots"] = { index: true, follow: true };

type PageMetaOptions = {
  /** Shown in search results. Pass `absoluteTitle` for a page that must not get the site suffix. */
  title: string;
  description: string;
  /** Canonical path, e.g. `/pricing`. No host — `absolute()` adds it where needed. */
  path: string;
  absoluteTitle?: boolean;
  type?: "website" | "article";
  robots?: Metadata["robots"];
  /** Only meaningful with `type: "article"`. */
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  keywords?: string[];
};

/**
 * The metadata every public page should carry, built once.
 *
 * The image is deliberately absent: `app/opengraph-image.tsx` is the app-level
 * metadata image, so a page that sets nothing still gets a real 1200×630 card,
 * and `twitter.image` falls back to `openGraph.images` for the same reason. A
 * page that wants its own picture sets it after calling this.
 */
export function pageMeta(o: PageMetaOptions): Metadata {
  const url = absolute(o.path);
  return {
    title: o.absoluteTitle ? { absolute: o.title } : o.title,
    description: o.description,
    keywords: o.keywords,
    robots: o.robots ?? INDEX,
    alternates: { canonical: o.path },
    openGraph: {
      type: o.type ?? "website",
      url,
      siteName: SITE_NAME,
      title: o.title,
      description: o.description,
      locale: "en_IN",
      ...(o.type === "article"
        ? {
            publishedTime: o.publishedTime,
            modifiedTime: o.modifiedTime ?? o.publishedTime,
            authors: o.author ? [o.author] : undefined,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: o.title,
      description: o.description,
    },
  };
}
