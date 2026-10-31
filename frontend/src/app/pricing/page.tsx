"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Info, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { JsonLd } from "@/components/seo/json-ld";
import { CheckoutDialog } from "@/components/pricing/checkout-dialog";
import { FeatureTable } from "@/components/pricing/FeatureTable";
import { PlanCard } from "@/components/pricing/PlanCard";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { PillGroup } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import type { PricingPlan } from "@/lib/types";

/**
 * Pricing.
 *
 * Every number on this page is read from `GET /api/payments/plans`, which is served
 * from the same `Plan` objects `entitlements.py` uses to decide whether a child's
 * third chat of the day goes through. Nothing here is typed in — a price list you
 * maintain by hand is where a promise and a rule first diverge, and the family that
 * pays for the divergence is the one that was promised.
 *
 * Three things this page is deliberately honest about:
 *
 * *If the server has no payment keys, it says so and the buttons are disabled. A
 *   pricing page on a deployment that cannot take money should not look like a shop.
 * *If the free plan's caps are not being enforced on this server, it says that too,
 *   rather than advertising a limit that does not bite.
 * *Nothing about careers is for sale. The catalogue — every career, stream, exam,
 *   resource, scholarship and institute — is readable on the free plan and is priced
 *   at zero on every row of the comparison table, because the amount a family can pay
 *   must never decide what a child is allowed to learn about their own future.
 */

const PRINCIPLES = [
  {
    icon: CircleDollarSign,
    title: "The advice does not change with the plan",
    body: "A paid plan buys conversation, questionnaires, a printed document and a parent's view. It cannot buy a career a suggestion, a ranking, or an exam listed ahead of another. There is no sponsored placement anywhere in the catalogue, and the tests check that a recommendation comes out identical before and after a payment.",
  },
  {
    icon: Lock,
    title: "The card never touches this server",
    body: "The payment sheet is Razorpay's own, drawn inside their frame. This application sees an order id, a payment id and a signature, and stores only those three. No card number, no expiry, no CVV, no last four digits — so a leak here could not hand over a card even if it wanted to.",
  },
  {
    icon: ShieldCheck,
    title: "An adult has to say so, every time",
    body: "Before an order is created, the person paying confirms they are 18 or older and are paying for this knowingly. That answer is stored against that one order, because the question a dispute asks is not \"is there an adult somewhere in this family\" but \"who agreed to this payment\".",
  },
  {
    icon: Sparkles,
    title: "Stop paying and nothing is taken away",
    body: "When a paid period ends the account drops to the free plan. Conversations, assessment results and reports already made stay readable and downloadable. A child is never cut off from work they already did because a payment stopped.",
  },
];

/** Questions a parent actually asks before putting in a card. Translated at render. */
const FAQS = [
    {
      q: "Does the plan renew on its own?",
      a: "No. One payment buys one fixed period — 30 days or 365 — and your billing page shows the date it ends. Renewing is a second deliberate click. Real auto-renewal needs the provider's subscription object and a card-on-file mandate, and this build does not have either, so it will never claim to.",
    },
    {
      q: "What happens when the period ends?",
      a: "The account returns to the free plan with its limits. Everything already made stays: chats, assessment results and any report you have already downloaded are still yours. You can renew from the billing page at any time.",
    },
    {
      q: "Can I get a refund?",
      a: "The refund policy page describes the promises this project makes about money back, and every order carries its own receipt so a payment can be identified. Until a real payment account is connected and tested, no refund has been paid and no amount has been taken.",
    },
    {
      q: "Do you sell our data, or share conversations?",
      a: "No. Private conversations are not sold or disclosed to advertisers, and a parent's dashboard shows progress and themes that the student has chosen to share. The privacy policy states what is stored and how to export or delete it.",
    },
    {
      q: "Is the free plan really free?",
      a: "Yes, and the whole career catalogue is free on every plan. The paid plans add conversation volume, repeat questionnaires, a printable PDF report and a guardian's view — never access to information about a path a child might take.",
    },
    {
      q: "The payment page said it worked but my plan has not changed.",
      a: "The browser's answer is only a claim until this server checks its signature, and a provider's confirmation can take a few seconds to arrive. Do not pay again: reload the billing page. If it is still not unlocked after a few minutes, contact us with the receipt number and it can be reconciled.",
    },
    {
      q: "Can a school pay for a whole class?",
      a: "That is the School Plan, and it is priced with a person rather than a checkout form, because there is no per-student count this page can guess. Use the contact page. A licence granted to a school unlocks the same tools and never changes the guidance a student is given.",
    },
    {
      q: "What if I am a student and I want to upgrade myself?",
      a: "Ask an adult to make the payment. The order cannot be created without the attestation, and that is intentional — this is a service for children, and a card should not be reachable by one.",
    },
];

export default function PricingPage() {
  const t = useT();
  const tf = useTf();
  const router = useRouter();
  const toast = useToast();
  const { status, user } = useSession();

  const loadPricing = useCallback(() => api.pricing(), []);
  const pricing = useResource(loadPricing);

  // The current plan is only knowable for a device the server already recognises,
  // and it is only a nicety here: an error must not blank the price list.
  const signedIn = status === "ready" && user !== null;
  const loadBilling = useCallback(() => api.billing(), []);
  const billing = useResource(loadBilling, signedIn);
  const currentCode = billing.data?.plan.plan_code ?? null;

  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [chosen, setChosen] = useState<PricingPlan | null>(null);

  const plans = useMemo(() => pricing.data?.plans ?? [], [pricing.data]);
  const features = pricing.data?.features ?? [];

  /** The card that gets the ring and the second slot: chosen by the toggle, never
   * hiding the other price. Both Pro cards stay on the page whatever is picked,
   * because a switch that hides one price is how a page makes a yearly plan look
   * like the only option. */
  const featuredCode = period === "yearly" ? "pro_yearly" : "pro_monthly";
  const orderedPlans = useMemo(() => {
    const free = plans.filter((plan) => plan.code === "free");
    const priced = plans.filter((plan) => plan.code !== "free" && plan.price_paise !== null);
    const custom = plans.filter((plan) => plan.code !== "free" && plan.price_paise === null);
    const first = priced.find((plan) => plan.code === featuredCode);
    const rest = priced.filter((plan) => plan.code !== featuredCode);
    return [...free, ...(first ? [first] : []), ...rest, ...custom];
  }, [plans, featuredCode]);

  const yearly = plans.find((plan) => plan.code === "pro_yearly");
  const toggleItems = [
    { value: "monthly", label: t("Monthly") },
    {
      value: "yearly",
      label: yearly && yearly.savings_percent > 0
        ? tf("{label} · save {percent}%", { label: t("Yearly"), percent: yearly.savings_percent })
        : t("Yearly"),
    },
  ];

  function choose(plan: PricingPlan) {
    if (!plan.purchasable) return;
    if (!signedIn) {
      // There is no login screen in this app — the device is the account — so an
      // order has nothing to attach to until the one question has been answered.
      toast.toast(t("Answer the first question, then choose a plan."), "info");
      router.push("/onboarding");
      return;
    }
    setChosen(plan);
  }

  const paymentsEnabled = pricing.data?.payments_enabled ?? false;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
        {/* `flex-wrap`, because the two actions need 283px and the row has 343 with the
            wordmark in it: measured on this page at 375px the pair reached x=467, so the
            dashboard button — the only way into the product from here — had its right half
            cut off by the body's overflow guard rather than shown as a scrollbar. Wrapping
            drops both actions onto a line of their own; `ml-auto` keeps them under the right
            edge of the wordmark's line instead of drifting to the left with `justify-between`. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/" aria-label={t("CareerGuide AI home")}>
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LinkButton size="sm" variant="ghost" href="/about">
              {t("How it works")}
            </LinkButton>
            <LinkButton size="sm" variant="outline" href="/app">
              {t("Open your dashboard")}
            </LinkButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <section>
          <Badge tone="teal" className="mb-5">
            {t("Plans and pricing")}
          </Badge>
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
            {t("The conversation can cost money. The information cannot.")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
            {t(
              "Everything about careers — every career, stream, exam, resource, scholarship and institute — is free, and stays free on every plan. A paid plan adds more conversation, more questionnaires, a printed report and a parent's view of progress.",
            )}
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted">
            {t(
              "Prices below are rupee figures the server itself quotes, in paise, and the limits beside them are the ones the server enforces. Nothing on this page is a copy of a number kept somewhere else.",
            )}
          </p>
        </section>

        {pricing.state === "loading" ? (
          <Card className="mt-10">
            <LoadingPanel label={t("Loading the price list")} />
          </Card>
        ) : pricing.state === "error" && !pricing.data ? (
          <Card className="mt-10">
            <ErrorState
              title={t("The price list could not be read")}
              description={
                pricing.error ??
                t("This page shows the server's own prices, and the server is not answering.")
              }
              onRetry={pricing.reload}
              extra={
                <LinkButton href="/contact" variant="outline" size="sm" className="mt-3">
                  {t("Contact")}
                </LinkButton>
              }
            />
          </Card>
        ) : (
          <>
            {/* What the buttons can honestly do, stated before the buttons. */}
            {!paymentsEnabled ? (
              <div className="mt-8 flex items-start gap-3 rounded-card border border-warning/30 bg-warning-mist px-4 py-3.5 text-sm leading-relaxed text-amber-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  {t(
                    "Online payment is not switched on for this deployment. The plans and their " +
                      "limits below are the real ones the server enforces, but no card can be taken " +
                      "here yet, so every upgrade button is disabled rather than pretending.",
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-8 flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3.5 text-sm leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                <p>
                  {pricing.data?.test_mode
                    ? t(
                        "Payment is switched on with Razorpay's test keys on this server. The card " +
                          "sheet behaves as it does for real and no money moves.",
                      )
                    : t(
                        "Payment is switched on. Card details are handled entirely by Razorpay's own " +
                          "payment page; this server keeps an order id, a payment id and a receipt.",
                      )}
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PillGroup items={toggleItems} value={period} onChange={(next) => setPeriod(next as "monthly" | "yearly")} />
              <p className="text-xs leading-relaxed text-muted">
                {t("Both prices stay on the page. This only chooses which one comes first.")}
              </p>
            </div>

            <section aria-label={t("Plans")} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {orderedPlans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  features={features}
                  paymentsEnabled={paymentsEnabled}
                  isCurrent={currentCode === plan.code}
                  recommended={plan.code === featuredCode}
                  onChoose={choose}
                />
              ))}
            </section>

            {!pricing.data?.limits_enforced ? (
              <p className="mt-4 text-xs leading-relaxed text-muted">
                {t(
                  "Note for this deployment: the free plan's caps are published above but are not " +
                    "being switched on yet, so a free account is not currently turned away at its " +
                    "third chat of the day. The numbers describe the plan; enforcement is a " +
                    "setting the operator turns on deliberately.",
                )}
              </p>
            ) : null}

            <section className="mt-12">
              <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
                {t("What each plan includes")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                {t(
                  "The row help text and every cell come from the server, which is why the wording " +
                    "in \"3 chats a day\" is the wording the limiter uses.",
                )}
              </p>
              <div className="mt-5">
                <FeatureTable plans={plans} features={features} currentPlanCode={currentCode} />
              </div>
            </section>
          </>
        )}

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
            {t("Four things that do not change with a plan")}
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-base font-semibold leading-snug text-ink">
                    {t(item.title)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(item.body)}</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
            {t("Questions a parent asks first")}
          </h2>
          <div className="mt-5 space-y-2.5">
            {FAQS.map((item) => (
              <details key={item.q} className="cg-card group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer list-none text-sm font-semibold leading-snug text-ink">
                  {t(item.q)}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(item.a)}</p>
              </details>
            ))}
          </div>
          {/* The structured-data version of the questions below. It is generated
              from the same `FAQS` array the page renders, so an answer cannot be
              updated in one place and left stale in the other — which is the
              failure mode Google's FAQ guidance warns about in practice. It is
              English because the array is English; the visible text is
              translated, the schema is not, and a crawler that cannot read the
              page's language still gets the same answers. */}
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQS.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            }}
          />
        </section>

        <section className="mt-14">
          <Card className="p-6">
            <h2 className="text-lg font-bold tracking-tight text-heading">{t("Before you pay")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {t(
                "Read the refund policy and the terms. This project is a prototype: it is not a " +
                  "replacement for a qualified career counsellor, it makes no promise about " +
                  "admissions, placements or salaries, and it does not claim to be compliant with " +
                  "any law because a feature was built. Those pages say what is real and where the " +
                  "gaps still are.",
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton href="/refund" variant="outline" size="sm">
                {t("Refund policy")}
              </LinkButton>
              <LinkButton href="/terms" variant="outline" size="sm">
                {t("Terms")}
              </LinkButton>
              <LinkButton href="/privacy" variant="outline" size="sm">
                {t("Privacy")}
              </LinkButton>
              <LinkButton href="/contact" variant="outline" size="sm">
                {t("Contact us")}
              </LinkButton>
            </div>
          </Card>
        </section>
      </main>

      {chosen ? (
        <CheckoutDialog
          plan={chosen}
          testMode={pricing.data?.test_mode ?? false}
          onClose={() => setChosen(null)}
          onCaptured={() => {
            setChosen(null);
            toast.success(t("Your plan is unlocked."));
            router.push("/app/billing");
          }}
        />
      ) : null}
    </div>
  );
}
