"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The list every account-style screen is made of: a row with an icon, a label,
 * one line of state, and a chevron saying there is more behind it. It lives here
 * rather than inside one page because Settings and the profile screen would
 * otherwise each grow their own copy of these class names and drift apart.
 */

const rowClasses =
  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-canvas focus-visible:bg-canvas";

export function SettingsRow({
  icon: Icon,
  tone,
  title,
  value,
  attention,
  href,
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  value: ReactNode;
  attention?: boolean;
  /** A row that leads to another screen is a link; one that opens a panel is a button. */
  href?: string;
  onClick?: () => void;
}) {
  const t = useT();
  const inner = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          attention ? "bg-warning-mist text-amber-700" : tone,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{t(title)}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {/* A state line is English source text like any other label, so it goes
            * through the dictionary; JSX values are left to their own devices. */}
          {typeof value === "string" ? t(value) : value}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={rowClasses}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={rowClasses}>
      {inner}
    </button>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
      {typeof children === "string" ? t(children) : children}
    </p>
  );
}

/** A heading plus the divided card of rows under it, as one reusable block. */
export function SettingsSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight text-ink">{t(title)}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted">{t(description)}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <Card className="divide-y divide-line overflow-hidden p-0">{children}</Card>
    </section>
  );
}
