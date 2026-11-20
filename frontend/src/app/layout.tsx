import { type ReactNode, Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { ClerkGate } from "@/components/account/clerk-gate";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import { Footer } from "@/components/layout/footer";
import { CookieBanner } from "@/components/consent/cookie-banner";
import { Analytics } from "@/components/analytics/Analytics";
import { JsonLd } from "@/components/seo/json-ld";
import { FOUNDER } from "@/lib/founder";
import { DEFAULT_DESCRIPTION, OG_IMAGE_ALT, OG_IMAGE_PATH, SITE_NAME, absolute, siteOrigin } from "@/lib/site";
import { CONTACT_EMAIL } from "@/lib/legal-entity";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist carries no Devanagari, so Hindi used to fall through to whatever font the
// device happened to have. Noto Sans Devanagari ships its own unicode-range, so the
// stack in globals.css picks it up only for the codepoints Geist cannot draw.
const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Every relative OG/canonical URL in this file and in `pageMeta()` resolves
  // against this origin, so a deployment that sets NEXT_PUBLIC_SITE_URL gets
  // correct absolute links for free and a preview build cannot leak the
  // production domain into a shared card.
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "CareerGuide AI — Explore careers, one conversation at a time",
    template: "%s · CareerGuide AI",
  },
  description:
    "A friendly voice and chat guide that helps Indian students from class 6 to 12 explore careers, build study plans and involve their parents. Conversations can be in Hindi, English or Hinglish.",
  keywords: [
    "career guidance for students",
    "career explorer India",
    "Hindi career guidance",
    "parent career dashboard",
    "study plan",
  ],
  authors: [{ name: "CareerGuide AI" }],
  // `applicationName` and `category` are the two signals a search engine and a
  // browser use when the `<title>` is not enough to name the site. Neither is
  // rendered as a tag a visitor sees; both describe the same thing the visible
  // header says.
  applicationName: SITE_NAME,
  category: "education",
  manifest: "/manifest.webmanifest",
  // Every one of these is the emblem from the approved horizontal artwork. The
  // 48px PNG is what search results and browser tabs can actually use; the SVG
  // and the larger PNGs serve high-density tabs and bookmarks. `/favicon.ico` is
  // listed first because it is the one URL a crawler asks for without being told:
  // it lives in `public/` (not the app directory) so that URL stays stable across
  // builds instead of carrying Next's content hash.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    // iOS ignores the manifest for the home-screen tile and wants this link.
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  // themeColor lives in the `viewport` export below: Next.js 14 deprecated
  // `metadata.themeColor` in favour of `viewport.themeColor`.
  appleWebApp: {
    capable: true,
    title: "CareerGuide AI",
    statusBarStyle: "default",
  },
  openGraph: {
    // Only the root layout can carry the site-wide defaults: a page that
    // exports its own openGraph replaces the whole object, which is why
    // `pageMeta()` re-states siteName and locale on every public page.
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    locale: "en_IN",
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  // The same defaults for Twitter/X. There is no account to name (`site` and
  // `creator` are deliberately absent — a handle that belongs to nobody turns a
  // shared card into a mention of a stranger), so these are the title and
  // description a card falls back to when a page sets none of its own.
  twitter: {
    card: "summary_large_image",
    title: "CareerGuide AI — Explore careers, one conversation at a time",
    description: DEFAULT_DESCRIPTION,
    images: [{ url: OG_IMAGE_PATH, alt: OG_IMAGE_ALT }],
  },
  // Google Search Console ownership. Left unset until the owner pastes the
  // "verification token" value Google shows into NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  // `undefined` means the meta tag is not rendered at all, so a build without
  // it is not claiming a half-configured verification.
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0b1730",
};

/**
 * The three blocks every crawler meets first: who publishes this site, who
 * leads it, and what the site is.
 *
 * CareerGuide AI is an individually developed student project, not a registered
 * company, so `Organization` carries no `legalName` and no postal address. It
 * carries a contact email only when one is configured for this deployment — an
 * address that belongs to nobody, echoed into structured data, is a claim a
 * crawler repeats further than the page that made it. `founder` is a reference
 * to the `Person` block below, not a second spelling of the same name.
 *
 * The `SearchAction` is honest: `/careers?search=` is a real `GET` form on a
 * public page, so the template describes something a person can actually do.
 */
const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteOrigin()}/#organization`,
  name: SITE_NAME,
  // The short form the footer, the manifest and the repository use. A crawler
  // matching "CareerGuide" to this site does not have to guess from the title.
  alternateName: "CareerGuide",
  url: siteOrigin(),
  logo: {
    "@type": "ImageObject",
    url: absolute("/icon-512.png"),
    width: 512,
    height: 512,
  },
  description: DEFAULT_DESCRIPTION,
  areaServed: "IN",
  founder: { "@id": `${siteOrigin()}/#anand-kumar` },
  ...(CONTACT_EMAIL ? { email: CONTACT_EMAIL } : {}),
};

/**
 * The person named in the homepage's founder section and the About page. The
 * `@id` is what `Organization.founder` and the About page's `mainEntity` point
 * at, so the graph holds one person rather than several look-alike nodes. It
 * carries no `sameAs`, no `alumniOf` and no address: none of those were supplied
 * with the project, and a made-up profile link is exactly the kind of claim a
 * search engine would surface as fact.
 */
const FOUNDER_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${siteOrigin()}/#anand-kumar`,
  name: FOUNDER.name,
  jobTitle: FOUNDER.title,
  url: absolute(`/about#${FOUNDER.anchor}`),
  worksFor: { "@id": `${siteOrigin()}/#organization` },
};

const SITE_SCHEMAS = [
  ORGANIZATION,
  FOUNDER_SCHEMA,
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteOrigin()}/#website`,
    name: SITE_NAME,
    alternateName: "CareerGuide",
    url: siteOrigin(),
    description: DEFAULT_DESCRIPTION,
    inLanguage: ["en", "hi"],
    publisher: { "@id": `${siteOrigin()}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteOrigin()}/careers?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
];

/**
 * The theme, decided in the document itself before any of it is painted.
 *
 * Light is the starting appearance, so the only ways into Dark are the two
 * choices in Settings → Storage and appearance and the header switch on the
 * public pages; `system` is the one that asks the operating system. A stored
 * value that is not one of the three, a browser that will not hand over
 * `localStorage`, and a first visit all end up in the same place: light.
 */
const THEME_PREPAINT = `try{var c=null;try{c=localStorage.getItem("careerguide.theme")}catch(e){c=null}var d=!!window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=c==="dark"||(c==="system"&&d)?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoDevanagari.variable} h-full antialiased`}
      data-reduced-motion="false"
      data-high-contrast="false"
      // The theme below is written onto this element before React exists, so its
      // `data-theme` attribute is not something hydration should complain about.
      suppressHydrationWarning
    >
      {/* `dvh`, not `100%`: a phone keyboard or a hiding URL bar changes the
          visible height, and a percentage resolves against a document box that
          can be taller than the screen — which shows up as a strip you can
          scroll past the end of the page into. */}
      <body className="flex min-h-dvh flex-col">
        {/* Paint the chosen theme before anything else, so a student who picked
            Dark does not get a white flash on every visit. `src/lib/theme.ts`
            reads and writes the same `careerguide.theme` key and is the half that
            runs inside React; this is the half that runs before it, which is why
            the key is repeated as a literal here rather than imported across the
            client boundary — the same reason `request-lang.ts` re-states the
            language key. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_PREPAINT }} />
        <ServiceWorkerRegistration />
        <JsonLd data={SITE_SCHEMAS} />
        {/* Clerk only wraps the tree when this deployment has a publishable key.
            With no key the app renders exactly as it did before Clerk was
            installed — the device account is the account, and an email sign-in is
            something a family adds on top of it. */}
        <ClerkGate>
          <ToastProvider>
            <SessionProvider>
              {children}
              {/* One footer for the whole site, so a legal page and the landing
                  page cannot disagree about where the contact link lives. It
                  skips the app screens themselves, which needs the current path
                  — a runtime value — hence Suspense: the page shell prerenders
                  and the footer arrives with the stream. */}
              <Suspense fallback={null}>
                <Footer />
              </Suspense>
              {/* Analytics and SEO live together because they must not be
                  separable: this component is the only thing that loads a
                  third-party script, and it reads the consent answer, the
                  configured project ids and the current path before it does.
                  It needs the path, so it is in Suspense for the same reason
                  the footer is. */}
              <Suspense fallback={null}>
                <Analytics />
              </Suspense>
              <CookieBanner />
            </SessionProvider>
          </ToastProvider>
        </ClerkGate>
      </body>
    </html>
  );
}
