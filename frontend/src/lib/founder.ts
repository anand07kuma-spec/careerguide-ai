/**
 * The one person who builds and runs CareerGuide AI.
 *
 * The homepage, the About page and the `Person` structured data all read this
 * module, so a name or a title cannot drift between what a visitor reads and
 * what a crawler is told. `title` is the public role; it does not imply a
 * registered company, and every page that prints it says so in the same breath.
 *
 * `photoFile` is a path under `public/` and `photoPath` is what an `<img>`
 * points at. The homepage still checks that the file resolves before printing
 * it — a broken image is a worse claim than no image.
 */
export const FOUNDER = {
  name: "Anand Kumar",
  title: "Founder & CEO",
  organisation: "CareerGuide AI",
  /** The anchor the homepage links to and the Person schema points at. */
  anchor: "founder",
  photoFile: "images/anand-kumar-founder.jpg",
  photoPath: "/images/anand-kumar-founder.jpg",
  photoAlt: "Anand Kumar, Founder & CEO of CareerGuide AI",
} as const;
