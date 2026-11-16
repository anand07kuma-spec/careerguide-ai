"use client";

import Link from "next/link";
import { Check, ChevronLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function shown(t: (en: string) => string, value: ReactNode): ReactNode {
  return typeof value === "string" ? t(value) : value;
}

/**
 * The frame every Settings destination page shares: the way back to the Settings
 * home over a plain sans title, and the full width of the main column. It is one
 * component rather than seven copies so the seven screens cannot drift apart.
 */
export function SettingsPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7">
      <Link
        href="/app/settings"
        className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        {t("Back to Settings")}
      </Link>
      <header className="mt-3">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-heading sm:text-[1.75rem]">
          {t(title)}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{t(description)}</p>
      </header>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

/**
 * One white section card: a small pastel tile, a title, one line of state, and an
 * optional control in the corner. The rows below a header are the caller's own,
 * divided by the warm settings line so two cards never share one long table.
 */
export function SettingsCard({
  icon: Icon,
  tone,
  title,
  description,
  action,
  children,
  id,
  className,
  bodyClassName,
}: {
  icon?: LucideIcon;
  tone?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  id?: string;
  className?: string;
  bodyClassName?: string;
}) {
  const t = useT();
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-6 overflow-hidden rounded-[18px] border border-settings-line bg-surface shadow-card",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                tone ?? "bg-tile-slate text-on-tile-slate",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight text-ink sm:text-base">
              {shown(t, title)}
            </h2>
            {description ? (
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted sm:text-sm">
                {shown(t, description)}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0 self-start">{action}</div> : null}
      </div>
      {children ? (
        <div className={cn("border-t border-settings-line", bodyClassName)}>{children}</div>
      ) : null}
    </section>
  );
}

/** A labelled row inside a card, with its control or value at the end. */
export function SettingsItem({
  title,
  description,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  const t = useT();
  return (
    <div
      id={id}
      className={cn(
        "flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0 sm:max-w-[28rem]">
        <p className="text-sm font-medium text-ink">{shown(t, title)}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{shown(t, description)}</p>
        ) : null}
      </div>
      {children ? <div className="shrink-0 sm:pl-4">{children}</div> : null}
    </div>
  );
}

const PILL_TONES = {
  success: "bg-success-mist text-success dark:text-emerald-200",
  brand: "bg-brand-mist text-brand-dark",
  warning: "bg-warning-mist text-amber-800 dark:text-amber-200",
  danger: "bg-danger-mist text-danger",
  neutral: "bg-subtle text-subtle-ink",
} as const;

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof PILL_TONES;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-2xs font-semibold",
        PILL_TONES[tone],
        className,
      )}
    >
      {shown(t, children)}
    </span>
  );
}

/** A short set of equal choices, the middle one lit. Used for the speaking pace;
 * `disabled` is what an unsupported choice honestly looks like. */
export function Segmented({
  items,
  value,
  onChange,
  disabled,
  label,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange?: (next: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t(label)}
      aria-disabled={disabled || undefined}
      className="inline-flex rounded-lg border border-settings-line bg-settings-page p-0.5"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange?.(item.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border border-settings-line bg-surface text-ink shadow-sm"
                : "border border-transparent text-muted",
              !disabled && !active && "hover:text-ink",
              disabled && "cursor-not-allowed",
            )}
          >
            {t(item.label)}
          </button>
        );
      })}
    </div>
  );
}

/** The reference's light blue selected pill: filled mist, blue ring, a tick. */
export function ChoicePills({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  const t = useT();
  return (
    <div role="group" aria-label={t(label)} className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-brand-solid bg-brand-mist text-brand-dark"
                : "border-settings-line bg-surface text-muted hover:border-brand-light hover:text-ink",
            )}
          >
            {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
            {t(item.label)}
          </button>
        );
      })}
    </div>
  );
}

/** A quiet explanatory strip inside a card, on the page's own warm surface. */
export function DetailNote({ children, className }: { children: ReactNode; className?: string }) {
  const t = useT();
  return (
    <p
      className={cn(
        "rounded-xl bg-settings-page px-3.5 py-2.5 text-xs leading-relaxed text-muted",
        className,
      )}
    >
      {shown(t, children)}
    </p>
  );
}
