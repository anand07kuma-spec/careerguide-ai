"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function shown(t: (en: string) => string, value: ReactNode): ReactNode {
  return typeof value === "string" ? t(value) : value;
}

/**
 * The top of a printable document — a report or an assessment result.
 *
 * Title and metadata are printed; actions are not. `level` exists because some
 * screens already own the page's `h1` through `Screen`, and a nested document
 * title must not introduce a second one.
 */
export function DocumentHeader({
  title,
  subtitle,
  meta,
  actions,
  level = 2,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  level?: 1 | 2;
  className?: string;
}) {
  const t = useT();
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <header
      className={cn(
        "border-b border-line pb-5 print:break-inside-avoid sm:pb-6",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <Heading className="text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
            {shown(t, title)}
          </Heading>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
              {shown(t, subtitle)}
            </p>
          ) : null}
          {meta ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
