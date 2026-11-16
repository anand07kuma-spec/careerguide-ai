"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type FigureAspect = "auto" | "square" | "video" | "4/3" | "3/2";

const ASPECTS: Record<Exclude<FigureAspect, "auto">, string> = {
  square: "aspect-square",
  video: "aspect-video",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
};

function shown(t: (en: string) => string, value: ReactNode): ReactNode {
  return typeof value === "string" ? t(value) : value;
}

/**
 * A chart or diagram in the same surface as the rest of the page.
 *
 * The frame deliberately does not hide overflow: a clipped axis label is worse
 * than a figure that grows. Charts keep their own height with `aspect="auto"`;
 * an explicit ratio is for media that should fill the box. Nothing here breaks
 * across a printed page.
 */
export function FigureFrame({
  children,
  caption,
  aspect = "auto",
  className,
  contentClassName,
}: {
  children: ReactNode;
  caption?: ReactNode;
  aspect?: FigureAspect;
  className?: string;
  contentClassName?: string;
}) {
  const t = useT();

  return (
    <figure
      className={cn(
        "cg-card p-4 print:break-inside-avoid print:shadow-none sm:p-5",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex w-full items-center justify-center",
          aspect === "auto" ? "min-h-56" : ASPECTS[aspect],
          "[&_canvas]:max-w-full [&_img]:max-h-full [&_svg]:max-h-full [&_svg]:max-w-full",
          contentClassName,
        )}
      >
        {children}
      </div>
      {caption ? (
        <figcaption className="mt-3 text-xs leading-relaxed text-muted">
          {shown(t, caption)}
        </figcaption>
      ) : null}
    </figure>
  );
}
