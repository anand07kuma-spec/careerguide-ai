"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  ListChecks,
  Lock,
  Save,
  ShieldCheck,
} from "lucide-react";
import { QuestionCard } from "@/components/assessments/QuestionCard";
import { ProgressBar } from "@/components/assessments/ProgressBar";
import { Screen } from "@/components/layout/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { isAssessmentType } from "@/lib/assessments";
import { api } from "@/lib/api";
import { useT, useTf, useUiLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { messageFor, useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

/**
 * Taking one questionnaire, start to finish.
 *
 * The rules that matter here are about losing work. Every answer is sent the moment
 * it is chosen, so a closed tab, a dead battery or a dropped connection costs one
 * answer rather than the whole sitting — and returning to `/app/assessments` resumes
 * the same sitting with the answers still on it. The count beside the progress bar is
 * the number the *server* has, not the number clicked, so a save that failed is
 * visible instead of assumed.
 *
 * Nothing is timed. A ticking clock turns a career questionnaire into an exam, and
 * the aptitude set is explicitly framed as puzzles to try, not a measure of ability.
 */
export default function AssessmentRunnerPage() {
  const params = useParams<{ type: string }>();
  const type = params.type;
  const known = isAssessmentType(type);

  const t = useT();
  const tf = useTf();
  const language = useUiLang();
  const { status, isParent } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [receipt, setReceipt] = useState<{ assessment_id: number; resumed: boolean } | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  // The answers clicked here, on top of the ones the server already has.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cataloguePanel = useResource(
    useCallback(() => api.assessments(language), [language]),
    known && status === "ready" && !isParent,
  );
  const instrument = cataloguePanel.data?.instruments.find((row) => row.type === type);

  const sessionId = receipt?.assessment_id ?? 0;
  const sessionPanel = useResource(
    useCallback(() => api.assessmentSession(sessionId), [sessionId]),
    receipt !== null,
  );

  const session = sessionPanel.data;
  const questions = session?.items ?? [];
  const total = questions.length;
  const answers = session ? { ...session.answered, ...picked } : picked;
  const answeredCount = serverCount ?? Object.keys(session?.answered ?? {}).length;
  const current = questions[index];
  const finished = session?.status === "submitted";

  // A parent who lands on this address gets sent to their own dashboard. Without
  // this the screen would sit on "Loading this questionnaire…" forever, because
  // the request that fills it is the one a parent is not allowed to make.
  useEffect(() => {
    if (status === "ready" && isParent) router.replace("/parent");
  }, [isParent, router, status]);

  async function begin() {
    if (!known) return;
    setStarting(true);
    setStartError(null);
    try {
      const next = await api.startAssessment(type, language);
      setReceipt({ assessment_id: next.assessment_id, resumed: next.resumed });
      if (next.resumed) toast(t("Welcome back — your saved answers are here."), "success");
    } catch (error) {
      setStartError(messageFor(error));
    } finally {
      setStarting(false);
    }
  }

  async function save(code: string, value: string) {
    setPicked((current) => ({ ...current, [code]: value }));
    setSaveError(null);
    setSaving(true);
    try {
      const saved = await api.answerAssessment(sessionId, code, value);
      setServerCount(saved.answered);
    } catch (error) {
      setSaveError(messageFor(error));
    } finally {
      setSaving(false);
    }
  }

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
    setSaveError(null);
  }

  function firstUnanswered(from: number) {
    for (let offset = 1; offset <= questions.length; offset += 1) {
      const candidate = (from + offset) % questions.length;
      if (!answers[questions[candidate].code]) return candidate;
    }
    return -1;
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.submitAssessment(sessionId, language);
      // The dialog closes only on the way out. Closing it in a `finally` would hide
      // the one sentence that tells the student the submit failed.
      setConfirmOpen(false);
      router.push(`/app/assessments/result/${result.result_id}`);
    } catch (error) {
      setSubmitError(messageFor(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (!known) {
    return (
      <Screen title="No such questionnaire" description="This app offers three: interest, personality and aptitude.">
        <Card>
          <EmptyState
            icon={ListChecks}
            title="We do not have that questionnaire"
            description={t("The address asked for an assessment this app does not offer. Nothing was started or changed.")}
            action={<LinkButton href="/app/assessments">{t("Back to assessments")}</LinkButton>}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={instrument?.name ?? t("Questionnaire")}
      description={
        receipt
          ? t("Answering. Nothing is timed, and every choice is saved as you go.")
          : instrument?.blurb
      }
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal" icon={<Clock className="h-3.5 w-3.5" aria-hidden />}>
            {instrument ? tf("About {minutes} minutes", { minutes: instrument.minutes }) : t("A few minutes")}
          </Badge>
          {instrument && !instrument.available ? (
            <Badge tone="warning" icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>
              {tf("Class {min_class} and above", { min_class: instrument.min_class })}
            </Badge>
          ) : null}
        </div>
      }
      action={
        receipt && !finished ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="ghost" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0 || saving}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t("Previous")}
            </Button>
            {index + 1 < questions.length ? (
              <Button size="sm" onClick={() => goTo(index + 1)} disabled={saving}>
                {t("Next")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={answeredCount === 0}>
                <Check className="h-4 w-4" aria-hidden />
                {t("Finish and see the result")}
              </Button>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        {/* ---------------------------------------------------- 1. before starting */}
        {!receipt ? (
          <Card>
            {cataloguePanel.state === "loading" ? (
              <LoadingPanel label="Loading this questionnaire…" />
            ) : cataloguePanel.state === "error" ? (
              <ErrorState description={cataloguePanel.error} onRetry={cataloguePanel.reload} />
            ) : !instrument ? (
              <ErrorState
                title="This questionnaire is not on the server"
                description={t(
                  "The question bank has not loaded, so there is nothing to start. The catalogue and your guide still work.",
                )}
                onRetry={cataloguePanel.reload}
              />
            ) : (
              <div className="space-y-4">
                <CardHeader
                  icon={<ListChecks className="h-4 w-4" aria-hidden />}
                  title="Before you start"
                  description={t(
                    "One question at a time, in your own order. Stop whenever you like and the answers you gave will still be here.",
                  )}
                />
                <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {tf("About {minutes} minutes, no timer", { minutes: instrument.minutes })}
                  </li>
                  <li className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {tf("{count} questions, one at a time", { count: instrument.item_count })}
                  </li>
                  <li className="flex items-center gap-2">
                    <Save className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {t("Each answer saves as you go")}
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {t("Only you see these answers")}
                  </li>
                </ul>

                <p className="rounded-2xl border border-line bg-canvas/60 p-4 text-sm leading-relaxed text-muted">
                  {t(cataloguePanel.data?.note ?? "")}
                </p>

                {!instrument.available ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-mist/60 p-4 text-sm leading-relaxed text-amber-800"
                  >
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {instrument.reason ||
                      tf("This set is written for class {min_class} and above.", {
                        min_class: instrument.min_class,
                      })}
                  </p>
                ) : null}

                {startError ? (
                  <p role="alert" className="text-sm font-medium text-danger">
                    {startError}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => void begin()} loading={starting} disabled={!instrument.available}>
                    {instrument.latest?.status === "in_progress"
                      ? t("Continue where you left off")
                      : t("Start the questions")}
                  </Button>
                  <LinkButton href="/app/assessments" variant="ghost">
                    {t("Back to the three")}
                  </LinkButton>
                </div>

                {!instrument.available ? (
                  <p className="text-xs text-muted">
                    {t("The button stays disabled because the server would refuse it too — nothing here pretends to work.")}
                  </p>
                ) : null}
              </div>
            )}
          </Card>
        ) : (
          <>
            {/* ------------------------------------------------ 2. where the student is */}
            {sessionPanel.state === "loading" ? (
              <Card>
                <LoadingPanel label="Getting your questions ready…" />
              </Card>
            ) : sessionPanel.state === "error" ? (
              <Card>
                <ErrorState
                  title="We could not open your answers"
                  description={sessionPanel.error}
                  onRetry={sessionPanel.reload}
                  extra={
                    <LinkButton href="/app/assessments" variant="ghost" size="sm">
                      {t("Back to assessments")}
                    </LinkButton>
                  }
                />
              </Card>
            ) : finished ? (
              <Card>
                <EmptyState
                  icon={Check}
                  title="You have already finished this one"
                  description={t(
                    "Its result is kept as it was when you submitted it. Answering again would start a new sitting, and two numbers about the same week are not easy to read side by side.",
                  )}
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <LinkButton href={`/app/assessments/result/${session?.result_id}`}>
                        {t("See your result")}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </LinkButton>
                      <Button variant="outline" onClick={() => void begin()}>
                        <ListChecks className="h-4 w-4" aria-hidden />
                        {t("Start a new sitting")}
                      </Button>
                    </div>
                  }
                />
              </Card>
            ) : current ? (
              <>
                <ProgressBar index={index} total={total} answered={answeredCount} saving={saving} />

                <Card>
                  {session?.caveat ? (
                    <p className="mb-4 rounded-2xl border border-line bg-canvas/60 px-4 py-3 text-xs leading-relaxed text-muted">
                      {session.caveat}
                    </p>
                  ) : null}
                  <QuestionCard
                    question={current}
                    index={index}
                    total={total}
                    scale={session?.scale ?? []}
                    value={answers[current.code]}
                    onChange={(value) => void save(current.code, value)}
                    disabled={saving}
                  />
                  {saveError ? (
                    <div role="alert" className="mt-4 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-danger">{saveError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void save(current.code, answers[current.code])}
                      >
                        {t("Save it again")}
                      </Button>
                    </div>
                  ) : null}
                </Card>

                {/* --------------------------------- 3. jump back to any question */}
                <div className="cg-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {questions.map((question, position) => {
                    const done = Boolean(answers[question.code]);
                    const active = position === index;
                    return (
                      <button
                        key={question.code}
                        type="button"
                        onClick={() => goTo(position)}
                        aria-current={active ? "step" : undefined}
                        aria-label={tf("Question {n}", { n: position + 1 })}
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold transition-colors",
                          active
                            ? "border-brand bg-brand text-white"
                            : done
                              ? "border-teal/40 bg-teal-mist text-teal hover:border-teal"
                              : "border-line bg-surface text-muted hover:border-brand-light hover:text-ink",
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : position + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0}>
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    {t("Previous")}
                  </Button>
                  {index + 1 < questions.length ? (
                    <Button onClick={() => goTo(index + 1)}>
                      {t("Next")}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                  {answeredCount > 0 ? (
                    <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
                      <Check className="h-4 w-4" aria-hidden />
                      {t("Finish and see the result")}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">
                      {t("Answer one question and a finish button appears here.")}
                    </span>
                  )}
                  {answeredCount < total ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const next = firstUnanswered(index);
                        if (next >= 0) goTo(next);
                        else setConfirmOpen(true);
                      }}
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden />
                      {answeredCount === 0 ? t("Start at the first question") : t("Jump to an unanswered one")}
                    </Button>
                  ) : null}
                  <Link href="/app/assessments" className="text-xs font-medium text-muted hover:text-ink">
                    {t("Leave it and come back later")}
                  </Link>
                </div>

                <Modal
                  open={confirmOpen}
                  onClose={() => setConfirmOpen(false)}
                  title={t("Finish this questionnaire?")}
                  description={tf("{answered} of {total} answered", {
                    answered: answeredCount,
                    total,
                  })}
                  footer={
                    <>
                      <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                        {t("Keep answering")}
                      </Button>
                      <Button onClick={() => void submit()} loading={submitting}>
                        {t("Yes, score it")}
                      </Button>
                    </>
                  }
                >
                  <div className="space-y-3 text-sm leading-relaxed text-ink">
                    <p>
                      {answeredCount < total
                        ? t(
                            "Areas with only one answer will show no number — that is honest, not a low score. Anything you leave blank stays blank.",
                          )
                        : t("You answered every question, so each area has a real count behind it.")}
                    </p>
                    <p className="text-muted">
                      {t(
                        "Your answers are kept and the result is calculated from them. You can read the result later, and you can start a new sitting whenever you like.",
                      )}
                    </p>
                    {submitError ? (
                      <p role="alert" className="font-medium text-danger">
                        {submitError}
                      </p>
                    ) : null}
                  </div>
                </Modal>
              </>
            ) : (
              <Card>
                <EmptyState
                  icon={ListChecks}
                  title="This questionnaire has no questions on the server"
                  description={t("The question bank did not load. Try again, or ask your guide instead.")}
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button size="sm" variant="outline" onClick={sessionPanel.reload}>
                        {t("Reload")}
                      </Button>
                      <LinkButton size="sm" variant="ghost" href="/app/chat">
                        {t("Talk to your guide")}
                      </LinkButton>
                    </div>
                  }
                />
              </Card>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
