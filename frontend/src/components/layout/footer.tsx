"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { REPO_URL } from "@/components/legal/legal-layout";
import { useT } from "@/lib/i18n";

/**
 * The site footer.
 *
 * A link here is a link to a page that exists. The four columns the design
 * brief asked for are all present, but where a destination has not been built
 * — no social accounts — the row is printed as text with the reason beside it.
 * A footer full of dead links is how a site advertises pages it does not have.
 * Pricing is a real page now; whether a card can actually be taken is answered
 * on it by the server, not here.
 */

/** The viewer's current year. Next.js will not prerender a `new Date()` read,
 * in a client component or in the layout, so the server snapshot is empty and
 * the number arrives at hydration instead. */
const nothingToSubscribe = () => () => {};

function useYear(): string {
  return useSyncExternalStore(
    nothingToSubscribe,
    () => String(new Date().getFullYear()),
    () => "",
  );
}

type Item = { label: string; href?: string; note?: string };

const COLUMNS: { title: string; items: Item[] }[] = [
  {
    title: "Product",
    items: [
      // Only the pages a visitor reads before signing in. The screens inside the
      // account are not listed here: the bottom bar, the dashboard's Explore grid
      // and the ☰ menu already offer each of them exactly once, and a sixth copy in
      // a footer is how the same word ends up on four parts of one phone. The door
      // into the account belongs to the header, which is on every public page, and
      // `/about` is already the Company column's row — a second name for the same
      // page, anchored to one heading, was the footer disagreeing with itself.
      { label: "Career profiles", href: "/careers" },
      { label: "Study abroad", href: "/study-abroad" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Legal",
    items: [
      // `Contact` lives in the Company column only. Two rows with the same word in
      // one footer is the same mistake this page keeps making.
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Refund policy", href: "/refund" },
      { label: "Disclaimer", href: "/disclaimer" },
      { label: "All legal pages", href: "/legal" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Blog", href: "/blog" },
      { label: "Careers at CareerGuide", note: "not hiring" },
    ],
  },
  {
    title: "Social",
    items: [
      { label: "GitHub repository", href: REPO_URL },
      { label: "LinkedIn", note: "no account" },
      { label: "X (Twitter)", note: "no account" },
      { label: "Instagram", note: "no account" },
      { label: "YouTube", note: "no account" },
    ],
  },
];

/** The screens that own their whole viewport — a full-height grid with a sticky
 * sidebar, a phone bottom bar, or a focused consent flow. A footer beneath one
 * of those would push its own navigation off the page when it scrolls. */
const NO_FOOTER = ["/app", "/parent", "/onboarding"];

export function Footer() {
  const t = useT();
  const year = useYear();
  const pathname = usePathname();

  if (NO_FOOTER.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <footer className="mt-10 border-t border-line bg-surface print:hidden">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
          <div className="max-w-xs">
            <Wordmark compact />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {t(
                "CareerGuide AI supports exploration. It is not a replacement for a qualified career counsellor, teacher or doctor.",
              )}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {t("A prototype for Indian students from class 6 to 12, and their parents.")}
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={t(column.title)}>
              <p className="text-xs font-semibold uppercase tracking-wide text-heading">
                {t(column.title)}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {column.items.map((item) => (
                  <li key={item.label} className="leading-snug">
                    {item.href ? (
                      <Link
                        className="text-muted underline-offset-2 hover:text-ink hover:underline"
                        href={item.href}
                      >
                        {t(item.label)}
                      </Link>
                    ) : (
                      <span className="text-muted/70">
                        {t(item.label)}
                        {item.note ? (
                          <span className="ml-1 text-xs italic text-muted/70">({t(item.note)})</span>
                        ) : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} CareerGuide AI · {t("Prototype — no compliance claims")}
          </p>
          <p className="flex items-center gap-1.5">
            {t("Made in India")}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t("GitHub repository")}
              className="text-muted hover:text-ink"
            >
              <GitBranch className="h-4 w-4" aria-hidden />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
