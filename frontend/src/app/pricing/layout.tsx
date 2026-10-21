import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMeta } from "@/lib/site";

/** Metadata for the pricing page. A server layout because the page itself is a
 * client component — it reads the live price list from the API — and a client
 * module cannot export `metadata`. The `FAQPage` structured data is rendered by
 * the page, next to the questions it describes, so the two cannot drift. */
export const metadata: Metadata = pageMeta({
  title: "Plans and pricing | CareerGuide",
  absoluteTitle: true,
  path: "/pricing",
  description:
    "Free, Pro, Pro Yearly and a School Plan. Every career, stream, exam, scholarship and institute stays free on every plan — a paid plan buys conversation, questionnaires, a printed report and a parent's view.",
  keywords: [
    "career guidance subscription price",
    "free career app for students",
    "school plan career guidance",
  ],
});

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children;
}
