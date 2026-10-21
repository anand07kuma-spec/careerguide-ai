import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/route-guard";
import { NOINDEX } from "@/lib/site";

/** A parent reaches this with a share code held in their own browser, so the
 * URL means nothing to anyone else and an index entry for it would be a dead
 * result for a stranger. */
export const metadata: Metadata = { robots: NOINDEX };

export default function ParentLayout({ children }: { children: ReactNode }) {
  return <RouteGuard access="parent">{children}</RouteGuard>;
}
