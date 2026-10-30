"use client";

import { Check, Minus } from "lucide-react";
import { useT, useTNumeric } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import type { FeatureRow, PricingPlan } from "@/lib/types";

/**
 * The comparison table.
 *
 * It is rendered from the same `features` rows and the same plan objects the cards
 * above it use, and the row help text comes from the server too, so a change to a
 * limit or to the wording of a row appears in both places from one edit. The brief
 * asked for a comparison table; the reason it is built from the API rather than
 * typed in here is that a table somebody maintains by hand is the place where a
 * promised "3 chats a day" and an enforced "5 chats a day" first disagree.
 *
 * On a phone the columns scroll sideways while the row labels stay, because four
 * plans squeezed into 375px would either wrap every word or shrink the type below
 * what a parent can read.
 */

function Cell({ value }: { value: boolean | string | undefined }) {
  const t = useT();
  const tn = useTNumeric();
  if (value === true) {
    return (
      <>
        <Check className="mx-auto h-4 w-4 text-brand" aria-hidden />
        <span className="sr-only">{t("Included")}</span>
      </>
    );
  }
  if (value === false || value === undefined) {
    return (
      <>
        <Minus className="mx-auto h-4 w-4 text-muted/60" aria-hidden />
        <span className="sr-only">{t("Not included")}</span>
      </>
    );
  }
  return <>{tn(value)}</>;
}

export function FeatureTable({
  plans,
  features,
  currentPlanCode,
}: {
  plans: PricingPlan[];
  features: FeatureRow[];
  currentPlanCode: string | null;
}) {
  const t = useT();

  return (
    <div className="cg-scrollbar overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">
          {t("What each plan includes")}
        </caption>
        <thead>
          <tr className="border-b border-line bg-canvas/60">
            <th scope="col" className="sticky left-0 z-10 bg-canvas px-4 py-3 text-left font-semibold text-heading">
              {t("Feature")}
            </th>
            {plans.map((plan) => (
              <th
                key={plan.code}
                scope="col"
                className="px-4 py-3 text-center align-top font-semibold text-heading"
              >
                <span className="block">{t(plan.name)}</span>
                <span className="mt-0.5 block text-xs font-medium text-muted tabular-nums">
                  {plan.price_paise === null
                    ? t("Custom")
                    : plan.price_paise === 0
                      ? t("Free")
                      : rupees(plan.price_paise)}
                </span>
                {currentPlanCode === plan.code ? (
                  <span className="mt-1 block text-[11px] font-semibold text-brand-dark">
                    {t("Your plan")}
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((row) => (
            <tr key={row.key} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                className="sticky left-0 z-10 max-w-xs bg-surface px-4 py-3 text-left font-medium text-ink"
              >
                <span className="block leading-snug">{t(row.label)}</span>
                <span className="mt-1 block text-xs font-normal leading-relaxed text-muted">
                  {t(row.help)}
                </span>
              </th>
              {plans.map((plan) => (
                <td
                  key={plan.code}
                  className="px-4 py-3 text-center leading-snug text-ink"
                >
                  <Cell value={plan.features[row.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
