"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("cg-card p-5", className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    // Stacked below `sm`, because the action is `shrink-0`: on a phone a two-button action
    // row leaves the title and its description in a column 60px wide, one word per line.
    <div className={cn("flex flex-col items-start gap-3 sm:flex-row sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight text-ink">
            {typeof title === "string" ? t(title) : title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {typeof description === "string" ? t(description) : description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Sections reference this with `aria-labelledby`, so the id must exist. */
  id?: string;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          {typeof title === "string" ? t(title) : title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {typeof description === "string" ? t(description) : description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
