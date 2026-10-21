import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NOINDEX } from "@/lib/site";

/** `/account/enter` and `/account/connect` exchange a code for a session. They
 * are public in the sense that anyone can load them, and private in every other
 * sense — nothing here is a page worth finding in a search result. */
export const metadata: Metadata = { robots: NOINDEX };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
