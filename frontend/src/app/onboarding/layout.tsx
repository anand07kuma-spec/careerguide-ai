import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NOINDEX } from "@/lib/site";

/** The first-run screen is a device-local shell with no content to index, and a
 * stranger clicking a search result for it would land on a question that is not
 * about them. */
export const metadata: Metadata = { robots: NOINDEX };

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return children;
}
