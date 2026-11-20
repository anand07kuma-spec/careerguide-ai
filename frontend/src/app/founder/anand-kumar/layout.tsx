import type { Metadata } from "next";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import {
  FOUNDER,
  FOUNDER_BIO,
  FOUNDER_PAGE_PATH,
  FOUNDER_PHOTO_HEIGHT,
  FOUNDER_PHOTO_WIDTH,
  founderPerson,
} from "@/lib/founder";
import { absolute, pageMeta, siteOrigin } from "@/lib/site";

/**
 * Metadata and structured data for the founder profile. A server layout because
 * the page itself is a client component, and a client module cannot export
 * `metadata` or read the site origin for absolute URLs.
 *
 * This is the one page that qualifies as a `ProfilePage`: its whole subject is
 * a single person affiliated with the publisher. The About page is an
 * `AboutPage` about the organisation and stays that way, so the two do not
 * compete for the same search intent.
 *
 * `mainEntity` is the same `Person` node the rest of the site publishes — same
 * `@id`, same name, same `worksFor` reference — so a crawler merges it into one
 * entity instead of reading two people with the same name. The telephone number
 * on the visible page is not repeated here, by design.
 */

const PROFILE_TITLE = `${FOUNDER.name} — ${FOUNDER.title}`;
const OG_IMAGE = {
  url: absolute(FOUNDER.photoPath),
  width: FOUNDER_PHOTO_WIDTH,
  height: FOUNDER_PHOTO_HEIGHT,
  alt: FOUNDER.photoAlt,
};

const base = pageMeta({
  title: PROFILE_TITLE,
  path: FOUNDER_PAGE_PATH,
  description: FOUNDER_BIO,
});

export const metadata: Metadata = {
  ...base,
  openGraph: {
    ...(base.openGraph ?? {}),
    type: "profile",
    title: PROFILE_TITLE,
    description: FOUNDER_BIO,
    images: [OG_IMAGE],
  },
  twitter: {
    // A 3:4 portrait is a summary card image, not a 1200×630 banner.
    card: "summary",
    title: PROFILE_TITLE,
    description: FOUNDER_BIO,
    images: [OG_IMAGE],
  },
};

export default function FounderProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          "@id": `${absolute(FOUNDER_PAGE_PATH)}#profilepage`,
          url: absolute(FOUNDER_PAGE_PATH),
          name: `${FOUNDER.name} — ${FOUNDER.title}, ${FOUNDER.organisation}`,
          description: FOUNDER_BIO,
          inLanguage: "en",
          isPartOf: { "@id": `${siteOrigin()}/#website` },
          dateCreated: "2026-11-20",
          dateModified: "2026-11-20",
          mainEntity: founderPerson(),
        }}
      />
    </>
  );
}
