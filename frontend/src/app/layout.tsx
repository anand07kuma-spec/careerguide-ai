import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkGate } from "@/components/account/clerk-gate";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import { Footer } from "@/components/layout/footer";
import { CookieBanner } from "@/components/consent/cookie-banner";
import { Analytics } from "@/components/analytics/Analytics";
import { JsonLd } from "@/components/seo/json-ld";
import { DEFAULT_DESCRIPTION, SITE_NAME, absolute, siteOrigin } from "@/lib/site";
import {
  CITY,
  COMPANY,
  GRIEVANCE_EMAIL,
  IS_SAMPLE,
  POSTAL_ADDRESS,
} from "@/lib/legal-entity";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  manifest: "/manifest.webmanifest",
  // iOS ignores the manifest for the home-screen tile and wants this link.
  icons: { apple: "/icon-192.png" },
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
 * The two blocks every crawler meets first: who publishes this site, and what
 * the site is.
 *
 * `Organization` carries no `legalName`, postal address or email while the
 * identity in `src/lib/legal-entity.ts` is still the sample set — a printed
 * address that belongs to nobody, echoed into structured data, is a claim a
 * crawler repeats further than the page that made it. Once an operator fills
 * those five variables for a real deployment, the same file says so, and this
 * block then asserts what the site itself has published.
 *
 * The `SearchAction` is honest: `/careers?search=` is a real `GET` form on a
 * public page, so the template describes something a person can actually do.
 */
const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteOrigin()}/#organization`,
  name: SITE_NAME,
  url: siteOrigin(),
  logo: { "@type": "ImageObject", url: absolute("/icon-512.png") },
  description: DEFAULT_DESCRIPTION,
  areaServed: "IN",
  ...(IS_SAMPLE
    ? {}
    : {
        legalName: COMPANY,
        address: { "@type": "PostalAddress", streetAddress: POSTAL_ADDRESS, addressLocality: CITY, addressCountry: "IN" },
        email: GRIEVANCE_EMAIL,
      }),
};

const SITE_SCHEMAS = [
  ORGANIZATION,
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteOrigin()}/#website`,
    name: SITE_NAME,
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-reduced-motion="false"
      data-high-contrast="false"
      // The theme below is written onto this element before React exists, so its
      // `data-theme` attribute is not something hydration should complain about.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
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
