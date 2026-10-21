import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NOINDEX } from "@/lib/site";

/** The optional email sign-in screens (`/sign-in`, `/sign-up`), which exist only
 * on a deployment that has connected an account provider. Route group: the
 * folder name is not in the URL. */
export const metadata: Metadata = { robots: NOINDEX };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
