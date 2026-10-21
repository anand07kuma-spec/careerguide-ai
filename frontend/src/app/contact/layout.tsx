import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMeta } from "@/lib/site";

/** Metadata for the contact page. A server layout because the page itself is a
 * client component, and a client module cannot export `metadata`. */
export const metadata: Metadata = pageMeta({
  title: "Contact | CareerGuide",
  absoluteTitle: true,
  path: "/contact",
  description:
    "How to reach this project, what happens to a message, and what to do if a child is in danger. The form needs a mail provider configured before it can deliver anything.",
});

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
