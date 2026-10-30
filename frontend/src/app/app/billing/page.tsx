"use client";

import { useCallback, useState } from "react";
import { CalendarClock, CreditCard, Info, Receipt, ShieldCheck, Wallet } from "lucide-react";
import { CheckoutDialog } from "@/components/pricing/checkout-dialog";
import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import { billDate, rupees } from "@/lib/money";
import type { Payment, PricingPlan } from "@/lib/types";

/**
 * Billing.
 *
 * Everything on this screen is read from `GET /api/payments/me`, which derives the
 * account's plan from the subscriptions and payments rows rather than from a
 * `is_paid` flag somebody might forget to clear. That matters most in the two cases
 * a family notices: a period that has already ended must show as ended, and a paid
 * period bought by another account in the same family must show as shared rather
 * than as if this account had paid.
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

function UsageRow({ label, value }: { label: string; value: string }) {
  const t = useT();
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-muted">{t(label)}</span>
      <span className="text-sm font-semibold text-ink tabular-nums">{value}</span>
    </li>
  );
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

  async function downgrade() {
    setBusy(true);
    try {
      await api.downgradePlan();
      setConfirmDowngrade(false);
      billing.reload();
      toast.success(t("You are on the free plan now."));
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? t(error.message) : t("The plan could not be changed. Nothing was lost."),
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
          <LoadingPanel label={t("Loading your plan")} />
        </Card>
      ) : billing.state === "error" && !data ? (
        <Card>
          <ErrorState
            description={billing.error ?? t("Your billing details could not be read.")}
            onRetry={billing.reload}
          />
        </Card>
      ) : plan && usage ? (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("Current plan")}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-heading">
                  {t(plan.plan_name)}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
              </div>

              <div className="text-right text-sm">
                {plan.expires_at ? (
                  <>
                    <p className="text-muted">{t("Until")}</p>
                    <p className="font-semibold text-ink">{billDate(plan.expires_at)}</p>
                    <p className="mt-1 text-xs text-muted">
                      {tf("{days} days left", { days: daysLeft(plan.expires_at) ?? 0 })}
                    </p>
                  </>
                ) : plan.source === "free" ? (
                  <p className="text-muted">{t("No end date, nothing to pay")}</p>
                ) : (
                  <p className="text-muted">{t("Does not lapse on its own")}</p>
                )}
              </div>
            </div>

            {/* `active` is false for anyone with no running paid period, which
                includes every account that never paid — so the sentence about a
                period *ending* needs the lapsed plan name as well, or a Free
                student is told their money ran out. */}
            {!plan.active && plan.lapsed_plan ? (
              <>
                <p className="mt-4 rounded-card border border-warning/30 bg-warning-mist px-3 py-2.5 text-sm leading-relaxed text-amber-900">
                  {t(
                    "The paid period on this account has ended, so the account is back on the free " +
                      "plan with its limits. Nothing that was already made has been taken away — " +
                      "conversations, results and reports you generated are still there.",
                  )}
                </p>
                <p className="mt-3 text-sm text-muted">
                  {t("Last paid plan:")} {t(nameFor(plan.lapsed_plan))}
                </p>
              </>
            ) : null}

            {plan.shared_from_family ? (
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                {t(
                  "This paid period was bought on another account in the same family. Its end date " +
                    "is the one shown above, and nobody can unlock it by editing anything in this " +
                    "browser — the server worked it out from the payment it holds.",
                )}
              </p>
            ) : null}

            {/* Only a plan someone bought can be renewed by someone paying. A
                school's granted licence has no payment behind it at all, so the
                sentence would be describing a transaction that never happened. */}
            {currentPlanObject && plan.source === "payment" ? (
              <p className="mt-4 text-sm text-muted">
                {t("This plan renews")}{" "}
                <span className="font-medium text-ink">{t("only if you pay again")}</span>
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {plan.source === "payment" && currentPlanObject?.purchasable ? (
                <Button onClick={() => setChosen(currentPlanObject)} disabled={!data?.payments_enabled}>
                  {t("Renew for another period")}
                </Button>
              ) : null}
              {plan.plan_code !== "pro_yearly" && plan.plan_code !== "pro_monthly" ? (
                <LinkButton
                  href="/pricing"
                  variant={data?.payments_enabled ? "primary" : "outline"}
                >
                  {t("Choose a paid plan")}
                </LinkButton>
              ) : null}
              {plan.source !== "free" ? (
                <Button variant="ghost" onClick={() => setConfirmDowngrade(true)}>
                  {t("Switch to the free plan")}
                </Button>
              ) : null}
              {!data?.payments_enabled ? (
                <p className="w-full text-xs leading-relaxed text-muted">
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
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                icon={<CalendarClock className="h-5 w-5" aria-hidden />}
                title="Used so far"
                description={
                  usage.enforced
                    ? "The caps the server applies to this plan."
                    : "The caps this plan publishes. This server is not enforcing them yet."
                }
              />
              <ul className="mt-4 divide-y divide-line">
                {/* A cap of null is the plan saying "not capped", and an unlimited plan
                    reports its own usage as null rather than as a number. */}
                <UsageRow
                  label="Chats today"
                  value={
                    usage.chats_allowed === null
                      ? t("Unlimited")
                      : tf("{used} of {allowed}", {
                          used: usage.chats_today ?? 0,
                          allowed: usage.chats_allowed,
                        })
                  }
                />
                <UsageRow
                  label="Chats left today"
                  value={
                    usage.chats_left === null
                      ? t("Unlimited")
                      : tf("{n} left", { n: usage.chats_left })
                  }
                />
                <UsageRow
                  label="Questionnaires finished"
                  value={
                    usage.assessments_allowed === null
                      ? tf("{n} so far", { n: usage.assessments_done })
                      : tf("{used} of {allowed}", {
                          used: usage.assessments_done,
                          allowed: usage.assessments_allowed,
                        })
                  }
                />
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                {t(
                  "Counts are read from the conversations and results this account actually has, " +
                    "and a chat day turns over at midnight in India rather than in Greenwich.",
                )}
              </p>
            </Card>

            <Card>
              <CardHeader
                icon={<Wallet className="h-5 w-5" aria-hidden />}
                title="Next payment"
                description="There isn't one, and that is the design."
              />
              <p className="mt-3 text-sm leading-relaxed text-ink">
                {t(
                  "A payment here buys a period with an end date. Nothing charges again by itself, " +
                    "so there is no next billing date to show and nothing to cancel. When the period " +
                    "ends the account moves to the free plan, and renewing is a deliberate click.",
                )}
              </p>
              {plan.expires_at ? (
                <p className="mt-3 text-sm text-muted">
                  {t("Period ends")}{" "}
                  <span className="font-semibold text-ink">{billDate(plan.expires_at)}</span>
                </p>
              ) : null}
            </Card>
          </div>

          <Card>
            <CardHeader
              icon={<Receipt className="h-5 w-5" aria-hidden />}
              title="Payments"
              description="Every order this account has made, paid or not."
            />
            {payments.length === 0 ? (
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {t(
                  "No payment has been made on this account. That is not a failure to load — the " +
                    "list is empty because nothing was charged.",
                )}
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {payments.map((payment: Payment) => (
                  <li
                    key={payment.id}
                    className="rounded-card border border-line bg-canvas/60 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {t(nameFor(payment.plan_code))}
                        {" · "}
                        {rupees(payment.amount_paise)}
                      </p>
                      <Badge tone={STATUS_TONES[payment.status] ?? "neutral"}>
                        {t(STATUS_HELP[payment.status] ?? payment.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted tabular-nums">
                      {billDate(payment.created_at)} · {t("Receipt")}{" "}
                      <span className="font-medium text-ink">{payment.receipt}</span>
                      {payment.payment_id ? ` · ${payment.payment_id}` : ""}
                      {payment.test_mode ? ` · ${t("test")}` : ""}
                    </p>
                    {payment.failure_reason ? (
                      <p className="mt-1 text-xs text-danger">{t(payment.failure_reason)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted">
              {t(
                "These rows hold an order id, a payment id, an amount and a receipt. They hold no " +
                  "card number, no expiry, no CVV and no cardholder name — that part of a payment " +
                  "stays with Razorpay, which is the reason a database here that also holds " +
                  "children's answers could never leak a card.",
              )}
            </p>
          </Card>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("Refunds follow the")}{" "}
            <LinkButton href="/refund" variant="ghost" size="sm" className="!px-0 !h-auto text-brand">
              {t("refund policy")}
            </LinkButton>
          </p>
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
        title={t("Switch to the free plan?")}
        description={t(
          "This stops the paid period early. It does not delete anything you made, and it cannot " +
            "be undone by this page — you would have to pay for a new period to get the features " +
            "back.",
        )}
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
