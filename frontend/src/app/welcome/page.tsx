"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, ClipboardList, MessagesSquare, ShieldCheck } from "lucide-react";
import { GuideAvatar, Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/session";
import { useT } from "@/lib/i18n";

/**
 * The first screen a browser the server has never met is sent to.
 *
 * Before this, a new device was dropped on `/onboarding` — a form — or, worse,
 * on an empty dashboard whose every tile would have 404'd for a profile that does
 * not exist yet. Here it is offered the two real ways in instead: a conversation,
 * or the question sets.
 *
 * Neither link can skip the consent step. The backend refuses to store a profile
 * without it (`POST /api/auth/onboarding` answers 400), so each CTA goes *into*
 * onboarding with the chosen destination remembered, and the one question plus the
 * two tick-boxes stay exactly where they were. This screen adds no account and asks
 * for nothing: the device id was already minted by `SessionProvider` on mount.
 *
 * The copy is deliberately not a promise. "Psychometric test" would describe a
 * licensed instrument, and these are in-house question sets that the app itself
 * labels "self-questionnaires, not diagnoses" — so the CTA names what actually
 * happens, and the note under it says what is stored and what is not.
 */
const WAYS_IN = [
  {
    href: "/onboarding?intent=chat",
    icon: MessagesSquare,
    title: "Start a Conversation (AI Chat)",
    body: "Tell the guide what you like and it explores careers from that. Hindi, English or Hinglish — typing always works, and voice only if you turn it on.",
    after: "You land in the chat",
  },
  {
    href: "/onboarding?intent=assessment",
    icon: ClipboardList,
    title: "Take the Self-Discovery Questions",
    body: "Three short sets about what you are drawn to, how you like to work, and puzzles you enjoy. Six to ten minutes each, nothing timed, no wrong answer.",
    after: "You land in Assessments",
  },
];

export default function WelcomePage() {
  const { status, isParent } = useSession();
  const router = useRouter();
  const t = useT();

  // Someone this device already signed in should not be shown a welcome wall.
  useEffect(() => {
    if (status === "ready") router.replace(isParent ? "/parent" : "/app");
  }, [status, isParent, router]);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Wordmark />
          <Badge tone="neutral">{t("No email, no password")}</Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col items-center text-center">
          <GuideAvatar state="idle" className="h-20 w-20 shrink-0" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
            {t("Welcome to CareerGuide!")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {t("Let's find the right path for you.")}
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {WAYS_IN.map((way) => {
            const Icon = way.icon;
            return (
              <Link
                key={way.href}
                href={way.href}
                className="cg-card group flex flex-col gap-3 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-lift"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark transition-transform group-hover:scale-105">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-base font-semibold leading-tight text-ink">{t(way.title)}</span>
                <span className="text-xs leading-relaxed text-muted">{t(way.body)}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-semibold text-brand-dark">
                  {t(way.after)}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
          {t(
            "Your progress belongs to this browser, not to an account. A parent sees only what you choose to share with them, and you can delete your conversations or leave at any time.",
          )}
        </p>

        <p className="mt-6 text-center text-xs text-muted">
          {t("Here for a child?")}{" "}
          <Link href="/onboarding" className="font-semibold text-brand-dark underline">
            {t("Choose parent instead")}
          </Link>
        </p>
      </main>
    </div>
  );
}
