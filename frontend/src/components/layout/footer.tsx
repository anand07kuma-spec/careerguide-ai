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
      { label: "Chat with the guide", href: "/app/chat" },
      { label: "Careers", href: "/app/careers" },
      { label: "Streams after class 10", href: "/app/streams" },
      { label: "Exams", href: "/app/exams" },
      { label: "Career profiles", href: "/careers" },
      { label: "Study abroad", href: "/study-abroad" },
      { label: "Assessments", href: "/app/assessments" },
      { label: "How it works", href: "/about#how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "Billing & plan", href: "/app/billing" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Refund policy", href: "/refund" },
      { label: "Disclaimer", href: "/disclaimer" },
      { label: "Contact", href: "/contact" },
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
 * of those would push its own navigation off the page when it scrolls. The
 * sign-in page is the same kind of screen: one full-height panel that ends in
 * its own quiet footer row. */
const NO_FOOTER = ["/app", "/parent", "/onboarding", "/login", "/reset-password"];

export function Footer() {
  const t = useT();
  const year = useYear();
  const pathname = usePathname();

  if (NO_FOOTER.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <footer className="relative mt-16 overflow-hidden bg-navy text-white/70 print:hidden">
      {/* The footer stays navy in both themes: it is the base of the page, and a
          pale strip under a dark closing section read as a rendering mistake. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 cg-grid-lines opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-brand/25 blur-3xl"
      />

      <div className="relative cg-container py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] lg:gap-8">
          <div className="max-w-xs">
            <Wordmark tone="white" />
            <p className="mt-4 text-sm leading-relaxed text-white/75">
              {t(
                "CareerGuide AI supports exploration. It is not a replacement for a qualified career counsellor, teacher or doctor.",
              )}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-white/60">
              {t("A prototype for Indian students from class 6 to 12, and their parents.")}
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={t(column.title)}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                {t(column.title)}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.items.map((item) => (
                  <li key={item.label} className="leading-snug">
                    {item.href ? (
                      <Link
                        className="text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline"
                        href={item.href}
                      >
                        {t(item.label)}
                      </Link>
                    ) : (
                      <span className="text-white/60">
                        {t(item.label)}
                        {item.note ? (
                          <span className="ml-1 text-xs italic text-white/45">({t(item.note)})</span>
                        ) : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} CareerGuide AI · {t("Prototype — no compliance claims")}
          </p>
          <p className="flex items-center gap-2">
            {t("Made in India")}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t("GitHub repository")}
              className="rounded-full border border-white/15 p-1.5 text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
