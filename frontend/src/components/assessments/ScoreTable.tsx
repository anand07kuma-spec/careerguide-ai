"use client";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { RadarPoint } from "./RadarChart";

/**
 * The same figures a radar draws, written out.
 *
 * Two callers, and they need it for opposite reasons. `RadarChart` puts this on the
 * page for a reader who cannot see the polygon — an SVG shape carries no meaning to
 * them, so the numbers have to exist somewhere. Lite mode puts the same component
 * where the chart was, because a chart is the most expensive thing in this app
 * (344 KB of drawing library for six numbers) and taking it away must not take the
 * numbers with it.
 *
 * Both are the same table because a second copy of these rows is how one of them
 * drifts from the other, and then a student reading the list offline and a student
 * hovering the spoke online get different facts about the same answers.
 */
export function ScoreTable({ data, className }: { data: RadarPoint[]; className?: string }) {
  const t = useT();

  return (
    <div
      className={cn(
        "cg-scrollbar overflow-x-auto rounded-card border border-line bg-surface",
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t("Scores from 0 to 100, one row per area")}</caption>
        <thead>
          <tr className="border-b border-line bg-canvas/60">
            <th scope="col" className="px-4 py-2.5 text-left font-semibold text-heading">
              {t("Area")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold text-heading">
              {t("Score")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold text-heading">
              {t("Answers behind it")}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label} className="border-b border-line last:border-0">
              <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink">
                {point.label}
              </th>
              <td className="px-4 py-2.5 text-right tabular-nums text-ink">{point.score}/100</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                {point.answered}/{point.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
