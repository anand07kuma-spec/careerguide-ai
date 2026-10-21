"use client";

import { useTf } from "@/lib/i18n";
import { ProgressBar as Bar } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

/**
 * Where the student is in the questionnaire, in two honest numbers: how far along
 * the list they are (`{n} of {total}`) and how many answers the server has saved.
 *
 * They are deliberately separate. Jumping around the list means the position can be
 * ahead of the count, and a bar that claimed 100% while four answers were still
 * missing is exactly the sort of thing that makes a finished-looking set feel safe
 * to leave.
 */
export function ProgressBar({
  index,
  total,
  answered,
  saving,
  className,
}: {
  index: number;
  total: number;
  answered: number;
  /** Shown while an answer is in flight, so autosave is visible rather than assumed. */
  saving?: boolean;
  className?: string;
}) {
  const tf = useTf();
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs font-medium text-muted">
        <span>{tf("Question {n} of {total}", { n: index + 1, total })}</span>
        <span aria-live="polite">
          {saving
            ? tf("Saving answer {answered} of {total}…", { answered, total })
            : tf("Saved: {answered} of {total}", { answered, total })}
          {"  ·  "}
          {percent}%
        </span>
      </div>
      <Bar value={answered} total={total} tone="teal" />
    </div>
  );
}
