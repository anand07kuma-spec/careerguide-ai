import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMeta } from "@/lib/site";

/**
 * Metadata for the privacy policy. It lives in a server layout rather than in
 * the page itself because `page.tsx` is a client component: the policy is
 * translated into हिन्दी through the interface-language store, and a client
 * module cannot export `metadata`. This file keeps both — the SEO tags and the
 * language choice.
 *
 * `lastModified` is not in the canonical block below because the sitemap already
 * carries a date for this page; a policy's date belongs in one place, and the
 * page itself prints the "Last updated" line a human should read.
 */
export const metadata: Metadata = pageMeta({
  title: "Privacy Policy | CareerGuide",
  absoluteTitle: true,
  path: "/privacy",
  description:
    "What CareerGuide AI stores about a student, what it never asks for, who outside services see the text of a conversation, and what this prototype does not claim.",
  keywords: ["children privacy", "no account career app", "data deletion", "GDPR for students"],
});

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
