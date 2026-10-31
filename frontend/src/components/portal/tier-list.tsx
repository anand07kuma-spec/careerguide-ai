"use client";

import { useCallback } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
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
 */
export function TierList({ kind, currentCode }: { kind: OrgKind; currentCode: string }) {
  const t = useT();
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {data.map((tier) => {
          const current = tier.code === currentCode;
          return (
            <Card
              key={tier.code}
              className={cn("space-y-3", current ? "border-brand ring-1 ring-brand/25" : "")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-ink">{tier.name}</h3>
                  <p className="mt-1 text-sm text-muted">{tier.tagline}</p>
                </div>
                {current ? <Badge tone="brand">{t("In use")}</Badge> : null}
              </div>

              <p className="text-sm text-ink">
                {tier.seats} {t("places")}
                {tier.price_rupees === null
                  ? ` · ${t("no price is set on this platform")}`
                  : ` · ₹${tier.price_rupees}`}
              </p>

              <ul className="space-y-1.5 text-sm">
                {tier.includes.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {line}
                  </li>
                ))}
                {tier.not_included.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-muted">
                    <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>

              <p className="rounded-xl bg-canvas px-3 py-2 text-xs leading-relaxed text-muted">
                {t("There is no buy button on this screen. A bigger tier is arranged with the platform by a person, and no card moves a seat.")}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
