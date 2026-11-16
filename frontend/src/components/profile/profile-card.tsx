"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import dreamBigArt from "@/assets/dream-big-art.webp";
import {
  ArrowRight,
  AtSign,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Globe2,
  GraduationCap,
  IndianRupee,
  KeyRound,
  Lightbulb,
  MessagesSquare,
  Minus,
  School,
  Settings2,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { ProfilePhotoControls } from "@/components/profile/profile-photo";
import type { Sitting } from "@/lib/assessments";
import { useT, useTf } from "@/lib/i18n";
import type { ClerkStatus, SignInMethods, StudentProfile, User } from "@/lib/types";
import { AGE_BANDS } from "@/lib/types";
import type { Resource } from "@/lib/use-resource";
import { classLabel, cn } from "@/lib/utils";

const TYPE_ICON: Record<Sitting["assessment_type"], LucideIcon> = {
  interest: ClipboardList,
  personality: MessagesSquare,
  aptitude: BookOpen,
};

const TYPE_TONE: Record<Sitting["assessment_type"], string> = {
  interest: "bg-profile-accent-solid text-white",
  personality: "bg-profile-violet text-on-profile-violet",
  aptitude: "bg-teal-bright text-on-teal",
};

type HistoryResource = Resource<Sitting[]> & { reload: () => void };
type ClerkResource = Resource<ClerkStatus> & { reload: () => void };
type MethodsResource = Resource<SignInMethods> & { reload: () => void };

/** A short written date for a finished assessment, or null when it cannot be read. */
function completedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The month and year an account began, for the account card's last row. */
function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Four-point star, drawn rather than borrowed. Decoration only. */
function GoldStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        d="M12 1.5c.65 5.2 3.85 8.4 9.05 9.05-5.2.65-8.4 3.85-9.05 9.05-.65-5.2-3.85-8.4-9.05-9.05 5.2-.65 8.4-3.85 9.05-9.05Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- hero */

/**
 * The passport page itself: the picture, the name that was given, the class this
 * account is in and the language the guide answers in, then the sentence that
 * turns the page from a record into an invitation. Nothing editable lives here
 * except the photo, which is the one thing a student is most likely to change.
 */
export function ProfileHero({
  user,
  profile,
  languageLabel,
}: {
  user: User | null;
  profile: StudentProfile | null;
  languageLabel: string;
}) {
  const t = useT();
  const classLevel = classLabel(profile?.class_level);

  // No `isolate`: it would trap the photo dialogs in this card's stacking
  // context, below the phone's fixed navigation bar. `overflow-hidden` keeps
  // the decoration inside without creating one.
  return (
    <section
      aria-labelledby="profile-name"
      className="relative overflow-hidden rounded-[26px] border border-profile-accent/45 cg-profile-hero text-white shadow-[0_28px_70px_-36px_rgba(4,16,48,0.85)]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 cg-grid-lines opacity-[0.10]" />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 rounded-full border border-white/10" />
      <div aria-hidden className="pointer-events-none absolute -right-28 top-10 h-80 w-80 rounded-full border border-white/[0.06]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-36 -left-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />

      <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-center lg:gap-5 lg:px-6 lg:py-6 xl:gap-8 xl:px-9">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left lg:gap-4">
          <ProfilePhotoControls user={user} />
          <div className="min-w-0 flex-1">
            <h2
              id="profile-name"
              className="break-words text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[1.75rem] xl:text-4xl"
            >
              {user?.display_name}
            </h2>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-profile-accent-solid px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/25">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
              {t("Student")}
            </span>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-sm font-medium text-white/85 sm:justify-start">
              <span>{classLevel ?? t("Class not set")}</span>
              <span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-4 w-4 text-white/70" aria-hidden />
                {languageLabel}
              </span>
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent lg:h-auto lg:w-px lg:self-stretch lg:bg-gradient-to-b lg:from-white/45 lg:via-white/15 lg:to-profile-gold/45"
        />

        <div className="flex items-center justify-between gap-4 sm:gap-6 lg:w-[15rem] lg:shrink-0 xl:w-[24rem]">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-white sm:text-xl lg:text-base xl:text-xl">
              <span>{t("Dream")}</span>{" "}
              <span className="text-profile-gold">{t("Big...")}</span>
            </p>
            <p className="mt-1.5 max-w-[13.5rem] text-sm leading-relaxed text-white/80 lg:text-[0.8125rem] lg:leading-normal">
              {t("Let's achieve your goals together!")}
            </p>
          </div>
          {/* The artwork carries its own cutout, so it sits straight on the card: the glow is
              the card's royal blue bleeding around it, and the warm pool under the books keeps
              the gold rim from going cold against the navy. */}
          <div className="relative shrink-0">
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[132%] w-[126%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(41,149,255,0.4),rgba(41,149,255,0.12)_56%,transparent_76%)] blur-xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[3%] left-1/2 h-[16%] w-[82%] -translate-x-1/2 rounded-full bg-profile-gold/20 blur-lg"
            />
            <Image
              src={dreamBigArt}
              alt=""
              aria-hidden
              sizes="(min-width: 1280px) 192px, 104px"
              className="relative block h-auto w-[6.5rem] select-none drop-shadow-[0_14px_20px_rgba(2,8,30,0.5)] lg:w-[5.25rem] xl:w-[12rem]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- facts */

/**
 * The three facts a visitor checks first, in one strip. Each value is whatever the
 * profile actually holds; an unset one says so rather than showing a blank or a
 * guess.
 */
export function ProfileFacts({ profile }: { profile: StudentProfile | null }) {
  const t = useT();
  const tf = useTf();
  const ageBand = AGE_BANDS.find((band) => band.value === profile?.age_range);

  const age =
    profile?.age !== null && profile?.age !== undefined
      ? tf("{years} years", { years: profile.age })
      : ageBand
        ? t(ageBand.label)
        : null;

  return (
    <section aria-label={t("Personal & academic details")}>
      <dl className="overflow-hidden rounded-[22px] border border-profile-line cg-profile-panel shadow-[0_16px_36px_-28px_rgba(8,24,64,0.55)] sm:grid sm:grid-cols-3 sm:divide-x sm:divide-profile-line">
        <Fact icon={CalendarDays} label="Age" value={age} />
        <Fact
          icon={School}
          label="School setting"
          value={profile?.education_context ? t(profile.education_context) : null}
        />
        <Fact
          icon={IndianRupee}
          label="Cost situation"
          value={profile?.financial_context ? t(profile.financial_context) : null}
          tone="green"
        />
      </dl>
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  tone?: "blue" | "green";
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-3.5 border-b border-profile-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:px-6 sm:py-5">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_18px_-10px_rgba(8,32,90,0.8)]",
          tone === "green" ? "bg-success-solid" : "bg-profile-accent",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-profile-muted">{t(label)}</dt>
        <dd
          className={cn(
            "mt-0.5 break-words text-sm font-semibold",
            value ? "text-profile-ink" : "font-normal text-profile-muted",
          )}
        >
          {value ?? t("Not specified")}
        </dd>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ history */

export function AssessmentHistory({ sittings }: { sittings: HistoryResource }) {
  const t = useT();
  const tf = useTf();
  const history = sittings.data ?? [];

  return (
    <section
      aria-labelledby="history-heading"
      className="rounded-[24px] border border-profile-line cg-profile-panel p-5 shadow-[0_20px_44px_-32px_rgba(8,24,64,0.6)] sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-profile-accent-solid text-white shadow-[0_10px_22px_-12px_rgba(15,98,214,0.9)]">
            <BarChart3 className="h-5 w-5" aria-hidden />
          </span>
          <h2 id="history-heading" className="text-lg font-semibold text-profile-ink sm:text-xl">
            {t("Assessment History")}
          </h2>
        </div>
        <Link
          href="/app/assessments"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-profile-accent-ink transition-colors hover:text-profile-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-profile-accent"
        >
          {t("View All")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {sittings.state === "loading" ? (
        <div role="status" className="mt-6">
          <span className="sr-only">{t("Reading your finished assessments…")}</span>
          <div aria-hidden className="space-y-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-start gap-3 py-1">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : sittings.state === "error" ? (
        <ErrorState
          title="Your assessment history could not load"
          description={sittings.error}
          onRetry={sittings.reload}
          className="mt-4 rounded-none border-0 bg-transparent px-2 py-8"
        />
      ) : history.length > 0 ? (
        <ol className="relative mt-4">
          <span
            aria-hidden
            className="absolute bottom-8 left-[23px] top-8 w-px bg-profile-track"
          />
          {history.map((sitting) => {
            const Icon = TYPE_ICON[sitting.assessment_type];
            const date = completedDate(sitting.completed_at);
            return (
              <li key={sitting.result_id} className="relative">
                <Link
                  href={`/app/assessments/result/${sitting.result_id}`}
                  className="group flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl px-1.5 py-3.5 transition-colors hover:bg-profile-accent-soft/60 focus-visible:bg-profile-accent-soft/60"
                >
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-profile-card",
                      TYPE_TONE[sitting.assessment_type],
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-profile-ink">
                      {sitting.name}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-profile-muted">
                      {date ? tf("Completed on {date}", { date }) : null}
                      {date ? " · " : null}
                      {tf("{answered} of {total} answers", {
                        answered: sitting.answered,
                        total: sitting.total,
                      })}
                    </span>
                  </span>
                  <span className="ml-12 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-profile-line bg-profile-card px-3.5 py-1.5 text-xs font-semibold text-profile-accent-ink transition-colors group-hover:border-profile-accent/60 group-hover:bg-profile-accent-solid group-hover:text-white sm:ml-0 sm:self-center">
                    {t("Read Result")}
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-col items-center px-2 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-profile-accent-soft text-profile-accent-ink">
            <ClipboardList className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold text-profile-ink">
            {t("No assessment finished yet")}
          </p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-profile-muted">
            {t(
              "An assessment is a short set of questions about what you enjoy and what you find easy. It never gives a verdict on you.",
            )}
          </p>
          <LinkButton href="/app/assessments" size="sm" className="mt-4">
            {t("See the three assessments")}
          </LinkButton>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ account */

/**
 * How this account is held and which doors open it. Read-only on purpose: the
 * switches live in Settings, and a copy here would drift from the page that
 * actually owns them.
 */
export function AccountPanel({
  user,
  clerk,
  methods,
}: {
  user: User | null;
  clerk: ClerkResource;
  methods: MethodsResource;
}) {
  const t = useT();
  const since = memberSince(user?.created_at);

  // The email row is drawn only when there is something true to say about it: a
  // linked address, a deployment that offers one, or a check still in flight. A
  // server that never switched email sign-in on does not get a row announcing it.
  const showEmailRow =
    clerk.state !== "ready" || Boolean(clerk.data?.linked) || Boolean(clerk.data?.available);

  const email =
    clerk.state === "loading"
      ? { label: t("Checking…"), tone: "idle" as const }
      : clerk.state === "error"
        ? { label: t("Could not check"), tone: "warn" as const }
        : clerk.data?.linked
          ? { label: t("Connected"), tone: "on" as const }
          : clerk.data?.available
            ? { label: t("Not connected"), tone: "off" as const }
            : { label: t("Not offered on this server"), tone: "off" as const };

  return (
    <section
      aria-labelledby="account-heading"
      className="rounded-[24px] border border-profile-line cg-profile-panel p-5 shadow-[0_20px_44px_-32px_rgba(8,24,64,0.6)] sm:p-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-profile-accent-solid text-white shadow-[0_10px_22px_-12px_rgba(15,98,214,0.9)]">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <h2 id="account-heading" className="text-lg font-semibold text-profile-ink sm:text-xl">
          {t("Account & Sign-in")}
        </h2>
      </div>

      <dl className="mt-4">
        <AccountRow icon={UserRound} label={t("Account Status")}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-profile-online/15 px-2.5 py-1 text-xs font-semibold text-profile-online">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-profile-online" />
            {t("Active")}
          </span>
        </AccountRow>

        {methods.state === "error" ? (
          <div className="border-b border-profile-line py-3.5">
            <p className="text-xs leading-relaxed text-profile-muted">
              {t("The ways into this account could not be read")}
            </p>
            <button
              type="button"
              onClick={methods.reload}
              className="mt-1 text-xs font-semibold text-profile-accent-ink underline underline-offset-2 hover:text-profile-accent"
            >
              {t("Try again")}
            </button>
          </div>
        ) : (
          <AccountRow icon={KeyRound} label={t("Signed in with Google")}>
            <StatusValue
              on={Boolean(methods.data?.google)}
              label={
                methods.state === "loading"
                  ? t("Checking…")
                  : methods.data?.google
                    ? t("Connected")
                    : t("Not connected")
              }
            />
          </AccountRow>
        )}

        {showEmailRow ? (
          <AccountRow icon={AtSign} label={t("Email sign-in")}>
            <StatusValue on={email.tone === "on"} tone={email.tone} label={email.label} />
            {clerk.state === "error" ? (
              <button
                type="button"
                onClick={clerk.reload}
                className="ml-2 shrink-0 text-xs font-semibold text-profile-accent-ink underline underline-offset-2 hover:text-profile-accent"
              >
                {t("Try again")}
              </button>
            ) : null}
          </AccountRow>
        ) : null}

        <AccountRow icon={CalendarDays} label={t("Member Since")}>
          <span className="text-sm font-semibold text-profile-ink">
            {since ?? t("Not available")}
          </span>
        </AccountRow>
      </dl>

      <Link
        href="/app/settings"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-profile-line bg-profile-card px-4 py-2.5 text-sm font-semibold text-profile-ink transition-colors hover:border-profile-accent/60 hover:text-profile-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-profile-accent"
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        {t("Manage in Settings")}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function AccountRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-profile-line py-3.5 last:border-b-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-profile-accent-soft text-profile-accent-ink">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <dt className="min-w-0 flex-1 text-sm text-profile-ink">{label}</dt>
      <dd className="flex shrink-0 items-center justify-end text-right">{children}</dd>
    </div>
  );
}

function StatusValue({
  on,
  tone = on ? "on" : "off",
  label,
}: {
  on: boolean;
  tone?: "on" | "off" | "idle" | "warn";
  label: string;
}) {
  const look =
    tone === "on"
      ? "text-profile-online"
      : tone === "warn"
        ? "text-warning"
        : "text-profile-muted";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", look)}>
      {on ? (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-profile-online text-white">
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
            <path d="m2.2 6.2 2.4 2.4 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <Minus className="h-3.5 w-3.5" aria-hidden />
      )}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------------ pro tip */

export function ProTipBanner() {
  const t = useT();
  return (
    <section
      aria-label={t("Pro Tip:")}
      className="relative overflow-hidden rounded-[22px] border border-profile-gold/45 cg-profile-panel px-5 py-4 shadow-[0_16px_36px_-28px_rgba(8,24,64,0.55)] sm:px-6"
    >
      <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-profile-gold/15 blur-2xl" />
      <div className="relative flex items-center gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-profile-gold-soft text-profile-gold ring-1 ring-inset ring-profile-gold/40">
          <Lightbulb className="h-5 w-5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-profile-ink">
          <span className="font-semibold text-profile-gold">{t("Pro Tip:")}</span>{" "}
          {t("Keep your profile picture updated to make your account more personal and recognizable.")}
        </p>
        <GoldStar className="hidden h-5 w-5 shrink-0 text-profile-gold sm:block" />
      </div>
    </section>
  );
}
