"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Compass,
  MessagesSquare,
  Sparkles,
  Target,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { messageFor } from "@/lib/use-resource";
import { api } from "@/lib/api";
import { useT, useTf, useUiLang } from "@/lib/i18n";
import type { AssessmentResult, RoadmapPlan } from "@/lib/assessments";

/**
 * The plan sitting on a finished result: the gap, and four weeks that close a little
 * of it.
 *
 * Both cards read from one object the server already put into sentences, so nothing
 * here computes a score or decides what a number means. What this file does hold is
 * the two claims that are easy to get wrong. A gap is described as something *the work
 * asks for*, never as something the child lacks — the questionnaire measured interests
 * and aptitude, not a job's skill list. And the source of every sentence is on show:
 * the app's own rules are labelled as rules, a model's words as a model's, and the ✨
 * button that swaps one for the other only exists when a model is actually configured.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  hinglish: "Hinglish",
};

export function RoadmapSection({
  result,
  onRebuilt,
}: {
  result: AssessmentResult;
  /** The whole result, because the rebuild route answers with one: the plan changed, and
   * so did the one sentence about whether a model was reached. */
  onRebuilt: (next: AssessmentResult) => void;
}) {
  const plan = result.roadmap;
  if (!plan) return <NoPlanCard result={result} />;
  return (
    <>
      <SkillGapCard result={result} plan={plan} onRebuilt={onRebuilt} />
      <PlanTimeline result={result} plan={plan} />
    </>
  );
}

/** A result with no plan, and the two honest reasons there is one. */
function NoPlanCard({ result }: { result: AssessmentResult }) {
  const t = useT();
  return (
    <Card>
      <CardHeader
        icon={<Compass className="h-4 w-4" aria-hidden />}
        title="No plan for these answers yet"
        description={
          result.careers.length > 0
            ? t(
                "This result was saved before the app started writing four-week plans, or its answers matched no career in its own notes closely enough to aim one at. Answering the questionnaire again produces a result that comes with a plan.",
              )
            : t(
                "No career in this app's notes matched your answers closely enough to aim four weeks at, so there is nothing for a plan to work towards. Answering more of the questionnaire is what changes that.",
              )
        }
      />
    </Card>
  );
}

function SkillGapCard({
  result,
  plan,
  onRebuilt,
}: {
  result: AssessmentResult;
  plan: RoadmapPlan;
  onRebuilt: (next: AssessmentResult) => void;
}) {
  const t = useT();
  const tf = useTf();
  const language = useUiLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const career = t(plan.career.title ?? "") || t("this work");
  const fromRules = plan.source === "rules";

  async function rebuild() {
    setBusy(true);
    setError(null);
    try {
      onRebuilt(await api.assessmentRoadmap(result.result_id, language));
    } catch (caught) {
      // The plan on screen is untouched by a request that never landed, so this says so
      // and leaves the rules version standing rather than blanking the card.
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<Target className="h-4 w-4" aria-hidden />}
        title="Your skill gap"
        description={tf(
          "What your answers already cover, and what {career} leans on beyond that. This describes the work, not you.",
          { career },
        )}
        action={
          result.roadmap_ai_available ? (
            <Button variant="outline" size="sm" onClick={rebuild} loading={busy} className="print:hidden">
              <Sparkles className="h-4 w-4" aria-hidden />
              {busy ? t("Asking the model…") : t("Rewrite this plan with AI")}
            </Button>
          ) : null
        }
      />

      {/* When a rebuild was refused, the server's own sentence about it. It describes the
          one click that just happened, not the stored plan, so a plain reload loses it —
          which is correct: the plan below is still the one the app wrote. */}
      {result.roadmap_note ? (
        <p
          role="status"
          className="mt-4 rounded-card bg-warning-mist px-3.5 py-2.5 text-xs leading-relaxed text-amber-700"
        >
          {t(result.roadmap_note)}
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-ink">{plan.summary}</p>

      {error ? (
        <p role="alert" className="mt-3 rounded-card bg-danger-mist px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-canvas/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">
            {t("Where your answers came back strong")}
          </p>
          {plan.strengths.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {plan.strengths.map((entry, index) => (
                <li key={`${entry.label}-${index}`} className="text-sm leading-relaxed text-ink">
                  <span className="font-medium">{entry.label}</span>
                  {entry.score !== null ? (
                    <span className="text-muted">
                      {" "}
                      — {entry.score}/100
                      {entry.band_label ? ` · ${entry.band_label}` : ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t(
                "Nothing came back strong enough to name. That is a result of how few answers there were, not a judgement.",
              )}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-canvas/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {t("What this work asks for beyond that")}
          </p>
          {plan.gaps.length > 0 ? (
            <ul className="mt-2 space-y-3">
              {plan.gaps.map((gap, index) => (
                <li key={`${gap.reason}-${gap.label}-${index}`}>
                  <p className="text-sm font-medium text-ink">{t(gap.label)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{gap.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t("This plan goes deeper into what you already like rather than fixing a gap.")}
            </p>
          )}
        </div>
      </div>

      {plan.unmeasured.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-warning/30 bg-warning-mist/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {t("Not measured, so not a weakness")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {plan.unmeasured.map((entry) => (
              <li key={entry.label}>
                <Badge tone="warning">{entry.label}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t(
              "Too few answers in these areas to score anything. They are left out of the gap above on purpose.",
            )}
          </p>
        </div>
      ) : null}

      {plan.career_skills.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {tf("Skills {career} leans on", { career })}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {plan.career_skills.map((skill) => (
              <li key={skill}>
                <Badge tone="neutral">{skill}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t(
              "These are the skills the work itself lists. Nothing here was tested, and none of them say what you are capable of learning.",
            )}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={fromRules ? "neutral" : "teal"}>
          {fromRules ? t("Written by the app's own rules") : tf("{provider} model", { provider: plan.source })}
        </Badge>
        {!fromRules && plan.text_language && plan.text_language !== language ? (
          <Badge tone="warning">
            {tf("Written in {language}", {
              language: LANGUAGE_NAMES[plan.text_language] ?? plan.text_language,
            })}
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
        {plan.note}
      </p>
    </Card>
  );
}

function PlanTimeline({ result, plan }: { result: AssessmentResult; plan: RoadmapPlan }) {
  const t = useT();
  const tf = useTf();
  const career = plan.career.title ?? "";
  const careerTitle = t(career) || t("this work");
  return (
    <Card>
      <CardHeader
        icon={<Compass className="h-4 w-4" aria-hidden />}
        title="Your 30-day plan"
        description={tf(
          "Four weeks aimed at {career}, from your own answers. Do them in order, swap them, or skip one — this is a suggestion, not a timetable.",
          { career: careerTitle },
        )}
      />

      {plan.weeks.length > 0 ? (
        <ol className="mt-5 space-y-6 border-l-2 border-dashed border-line pl-6">
          {plan.weeks.map((entry) => (
            <li key={entry.week} className="relative">
              <span
                aria-hidden
                className="absolute -left-[31px] flex h-7 w-7 items-center justify-center rounded-full bg-brand-mist text-xs font-semibold text-brand-dark"
              >
                {entry.week}
              </span>
              <h3 className="text-sm font-semibold leading-snug text-ink">{entry.title}</h3>
              <ul className="mt-2 space-y-2">
                {entry.steps.map((step, index) => (
                  <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                    <span className="mt-0.5 shrink-0 text-xs font-semibold text-brand-dark">
                      {index + 1}.
                    </span>
                    <span>{step.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {t("This plan has no weeks in it, which means something went wrong above rather than with you.")}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 print:hidden">
        <LinkButton href={`/app/chat?context=roadmap&result=${result.result_id}`} size="sm">
          <MessagesSquare className="h-4 w-4" aria-hidden />
          {t("Discuss this roadmap with AI Guide")}
        </LinkButton>
        {career ? (
          <LinkButton
            href={`/app/careers/${encodeURIComponent(plan.career.slug ?? "")}`}
            variant="ghost"
            size="sm"
          >
            {tf("Read about {career}", { career: careerTitle })}
          </LinkButton>
        ) : null}
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted print:hidden">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
        {t(
          "Nothing here is a promise about results, admissions or a job. It is four weeks of things to try, and the fact that you did them is the only thing it proves.",
        )}
      </p>
    </Card>
  );
}
