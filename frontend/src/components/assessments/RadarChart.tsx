"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useT } from "@/lib/i18n";

/**
 * The result shape: one spoke per area, 0 at the centre and 100 at the edge.
 *
 * Two things this chart must not do. It must not look like a verdict — so the spokes
 * are the areas' own names and the numbers beside them say how many answers produced
 * the shape. And it must not be the only copy of the data: the same rows are printed
 * as a table for a screen reader, because an SVG polygon carries no meaning to a
 * reader that cannot see it.
 *
 * Only answered areas appear. A dimension with too few answers has no score at all
 * (`score: null`), and drawing it as 0 would invent a flat spoke in a shape a parent
 * reads as "no strength there".
 */
export interface RadarPoint {
  label: string;
  score: number;
  answered: number;
  total: number;
}

export function RadarChart({
  data,
  height = 300,
  className,
}: {
  data: RadarPoint[];
  height?: number;
  className?: string;
}) {
  const t = useT();

  return (
    <div className={className}>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadar data={data} outerRadius="68%">
            <PolarGrid stroke="var(--color-line)" />
            <PolarAngleAxis
              dataKey="label"
              tick={{ fill: "var(--color-muted)", fontSize: 11, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tickCount={5}
              axisLine={false}
              tick={{ fill: "var(--color-muted)", fontSize: 9 }}
            />
            <Radar
              name={t("Your answers")}
              dataKey="score"
              stroke="var(--color-brand)"
              strokeWidth={2}
              fill="var(--color-brand)"
              fillOpacity={0.18}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-brand-light)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as RadarPoint | undefined;
                if (!active || !point) return null;
                return (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-card)]">
                    <p className="font-semibold text-ink">{point.label}</p>
                    <p className="mt-0.5 text-muted">
                      {point.score}/100 · {point.answered}/{point.total}
                    </p>
                  </div>
                );
              }}
            />
          </RechartsRadar>
        </ResponsiveContainer>
      </div>

      {/* The accessible copy of the same figures. */}
      <table className="sr-only">
        <caption>{t("Scores from 0 to 100, one row per area")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("Area")}</th>
            <th scope="col">{t("Score")}</th>
            <th scope="col">{t("Answers behind it")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{point.score}</td>
              <td>
                {point.answered}/{point.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-center text-xs text-muted">
        {t("0 at the centre, 100 at the edge. Fewer answers make a shorter, less reliable spoke.")}
      </p>
    </div>
  );
}
