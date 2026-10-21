import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMeta } from "@/lib/site";

/** Metadata for the disclaimer. A server layout because the page itself is a
 * client component, and a client module cannot export `metadata`. */
export const metadata: Metadata = pageMeta({
  title: "Disclaimer | CareerGuide",
  absoluteTitle: true,
  path: "/disclaimer",
  description:
    "What CareerGuide AI does not know and does not promise: machine-generated guidance, sample catalogue data, no guarantees of admission, results, jobs or salary, and no professional relationship.",
});

export default function DisclaimerLayout({ children }: { children: ReactNode }) {
  return children;
}
