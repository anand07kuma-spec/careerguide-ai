"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function shown(t: (en: string) => string, value: ReactNode): ReactNode {
  return typeof value === "string" ? t(value) : value;
}

/**
 * The action bar for a long document or workspace.
 *
 * Sticky is desktop-only on purpose: below `lg` the app shell already has a
 * sticky header at the top of the viewport, and a second bar pinned to `top-0`
 * would sit behind it. The wrapper never fixes a height, so a wrapped action
 * row on a narrow screen grows instead of clipping.
 */
export function PageToolbar({
  title,
  meta,
  actions,
  sticky = false,
  className,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  const t = useT();

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        sticky &&
          "z-20 bg-canvas/95 backdrop-blur lg:sticky lg:top-0 lg:py-3 print:static print:bg-transparent print:py-0 print:backdrop-blur-none",
        className,
      )}
    >
      {title || meta ? (
        <div className="min-w-0">
          {title ? (
            <h2 className="text-base font-semibold leading-snug break-words text-heading">
              {shown(t, title)}
            </h2>
          ) : null}
          {meta ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {meta}
            </div>
          ) : null}
        </div>
      ) : null}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>
      ) : null}
    </div>
  );
}
