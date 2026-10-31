"use client";

import { BadgeIndianRupee, Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { perMonthAmount, rupees } from "@/lib/money";
import { useT, useTf, useTNumeric } from "@/lib/i18n";
import type { FeatureRow, PricingPlan } from "@/lib/types";

/**
 * One plan, priced and limited exactly as the server says.
 *
 * Nothing here is typed into the file. The number, the period and every limit row
 * come from `GET /api/payments/plans`, which is served from the same objects the
 * enforcement in `entitlements.py` reads. That is the only way the promise on this
 * card and the rule applied to a child's chat can be the same fact rather than two
 * copies of it that drift apart.
 *
 * The button is honest about the three possible states of this deployment: a plan
 * that can be bought, a plan this account is already on, and a plan that cannot be
 * bought here because the server has no payment keys configured. The third is
 * printed as disabled text, never as a live-looking "Upgrade".
 */

/** The period a price is quoted against, from the plan's own interval, never assumed. */
function perPeriod(plan: PricingPlan): string {
  if (plan.code === "free") return "forever";
  if (plan.interval === "monthly") return "a month";
  if (plan.interval === "yearly") return "a year";
  return "";
}

export function PlanCard({
  plan,
  features,
  paymentsEnabled,
  isCurrent,
  recommended,
  busy,
  onChoose,
}: {
  plan: PricingPlan;
  /** The rows of the comparison table, in the same order, so the two agree on screen. */
  features: FeatureRow[];
  paymentsEnabled: boolean;
  isCurrent: boolean;
  recommended?: boolean;
  busy?: boolean;
  onChoose: (plan: PricingPlan) => void;
}) {
  const t = useT();
  const tf = useTf();
  const tn = useTNumeric();
  const paid = plan.price_paise !== null && plan.price_paise > 0;
  const buyable = plan.purchasable && paymentsEnabled;
  const months = plan.interval === "yearly" ? 12 : 1;
  const needsContact = plan.cta === "contact";

  return (
    <div
      className={`cg-card flex h-full flex-col p-5 ${
        recommended ? "ring-2 ring-brand" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-tight text-heading">{t(plan.name)}</h3>
        {isCurrent ? <Badge tone="success">{t("Current")}</Badge> : null}
        {!isCurrent && recommended ? <Badge tone="brand">{t("Most chosen")}</Badge> : null}
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(plan.tagline)}</p>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* No `tracking-tight`: this span holds either numerals or, on the plan with no
            published price, the words "Talk to us" — and negative letter-spacing at 30px
            pulls a Devanagari matra off the consonant it belongs to. On ₹2,499 the tightening
            was worth less than a pixel. */}
        <span className="text-3xl font-bold text-ink tabular-nums">
          {plan.price_paise === null ? t("Talk to us") : rupees(plan.price_paise)}
        </span>
        {plan.price_paise !== null && plan.price_paise > 0 ? (
          <span className="text-sm font-medium text-muted">{t(perPeriod(plan))}</span>
        ) : null}
      </div>

      {/* Both savings figures are computed server-side from the two real prices, so
          "30% off" here is arithmetic on ₹2,499 against ₹299 × 12, not a claim. */}
      {plan.savings_paise > 0 ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-brand-dark">
          <BadgeIndianRupee className="h-4 w-4" aria-hidden />
          <span className="font-semibold">
            {t("Save")} {rupees(plan.savings_paise)}
          </span>
          <s className="text-muted tabular-nums">{rupees(plan.compare_at_paise)}</s>
          <span className="text-muted">
            ({plan.savings_percent}% {t("off")}) ·{" "}
            {tf("about {amount} a month", { amount: perMonthAmount(plan.price_paise, months) })}
          </span>
        </p>
      ) : null}
      {plan.price_paise === 0 ? (
        <p className="mt-1 text-sm text-muted">{t("No card, no commitment.")}</p>
      ) : null}

      <ul className="mt-5 space-y-2.5 text-sm">
        {features.map((row) => {
          const value = plan.features[row.key];
          const included = value === true;
          const excluded = value === false || value === undefined;
          return (
            <li key={row.key} className="flex items-start gap-2.5 leading-snug">
              {excluded ? (
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted/60" aria-hidden />
              ) : (
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${included ? "text-brand" : "text-teal"}`}
                  aria-hidden
                />
              )}
              <span className={`min-w-0 ${excluded ? "text-muted" : "text-ink"}`}>
                {t(row.label)}
                {typeof value === "string" ? (
                  <span className="font-semibold text-heading"> — {tn(value)}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-1 flex-col justify-end gap-2 pt-2">
        {isCurrent ? (
          <Button variant="outline" size="lg" disabled>
            {t("This is your plan")}
          </Button>
        ) : needsContact ? (
          <LinkButton href="/contact" variant="outline" size="lg">
            {t("Ask about school licences")}
          </LinkButton>
        ) : !paid ? (
          <LinkButton href="/app" variant="outline" size="lg">
            {t("Start free")}
          </LinkButton>
        ) : buyable ? (
          <Button
            variant={recommended ? "primary" : "secondary"}
            size="lg"
            loading={busy}
            onClick={() => onChoose(plan)}
          >
            {t("Upgrade")}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="lg" disabled>
              {t("Upgrades are not open yet")}
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              {t(
                "Online payment is not switched on for this deployment, so this button does " +
                  "nothing yet. Everything this plan promises is still free to read about.",
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
