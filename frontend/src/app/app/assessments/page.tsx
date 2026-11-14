"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  ClipboardList,
  Compass,
  Info,
  ListChecks,
  Lock,
  Puzzle,
  RotateCcw,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { INSTRUMENT_ORDER, type AssessmentInstrument } from "@/lib/assessments";
import { api } from "@/lib/api";
import { useT, useTf, useUiLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn, relativeTime } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";

const ICONS = {
  interest: Compass,
  personality: Users,
  aptitude: Puzzle,
} as const;

/**
 * One look per questionnaire, three notes in one palette.
 *
 * The colour only ever marks the card's icon and its hint — the title, the numbers
 * and the button keep the same ink as everything else in the app, so the three stay
 * equally readable and the page still reads as one catalogue. Every step is an
 * existing token (`brand`, `teal`, `indigo`), and each one has a dark theme value,
 * so no card invents a colour the rest of the app does not own.
 */
const LOOKS: Record<
  AssessmentInstrument["type"],
  { hint: string; hintColor: string; icon: string; wash: string; watermark: string }
> = {
  interest: {
    hint: "Interests & exploration",
    hintColor: "text-brand-dark",
    icon: "bg-[linear-gradient(150deg,#3b82f6,#1d4ed8)] text-white shadow-[0_12px_26px_-14px_rgba(37,99,235,0.9)]",
    wash: "from-brand-mist/80",
    watermark: "text-brand/10",
  },
  personality: {
    hint: "Work preferences",
    hintColor: "text-teal",
    icon: "bg-[linear-gradient(150deg,#14b8a6,#0f766e)] text-white shadow-[0_12px_26px_-14px_rgba(13,148,136,0.9)]",
    wash: "from-teal-mist/45",
    watermark: "text-teal/10",
  },
  aptitude: {
    hint: "Logic & reasoning",
    hintColor: "text-indigo-700",
    icon: "bg-[linear-gradient(150deg,#6366f1,#4338ca)] text-white shadow-[0_12px_26px_-14px_rgba(67,56,202,0.85)]",
    wash: "from-indigo-100/80",
    watermark: "text-indigo-700/10",
  },
};

/**
 * The three questionnaires, each with this student's own history on it.
 *
 * A set that is already finished shows its result rather than an invite to do it
 * again, because a second sitting of the same questions the next week would produce a
 * second, different number about the same child — and two numbers on one page read
 * like one of them was wrong. Starting over is still there, as the quieter action.
 *
 * The age gate is not decoration: the server refuses a class below the instrument's
 * minimum, and this screen says so on the card instead of offering a button that
 * would fail.
 */
export default function AssessmentsPage() {
  const t = useT();
  const language = useUiLang();
  const { status, isParent } = useSession();
  const router = useRouter();

  // These screens read a child's private answers. A parent lands here from the
  // shared shell, so send them back to their own dashboard instead of a 403.
  useEffect(() => {
    if (status === "ready" && isParent) router.replace("/parent");
  }, [isParent, router, status]);

  const panel = useResource(useCallback(() => api.assessments(language), [language]), status === "ready" && !isParent);
  const instruments = useMemo(() => {
    const rows = panel.data?.instruments ?? [];
    return [...rows].sort(
      (a, b) => INSTRUMENT_ORDER.indexOf(a.type) - INSTRUMENT_ORDER.indexOf(b.type),
    );
  }, [panel.data]);

  return (
    <div className="mx-auto w-full max-w-page px-4 py-6 sm:px-6 sm:py-9">
      {/* One navy room for the invitation, in both themes: the same two light
          sources and faint grid as the dashboard hero, held back so the words stay
          the brightest thing in it. */}
      <section className="relative isolate overflow-hidden rounded-card bg-navy px-5 py-7 text-white shadow-lift sm:px-8 sm:py-9 lg:px-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 cg-aurora opacity-80" />
        <div aria-hidden className="pointer-events-none absolute inset-0 cg-grid-lines opacity-25" />
        <DiscoveryOrbit className="pointer-events-none absolute right-4 top-1/2 hidden w-[300px] -translate-y-1/2 opacity-80 xl:block" />

        <div className="relative">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-light">
            {t("Discover yourself")}
          </p>
          <h1 className="mt-2.5 max-w-xl text-3xl font-semibold tracking-tight xl:max-w-[31rem]">
            {t("Discover what makes you, you.")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 xl:max-w-[31rem]">
            {t(
              "Three short questionnaires about what you are drawn to, how you tend to work, and puzzles you enjoy. Each one takes six to ten minutes, nothing is timed, and every answer saves as you go.",
            )}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55 xl:max-w-[31rem]">
            {t(
              "There are no right answers — the point is to notice what feels true to you, not to pass.",
            )}
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-2xs font-medium text-white/70">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            {t("Self-questionnaires, not diagnoses")}
          </span>
        </div>
      </section>

      {/* The disclaimer, said once and quietly. It is a note beside the page, not
          a barrier in front of it: no warning tint, no icon with an alarm in it. */}
      <section
        aria-label={t("About these questionnaires")}
        className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-surface/80 px-4 py-3.5 print:hidden sm:px-5"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-subtle text-subtle-ink">
          <Info className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-xs font-semibold tracking-wide text-heading">
            {t("About these questionnaires")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {panel.data?.note ??
              t(
                "These questions were written for this app, in house. They are self-questionnaires in the RIASEC and Big Five traditions, not licensed clinical instruments, and they are not a diagnosis, an IQ score, or a prediction about any child.",
              )}
          </p>
        </div>
      </section>

      <section aria-label={t("The three questionnaires")} className="mt-6">
        {panel.state === "loading" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : panel.state === "error" ? (
          <ErrorState
            title="We could not load the questionnaires"
            description={panel.error}
            onRetry={panel.reload}
            retryLabel="Try again"
          />
        ) : instruments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No questionnaires are available right now"
            description="The question bank has not loaded on the server. Your guide, the career catalogue and the interest chat all still work."
            action={
              <LinkButton href="/app/chat" size="sm" variant="outline">
                {t("Talk to your guide")}
              </LinkButton>
            }
          />
        ) : (
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {instruments.map((instrument, index) => (
              <InstrumentCard key={instrument.type} instrument={instrument} index={index} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 print:hidden">
        <Card className="relative overflow-hidden border-teal/20 bg-gradient-to-br from-teal-mist/60 via-surface to-surface p-5 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-teal/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-mist text-teal ring-1 ring-teal/20">
                <Compass className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-snug text-heading">
                  {t("Not ready for a questionnaire?")}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
                  {t(
                    "The interest chat asks nothing but conversation questions, works from class 6 up, and builds the same kind of picture over time. There is no score at the end of it, which is partly the point.",
                  )}
                </p>
              </div>
            </div>
            <LinkButton
              href="/app/interests"
              variant="outline"
              size="md"
              className="shrink-0 self-start bg-surface sm:self-center"
            >
              {t("Discover My Interests")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
          </div>
        </Card>
      </section>
    </div>
  );
}

function InstrumentCard({ instrument, index }: { instrument: AssessmentInstrument; index: number }) {
  const t = useT();
  const tf = useTf();
  const Icon = ICONS[instrument.type];
  const look = LOOKS[instrument.type];
  const latest = instrument.latest;
  const finished = latest?.status === "submitted" && latest.result_id !== null;
  const running = latest?.status === "in_progress";

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift focus-within:border-brand/40 sm:p-0">
      <div className="relative overflow-hidden px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent", look.wash)} />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-3 right-4 select-none text-6xl font-semibold leading-none tracking-tight",
            look.watermark,
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className={cn(
            "relative flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-white/20",
            look.icon,
          )}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <p className={cn("relative mt-4 text-xs font-semibold", look.hintColor)}>{t(look.hint)}</p>
        <h2 className="relative mt-1 text-lg font-semibold leading-snug text-heading break-words">
          {instrument.name}
        </h2>
      </div>

      <div className="flex flex-1 flex-col border-t border-line/70 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-2xs font-medium text-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {tf("About {minutes} minutes", { minutes: instrument.minutes })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-2xs font-medium text-muted">
            <ListChecks className="h-3.5 w-3.5" aria-hidden />
            {tf("{count} questions", { count: instrument.item_count })}
          </span>
        </div>

        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{instrument.blurb}</p>

        <div className="mt-5 space-y-3">
          {latest ? (
            <p className="text-xs leading-relaxed text-muted">
              {finished
                ? tf("Finished {when}", {
                    when: relativeTime(latest.completed_at ?? latest.started_at),
                  })
                : tf("Started {when}, not finished yet", { when: relativeTime(latest.started_at) })}
            </p>
          ) : null}

          {!instrument.available ? (
            <div className="space-y-2">
              <p className="flex items-start gap-2 rounded-xl border border-amber-600/20 bg-warning-mist/60 px-3 py-2 text-xs leading-relaxed text-amber-800">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {instrument.reason ||
                  tf("This set is written for class {min_class} and above.", {
                    min_class: instrument.min_class,
                  })}
              </p>
              {/* Disabled, not hidden-but-broken: the reason is on screen and the
                  button does exactly what it says it cannot do. */}
              <Button size="md" variant="outline" disabled className="w-full justify-center">
                {t("Not available for your class yet")}
              </Button>
            </div>
          ) : finished ? (
            <div className="flex flex-wrap items-center gap-2">
              <LinkButton
                href={`/app/assessments/result/${latest?.result_id}`}
                size="md"
                className="min-w-0 flex-1 justify-center"
              >
                {t("See your result")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
              <LinkButton href={`/app/assessments/${instrument.type}`} variant="ghost" size="md">
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t("Answer again")}
              </LinkButton>
            </div>
          ) : (
            <LinkButton
              href={`/app/assessments/${instrument.type}`}
              size="md"
              className="w-full justify-center"
            >
              {running ? t("Continue where you left off") : t("Start")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * An original line drawing for the hero: a compass with a dotted path arriving at
 * it. Decoration only, in the two accent tones the rest of the page uses, so it
 * carries no meaning a reader would miss if it were not there.
 */
function DiscoveryOrbit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 220" fill="none" aria-hidden className={className}>
      <g stroke="#93C5FD" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="196" cy="110" r="76" strokeWidth="1.2" opacity=".26" />
        <circle cx="196" cy="110" r="54" strokeWidth="1.2" strokeDasharray="2 7" opacity=".2" />
        <circle cx="196" cy="110" r="34" strokeWidth="1.4" opacity=".5" />
        <path d="M196 58v14M196 148v14M144 110h14M234 110h14" strokeWidth="1.2" opacity=".3" />
        <path d="M196 84l7 33-7-6-7 6 7-33Z" fill="#93C5FD" stroke="none" opacity=".9" />
        <path d="M196 136l7-33-7 6-7-6 7 33Z" fill="#2DD4BF" stroke="none" opacity=".55" />
        <path
          d="M84 172c14-24 40-34 62-50 18-13 22-32 32-48"
          strokeDasharray="1.5 7"
          strokeWidth="1.3"
          opacity=".5"
        />
        <circle cx="146" cy="122" r="3.5" strokeWidth="1.3" opacity=".8" />
        <circle cx="178" cy="74" r="3" strokeWidth="1.3" opacity=".65" />
        <circle cx="84" cy="172" r="4.5" strokeWidth="1.3" opacity=".85" />
      </g>
      <g fill="#93C5FD" opacity=".5">
        <circle cx="62" cy="48" r="1.6" />
        <circle cx="262" cy="36" r="1.4" />
        <circle cx="248" cy="188" r="1.5" />
        <circle cx="104" cy="26" r="1.2" />
      </g>
    </svg>
  );
}
