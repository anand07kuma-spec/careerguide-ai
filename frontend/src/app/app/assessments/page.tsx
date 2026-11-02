"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Compass, Lock, Puzzle, RotateCcw, Users } from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { INSTRUMENT_ORDER, type AssessmentInstrument } from "@/lib/assessments";
import { api } from "@/lib/api";
import { useT, useTf, useUiLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { relativeTime } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";

const ICONS = {
  interest: Compass,
  personality: Users,
  aptitude: Puzzle,
} as const;

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
    <Screen
      title="Assessments"
      description="Three short questionnaires about what you are drawn to, how you tend to work, and puzzles you enjoy. Each one takes six to ten minutes, nothing is timed, and every answer saves as you go."
      badge={
        <Badge tone="teal" icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}>
          {t("Self-questionnaires, not diagnoses")}
        </Badge>
      }
    >
      <div className="space-y-5">
        <p className="rounded-2xl border border-line bg-surface/70 px-4 py-3 text-sm leading-relaxed text-muted print:hidden">
          {panel.data?.note ??
            t(
              "These questions were written for this app, in house. They are self-questionnaires in the RIASEC and Big Five traditions, not licensed clinical instruments, and they are not a diagnosis, an IQ score, or a prediction about any child.",
            )}
        </p>

        {panel.state === "loading" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {instruments.map((instrument) => (
              <InstrumentCard key={instrument.type} instrument={instrument} />
            ))}
          </div>
        )}

        <Card className="print:hidden">
          <CardHeader
            icon={<Compass className="h-4 w-4" aria-hidden />}
            title="Not ready for a questionnaire?"
            description={t(
              "The interest chat asks nothing but conversation questions, works from class 6 up, and builds the same kind of picture over time. There is no score at the end of it, which is partly the point.",
            )}
            action={
              <LinkButton href="/app/interests" variant="outline" size="sm">
                {t("Discover My Interests")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
            }
          />
        </Card>
      </div>
    </Screen>
  );
}

function InstrumentCard({ instrument }: { instrument: AssessmentInstrument }) {
  const t = useT();
  const tf = useTf();
  const Icon = ICONS[instrument.type];
  const latest = instrument.latest;
  const finished = latest?.status === "submitted" && latest.result_id !== null;
  const running = latest?.status === "in_progress";

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight text-ink break-words">{instrument.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-muted">
            <span>{tf("About {minutes} minutes", { minutes: instrument.minutes })}</span>
            <span aria-hidden>·</span>
            <span>{tf("{count} questions", { count: instrument.item_count })}</span>
          </p>
        </div>
      </div>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{instrument.blurb}</p>

      <div className="mt-4 space-y-3">
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
            <p className="flex items-start gap-2 rounded-xl bg-warning-mist/70 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {instrument.reason ||
                tf("This set is written for class {min_class} and above.", {
                  min_class: instrument.min_class,
                })}
            </p>
            {/* Disabled, not hidden-but-broken: the reason is on screen and the
                button does exactly what it says it cannot do. */}
            <Button size="sm" variant="outline" disabled className="w-full justify-center">
              {t("Not available for your class yet")}
            </Button>
          </div>
        ) : finished ? (
          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href={`/app/assessments/result/${latest?.result_id}`} size="sm" className="min-w-0 flex-1">
              {t("See your result")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
            <LinkButton href={`/app/assessments/${instrument.type}`} variant="ghost" size="sm">
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t("Answer again")}
            </LinkButton>
          </div>
        ) : (
          <LinkButton href={`/app/assessments/${instrument.type}`} size="sm" className="w-full justify-center">
            {running ? t("Continue where you left off") : t("Start")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
        )}
      </div>
    </Card>
  );
}
