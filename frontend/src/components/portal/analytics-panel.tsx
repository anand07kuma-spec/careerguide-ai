"use client";

import { useCallback } from "react";
import { ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingPanel, Stat } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import type { AnalyticsBucket } from "@/lib/types";

/**
 * How far through the questionnaire this portal's students got.
 *
 * Every number here is a count of a group, never a row about one child, and the group has
 * to be big enough for a count to be a fact about the group rather than about a named
 * student. When it is not, the server drops the breakdown and says which one in `hidden`,
 * and this screen prints that sentence instead of an empty chart — a missing bar reads as
 * "nobody is in Class 12", which is exactly the wrong thing for a head teacher to believe.
 */
export function AnalyticsPanel({ slug }: { slug: string }) {
  const t = useT();
  const load = useCallback(() => api.analytics(slug), [slug]);
  const { state, data, error, reload } = useResource(load);

  if (state === "loading" && !data) return <LoadingPanel label="Loading the cohort" />;
  if (state === "error" && !data) {
    return <ErrorState description={error} onRetry={reload} retryLabel="Try again" />;
  }
  if (!data) return null;

  const belowFloor = data.cohort_size < data.min_reportable;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <CardHeader
          title="This portal's questionnaire progress"
          description={
            belowFloor
              ? "Too few members to report a breakdown. The totals below are still counts of a group, and nothing here names a child."
              : `Counts of the members of this portal whose answers it may see. A breakdown is withheld when fewer than ${data.min_reportable} people are in it.`
          }
          action={
            <Badge tone={belowFloor ? "warning" : "neutral"}>
              {belowFloor ? t("Sample too small") : t("Reportable")}
            </Badge>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="In the cohort" value={data.cohort_size} />
          <Stat label="Started" value={data.sittings_started} tone="teal" />
          <Stat label="Finished" value={data.sittings_completed} tone="success" />
          <Stat
            label="Shared their own results"
            value={data.shared_results}
            tone="brand"
            hint={t("Only counts children who chose to")}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BucketCard title="By stage" buckets={data.by_stage} empty="No stage breakdown is reportable for this cohort." />
        <BucketCard
          title="By language"
          buckets={data.by_language}
          empty="No language breakdown is reportable for this cohort."
        />
      </div>

      {data.hidden.length > 0 ? (
        <Card className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-mist text-amber-700">
              <ShieldQuestion className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">{t("Withheld to keep the cohort anonymous")}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t("This portal can see these numbers were dropped and why. It cannot see who is inside them.")}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {data.hidden.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function BucketCard({
  title,
  buckets,
  empty,
}: {
  title: string;
  buckets: AnalyticsBucket[];
  empty: string;
}) {
  const t = useT();
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">{t(title)}</h3>
      {buckets.length === 0 ? (
        <p className="text-sm text-muted">{t(empty)}</p>
      ) : (
        <ul className="space-y-2.5">
          {buckets.map((bucket) => (
            <li key={bucket.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-ink">{bucket.label}</span>
                <span className="shrink-0 font-medium tabular-nums text-muted">{bucket.count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${total > 0 ? Math.round((bucket.count / total) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
