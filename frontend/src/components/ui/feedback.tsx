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
      <p className={cn("mt-1.5 text-2xl font-semibold leading-none", accent)}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
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
