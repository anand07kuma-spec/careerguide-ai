import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The frame every public page puts around its header content.
 *
 * Before this file the same five classes — border, translucent surface, and a
 * centred container — were copied into about, pricing, welcome, legal, join,
 * onboarding and the careers shell, and three of them also disagreed about the
 * width (5xl, 6xl and 3xl on the same footer). The width here is a token:
 * `page` for the app and marketing pages, `reading` for a text column, `focus`
 * for a single-task flow.
 *
 * It stays a server component. Pages pass already-rendered controls, so the
 * language and theme toggles keep their own client boundaries instead of
 * turning the whole header into one.
 */

type Width = "page" | "reading" | "focus";

const WIDTH: Record<Width, string> = {
  page: "max-w-page",
  reading: "max-w-reading",
  focus: "max-w-focus",
};

export function SiteHeader({
  children,
  width = "reading",
  sticky = false,
  skipTo,
  skipLabel = "Skip to content",
  className,
  innerClassName,
}: {
  children: ReactNode;
  width?: Width;
  sticky?: boolean;
  /** The id of the page's `<main>`; renders a focus-only skip link when set. */
  skipTo?: string;
  skipLabel?: string;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <header
      className={cn(
        "border-b border-line bg-surface/85 backdrop-blur",
        sticky && "sticky top-0 z-30",
        className,
      )}
    >
      {skipTo ? (
        <a className="cg-skip-link" href={skipTo}>
          {skipLabel}
        </a>
      ) : null}
      <div
        className={cn(
          "mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6",
          WIDTH[width],
          innerClassName,
        )}
      >
        {children}
      </div>
    </header>
  );
}
