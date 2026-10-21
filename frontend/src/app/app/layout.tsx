import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/route-guard";
import { NOINDEX } from "@/lib/site";

/**
 * Everything under `/app` is a signed-in surface: its HTML is a loading shell
 * and the real content arrives later with a token from this browser. A search
 * result for it would therefore be a dead page, so it is kept out of the index
 * as well as out of `robots.txt` — a crawler that ignores the second file still
 * sees this tag.
 */
export const metadata: Metadata = { robots: NOINDEX };

export default function AppLayout({ children }: { children: ReactNode }) {
  // Students and parents both need this shell (parents use /app/settings),
  // so the role split is handled by the individual screens and the backend.
  return <RouteGuard access="any">{children}</RouteGuard>;
}
