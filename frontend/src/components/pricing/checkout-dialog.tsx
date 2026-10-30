"use client";

import { useState } from "react";
import { Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { openCheckout } from "@/lib/checkout";
import { useT, useTf } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import type { Payment, PricingPlan } from "@/lib/types";

/**
 * Paying for a plan, in the order the truth requires.
 *
 * 1. The adult attests. `POST /api/payments/create-order` refuses the request without
 *    it (403), and it refuses it because this is a service for children: the person
 *    whose card is used has to say they are an adult paying for this on purpose. The
 *    answer is stored against the order, not once against the account, because a
 *    dispute asks "who agreed to *this* payment?".
 * 2. The server prices the order. Nothing on this screen can set an amount — the only
 *    number sent is a plan code, and the server answers with the order id, the amount
 *    in paise and the publishable key.
 * 3. Razorpay draws the card sheet. This app never sees a card number, which is why
 *    there is no card field here and no card data in the database.
 * 4. The callback is *claimed*, not believed. The three values Checkout hands back go
 *    to `POST /api/payments/verify`, and only the server's HMAC check moves a family
 *    onto a paid plan.
 *
 * The two failure states are kept apart on purpose. A dismissed sheet means nothing
 * happened. A payment the server could not confirm means money may have moved and the
 * family must be told not to try again — the webhook usually settles it within a
 * minute, and the billing screen shows it when it does.
 */

type Step = "attest" | "paying" | "closed" | "problem" | "unconfirmed";

export function CheckoutDialog({
  plan,
  testMode,
  onClose,
  onCaptured,
}: {
  plan: PricingPlan;
  testMode: boolean;
  onClose: () => void;
  /** Called with the server's payment row once the plan is really unlocked. */
  onCaptured: (payment: Payment) => void;
}) {
  const t = useT();
  const tf = useTf();
  const [attested, setAttested] = useState(false);
  const [step, setStep] = useState<Step>("attest");
  const [message, setMessage] = useState<string | null>(null);

  // Only the length of the period is quoted here. The date it ends on is worked out by
  // the server when the payment is captured, and shown on the billing page from that
  // answer — a date this screen calculated from its own clock would be a second source
  // of truth about something the server already decided.
  const days = plan.period_days ?? 0;

  async function pay() {
    setStep("paying");
    setMessage(null);
    try {
      const order = await api.createOrder(plan.code, true);
      await openCheckout(order.checkout, {
        onPaid: (confirmation) => {
          void api
            .verifyPayment(confirmation)
            .then((payment) => onCaptured(payment))
            .catch(() => {
              setStep("unconfirmed");
              setMessage(
                t(
                  "The payment page said it went through, but this server could not confirm it yet. If money left your account it will appear on your billing page within a minute or two. Please do not pay again until it does.",
                ),
              );
            });
        },
        onDismissed: () => {
          setStep("closed");
          setMessage(null);
        },
        onProblem: (text) => {
          setStep("problem");
          // Some of these are this app's own sentences, and one is the word Razorpay's
          // callback carried. A lookup answers with the input when the dictionary has no
          // such key, so a provider's message is never rewritten.
          setMessage(t(text));
        },
      });
    } catch (error: unknown) {
      setStep("problem");
      setMessage(
        error instanceof Error
          ? t(error.message)
          : t("That order could not be started. Nothing has been charged."),
      );
    }
  }

  return (
    <Modal
      open
      onClose={step === "paying" ? () => undefined : onClose}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {t("Pay for")} {t(plan.name)} — {rupees(plan.price_paise)}
          {testMode ? <Badge tone="warning">{t("Test mode")}</Badge> : null}
        </span>
      }
      description={
        days > 0
          ? tf(
              "This buys {plan} for {days} days from the day the payment is captured. It does not renew by itself.",
              { plan: plan.name, days },
            )
          : tf("{plan} is not a subscription, and it does not renew by itself.", {
              plan: plan.name,
            })
      }
      footer={
        step === "attest" ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t("Not now")}
            </Button>
            <Button disabled={!attested} onClick={() => void pay()}>
              {t("Continue to payment")}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>{t("Close")}</Button>
        )
      }
    >
      {step === "paying" ? (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-ink" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          {t(
            "Razorpay's own payment page should be open now. If it is not, a pop-up blocker or a " +
              "content filter is stopping it — nothing has been charged, so close this and try again.",
          )}
        </p>
      ) : (
        <div className="space-y-4">
          {message ? (
            <p
              className="rounded-card border border-danger/30 bg-danger-mist px-3 py-2.5 text-sm leading-relaxed text-red-900"
              role="alert"
            >
              {t(message)}
            </p>
          ) : null}

          {step === "closed" ? (
            <p className="text-sm leading-relaxed text-muted">
              {t("You closed the payment page. Nothing was charged and your plan is unchanged.")}
            </p>
          ) : null}

          <ul className="space-y-2 text-sm leading-relaxed text-ink">
            <li className="flex justify-between gap-3">
              <span className="text-muted">{t("Plan")}</span>
              <span className="font-medium">
                {t(plan.name)} · {rupees(plan.price_paise)}
              </span>
            </li>
            {plan.compare_at_paise && plan.savings_paise > 0 ? (
              <li className="flex justify-between gap-3">
                <span className="text-muted">{t("You save")}</span>
                <span className="font-medium text-brand-dark">
                  {rupees(plan.savings_paise)} ({plan.savings_percent}%)
                </span>
              </li>
            ) : null}
            <li className="flex justify-between gap-3">
              <span className="text-muted">{t("Length")}</span>
              <span className="font-medium">
                {days > 0 ? `${days} ${t("days")}` : t("one payment")}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted">{t("Renews")}</span>
              <span className="font-medium">{t("Never by itself")}</span>
            </li>
          </ul>

          {testMode ? (
            <p className="flex items-start gap-2 rounded-card border border-warning/30 bg-warning-mist px-3 py-2.5 text-xs leading-relaxed text-amber-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t(
                "This server is running on Razorpay's test keys. The card sheet behaves exactly as " +
                  "it does for real, but no money moves and no card is charged.",
              )}
            </p>
          ) : null}

          <Checkbox
            checked={attested}
            disabled={step !== "attest"}
            onChange={(event) => setAttested(event.target.checked)}
            label={t("I am 18 or older, and I am the adult paying for this")}
            description={t(
              "This app is for students. A paid plan can only be bought by an adult who says so " +
                "here, and that answer is kept against this one order.",
            )}
          />

          <p className="text-xs leading-relaxed text-muted">
            {t("Card details go to Razorpay, never to this server.")}{" "}
            <LinkButton href="/refund" variant="ghost" size="sm" className="!px-0 text-brand">
              {t("Refunds and cancellation")}
            </LinkButton>
          </p>
        </div>
      )}
    </Modal>
  );
}
