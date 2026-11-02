"use client";

import { useCallback } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";
import type { OrgKind } from "@/lib/types";

/**
 * The reseller tiers, printed as the catalogue defines them.
 *
 * There is no buy button anywhere on this screen, and it says so in the same sentence as
 * the seat count: every tier in this build carries `purchasable: false` and no price, so a
 * portal that wants more places asks a person rather than a card. A tenant cannot upgrade
 * itself here, which is the point — the ceiling is what stops one school's paste from
 * taking a seat from another's.
 *
 * The tier names, taglines and lines are the platform's own closed catalogue, so they go
 * through the dictionary the way the plan cards on `/pricing` do. The seat count and the
 * price stay on the page; the long list of what is in the box is folded, and the sentence
 * about there being no buy button is said once above the tiers instead of once per card.
 */
export function TierList({ kind, currentCode }: { kind: OrgKind; currentCode: string }) {
  const t = useT();
  const tf = useTf();
  const load = useCallback(() => api.orgTiers(kind), [kind]);
  const { state, data, error, reload } = useResource(load);

  if (state === "loading" && !data) return <LoadingPanel label="Loading the tiers" />;
  if (state === "error" && !data) {
    return <ErrorState description={error} onRetry={reload} retryLabel="Try again" />;
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <CardHeader
        title="Places this portal can hold"
        description="A tier is a ceiling on seats, not a level of service to a child. Nobody's recommendations, answers or report change with the tier their school is on."
      />

      <p className="rounded-2xl border border-line bg-canvas/60 px-4 py-3 text-xs leading-relaxed text-muted">
        {t("There is no buy button on this screen. A bigger tier is arranged with the platform by a person, and no card moves a seat.")}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {data.map((tier) => {
          const current = tier.code === currentCode;
          return (
            <Card
              key={tier.code}
              className={cn("space-y-3", current ? "border-brand ring-1 ring-brand/25" : "")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold text-heading">{t(tier.name)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t(tier.tagline)}</p>
                </div>
                {current ? <Badge tone="brand">{t("In use")}</Badge> : null}
              </div>

              <p className="text-sm text-ink">
                {tf("{n} places", { n: tier.seats })}
                {tier.price_rupees === null
                  ? ` · ${t("no price is set on this platform")}`
                  : ` · ₹${tier.price_rupees}`}
              </p>

              <details className="group rounded-xl border border-line bg-canvas/60 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-brand-dark [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">{t("What this tier includes")}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <ul className="mt-2 space-y-1.5 border-t border-line pt-2 text-sm leading-relaxed">
                  {tier.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                      <span className="min-w-0 break-words">{t(line)}</span>
                    </li>
                  ))}
                  {tier.not_included.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-muted">
                      <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 break-words">{t(line)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          );
        })}
      </div>
    </div>
  );
}