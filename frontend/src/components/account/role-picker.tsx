"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import getStartedArt from "@/assets/get-started-art.webp";
import getStartedArtPortrait from "@/assets/get-started-art-portrait.webp";
import { Wordmark } from "@/components/brand";
import { SiteHeader } from "@/components/layout/site-header";
import { Button, LinkButton } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { student: "Student", parent: "Parent" };

const ROLE_POINTS: Record<Role, string[]> = {
  student: [
    "Explore interests, subjects, strengths and careers.",
    "Talk in Hindi, English or Hinglish — typing always works.",
    "Keep your own reports, recommendations and next steps.",
  ],
  parent: [
    "Understand the career options your child is exploring.",
    "Support decisions with cost-aware, pressure-free guidance.",
    "See only what your child agrees to share.",
  ],
};

/**
 * The one question asked before login or signup.
 *
 * The chosen role is carried into both flows as `?role=`, but it is never more than a
 * preference: the dashboard after login is chosen from the account the server returns,
 * not from this URL. A parent cannot become linked to a child by picking a card.
 */
export function RolePicker() {
  const t = useT();
  const router = useRouter();
  const { status, isParent } = useSession();
  const [role, setRole] = useState<Role | null>(null);

  // Somebody this device already knows should go to their own dashboard rather
  // than choose a role for a second account.
  useEffect(() => {
    if (status === "ready") router.replace(isParent ? "/parent" : "/app");
  }, [status, isParent, router]);

  // `?role=parent` may preselect a card when a visitor arrives from a role-specific
  // link, but nothing else about the page depends on it.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("role");
    // Read after mount so the server-rendered page and the first client render
    // agree, then preselect the card the visitor arrived with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (param === "student" || param === "parent") setRole(param);
  }, []);

  const roleCards: {
    value: Role;
    icon: typeof UserRound;
    title: string;
    subtitle: string;
    tone: string;
  }[] = [
    {
      value: "student",
      icon: UserRound,
      title: t("Student"),
      subtitle: t("For students in Classes 6–12"),
      tone: "bg-brand-mist text-brand-dark",
    },
    {
      value: "parent",
      icon: Users,
      title: t("Parent"),
      subtitle: t("For parents who want to support their child's journey"),
      tone: "bg-teal-mist text-teal",
    },
  ];

  return (
    <div className="relative isolate min-h-dvh bg-canvas">
      <div
        aria-hidden
        className="cg-getstarted-art pointer-events-none fixed inset-0 -z-10"
      >
        <Image
          src={getStartedArt}
          alt=""
          fill
          priority
          sizes="100vw"
          className="cg-art-wide object-cover object-center"
        />
        <Image
          src={getStartedArtPortrait}
          alt=""
          fill
          sizes="100vw"
          className="cg-art-tall object-cover object-center"
        />
        <span className="cg-getstarted-wash" />
      </div>

      <SiteHeader
        width="focus"
        skipTo="#main-content"
        skipLabel={t("Skip to content")}
        innerClassName="justify-center"
      >
        <Wordmark />
      </SiteHeader>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-focus px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-mist px-3.5 py-1.5 text-xs font-semibold text-brand-dark">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("Get started")}
          </span>
          <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-heading sm:text-4xl">
            {t("How would you like to use CareerGuide?")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {t(
              "Choose Student or Parent. Next you can create an account or open one you already have.",
            )}
          </p>
        </div>

        <fieldset className="mt-8 border-0 p-0">
          <legend className="sr-only">{t("How would you like to use CareerGuide?")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {roleCards.map((option) => {
              const Icon = option.icon;
              const selected = role === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer flex-col rounded-card border p-5 text-left transition-all focus-within:ring-2 focus-within:ring-brand/25",
                    selected
                      ? "border-brand bg-brand-mist/50 shadow-lift"
                      : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-card",
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={selected}
                    onChange={() => setRole(option.value)}
                    className="sr-only"
                  />
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "inline-flex h-11 w-11 items-center justify-center rounded-2xl",
                        option.tone,
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
                        selected
                          ? "border-brand bg-brand-solid text-on-brand"
                          : "border-line bg-canvas text-transparent",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <span className="mt-4 block text-lg font-semibold tracking-tight text-heading">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{option.subtitle}</span>
                  <ul className="mt-4 space-y-2">
                    {ROLE_POINTS[option.value].map((point) => (
                      <li key={point} className="flex gap-2 text-xs leading-relaxed text-ink">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
                        <span>{t(point)}</span>
                      </li>
                    ))}
                  </ul>
                </label>
              );
            })}
          </div>
        </fieldset>

        <p aria-live="polite" className="mt-4 text-center text-sm text-muted">
          {role
            ? t(`Selected: ${ROLE_LABEL[role]}. Continue below.`)
            : t("Choose one to continue.")}
        </p>

        <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          {role ? (
            <LinkButton size="lg" href={`/login?role=${role}`} className="w-full sm:w-auto">
              {role === "parent" ? t("Create a parent account") : t("Create a student account")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
          ) : (
            <Button size="lg" disabled className="w-full sm:w-auto">
              {t("Create an account")}
            </Button>
          )}
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-card border border-line bg-surface p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
          <p className="text-xs leading-relaxed text-muted">
            {t(
              "Your choice only sets up the right experience. Your account's real role, checked by the server, decides which dashboard opens — and a parent is never linked to a student without the student's sharing code and consent.",
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          {t("New to CareerGuide?")}{" "}
          <Link className="font-semibold text-brand-dark underline-offset-4 hover:underline" href="/careers">
            {t("Explore careers first")}
          </Link>
        </p>
      </main>
    </div>
  );
}
