import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NOINDEX } from "@/lib/site";

/** The first-run choice screen is a device-local shell with nothing to index, and
 * a search result pointing at it would show a stranger two buttons meant for a
 * student who has not arrived yet. */
export const metadata: Metadata = { robots: NOINDEX };

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return children;
}
