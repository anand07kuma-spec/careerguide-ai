import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/route-guard";
import { NOINDEX } from "@/lib/site";

/**
 * A school's portal is a signed-in surface, and the role inside it is decided by the
 * server: this guard only asks whether the browser holds a session at all, because a
 * student who joined the school has a portal screen too — their own switch, the note the
 * school wrote for members, and nothing else.
 */
export const metadata: Metadata = { robots: NOINDEX, title: "School portal" };

export default function SchoolLayout({ children }: { children: ReactNode }) {
  return <RouteGuard access="any">{children}</RouteGuard>;
}
