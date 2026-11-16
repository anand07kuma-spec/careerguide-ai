"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardList,
  Info,
  MessagesSquare,
  Minus,
  Receipt,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { CheckoutDialog } from "@/components/pricing/checkout-dialog";
import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingPanel, Skeleton } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import { billDate, rupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Payment, PricingPlan } from "@/lib/types";

/**
 * Billing & plan.
 *
 * Everything on this screen is read from `GET /api/payments/me`, which derives the
 * account's plan from the subscriptions and payments rows rather than from an
 * `is_paid` flag somebody might forget to clear. That matters most in the two cases
 * a family notices: a period that has already ended must show as ended, and a paid
 * period bought by another account in the same family must show as shared rather
 * than as if this account had paid.
 *
 * The page is laid out as a subscription dashboard, not a receipt list: the plan it
 * is on first, then what the plan is actually being used for, then the plans that
 * exist and the orders this account made. The usage figures say whether this server
 * enforces the plan's caps at all, because a published limit painted as a hard stop
 * is the same kind of lie as a price that does not match the order.
 *
 * There is no "Cancel subscription" button, because nothing here subscribes: a
 * payment buys a fixed period that ends by itself. The two honest controls are
 * therefore Renew — a second deliberate payment for a second period — and Switch to
 * the free plan, which is confirmed in plain words about what it gives up, since
 * switching early gives away days that were already paid for.
 */

const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  captured: "success",
  created: "warning",
  failed: "danger",
};

/** Plain words for the three things a payment row can say about itself. */
const STATUS_HELP: Record<string, string> = {
  captured: "Paid and unlocked",
  created: "Started, not paid yet",
  failed: "Did not go through",
};

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

/** The interval a price is quoted against, from the plan's own field. */
function perPeriod(plan: PricingPlan): string {
  if (plan.price_paise === 0) return "forever";
  if (plan.interval === "monthly") return "a month";
  if (plan.interval === "yearly") return "a year";
  return "";
}

/**
 * A bar that draws only when both numbers are real. `over` turns it amber rather
 * than clipping a larger number into a full-brand bar, so a count above the cap is
 * visibly out of range instead of looking like an ordinary 100%.
 */
function Meter({
  used,
  total,
  over,
  label,
}: {
  used: number;
  total: number;
  over: boolean;
  label: string;
}) {
  const percent = Math.min(100, Math.max(0, Math.round((used / total) * 100)));
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="mt-3 h-2 w-full overflow-hidden rounded-full bg-subtle"
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          over ? "bg-warning" : "bg-brand",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * The cap's own status, kept next to the number it describes: a limit this server
 * enforces, one it merely publishes, or no limit at all.
 */
function CapBadge({ allowed, enforced }: { allowed: number | null; enforced: boolean }) {
  const t = useT();
  if (allowed === null) return <Badge tone="neutral">{t("Not capped")}</Badge>;
  return enforced ? (
    <Badge tone="success">{t("Cap enforced")}</Badge>
  ) : (
    <Badge tone="warning">{t("Published cap, not enforced")}</Badge>
  );
}

/** One plan's feature value, from the same `features` row the pricing page renders. */
function FeatureValue({ value }: { value: boolean | string | undefined }) {
  const t = useT();
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-end">
        <Check className="h-4 w-4 text-brand" aria-hidden />
        <span className="sr-only">{t("Included")}</span>
      </span>
    );
  }
  if (value === false || value === undefined) {
    return (
      <span className="inline-flex items-center justify-end">
        <Minus className="h-4 w-4 text-muted/60" aria-hidden />
        <span className="sr-only">{t("Not included")}</span>
      </span>
    );
  }
  return <span className="font-semibold text-heading">{t(value)}</span>;
}

export default function BillingPage() {
  const t = useT();
  const tf = useTf();
  const toast = useToast();

  const loadBilling = useCallback(() => api.billing(), []);
  const billing = useResource(loadBilling);
  const loadPricing = useCallback(() => api.pricing(), []);
  // The plan objects come from the public price list so the renew button charges
  // exactly the amount that page quotes; `me` says what the account is on.
  const pricing = useResource(loadPricing);

  const [chosen, setChosen] = useState<PricingPlan | null>(null);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = billing.data;
  const plan = data?.plan ?? null;
  const usage = data?.usage ?? null;
  const payments = data?.payments ?? [];
  const currentPlanObject = pricing.data?.plans.find((row) => row.code === plan?.plan_code) ?? null;

  /** Payment rows carry a plan code; the price list turns it back into the name the
   * family was quoted, so a bill never prints `pro_monthly` at a person. */
  const nameFor = (code: string) =>
    pricing.data?.plans.find((row) => row.code === code)?.name ?? code;

  /** Free first, then price ascending, and "talk to us" last. The order is derived
   * from the price list rather than naming plan codes here. */
  const orderedPlans = useMemo(() => {
    const rank = (row: PricingPlan) =>
      row.price_paise === null ? Number.MAX_SAFE_INTEGER : row.price_paise;
    return [...(pricing.data?.plans ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [pricing.data]);

  const daysRemaining = daysLeft(plan?.expires_at ?? null);
  const periodEnded = daysRemaining !== null && daysRemaining < 0;

  const chatsUsed = usage?.chats_today ?? 0;
  const chatsOver =
    usage !== null && usage.chats_allowed !== null && chatsUsed > usage.chats_allowed;
  const assessmentsOver =
    usage !== null &&
    usage.assessments_allowed !== null &&
    usage.assessments_done > usage.assessments_allowed;

  async function downgrade() {
    setBusy(true);
    try {
      await api.downgradePlan();
      setConfirmDowngrade(false);
      billing.reload();
      toast.success(t("You are on the free plan now."));
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "The plan could not be changed. Nothing was lost.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Billing & plan"
      description="What you are on, what it covers, and every payment this account has made."
      badge={
        // `test_mode` is the fail-safe answer of a server with no key at all, so
        // printing it alone would tell a family this site takes money in a
        // sandbox when it cannot take money. It means something only next to a
        // checkout that is actually switched on.
        data?.payments_enabled && data?.test_mode ? (
          <Badge tone="warning" icon={<Info className="h-3.5 w-3.5" aria-hidden />}>
            {t("Test mode — no real money")}
          </Badge>
        ) : null
      }
      action={
        data ? (
          <LinkButton href="/pricing" variant="outline" size="sm">
            {t("See the plans")}
          </LinkButton>
        ) : null
      }
    >
      {billing.state === "loading" && !data ? (
        <Card>
          <LoadingPanel label="Loading your plan" />
        </Card>
      ) : billing.state === "error" && !data ? (
        <Card>
          <ErrorState
            description={billing.error ?? "Your billing details could not be read."}
            onRetry={billing.reload}
          />
        </Card>
      ) : plan && usage ? (
        <div className="space-y-9 sm:space-y-11">
          {/* ------------------------------------------------ plan overview */}
          <section aria-labelledby="plan-overview-heading">
            <h2 id="plan-overview-heading" className="sr-only">
              {t("Current plan")}
            </h2>
            <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-card border border-white/10 bg-navy p-4 text-white shadow-card sm:px-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-brand/25 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-28 left-8 h-56 w-56 rounded-full bg-teal-bright/10 blur-3xl"
              />

              <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                <div className="min-w-0">
                  <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-white/50">
                    {t("Current plan")}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-white">
                    {t(plan.plan_name)}
                  </h3>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {plan.source === "payment" ? (
                      <Badge tone="brand">{t("Bought by an adult here")}</Badge>
                    ) : plan.source === "granted" ? (
                      <Badge tone="teal">{t("Licence granted to you")}</Badge>
                    ) : (
                      <Badge tone="neutral">{t("Free plan")}</Badge>
                    )}
                    {plan.shared_from_family ? (
                      <Badge tone="success">{t("Shared from family")}</Badge>
                    ) : null}
                  </div>

                  {currentPlanObject?.tagline ? (
                    <p className="mt-1.5 max-w-xl text-sm leading-snug text-white/65">
                      {t(currentPlanObject.tagline)}
                    </p>
                  ) : null}

                  {/* `active` is false for anyone with no running paid period, which
                      includes every account that never paid — so the sentence about a
                      period *ending* needs the lapsed plan name as well, or a Free
                      student is told their money ran out. */}
                  {!plan.active && plan.lapsed_plan ? (
                    <div className="mt-4 flex items-start gap-2.5 rounded-control border border-warning/40 bg-warning-mist px-3.5 py-3 text-sm leading-relaxed text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <p>
                          {t(
                            "The paid period on this account has ended, so the account is back on the free " +
                              "plan with its limits. Nothing that was already made has been taken away — " +
                              "conversations, results and reports you generated are still there.",
                          )}
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          {t("Last paid plan:")} {t(nameFor(plan.lapsed_plan))}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {plan.shared_from_family ? (
                    <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-white/60">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" aria-hidden />
                      {t(
                        "This paid period was bought on another account in the same family. Its end date " +
                          "is the one shown above, and nobody can unlock it by editing anything in this " +
                          "browser — the server worked it out from the payment it holds.",
                      )}
                    </p>
                  ) : null}
                </div>

                {/* The period block names only facts the server sent: an end date
                    when there is one, and the absence of an automatic next charge. */}
                <div className="rounded-2xl border border-white/12 bg-white/5 p-2.5">
                  <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-white/50">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    {plan.expires_at ? (periodEnded ? t("Ended") : t("Until")) : t("Plan")}
                  </p>
                  {plan.expires_at ? (
                    <>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {billDate(plan.expires_at)}
                      </p>
                      <p className="mt-0.5 text-xs text-white/60">
                        {daysRemaining === null
                          ? ""
                          : daysRemaining >= 0
                            ? tf("{days} days left", { days: daysRemaining })
                            : t("The period has ended.")}
                      </p>
                    </>
                  ) : plan.source === "free" ? (
                    <p className="mt-1 text-sm font-medium leading-snug text-white/85">
                      {t("No end date, nothing to pay")}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-medium leading-snug text-white/85">
                      {t("Does not lapse on its own")}
                    </p>
                  )}

                  <div className="my-2 h-px bg-white/10" />

                  <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-white/50">
                    {t("Next payment")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white/85">
                    {t("Never by itself")}
                  </p>
                </div>
              </div>

              {/* A Free account has nothing to act on here, so the row is left
                  out rather than drawn empty. Paid and granted plans keep it. */}
              {plan.source !== "free" ? (
                <div className="relative mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
                  {/* Only a plan someone bought can be renewed by someone paying. A
                      school's granted licence has no payment behind it at all, so the
                      button would describe a transaction that never happened. */}
                  {plan.source === "payment" && currentPlanObject?.purchasable ? (
                    <Button
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={() => setChosen(currentPlanObject)}
                      disabled={!data?.payments_enabled}
                    >
                      {t("Renew for another period")}
                    </Button>
                  ) : null}

                  {plan.plan_code !== "pro_yearly" && plan.plan_code !== "pro_monthly" ? (
                    <LinkButton
                      href="/pricing"
                      size="lg"
                      variant={data?.payments_enabled ? "primary" : "outline"}
                      className="w-full sm:w-auto"
                    >
                      {t("Choose a paid plan")}
                    </LinkButton>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setConfirmDowngrade(true)}
                    className="min-h-10 text-sm font-medium text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
                  >
                    {t("Switch to the free plan")}
                  </button>
                </div>
              ) : null}

              {/* A Free card has no control and already says the plan is free,
                  so this notice is only kept where it explains a missing action. */}
              {!data?.payments_enabled && plan.source !== "free" ? (
                <p className="relative mt-2 max-w-2xl text-xs leading-relaxed text-white/55">
                  {plan.source === "payment" && currentPlanObject?.purchasable
                    ? t(
                        "Payment is not switched on for this deployment, so the button above that " +
                          "would take a card is disabled rather than dead.",
                      )
                    : t(
                        "Nothing on this screen takes a card. Online payment is not switched on for " +
                          "this deployment, so the paid plans are described rather than sold.",
                      )}
                </p>
              ) : null}
            </div>
          </section>

          {/* ------------------------------------------------------- usage */}
          <section aria-labelledby="usage-heading">
            <SectionHeading
              id="usage-heading"
              eyebrow="Usage"
              title="What this plan is being used for"
              description="Counted from this account's own conversations and results. A cap that is only published is marked as such, not painted as a wall."
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <article className="cg-card flex flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-mist text-brand-dark">
                      <MessagesSquare className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-heading">{t("Chats today")}</h3>
                      <p className="mt-0.5 text-xs text-muted">{t("Today, counted in India time")}</p>
                    </div>
                  </div>
                  <CapBadge allowed={usage.chats_allowed} enforced={usage.enforced} />
                </div>

                <div className="mt-5">
                  {usage.chats_allowed === null ? (
                    <>
                      <p className="text-3xl font-semibold tracking-tight text-heading">
                        {t("Unlimited")}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted">
                        {t("This plan does not cap conversations.")}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-semibold leading-none tracking-tight text-heading tabular-nums">
                          {chatsUsed}
                        </span>
                        <span className="text-sm font-medium text-muted tabular-nums">
                          / {usage.chats_allowed}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{t("started today")}</p>
                      {usage.chats_allowed > 0 ? (
                        <Meter
                          used={chatsUsed}
                          total={usage.chats_allowed}
                          over={chatsOver}
                          label={t("Chats today")}
                        />
                      ) : null}
                      {chatsOver ? (
                        <p className="mt-2 text-xs font-medium leading-relaxed text-warning">
                          {tf("This account is past the published cap of {n}.", {
                            n: usage.chats_allowed,
                          })}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted">
                          {tf("{n} left", {
                            n: usage.chats_left ?? Math.max(usage.chats_allowed - chatsUsed, 0),
                          })}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </article>

              <article className="cg-card flex flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-teal-mist text-teal">
                      <ClipboardList className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-heading">
                        {t("Questionnaires finished")}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted">
                        {t("Interest, personality and aptitude")}
                      </p>
                    </div>
                  </div>
                  <CapBadge allowed={usage.assessments_allowed} enforced={usage.enforced} />
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold leading-none tracking-tight text-heading tabular-nums">
                      {usage.assessments_done}
                    </span>
                    {usage.assessments_allowed !== null ? (
                      <span className="text-sm font-medium text-muted tabular-nums">
                        / {usage.assessments_allowed}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">{t("finished so far")}</p>

                  {usage.assessments_allowed === null ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      {t("This plan does not cap questionnaires.")}
                    </p>
                  ) : (
                    <>
                      {usage.assessments_allowed > 0 ? (
                        <Meter
                          used={usage.assessments_done}
                          total={usage.assessments_allowed}
                          over={assessmentsOver}
                          label={t("Questionnaires finished")}
                        />
                      ) : null}
                      {assessmentsOver ? (
                        <p className="mt-2 text-xs font-medium leading-relaxed text-warning">
                          {tf("This account is past the published cap of {n}.", {
                            n: usage.assessments_allowed,
                          })}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted">
                          {tf("{n} left", {
                            n: Math.max(
                              usage.assessments_allowed - usage.assessments_done,
                              0,
                            ),
                          })}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </article>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-control border border-line bg-subtle/50 px-4 py-3 text-xs leading-relaxed text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                {t(
                  "Counts are read from the conversations and results this account actually has, " +
                    "and a chat day turns over at midnight in India rather than in Greenwich.",
                )}{" "}
                {!usage.enforced
                  ? t(
                      "The caps shown here are what the plan publishes. This server is not turning " +
                        "anyone away at them yet.",
                    )
                  : null}
              </p>
            </div>
          </section>

          {/* -------------------------------------------------- comparison */}
          <section aria-labelledby="comparison-heading">
            <SectionHeading
              id="comparison-heading"
              eyebrow="Plan"
              title="Compare the plans side by side"
              description="What each plan costs and includes, read from the same price list the checkout uses."
              action={
                <LinkButton href="/pricing" variant="outline" size="sm">
                  {t("See the plans")}
                </LinkButton>
              }
            />

            {pricing.state === "loading" && !pricing.data ? (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-60 rounded-card" />
                ))}
              </div>
            ) : pricing.data ? (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {orderedPlans.map((option, index) => {
                  const isCurrent = option.code === plan.plan_code;
                  // The second plan is the one worth recommending: it is the cheapest
                  // paid option, so it carries the only visual emphasis on the row.
                  const isBestValue = index === 1;
                  const contactOnly = option.price_paise === null;
                  return (
                    <article
                      key={option.code}
                      className={cn(
                        "flex h-full flex-col rounded-card border bg-surface p-3.5",
                        isBestValue
                          ? "relative border-brand/60 bg-brand-mist/70 ring-1 ring-brand/25 shadow-[0_18px_40px_-24px_rgba(37,99,235,0.55)]"
                          : isCurrent
                            ? "border-brand/45 bg-brand-mist/20 ring-1 ring-brand/20"
                            : "border-line",
                      )}
                    >
                      {isBestValue ? (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-white shadow-sm">
                          {t("Best value")}
                        </span>
                      ) : null}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold leading-snug text-heading">
                          {t(option.name)}
                        </h3>
                        {isCurrent ? <Badge tone="brand">{t("Your plan")}</Badge> : null}
                      </div>

                      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span className="text-xl font-semibold tracking-tight text-heading tabular-nums">
                          {contactOnly ? t("Talk to us") : rupees(option.price_paise)}
                        </span>
                        {!contactOnly ? (
                          <span className="text-xs font-medium text-muted">
                            {t(perPeriod(option))}
                          </span>
                        ) : null}
                      </p>

                      {option.tagline ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">
                          {t(option.tagline)}
                        </p>
                      ) : null}

                      <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs">
                        {(pricing.data?.features ?? []).map((row) => (
                          <li key={row.key} className="flex items-start justify-between gap-3">
                            <span className="min-w-0 flex-1 leading-snug text-muted">{t(row.label)}</span>
                            <span className="max-w-[50%] shrink-0 text-right leading-snug">
                              <FeatureValue value={option.features[row.key]} />
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto pt-3">
                        {isCurrent ? (
                          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-dark">
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            {t("This is your plan")}
                          </p>
                        ) : contactOnly ? (
                          <LinkButton
                            href="/contact"
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            {t("Ask about school licences")}
                          </LinkButton>
                        ) : (
                          <LinkButton href="/pricing" variant="outline" size="sm" className="w-full">
                            {t("See the plans")}
                          </LinkButton>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <Card className="mt-5">
                <ErrorState
                  title="The price list could not be read"
                  description={
                    pricing.error ??
                    "This page shows the server's own prices, and the server is not answering."
                  }
                  onRetry={pricing.reload}
                />
              </Card>
            )}
          </section>

          {/* ---------------------------------------------- payment history */}
          <section aria-labelledby="payments-heading">
            <SectionHeading
              id="payments-heading"
              eyebrow="Billing"
              title="Payment history"
              description="Every order this account has made, paid or not."
            />

            {payments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                className="mt-5"
                title="No payments yet"
                description="No payment has been made on this account. That is not a failure to load — the list is empty because nothing was charged."
              />
            ) : (
              <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface shadow-card">
                <table className="hidden w-full border-collapse text-sm md:table">
                  <thead className="border-b border-line bg-canvas/60 text-left text-2xs font-semibold uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 sm:px-5">
                        {t("Plan")}
                      </th>
                      <th scope="col" className="px-4 py-3 sm:px-5">
                        {t("Receipt")}
                      </th>
                      <th scope="col" className="px-4 py-3 sm:px-5">
                        {t("Date")}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right sm:px-5">
                        {t("Amount")}
                      </th>
                      <th scope="col" className="px-4 py-3 sm:px-5">
                        {t("Status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payments.map((payment: Payment) => (
                      <tr key={payment.id} className="align-top">
                        <td className="px-4 py-3.5 sm:px-5">
                          <p className="font-medium leading-snug text-ink">
                            {t(nameFor(payment.plan_code))}
                          </p>
                          <p className="mt-0.5 break-all font-mono text-2xs text-muted">
                            {payment.order_id}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 sm:px-5">
                          <p className="break-all font-mono text-xs text-ink">{payment.receipt}</p>
                          {payment.payment_id ? (
                            <p className="mt-0.5 break-all font-mono text-2xs text-muted">
                              {payment.payment_id}
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted sm:px-5">
                          {billDate(payment.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-ink tabular-nums sm:px-5">
                          {rupees(payment.amount_paise)}
                        </td>
                        <td className="px-4 py-3.5 sm:px-5">
                          <Badge tone={STATUS_TONES[payment.status] ?? "neutral"}>
                            {t(STATUS_HELP[payment.status] ?? payment.status)}
                          </Badge>
                          {payment.test_mode ? (
                            <p className="mt-1 text-2xs text-muted">{t("test")}</p>
                          ) : null}
                          {payment.failure_reason ? (
                            <p className="mt-1 text-xs leading-relaxed text-danger">
                              {t(payment.failure_reason)}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <ul className="divide-y divide-line md:hidden">
                  {payments.map((payment: Payment) => (
                    <li key={payment.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {t(nameFor(payment.plan_code))}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {billDate(payment.created_at)}
                          </p>
                        </div>
                        <Badge tone={STATUS_TONES[payment.status] ?? "neutral"}>
                          {t(STATUS_HELP[payment.status] ?? payment.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between gap-3">
                        <p className="min-w-0 break-all font-mono text-2xs text-muted">
                          {t("Receipt")} {payment.receipt}
                          {payment.payment_id ? ` · ${payment.payment_id}` : ""}
                        </p>
                        <p className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                          {rupees(payment.amount_paise)}
                        </p>
                      </div>
                      {payment.test_mode ? (
                        <p className="mt-1 text-2xs text-muted">{t("test")}</p>
                      ) : null}
                      {payment.failure_reason ? (
                        <p className="mt-1 text-xs leading-relaxed text-danger">
                          {t(payment.failure_reason)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-muted">
              {t(
                "These rows hold an order id, a payment id, an amount and a receipt. They hold no " +
                  "card number, no expiry, no CVV and no cardholder name — that part of a payment " +
                  "stays with Razorpay, which is the reason a database here that also holds " +
                  "children's answers could never leak a card.",
              )}
            </p>
          </section>

          {/* -------------------------------------------------------- refund */}
          <section aria-labelledby="refund-heading">
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-teal-mist text-teal">
                  <RotateCcw className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 id="refund-heading" className="text-base font-semibold text-heading">
                    {t("Refunds and cancellation")}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
                    {t(
                      "The refund policy says what happens to money already paid, and every order " +
                        "above carries a receipt that identifies it.",
                    )}
                  </p>
                </div>
              </div>
              <LinkButton
                href="/refund"
                variant="outline"
                size="sm"
                className="self-start sm:self-auto"
              >
                {t("Refund policy")}
              </LinkButton>
            </Card>
          </section>
        </div>
      ) : null}

      {chosen ? (
        <CheckoutDialog
          plan={chosen}
          testMode={data?.test_mode ?? false}
          onClose={() => setChosen(null)}
          onCaptured={() => {
            setChosen(null);
            billing.reload();
            toast.success(t("Your plan is unlocked."));
          }}
        />
      ) : null}

      <Modal
        open={confirmDowngrade}
        onClose={() => setConfirmDowngrade(false)}
        title="Switch to the free plan?"
        description={
          "This stops the paid period early. It does not delete anything you made, and it cannot " +
            "be undone by this page — you would have to pay for a new period to get the features " +
            "back."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDowngrade(false)}>
              {t("Keep my plan")}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void downgrade()}>
              {t("Switch to free")}
            </Button>
          </>
        }
      >
        <ul className="space-y-2 text-sm leading-relaxed text-ink">
          <li>
            {t("Given up:")}{" "}
            {[
              // What the current plan *has* is what switching gives up — the feature
              // flags read from the plan the server is enforcing right now.
              plan?.pdf_reports ? t("printable PDF reports") : null,
              plan?.parent_dashboard ? t("the parent dashboard") : null,
              plan
                ? plan.daily_chats === null
                  ? t("unlimited chats")
                  : tf("{n} chats a day", { n: plan.daily_chats })
                : null,
              plan
                ? plan.total_assessments === null
                  ? t("every questionnaire, repeatable")
                  : tf("{n} questionnaires in total", { n: plan.total_assessments })
                : null,
            ]
              .filter(Boolean)
              .join(", ") || t("nothing, because this plan is not capped")}
          </li>
          {plan?.expires_at ? (
            <li className="text-muted">
              {tf("The period you already paid for would have lasted until {date}.", {
                date: billDate(plan.expires_at),
              })}
            </li>
          ) : null}
        </ul>
      </Modal>
    </Screen>
  );
}
