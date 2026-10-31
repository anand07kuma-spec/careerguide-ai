"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Printer } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

/**
 * The frame every legal page shares — header, title, contents, the "not a
 * legal opinion" line, sibling links and a footer. Written once so a privacy
 * policy and its terms cannot drift apart while pretending to be one document
 * set.
 *
 * The contents list is sticky on a laptop and collapsible on a phone, because
 * a fifteen-thousand-character policy without a way to jump around is a wall
 * of text nobody reads. Print drops the navigation and keeps the prose.
 */

export const REPO_URL = "https://github.com/anand07kuma-spec/careerguide-ai";

export const LEGAL_PAGES = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund", label: "Refund policy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/contact", label: "Contact" },
] as const;

/** One numbered entry in the contents list, matched to a `LegalSection` by id. */
export type SectionRef = { id: string; title: string };

export type TocItem = SectionRef;

function TocList({ toc, onNavigate }: { toc: readonly TocItem[]; onNavigate?: () => void }) {
  const t = useT();
  return (
    <ol className="space-y-1 text-sm">
      {toc.map((item, index) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={onNavigate}
            className="flex gap-2 rounded-md px-2 py-1 leading-snug text-muted hover:bg-brand-mist hover:text-brand-dark"
          >
            <span className="w-5 shrink-0 text-right tabular-nums text-muted">
              {index + 1}.
            </span>
            <span>{t(item.title)}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

export function LegalLayout({
  badge,
  title,
  intro,
  current,
  lastUpdated,
  sections,
  children,
}: {
  badge: string;
  title: string;
  intro: ReactNode;
  /** This page's own href, so it is never linked to itself. */
  current: string;
  lastUpdated?: string;
  /** The numbered sections, in order. The contents list is built from these. */
  sections?: readonly SectionRef[];
  children: ReactNode;
}) {
  const t = useT();
  const [tocOpen, setTocOpen] = useState(false);
  const siblings = LEGAL_PAGES.filter((page) => page.href !== current);
  const hasToc = Boolean(sections && sections.length > 0);

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6 print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Wordmark />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden items-center gap-1.5 text-xs font-medium text-muted hover:text-ink sm:flex print:hidden"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              {t("Print")}
            </button>
            <span className="text-xs font-medium text-muted">{t("Prototype")}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid grid-cols-1 w-full max-w-5xl gap-x-10 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {hasToc ? (
          <aside className="lg:col-start-1 lg:row-start-1 print:hidden">
            {/* Phone: a button that opens the list in place. */}
            <div className="lg:hidden">
              <button
                type="button"
                aria-expanded={tocOpen}
                onClick={() => setTocOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3 text-sm font-semibold text-heading"
              >
                {t("On this page")}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted transition-transform ${tocOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {tocOpen ? (
                <div className="mt-2 rounded-card border border-line bg-surface p-2">
                  <TocList toc={sections!} onNavigate={() => setTocOpen(false)} />
                </div>
              ) : null}
            </div>
            {/* Laptop: a column that stays beside the text while it scrolls. */}
            <nav
              aria-label={t("On this page")}
              className="hidden lg:sticky lg:top-8 lg:block print:hidden"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {t("Contents")}
              </p>
              <TocList toc={sections!} />
            </nav>
          </aside>
        ) : null}

        <div className="min-w-0 max-w-3xl lg:col-start-2 lg:row-start-1">
          <Badge tone="teal" className="mb-4">
            {badge}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl print:text-black">
            {title}
          </h1>
          {lastUpdated ? (
            <p className="mt-2 text-sm text-muted">
              {t("Last updated")}
              {": "}
              <span className="font-medium text-ink">{lastUpdated}</span>
            </p>
          ) : null}
          <p className="mt-4 leading-relaxed text-ink print:text-black">{intro}</p>

          {children}

          <p className="mt-10 text-sm font-medium text-muted">
            {t("This is not a legal opinion.")}{" "}
            {siblings.map((page, index) => (
              <span key={page.href}>
                {index > 0 ? " · " : ""}
                <Link className="text-brand underline-offset-2 hover:underline" href={page.href}>
                  {t(page.label)}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </main>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  tone = "plain",
  children,
}: {
  id?: string;
  title: string;
  tone?: "plain" | "warn";
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-10 scroll-mt-8 print:mt-6 print:break-inside-avoid"
    >
      <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl print:text-black">
        {title}
      </h2>
      {tone === "warn" ? (
        <div className="mt-4 rounded-card border border-danger/30 bg-danger-mist p-5 text-sm leading-relaxed text-ink print:border-black print:bg-white print:text-black">
          {children}
        </div>
      ) : (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted print:text-black">
          {children}
        </div>
      )}
    </section>
  );
}
