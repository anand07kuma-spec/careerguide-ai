import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMeta } from "@/lib/site";

/** Metadata for the refund policy. It is a server file because `page.tsx` is a
 * client component and a client module cannot export `metadata`. */
export const metadata: Metadata = pageMeta({
  title: "Refund Policy | CareerGuide",
  absoluteTitle: true,
  path: "/refund",
  description:
    "When a refund is owed here, how it is asked for and how the money comes back — on a build whose checkout exists, has never taken money, and has no refund button in it.",
});

export default function RefundLayout({ children }: { children: ReactNode }) {
  return children;
}
