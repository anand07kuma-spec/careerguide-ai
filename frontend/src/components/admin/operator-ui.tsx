"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT, useTf } from "@/lib/i18n";
import type { AdminBucket } from "@/lib/types";

/**
 * The pieces the operator screens under `/app/admin` share.
 *
 * They live here rather than in `components/ui` because they say things a student-facing
 * control should never have to say: how a figure was counted, what a refusal meant, and
 * which half of a number moved no money.
 */

/** A date the way an Indian operator reads one: 14/10/2026. */
export function day(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
}

export function dateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
}

/**
 * Money is stored in paise, so every rupee on these screens is divided here rather than
 * rounded in somebody's head. A test-mode payment is never passed to this function
 * alongside real revenue — the two are shown as separate figures, because one of them
 * moved no money.
 */
export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** The panel an action ends in: what the server said, in the server's own words. */
export function Notice({ tone, text }: { tone: "ok" | "bad"; text: string }) {
  const t = useT();
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={`rounded-card border p-3 text-xs leading-relaxed ${
        tone === "bad"
          ? "border-danger/30 bg-danger-mist text-ink"
          : "border-success/30 bg-success-mist text-ink"
      }`}
    >
      {typeof text === "string" ? t(text) : text}
    </p>
  );
}

/**
 * A count that is true now, in a caption under a number. Several of these figures are
 * invariants of the API (`chat + voice = sessions`), and showing the parts is cheaper
 * than asking a reader to trust the total.
 */
export function Caption({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <p className="mt-2 text-xs leading-relaxed text-muted">
      {typeof children === "string" ? t(children) : children}
    </p>
  );
}

/** The buckets the summary sends as `by_type` and `by_plan`: label, count, share. */
export function BucketList({
  buckets,
  total,
  emptyLabel,
}: {
  buckets: AdminBucket[];
  total: number;
  emptyLabel: string;
}) {
  const t = useT();
  if (buckets.length === 0) {
    return <p className="text-sm text-muted">{t(emptyLabel)}</p>;
  }
  return (
    <ul className="space-y-2">
      {buckets.map((bucket) => {
        const share = total > 0 ? Math.round((bucket.count / total) * 100) : 0;
        return (
          <li key={bucket.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">{bucket.label}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {bucket.count.toLocaleString("en-IN")}
                <span className="ml-1.5 text-xs">({share}%)</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand/70" style={{ width: `${share}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** One labelled fact, for the read-only deployment panel. */
export function KeyValue({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-line/60 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-baseline">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {typeof label === "string" ? t(label) : label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-ink">
        {typeof value === "string" ? t(value) : value}
        {note ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {typeof note === "string" ? t(note) : note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

export function Yes({ on }: { on: boolean }) {
  const t = useT();
  return (
    <span className={on ? "font-medium text-success" : "text-muted"}>
      {on ? t("Yes") : t("No")}
    </span>
  );
}

/**
 * Prev / next over a paged list. The offset moves in whole pages, and a button that would
 * step past the end is disabled rather than left to return an empty table.
 */
export function Pager({
  total,
  limit,
  offset,
  onMove,
  unit = "rows",
}: {
  total: number;
  limit: number;
  offset: number;
  onMove: (nextOffset: number) => void;
  unit?: string;
}) {
  const t = useT();
  const tf = useTf();
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + limit, total);
  const unitLabel = t(unit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs text-muted" role="status">
        {total === 0
          ? tf("No {unit} match this filter.", { unit: unitLabel })
          : tf("{first}–{last} of {total} {unit}.", {
              first,
              last,
              total: total.toLocaleString("en-IN"),
              unit: unitLabel,
            })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMove(Math.max(0, offset - limit))}
          disabled={offset <= 0}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("Previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMove(offset + limit)}
          disabled={last >= total}
        >
          {t("Next")}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** A `string[]` field edited as one item per line. */
export function toLines(items: string[] | null | undefined): string {
  return (items ?? []).join("\n");
}

export function fromLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
