import type { MetadataRoute } from "next";

import { DISALLOWED_PATHS, siteOrigin } from "@/lib/site";

/**
 * `/robots.txt`.
 *
 * The brief asked for "allow all, disallow /app/*, /api/*, /admin/*". The list
 * below is longer, and deliberately so: `DISALLOWED_PATHS` in `lib/site.ts` is
 * the same array `isPrivateSurface()` uses to decide where analytics scripts
 * may not load and where `NOINDEX` applies. One list, three consequences — if
 * they were separate they would drift, and the drift would show up as a
 * crawler being invited into a child's session shell.
 *
 * A robots rule is a request, not a protection. `/api` is closed here because
 * an unauthenticated crawler hitting a JSON endpoint wastes both parties'
 * time; the actual access control is the token check in the backend, which is
 * tested independently of this file.
 *
 * Subpaths are covered by prefix matching, which is why these entries carry no
 * trailing wildcard: `/app` already disallows `/app/billing`.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOWED_PATHS],
      },
    ],
    // Where to find the list of pages this site actually considers public.
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
