import type { Metadata } from "next";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { DEFAULT_DESCRIPTION, SITE_NAME, absolute, pageMeta, siteOrigin } from "@/lib/site";

/**
 * Metadata for the About page. A server layout because the page itself is a
 * client component, and a client module cannot export `metadata`.
 *
 * The `AboutPage` structured data lives here too, for the same reason. Its
 * `mainEntity` is the organisation this project actually is: a name, a URL and a
 * description. It carries no `legalName`, no address and no `sameAs` profiles,
 * because the visible page says there is no registered company to name — the
 * schema must not assert what the prose admits it does not know. Its `founder`
 * points at the `Person` block the root layout publishes, so the name in the
 * page and the name in the graph are the same one.
 */
export const metadata: Metadata = pageMeta({
  title: "About",
  path: "/about",
  description:
    "Who builds CareerGuide AI, why the project exists, how a conversation turns into a next step, and what it holds to about privacy and cost.",
});

export default function AboutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: `About ${SITE_NAME}`,
          url: absolute("/about"),
          description: DEFAULT_DESCRIPTION,
          inLanguage: "en",
          mainEntity: {
            "@type": "Organization",
            "@id": `${siteOrigin()}/#organization`,
            name: SITE_NAME,
            url: siteOrigin(),
            description: DEFAULT_DESCRIPTION,
            founder: { "@id": `${siteOrigin()}/#anand-kumar` },
            publishingPrinciples: absolute("/disclaimer"),
          },
        }}
      />
    </>
  );
}
