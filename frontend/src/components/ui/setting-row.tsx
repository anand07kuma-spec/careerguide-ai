"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function shown(t: (en: string) => string, value: ReactNode): ReactNode {
  return typeof value === "string" ? t(value) : value;
}

/**
 * One preference or fact in a settings/profile stack.
 *
 * The row itself is at least 44px tall, so the whole line is comfortable to
 * scan and a wrapped control still has room. A keyboard focus inside the row
 * tints it, in addition to the control's own focus ring.
 */
export function SettingRow({
  label,
  description,
  value,
  control,
  readOnly = false,
  divider = false,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  /** The fact shown by a read-only row. */
  value?: ReactNode;
  /** The control or action for an editable row. */
  control?: ReactNode;
  readOnly?: boolean;
  /** Draws a rule under the row; the last row in a stack drops it. */
  divider?: boolean;
  className?: string;
}) {
  const t = useT();

  return (
    <div
      className={cn(
        "-mx-2 flex min-h-11 flex-col gap-2 rounded-control px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        "focus-within:bg-subtle/60",
        divider && "border-b border-line last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug text-ink">{shown(t, label)}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {shown(t, description)}
          </p>
        ) : null}
      </div>
      {readOnly ? (
        value !== undefined && value !== null ? (
          <div className="min-w-0 text-sm leading-snug text-muted sm:max-w-[55%] sm:text-right">
            {shown(t, value)}
          </div>
        ) : null
      ) : control ? (
        <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          {control}
        </div>
      ) : null}
    </div>
  );
}
