"use client";

import { AlertTriangle, Briefcase, MessagesSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { RadarChart } from "./RadarChart";
import { RoadmapSection } from "./RoadmapSection";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { useT, useTf } from "@/lib/i18n";
import type { AssessmentResult, DimensionTrait } from "@/lib/assessments";
import { cn } from "@/lib/utils";

/**
 * What a questionnaire came back as — and what it does not mean.
 *
 * The order is the honest one: how much was actually answered first, then the shape,
 * then each area with its band and its count, then careers, then the plan those careers
 * point at, then the sentences that bound all of it. A number is never shown without
 * `answered of total` beside it, because "Building and doing 100" from two answers is not
 * the same claim as from five, and the reader cannot tell the difference without being
 * told.
 */

const BAND_TONES: Record<string, "neutral" | "brand" | "teal" | "success" | "warning"> = {
  light: "neutral",
  some: "brand",
  strong: "teal",
  very_strong: "success",
  unknown: "warning",
};

function bandTone(band: string) {
  return BAND_TONES[band] ?? "neutral";
}

export function ResultSummary({
  result,
  onRoadmap,
}: {
  result: AssessmentResult;
  /** Hands the page the result that comes back from the ✨ request. It has to be
   * required: a plan card whose rebuild button had nowhere to put the answer would be
   * exactly the working-looking button this app promises never to ship. */
  onRoadmap: (next: AssessmentResult) => void;
}) {
  const t = useT();
  const tf = useTf();

  const scored = result.traits.filter((entry) => entry.score !== null);
  const unscored = result.traits.filter((entry) => entry.score === null);

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ How much was answered */}
      <Card>
        <CardHeader
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          title="How much you answered"
          description="A shape drawn from a few answers is a weaker shape. This says which it is."
        />
        <div className="mt-4 space-y-3">
          <ProgressBar
            value={result.totals.answered}
            total={result.totals.items}
            tone={result.totals.completeness >= 80 ? "success" : "teal"}
          />
          <p className="text-sm text-muted">
            {tf("{answered} of {total} questions answered ({percent}%)", {
              answered: result.totals.answered,
              total: result.totals.items,
              percent: result.totals.completeness,
            })}
            {result.totals.ignored > 0
              ? ` ${tf("{count} answers could not be scored and were left out.", {
                  count: result.totals.ignored,
                })}`
              : ""}
          </p>
        </div>
      </Card>

      {/* ------------------------------------------------ The shape */}
      <Card>
        <CardHeader
          title={tf("{name}: your shape", { name: result.name })}
          description={
            scored.length < 3
              ? t("Not enough areas are scored yet for the six-sided shape, so each area is listed on its own.")
              : t("One line per area. Longer means more of your strongest answers fell in that area.")
          }
        />
        <div className="mt-4">
          {scored.length >= 3 ? (
            <RadarChart
              data={scored.map((entry) => ({
                label: entry.name,
                score: entry.score ?? 0,
                answered: entry.answered,
                total: entry.total,
              }))}
            />
          ) : (
            <ul className="space-y-4">
              {result.traits.map((entry) => (
                <TraitBar key={entry.dimension} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------ Top areas */}
      <Card>
        <CardHeader
          title="Your strongest areas"
          description={t("Ranked by the answers you gave, not by what anyone expects of you.")}
        />
        <ul className="mt-4 space-y-3">
          {result.top_traits.map((entry, index) => (
            <li key={entry.dimension} className="rounded-2xl border border-line bg-canvas/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-mist text-xs font-semibold text-brand-dark"
                  >
                    {index + 1}
                  </span>
                  {entry.name}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={bandTone(entry.band)}>{entry.band_label}</Badge>
                  <span className="text-xs text-muted">
                    {entry.score}/100 · {entry.answered}/{entry.total}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{entry.blurb}</p>
              {scored.length >= 3 ? (
                <div className="mt-3">
                  <TraitBar entry={entry} bare />
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {unscored.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-warning/30 bg-warning-mist/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              {t("No number yet")}
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
              {unscored.map((entry) => (
                <li key={entry.dimension}>
                  {entry.name} — {entry.band_label} ({entry.answered}/{entry.total})
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              {t(
                "These areas had too few answers to score. They are not low: they are unknown, and answering two more questions in one of them would change that.",
              )}
            </p>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------------------------ Careers */}
      <Card>
        <CardHeader
          icon={<Briefcase className="h-4 w-4" aria-hidden />}
          title="Careers worth a look"
          description={result.career_note}
        />
        {result.careers.length > 0 ? (
          <>
            <ul className="mt-4 space-y-3">
              {result.careers.map((career) => (
                <li key={career.slug}>
                  <Link
                    href={`/app/careers/${encodeURIComponent(career.slug)}`}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-line bg-canvas/60 p-4 transition-colors hover:border-brand/50 hover:bg-surface"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{t(career.title)}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">
                        {tf("A large part of this work is {themes}, which came up among your strongest answers.", {
                          themes:
                            career.matched.length > 1
                              ? tf("{a} and {b}", { a: t(career.matched[0]), b: t(career.matched[1]) })
                              : t(career.matched[0]),
                        })}
                      </span>
                    </span>
                    <Badge tone={career.needs_verification ? "warning" : "success"}>
                      {career.needs_verification ? t("Sample data — verify") : t("Verified source")}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              {t(
                "These are starting points to read about, not admissions advice. Nothing here predicts that you will get in, or that you will like it.",
              )}
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {t(
              "No careers are listed because no area had enough answers to point at one. That is a normal result of doing only a few questions.",
            )}
          </p>
        )}
      </Card>

      {/* ------------------------------------------------ The gap and the plan */}
      <RoadmapSection result={result} onRebuilt={onRoadmap} />

      {/* ------------------------------------------------ What this is not */}
      <Card className="border-teal/30 bg-teal-mist/30">
        <CardHeader title="What these numbers are not" />
        <ul className="mt-3 space-y-2.5">
          {result.caveats.map((caveat, index) => (
            <li key={index} className="flex gap-2 text-sm leading-relaxed text-ink">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal" aria-hidden />
              <span>{caveat}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <LinkButton href="/app/chat" variant="outline" size="sm">
            <MessagesSquare className="h-4 w-4" aria-hidden />
            {t("Talk to your guide about this")}
          </LinkButton>
          <LinkButton href="/app/careers" variant="ghost" size="sm">
            {t("Browse all careers")}
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}

/** One area as a bar. Used for the list view, and under each top area in the chart
 * view where the polygon alone would not show the count. */
function TraitBar({ entry, bare = false }: { entry: DimensionTrait; bare?: boolean }) {
  return (
    <div className={cn(!bare && "rounded-2xl border border-line bg-canvas/60 p-4")}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className={cn("text-sm font-medium", bare ? "text-muted" : "text-ink")}>
          {entry.name}
        </span>
        <span className="text-xs text-muted">
          {entry.score === null ? entry.band_label : `${entry.score}/100 · ${entry.answered}/${entry.total}`}
        </span>
      </div>
      <ProgressBar
        value={entry.score ?? 0}
        total={100}
        tone={entry.score === null ? "teal" : "brand"}
      />
    </div>
  );
}
