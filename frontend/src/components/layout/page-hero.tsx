import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The opening band for a public page that is not the home page.
 *
 * The catalogue pages get their own heroes because their opening argument is
 * different — a search panel on Careers, a profile on a career. The remaining
 * public pages are documents, and this is the one shape they share: an eyebrow,
 * a title at editorial scale, the honest lead, and the actions that follow from
 * it, all sitting on the same soft surface the header ends in. The washes are
 * decoration; every word stays in normal flow for zoom and print.
 *
 * `width="reading"` lines the band up with the article column beneath it, so a
 * long-form page does not open wide and then narrow by a third.
 */
export function PageHero({
  eyebrow,
  title,
  notice,
  lead,
  actions,
  width = "reading",
  className,
}: {
  eyebrow: string;
  title: string;
  /** A language or verification note, placed before the lead rather than after it. */
  notice?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  width?: "page" | "reading";
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden border-b border-line bg-surface", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand-mist/80 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full bg-teal-mist/50 blur-3xl"
      />
      <div
        className={cn(
          "relative mx-auto w-full px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14",
          width === "page" ? "max-w-page" : "max-w-reading",
        )}
      >
        <div className="max-w-3xl">
          <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
          <h1 className="mt-3 text-balance text-3xl font-bold leading-[1.1] tracking-tight text-heading sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {notice ? <div className="mt-4">{notice}</div> : null}
          {lead ? (
            <div className="mt-5 text-base leading-relaxed text-muted sm:text-lg">{lead}</div>
          ) : null}
          {actions ? <div className="mt-7 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
