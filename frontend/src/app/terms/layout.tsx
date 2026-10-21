import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMeta } from "@/lib/site";

/**
 * Metadata lives in a server layout because `page.tsx` is a client component:
 * the terms are translated through the interface-language store, and a client
 * module cannot export `metadata`.
 */
export const metadata: Metadata = pageMeta({
  title: "Terms of Use | CareerGuide",
  absoluteTitle: true,
  path: "/terms",
  description:
    "The terms for a prototype with no password and no advertising: what the guide promises, what it refuses to do, and which clauses — including the ones about money — are honestly marked as missing.",
});

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children;
}
