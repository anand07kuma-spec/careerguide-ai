import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/route-guard";
import { NOINDEX } from "@/lib/site";

/** A practice's portal, behind the same session check as the school's. Which staff role
 * holds which power inside it is answered by the backend on every request, not here. */
export const metadata: Metadata = { robots: NOINDEX, title: "Counsellor portal" };

export default function CounsellorLayout({ children }: { children: ReactNode }) {
  return <RouteGuard access="any">{children}</RouteGuard>;
}
