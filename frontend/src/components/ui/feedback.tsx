"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/80", className)} />;
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
      className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[264px_minmax(0,1fr)]"
    >
      {/* The sidebar, whose nav rows are the same height as the real ones. */}
      <div className="hidden space-y-2.5 bg-navy/5 px-4 py-5 lg:block">
        <Skeleton className="mb-4 h-7 w-40 rounded-lg bg-slate-200/60" />
        <Skeleton className="h-4 w-24 rounded-md bg-slate-200/60" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl bg-slate-200/60" />
        ))}
        <Skeleton className="mt-6 h-4 w-20 rounded-md bg-slate-200/60" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl bg-slate-200/60" />
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
        {/* Mobile header, which is what a phone shows above the content. */}
        <div className="flex items-center gap-3 lg:hidden">
          <Skeleton className="h-10 w-20 rounded-xl bg-slate-200/60" />
          <Skeleton className="ml-auto h-9 w-9 rounded-full bg-slate-200/60" />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 rounded-full bg-slate-200/60" />
            <Skeleton className="h-7 w-44 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-28 rounded-xl bg-slate-200/60" />
        </div>

        {/* Guide card: the avatar and the two ways in. */}
        <div className="cg-card flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full sm:h-20 sm:w-20" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-40 rounded-lg bg-slate-200/60" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[88px]" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-24 rounded-lg bg-slate-200/60" />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[86px] rounded-card" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-56 rounded-lg bg-slate-200/60" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The signed-in frame, drawn in grey, before anybody knows which screen is coming.
 *
 * `src/app/app/loading.tsx` renders this. It is the same measurement as `AppShell` —
 * a 264px navy column, the phone's header bar, the thumb bar across the bottom — so
 * the page that arrives does not move underneath the student, which on a low-end
 * handset over a slow link is the difference between "it is loading" and "it broke".
 *
 * The frame only, deliberately: `/app/settings` and `/app/careers` do not have the
 * same content, and a shell that guessed the wrong one would be a promise the app
 * has no way to keep. `DashboardSkeleton` above knows what it is waiting for; this
 * one does not, and says nothing beyond the shape it actually shares with every
 * signed-in screen.
 *
 * `aria-hidden` for the same reason: the shapes mean nothing to anyone listening.
 */
export function AppShellSkeleton() {
  return (
    <div
      aria-hidden
      className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[264px_minmax(0,1fr)]"
    >
      {/* The sidebar: wordmark, four section headings and the rows under them, at
          the real rows' height so nothing jumps when the links replace them. */}
      <div className="hidden h-dvh flex-col bg-navy/5 px-4 py-5 lg:flex">
        <Skeleton className="mb-6 h-7 w-40 rounded-lg bg-slate-200/60" />
        {Array.from({ length: 3 }, (_, group) => (
          <div key={group} className="mb-5">
            <Skeleton className="mb-2.5 ml-3 h-3 w-20 rounded-md bg-slate-200/60" />
            {Array.from({ length: 3 }, (_, row) => (
              <Skeleton key={row} className="mb-1 h-10 w-full rounded-xl bg-slate-200/60" />
            ))}
          </div>
        ))}
        <Skeleton className="mt-auto h-14 w-full rounded-xl bg-slate-200/60" />
      </div>

      <div className="flex min-w-0 flex-col">
        {/* The phone's header, which is the one thing a student's thumb is
            already looking for. */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
          <Skeleton className="h-9 w-20 rounded-xl bg-slate-200/60" />
          <Skeleton className="h-5 w-24 rounded-lg bg-slate-200/60" />
          <Skeleton className="ml-auto h-9 w-9 rounded-full bg-slate-200/60" />
        </div>

        <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-md bg-slate-200/60" />
            <Skeleton className="h-7 w-48 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
          <Skeleton className="h-[220px] rounded-card" />
        </div>
      </div>

      {/* The bottom bar, with its five slots — including the raised one in the
          middle that is the AI Call. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-2 py-2 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <Skeleton
                className={cn("rounded-full bg-slate-200/60", i === 2 ? "h-11 w-11" : "h-8 w-8")}
              />
              <Skeleton className="h-2.5 w-10 rounded-sm bg-slate-200/60" />
            </div>
          ))}
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
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-mist text-brand-dark">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">{t(title)}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted">
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
        "flex flex-col items-center justify-center rounded-2xl border border-danger/25 bg-danger-mist/50 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-ink">{t(title)}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted">
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
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
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
  footer,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "brand" | "teal" | "success" | "warning";
  /** Anything drawn under the number, such as a progress bar. */
  footer?: ReactNode;
  /** Makes the tile a question the student can ask about its own number. */
  onClick?: () => void;
}) {
  const accent = {
    brand: "text-brand-dark",
    teal: "text-teal",
    success: "text-success",
    warning: "text-amber-600",
  }[tone];
  const t = useT();
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{t(label)}</p>
      {/* The number keeps text-2xl's own 32px line box: `leading-none` made it 24px and
          clipped 7px off the digit, which is how a progress figure loses its top. */}
      <p className={cn("mt-1.5 text-2xl font-semibold", accent)}>{value}</p>
      {hint ? (
        <p className="mt-2 text-xs text-muted">
          {typeof hint === "string" ? t(hint) : hint}
        </p>
      ) : null}
      {footer}
    </>
  );
  const shell = "cg-card p-4 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(shell, "transition-colors hover:border-brand/50")}>
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}
