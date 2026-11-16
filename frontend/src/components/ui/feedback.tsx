"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Inbox, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-skeleton", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="cg-card space-y-3 p-5">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

/**
 * The signed-in screen a student is waiting for, drawn in grey.
 *
 * A centred spinner in an otherwise empty page is indistinguishable from a stuck
 * one, and the wait here is a round trip to find out whether this browser already
 * has an account. Drawn to the dashboard's own measurements instead — sidebar,
 * header row, guide card, four stat tiles, the explore grid, three suggestion
 * cards — so the page looks like it is arriving rather than like it forgot.
 *
 * `aria-hidden` because the shapes mean nothing to a screen reader; the caller
 * puts a real `role="status"` sentence next to it.
 */
export function DashboardSkeleton() {
  return (
    <div
      aria-hidden
      className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[280px_minmax(0,1fr)]"
    >
      {/* The sidebar, whose nav rows are the same height as the real ones. */}
      <div className="hidden space-y-2.5 bg-navy/5 px-4 py-5 lg:block">
        <Skeleton className="mb-4 h-7 w-40 rounded-lg bg-skeleton" />
        <Skeleton className="h-4 w-24 rounded-md bg-skeleton" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl bg-skeleton" />
        ))}
        <Skeleton className="mt-6 h-4 w-20 rounded-md bg-skeleton" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl bg-skeleton" />
        ))}
      </div>

      <div className="mx-auto w-full max-w-page space-y-6 px-4 py-6 sm:px-6 sm:py-9">
        {/* Mobile header, which is what a phone shows above the content. */}
        <div className="flex items-center gap-3 lg:hidden">
          <Skeleton className="h-10 w-20 rounded-xl bg-skeleton" />
          <Skeleton className="ml-auto h-9 w-9 rounded-full bg-skeleton" />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 rounded-full bg-skeleton" />
            <Skeleton className="h-7 w-44 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-28 rounded-xl bg-skeleton" />
        </div>

        {/* Guide panel: the avatar and the two ways in. */}
        <div className="cg-card flex items-center gap-4 p-5 sm:gap-6 sm:p-7">
          <Skeleton className="h-20 w-20 shrink-0 rounded-full sm:h-24 sm:w-24" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-40 rounded-lg bg-skeleton" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[132px]" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-24 rounded-lg bg-skeleton" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-card" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-56 rounded-lg bg-skeleton" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[148px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  const t = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 py-12 text-sm text-muted"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {t(label)}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-line bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-subtle text-subtle-ink">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-heading">{t(title)}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
          {typeof description === "string" ? t(description) : description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Errors offer a way forward, never a dead end. */
export function ErrorState({
  title = "That did not load",
  description,
  onRetry,
  retryLabel = "Try again",
  extra,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  extra?: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-line bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-heading">{t(title)}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
          {typeof description === "string" ? t(description) : description}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t(retryLabel)}
          </Button>
        ) : null}
        {extra}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  total = 100,
  label,
  className,
  tone = "brand",
}: {
  value: number;
  total?: number;
  label?: string;
  className?: string;
  tone?: "brand" | "teal" | "success";
}) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const fill = tone === "teal" ? "bg-teal" : tone === "success" ? "bg-success" : "bg-brand";
  const t = useT();
  return (
    <div className={className}>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
          <span>{t(label)}</span>
          <span>{percent}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t(label ?? "Progress")}
        className="h-2 w-full overflow-hidden rounded-full bg-subtle"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "brand",
  icon: Icon,
  footer,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "brand" | "teal" | "success" | "warning" | "indigo";
  icon?: LucideIcon;
  /** Anything drawn under the number, such as a progress bar. */
  footer?: ReactNode;
  /** Makes the whole tile a link to the part of the account it counts. */
  href?: string;
}) {
  const accent = tone === "warning" ? "text-warning" : "text-heading";
  const tint = {
    brand: "bg-brand-mist text-brand-dark",
    teal: "bg-teal-mist text-teal",
    success: "bg-success-mist text-success",
    warning: "bg-warning-mist text-warning",
    indigo: "bg-indigo-100 text-indigo-700",
  }[tone];
  const t = useT();
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-relaxed text-muted break-words">{t(label)}</p>
          <p className={cn("mt-2 text-3xl font-semibold leading-none tracking-tight", accent)}>{value}</p>
        </div>
        {Icon ? (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", tint)}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
      {footer}
    </>
  );
  const shell = "cg-card p-4 text-left sm:p-5";
  return href ? (
    <Link href={href} className={cn(shell, "cg-lift block hover:border-brand/40")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
