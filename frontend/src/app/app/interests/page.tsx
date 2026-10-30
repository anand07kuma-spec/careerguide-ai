"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Lightbulb,
  MessageSquare,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingPanel, SkeletonCard } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import { translate, useT, useTf } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import {
  INTEREST_OPTIONS,
  THEME_LABELS,
  type ConversationInfo,
  type InterestPrompt,
  type InterestSummary,
  type Observation,
  type ThemeKey,
} from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

interface AnswerResult {
  saved_themes: { theme: ThemeKey; label: string }[];
  message: string;
}

const SOURCE_LABELS: Record<string, string> = {
  conversation: "a chat with your guide",
  interest_activity: "an interest question you answered",
};

function errorMessage(error: unknown) {
  // A message from the API is content and stays as written; the fallback is the app's own
  // sentence, so it goes through the dictionary. `translate` reads the language the mounted
  // store settled on, which a module-scope helper cannot get from `useT`.
  return error instanceof Error
    ? translate(error.message)
    : translate("Something went wrong. Please try again.");
}

export default function InterestsPage() {
  const { profile, settings, saveProfile } = useSession();
  const { toast } = useToast();
  const t = useT();
  const tf = useTf();

  // Classes 6-8 (and the young age bands) get shorter, more concrete sentences.
  const simple = useMemo(() => {
    const classNumber = /^class-(\d+)$/.exec(profile?.class_level ?? "")?.[1];
    if (classNumber) return Number(classNumber) <= 8;
    return ["3-5", "6-8", "9-10"].includes(profile?.age_range ?? "");
  }, [profile?.class_level, profile?.age_range]);

  const promptsPanel = useResource(
    useCallback(() => api.interestPrompts(settings.language || "hinglish"), [settings.language]),
  );
  const observationsPanel = useResource(useCallback(() => api.observations(), []));
  const summaryPanel = useResource(useCallback(() => api.interestSummary(), []));
  // Optional context for answers; if it fails we simply hide the checkbox.
  const conversationsPanel = useResource(useCallback(() => api.listConversations(), []));

  const prompts = promptsPanel.data?.prompts ?? [];
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attachToChat, setAttachToChat] = useState(false);

  const latestSession: ConversationInfo | null = useMemo(() => {
    const list = conversationsPanel.data;
    if (!list || list.length === 0) return null;
    return list.reduce((newest, item) => (item.id > newest.id ? item : newest), list[0]);
  }, [conversationsPanel.data]);

  const prompt: InterestPrompt | undefined = prompts[index];

  function goTo(nextIndex: number, keepDraft = false) {
    setIndex(nextIndex);
    setResult(null);
    setSubmitError(null);
    const nextPrompt = prompts[nextIndex];
    setAnswer(keepDraft && nextPrompt ? answered[nextPrompt.id] ?? "" : "");
  }

  function answerPromptId(promptId: string) {
    const nextIndex = prompts.findIndex((item) => item.id === promptId);
    if (nextIndex >= 0) goTo(nextIndex);
  }

  async function submit() {
    if (!prompt || !answer.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const next = await api.answerInterest(
        prompt.id,
        answer.trim(),
        attachToChat && latestSession ? latestSession.id : null,
      );
      setAnswered((current) => ({ ...current, [prompt.id]: answer.trim() }));
      setResult(next);
      // These panels now hold fresh signals; refresh them quietly.
      observationsPanel.reload();
      summaryPanel.reload();
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function skip() {
    if (index + 1 < prompts.length) goTo(index + 1);
    else {
      const unanswered = prompts.findIndex((item) => !(item.id in answered));
      if (unanswered >= 0) goTo(unanswered);
      else goTo(0);
    }
  }

  // ---- "Your own interests" chip editor, optimistic with rollback ----------
  const savedInterests = useMemo(() => profile?.interest_areas ?? [], [profile?.interest_areas]);
  // The chips follow the profile, except while a save is in flight: this holds
  // the click the student just made, and dropping it is the rollback.
  const [draftInterests, setDraftInterests] = useState<string[] | null>(null);
  const [interestsSaving, setInterestsSaving] = useState(false);
  const interests = draftInterests ?? savedInterests;

  async function toggleInterest(option: string) {
    const next = interests.includes(option)
      ? interests.filter((item) => item !== option)
      : [...interests, option];
    setDraftInterests(next);
    setInterestsSaving(true);
    try {
      await saveProfile({ interest_areas: next });
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      // A saved profile has already replaced `savedInterests`, so falling back
      // to it shows the truth in both directions.
      setDraftInterests(null);
      setInterestsSaving(false);
    }
  }

  const observations = observationsPanel.data ?? [];
  const summary: InterestSummary | null = summaryPanel.data;

  return (
    <Screen
      title="Discover My Interests"
      description={
        simple
          ? "Let's find out what you enjoy. No marks. No labels. Just questions."
          : "Gentle questions about what you enjoy. Answers become small, early signals — never a fixed profile or a verdict."
      }
      badge={
        <Badge tone="teal" icon={<Lightbulb className="h-3.5 w-3.5" aria-hidden />}>
          {t("Early signals, not labels")}
        </Badge>
      }
    >
      <div className="space-y-6">
        {/* ------------------------------------------------ Answer one question */}
        <Card>
          <CardHeader
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
            title="Answer a question"
            description={promptsPanel.data?.note}
          />

          {promptsPanel.state === "loading" ? (
            <LoadingPanel label="Getting questions ready…" />
          ) : promptsPanel.state === "error" ? (
            <div className="mt-4">
              <ErrorState
                description={promptsPanel.error}
                onRetry={promptsPanel.reload}
                retryLabel="Reload questions"
              />
            </div>
          ) : prompts.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={Lightbulb}
                title="No questions available right now"
                description="Check the backend is running, then reload this page."
                action={
                  <Button size="sm" variant="outline" onClick={promptsPanel.reload}>
                    {t("Reload questions")}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {/* Prompt navigator: revisit any question, answered or not. */}
              <div className="cg-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {prompts.map((item, itemIndex) => {
                  const done = item.id in answered;
                  const active = itemIndex === index;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => answerPromptId(item.id)}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-brand bg-brand text-white"
                          : done
                            ? "border-teal/40 bg-teal-mist text-teal hover:border-teal"
                            : "border-line bg-surface text-muted hover:border-brand-light hover:text-ink",
                      )}
                    >
                      {done ? <Check className="h-3 w-3" aria-hidden /> : null}
                      Q{itemIndex + 1}
                    </button>
                  );
                })}
              </div>

              {result ? (
                <div className="rounded-2xl border border-teal/25 bg-teal-mist/50 p-4">
                  <p className="text-sm font-medium text-ink">
                    {result.saved_themes.length > 0
                      ? simple
                        ? "That tells us you might enjoy…"
                        : "That tells us you might enjoy areas like these — it is a possibility, not a prediction:"
                      : ""}
                  </p>
                  {result.saved_themes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.saved_themes.map((theme) => (
                        <Badge key={theme.theme} tone="teal">
                          {THEME_LABELS[theme.theme] ?? theme.label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <p className={cn("text-sm text-muted", result.saved_themes.length > 0 && "mt-2")}>
                    {result.message}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {index + 1 < prompts.length ? (
                      <Button size="sm" onClick={() => goTo(index + 1)}>
                        {t("Next question")}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => goTo(0)}>
                        {t("Back to the start")}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                      {t("Change my answer")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {tf("Question {n} of {total}", { n: index + 1, total: prompts.length })}
                    </p>
                    <p className="mt-1.5 text-base font-semibold leading-snug text-ink">
                      {prompt?.question}
                    </p>
                    <p className="mt-1 text-sm text-muted">{prompt?.hint}</p>
                  </div>
                  <Textarea
                    label="Your answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    rows={3}
                    placeholder={
                      simple
                        ? "Type here. English, Hindi or Hinglish — anything you like."
                        : "Answer in English, Hindi or Hinglish — whatever feels natural. There is no right or wrong answer."
                    }
                  />
                  {latestSession ? (
                    <Checkbox
                      label="Also save to my last conversation"
                      description={tf(
                        "Adds this answer to conversation #{id} so your guide can use it.",
                        { id: latestSession.id },
                      )}
                      checked={attachToChat}
                      onChange={(event) => setAttachToChat(event.target.checked)}
                    />
                  ) : null}
                  {submitError ? (
                    <p role="alert" className="text-sm font-medium text-danger">
                      {submitError}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => void submit()} loading={submitting} disabled={!answer.trim()}>
                      {t("Save my answer")}
                    </Button>
                    <Button variant="outline" onClick={skip} disabled={prompts.length <= 1}>
                      <SkipForward className="h-4 w-4" aria-hidden />
                      {t("Skip this one")}
                    </Button>
                    {index > 0 ? (
                      <Button variant="ghost" onClick={() => goTo(index - 1)}>
                        {t("Previous")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ------------------------------------------------ What we've noticed */}
        <Card>
          <CardHeader
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            title="What we've noticed so far"
            description={
              simple
                ? "Small signals from your chats. They are not a fixed profile. You can always change your mind."
                : "These are small, early observations pulled from things you chose to share. They are not a fixed profile, a personality type, or an ability judgement — interests move around a lot."
            }
          />
          <div className="mt-4">
            {observationsPanel.state === "loading" ? (
              <LoadingPanel label="Looking through your signals…" />
            ) : observationsPanel.state === "error" ? (
              <ErrorState
                title="We couldn't load your observations"
                description={observationsPanel.error}
                onRetry={observationsPanel.reload}
              />
            ) : observations.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No signals yet"
                description="Answer one of the questions above, or have a chat with your guide, and small observations will start appearing here."
                action={
                  <LinkButton href="/app/call" size="sm">
                    {t("Talk to your guide")}
                  </LinkButton>
                }
              />
            ) : (
              <ul className="space-y-3">
                {observations.map((observation: Observation) => (
                  <li
                    key={observation.id}
                    className="rounded-2xl border border-line bg-canvas/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone="teal">
                        {t(THEME_LABELS[observation.theme] ?? observation.theme)}
                      </Badge>
                      <span className="text-xs text-muted">
                        {relativeTime(observation.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink">
                      &ldquo;{observation.evidence}&rdquo;
                    </p>
                    <p className="mt-1.5 text-xs text-muted">
                      {tf("Noticed through {source}", {
                        source: t(SOURCE_LABELS[observation.source] ?? observation.source),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------ Interest summary */}
        <Card>
          <CardHeader
            icon={<Lightbulb className="h-4 w-4" aria-hidden />}
            title="Interest summary"
            description={summary?.note}
            action={
              summaryPanel.state === "ready" ? (
                <Button size="sm" variant="ghost" onClick={summaryPanel.reload}>
                  {t("Refresh")}
                </Button>
              ) : undefined
            }
          />
          <div className="mt-4">
            {summaryPanel.state === "loading" ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : summaryPanel.state === "error" ? (
              <ErrorState
                title="We couldn't load your summary"
                description={summaryPanel.error}
                onRetry={summaryPanel.reload}
              />
            ) : summary && summary.themes.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {summary.themes.map((theme) => (
                  <div key={theme.theme} className="rounded-2xl border border-line bg-surface p-4">
                    <Badge tone="teal">{theme.label}</Badge>
                    <p className="mt-2.5 text-sm leading-relaxed text-ink">{theme.blurb}</p>
                    {theme.evidence.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {theme.evidence.map((evidence, evidenceIndex) => (
                          <li key={evidenceIndex} className="flex gap-2 text-xs text-muted">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal" aria-hidden />
                            <span className="min-w-0 leading-relaxed">{evidence}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {theme.suggested_categories.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {theme.suggested_categories.map((category) => (
                          <LinkButton
                            key={category}
                            href={`/app/careers?category=${encodeURIComponent(category)}`}
                            variant="outline"
                            size="sm"
                          >
                            {category}
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </LinkButton>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Lightbulb}
                title="Nothing to summarise yet"
                description={
                  simple
                    ? "That's okay! Answer a question or two above and themes will show up here."
                    : "That is a perfectly fine place to start. Answer a few prompts above or have one conversation, and themes will appear here as possibilities to explore."
                }
              />
            )}
          </div>
        </Card>

        {/* ------------------------------------------------ Your own interests */}
        <Card>
          <CardHeader
            icon={<Check className="h-4 w-4" aria-hidden />}
            title="Your own interests"
            description={
              simple
                ? "Tap what you like. Change your mind any time."
                : "Pick anything that feels like you. This list is yours — add or remove items any time, nothing here is permanent."
            }
            action={
              interestsSaving ? (
                <span className="text-xs text-muted">{t("Saving…")}</span>
              ) : (
                <span className="text-xs text-muted">{tf("{n} selected", { n: interests.length })}</span>
              )
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((option) => {
              const selected = interests.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => void toggleInterest(option)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-brand bg-brand-mist text-brand-dark"
                      : "border-line bg-surface text-muted hover:border-brand-light hover:text-ink",
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                  {/* The stored value is the label, so the lookup happens here. `option`
                      itself stays English: it is what goes into `interest_areas`. */}
                  {t(option)}
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </Screen>
  );
}
