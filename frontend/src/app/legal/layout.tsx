import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMeta } from "@/lib/site";

/** Metadata for the legal index. A server layout because the page itself is a
 * client component, and a client module cannot export `metadata`. */
export const metadata: Metadata = pageMeta({
  title: "Legal pages | CareerGuide",
  absoluteTitle: true,
  path: "/legal",
  description:
    "Privacy, terms, refunds, disclaimer and contact — written for the app that actually exists, with the operator's contact details in one place and no compliance claim anywhere.",
});

export default function LegalIndexLayout({ children }: { children: ReactNode }) {
  return children;
}
