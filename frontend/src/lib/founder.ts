import { absolute, siteOrigin } from "./site";

/**
 * The one person who builds and runs CareerGuide AI.
 *
 * The homepage, the About page, the founder profile and the `Person`
 * structured data all read this module, so a name or a title cannot drift
 * between what a visitor reads and what a crawler is told. `title` is the
 * public role; it does not imply a registered company, and every page that
 * prints it says so in the same breath.
 *
 * `photoFile` is a path under `public/` and `photoPath` is what an `<img>`
 * points at. The homepage still checks that the file resolves before printing
 * it — a broken image is a worse claim than no image.
 */
export const FOUNDER = {
  name: "Anand Kumar",
  title: "Founder & CEO",
  organisation: "CareerGuide AI",
  /** The anchor the About page links to. The Person schema points at the
   * dedicated profile page instead, which is the page about this person. */
  anchor: "founder",
  photoFile: "images/anand-kumar-founder.jpg",
  photoPath: "/images/anand-kumar-founder.jpg",
  photoAlt: "Anand Kumar, Founder & CEO of CareerGuide AI",
} as const;

/** The dedicated ProfilePage route. `Person.url` and the sitemap both use it. */
export const FOUNDER_PAGE_PATH = "/founder/anand-kumar";

/** Intrinsic pixel size of the approved portrait, so an `<img>` and the
 * `ImageObject` in structured data reserve the same box. */
export const FOUNDER_PHOTO_WIDTH = 1086;
export const FOUNDER_PHOTO_HEIGHT = 1448;

/**
 * The approved biography, word for word. The profile page prints it and the
 * `Person` node uses it as `description`, so the visible page and the schema
 * cannot tell two slightly different stories about the same person.
 *
 * It states only what the project can support: the role, the platform and what
 * the platform is for. No education, awards, employers or social profiles are
 * claimed anywhere, because none were supplied.
 */
export const FOUNDER_BIO =
  "Anand Kumar is the Founder & CEO of CareerGuide AI, a career guidance platform built to help Indian students explore career opportunities, understand educational pathways and make informed decisions about their future.";

/**
 * The single `Person` entity for this site, without a `@context` so it can also
 * be embedded inside `ProfilePage.mainEntity` by reference-free inclusion.
 *
 * The `@id` is the identity: `Organization.founder`, the About page's
 * `mainEntity` and the founder profile's `mainEntity` all point at it, so the
 * graph holds one person rather than several look-alike nodes. There is no
 * `sameAs`, no `alumniOf` and no address — the footer says there are no social
 * accounts, and a made-up profile link is exactly the kind of claim a search
 * engine would surface as fact.
 *
 * The telephone number is deliberately absent. It is a business contact
 * printed on the profile page, not an attribute published as structured data
 * for every crawler to redistribute.
 */
export function founderPerson() {
  return {
    "@type": "Person",
    "@id": `${siteOrigin()}/#anand-kumar`,
    name: FOUNDER.name,
    jobTitle: FOUNDER.title,
    description: FOUNDER_BIO,
    url: absolute(FOUNDER_PAGE_PATH),
    image: {
      "@type": "ImageObject",
      url: absolute(FOUNDER.photoPath),
      width: FOUNDER_PHOTO_WIDTH,
      height: FOUNDER_PHOTO_HEIGHT,
      caption: FOUNDER.photoAlt,
    },
    worksFor: { "@id": `${siteOrigin()}/#organization` },
  };
}
