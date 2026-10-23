"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Compass,
  Mic,
  MicOff,
  MessagesSquare,
  Pause,
  Play,
  Plus,
  Send,
  Square,
  StopCircle,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Toggle } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { BACKEND_URL, api, isOffline } from "@/lib/api";
import type { RoadmapPlan } from "@/lib/assessments";
import { useSession } from "@/lib/session";
import { useT, useTf, useUiLang } from "@/lib/i18n";
import { classLabel, cn } from "@/lib/utils";
import { THEME_LABELS, type ChatMessage, type ConversationInfo, type ThemeKey } from "@/lib/types";
import {
  MIC_ERROR_TEXT,
  cancelBrowserTts,
  speakWithBrowser,
  useAudioPlayer,
  useSpeechInput,
} from "@/lib/voice";

interface Turn extends ChatMessage {
  /** Themes the guide noticed in this reply, shown under the bubble. */
  themes?: string[];
  /** What this turn saved to the profile, in words the student can read. */
  saved?: string[];
}

const GUIDE_STAGES = 7;

/** How to tell a student what the conversation just taught the app. */
const FACT_NOTICES: Record<string, string> = {
  age_range: "Age group",
  education_context: "Where you study",
  financial_context: "Cost preference",
};

/**
 * The chat, and the plan it may have been opened from.
 *
 * A result page links here as `/app/chat?context=roadmap&result=12`. Reading that
 * address needs `useSearchParams`, which has no value while a page is being
 * prerendered — so the thread that reads it sits behind a boundary of its own, or the
 * build stops shipping this route at all.
 */
export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <Screen title="Chat with your guide">
          <Card>
            <LoadingPanel label="Opening your conversation…" />
          </Card>
        </Screen>
      }
    >
      <ChatThread />
    </Suspense>
  );
}

function ChatThread() {
  const { settings, user, reload, isParent } = useSession();
  const { toast } = useToast();
  const t = useT();
  const tf = useTf();
  const player = useAudioPlayer();

  const [session, setSession] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootOffline, setBootOffline] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [speakOn, setSpeakOn] = useState(settings.speak_responses);
  const [lastAudio, setLastAudio] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [safety, setSafety] = useState(false);
  const [listRef, setListRef] = useState<HTMLDivElement | null>(null);

  const language = settings.language || user?.preferred_language || "hinglish";
  // The interface language, which is what a plan card is written in. It is not the
  // conversation language above: a plan is a document the student reads, and the result
  // page they came from renders it in the interface, whatever they happen to be typing.
  const uiLang = useUiLang();
  // The guide replies in whatever language the student last used, so spoken
  // playback and dictation follow that instead of the account default.
  const [spoken, setSpoken] = useState(language);
  const dictation = useSpeechInput({
    language: spoken,
    // Each finished phrase lands in the composer, appended to whatever is already
    // typed, so a message can be half spoken and half typed.
    onFinal: (words) =>
      setDraft((current) => {
        const base = current.trim();
        return base ? `${base} ${words}` : words;
      }),
  });

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef) listRef.scrollTop = listRef.scrollHeight;
    });
  }, [listRef]);

  // ---------------------------------------------------- the plan this chat opened from
  const query = useSearchParams();
  const planId = useMemo(() => {
    if (query.get("context") !== "roadmap") return null;
    const value = Number(query.get("result"));
    return Number.isInteger(value) && value > 0 ? value : null;
  }, [query]);
  const [plan, setPlan] = useState<RoadmapPlan | null>(null);
  const [planChecked, setPlanChecked] = useState(false);
  const [planHidden, setPlanHidden] = useState(false);

  // Read back through the same route the result page uses, so the words on this card are
  // the words on that page. A failure is silent on purpose: the result may have been
  // deleted, and a chat that cannot show a plan is still a working chat.
  useEffect(() => {
    if (!planId || isParent) return;
    let active = true;
    api
      .assessmentResult(planId, uiLang)
      .then((found) => {
        if (!active) return;
        setPlan(found.roadmap);
        setPlanChecked(true);
        if (found.roadmap) {
          // Start the student off with the question they came here to ask, but only into a
          // still-empty box — nothing they were typing gets overwritten by a card arriving.
          setDraft((current) =>
            current.trim()
              ? current
              : t("My 30-day plan is next to this chat — what should I do first this week?"),
          );
        }
      })
      .catch(() => {
        if (!active) return;
        setPlan(null);
        setPlanChecked(true);
      });
    return () => {
      active = false;
    };
  }, [isParent, planId, t, uiLang]);

  // Shown and pinned together: the card only stays while the student can see it, so a
  // plan never keeps being named in messages after it was put away.
  const pinned = plan !== null && !planHidden;

  const openSession = useCallback(
    async (info: ConversationInfo, history: Turn[]) => {
      setSession(info);
      // The server stores the greeting as the thread's first assistant message, so a
      // brand new chat is not empty. Seeding it here keeps that bubble identical whether
      // the conversation was just started or reopened, instead of printing it above a
      // list that claims there are no messages.
      setMessages(
        history.length === 0 && info.greeting
          ? [
              {
                id: -1,
                role: "assistant",
                content: info.greeting,
                demo_generated: true,
                created_at: new Date().toISOString(),
              },
            ]
          : history
      );
      setNotice(null);
      setSpoken(info.language || "hinglish");
      scrollToEnd();
    },
    [scrollToEnd],
  );

  // One promise chain, and state only changes inside its callbacks. Opening the
  // thread therefore never writes state synchronously, which is what lets the
  // mount effect below stay simple.
  const boot = useCallback(
    () =>
      api
        .listConversations()
        .then(async (sessions) => {
          const active = sessions.find((item) => item.status === "active" && item.kind === "chat");
          if (active) {
            await openSession(active, await api.messages(active.id));
            return;
          }
          await openSession(await api.startConversation("chat", spoken), []);
        })
        .catch((error: unknown) => {
          if (isOffline(error)) setBootOffline(true);
          setBootError(
            error instanceof Error ? error.message : t("Could not open the conversation."),
          );
        })
        .finally(() => setBooting(false)),
    [openSession, spoken, t],
  );

  // The screen already renders as "booting", so mounting only fires the request;
  // rewinding the flags belongs to `retryBoot`, which the Try again button calls.
  useEffect(() => {
    void boot();
    // Booting once per mount: restarting on every language change would drop
    // the thread the student is in the middle of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryBoot = useCallback(() => {
    setBooting(true);
    setBootError(null);
    setBootOffline(false);
    void boot();
  }, [boot]);

  useEffect(() => {
    scrollToEnd();
  }, [messages, sending, scrollToEnd]);

  // The player object is a new literal every render, so depending on `player`
  // itself would stop the voice mid-sentence. `stop` is stable, so this only
  // ever fires when the screen unmounts.
  const stopVoice = player.stop;
  useEffect(
    () => () => {
      stopVoice();
      cancelBrowserTts();
    },
    [stopVoice],
  );

  const replyTo = useCallback(
    async (text: string) => {
      if (!session) return;
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setSending(true);
      setSendError(null);
      setDraft("");
      dictation.reset();

      try {
        // The result id travels with a message only while that plan is pinned on screen.
        // The server re-reads the plan from its own row rather than trusting this number,
        // and it refuses an id that is not this student's, so nothing here can hand over
        // another family's answers.
        const answer = await api.sendMessage(session.id, trimmed, speakOn, pinned ? planId : null);
        // The reply carries the guide's own judgement about whether this sounds
        // like a child asking for help, so a second request that fails cannot
        // decide whether the helpline card appears.
        setSafety(answer.needs_support);
        // Follow the guide's language for the next dictation and any fallback voice.
        setSpoken(answer.language || language);
        // Anything this turn revealed about the student is already saved on the
        // server. Saying so here keeps the storage visible instead of silent.
        const saved: string[] = [];
        const updates = answer.profile_updates ?? {};
        for (const [key, value] of Object.entries(updates)) {
          // A spoken age fills in two columns — the number and the band the server
          // derived from it. One fact was said, so one chip says it back.
          if (key === "age_range" && "age" in updates) continue;
          const label =
            key === "class_level"
              ? classLabel(String(value))
              : key === "age"
                ? tf("{years} years old", { years: Number(value) })
                : t(FACT_NOTICES[key] ?? key);
          if (label) saved.push(label);
        }
        setMessages((current) => [
          ...current,
          {
            id: Date.now(),
            role: "user",
            content: trimmed,
            demo_generated: false,
            created_at: new Date().toISOString(),
          },
          { ...answer.reply, themes: answer.detected_themes, saved },
        ]);
        setSession({ ...session, stage: answer.stage });
        if (saved.length) void reload();

        if (answer.audio_url) {
          setLastAudio(answer.audio_url);
          if (speakOn) void player.play(answer.audio_url);
        } else if (speakOn) {
          // The server's text-to-speech failed; the browser's own voice is a
          // different sound, so the reply still says it is labelled as such.
          if (answer.audio_error) {
            setNotice(
              tf("{failed} Your browser's own voice is reading this reply.", {
                failed: answer.audio_error,
              }),
            );
            speakWithBrowser(answer.reply.content, answer.language || language);
          }
        }
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : t("The guide could not answer just now."),
        );
      } finally {
        setSending(false);
      }
    },
    [dictation, language, pinned, planId, player, reload, sending, session, speakOn, t, tf],
  );

  const canSend = Boolean(session) && draft.trim().length > 0 && !sending;

  const startNewConversation = useCallback(async () => {
    player.stop();
    setSafety(false);
    setBooting(true);
    try {
      if (session) {
        try {
          await api.endConversation(session.id);
        } catch {
          // The new chat still opens; only the old thread's status is unsure, and
          // that much is worth saying rather than swallowing.
          toast(t("The previous chat may still be listed as open on the Journey page."), "info");
        }
      }
      const fresh = await api.startConversation("chat", spoken);
      await openSession(fresh, []);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : t("Could not start a new chat."));
    } finally {
      setBooting(false);
    }
  }, [openSession, player, session, spoken, t, toast]);

  const endConversation = useCallback(async () => {
    if (!session) return;
    player.stop();
    cancelBrowserTts();
    try {
      await api.endConversation(session.id);
      toast(t("Conversation closed. Your progress is on the Journey page."), "success");
      setSession(null);
      setMessages([]);
      setBooting(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("Could not close the conversation."), "error");
    }
  }, [player, session, t, toast]);

  const clearMessages = useCallback(async () => {
    if (!session) return;
    try {
      await api.clearConversation(session.id);
      setMessages([]);
      setNotice(t("Earlier messages were deleted from the server."));
      toast(t("Messages deleted."), "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : t("Could not delete the messages."), "error");
    }
  }, [session, t, toast]);

  const stageLine = useMemo(() => {
    if (!session || session.stage <= 1) return null;
    return tf("Guide is at step {step} of {total} — it simply asks a few friendly questions.", {
      step: Math.min(session.stage, GUIDE_STAGES),
      total: GUIDE_STAGES,
    });
  }, [session, tf]);

  if (booting) {
    return (
      <Screen title="Chat with your guide">
        <Card>
          <LoadingPanel label="Opening your conversation…" />
        </Card>
      </Screen>
    );
  }

  if (bootError && !session) {
    return (
      <Screen title="Chat with your guide">
        <ErrorState
          title="The chat could not start"
          description={bootError}
          onRetry={retryBoot}
          retryLabel="Try again"
          extra={
            bootOffline ? (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {process.env.NODE_ENV === "development" ? (
                  <>
                    {tf("The server at {api} is not answering.", { api: BACKEND_URL })}
                    {" " + t("In the backend folder run") + " "}
                    <code>uvicorn app.main:app --reload</code>
                    {t(", then press Try again.")}
                  </>
                ) : (
                  t(
                    "We are having trouble connecting to our servers. Please try again later.",
                  )
                )}
              </p>
            ) : null
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Chat with your guide"
      description="Type, speak, or do both. There is no wrong answer, and you can stop any time."
      badge={<Badge tone="brand">{t("Talk with your guide")}</Badge>}
      action={
        <>
          <Button variant="secondary" size="sm" onClick={() => void startNewConversation()}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("New chat")}
          </Button>
          {session ? (
            <Button variant="ghost" size="sm" onClick={() => void endConversation()}>
              <StopCircle className="h-4 w-4" aria-hidden />
              {t("End")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        {safety ? (
          <Card className="border-warning/40 bg-warning-mist">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-ink">{t("Your safety comes first")}</p>
                <p className="mt-1 leading-relaxed text-ink/80">
                  {t(
                    "If someone is hurting you or you feel unsafe at home, please tell a trusted adult right away — a parent, relative, teacher or school counsellor.",
                  )}{" "}
                  {t("In India you can also call")} <strong>{t("Childline 1098")}</strong>
                  {t(", free, any time, day or night. Career talk can wait.")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setSafety(false)}
                >
                  {t("I have read this")}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {planId && !planChecked ? (
          <p className="text-xs text-muted" role="status">
            {t("Reading your plan…")}
          </p>
        ) : null}

        {pinned && plan ? (
          <Card className="border-brand/30 bg-brand-mist/40">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-dark">
                  <Compass className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-tight text-ink">
                    {t("Your 30-day plan")}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {tf(
                      "Aimed at {career}. Your guide is looking at these same four weeks, so you can ask about week two without describing it.",
                      { career: plan.career.title ? t(plan.career.title) : t("this work") },
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("Put this plan away")}
                onClick={() => setPlanHidden(true)}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {plan.weeks.map((entry) => (
                <li key={entry.week}>
                  <Badge tone="brand">
                    {tf("Week {n}", { n: entry.week })}: {entry.title}
                  </Badge>
                </li>
              ))}
            </ul>
            <LinkButton href={`/app/assessments/result/${planId}`} variant="outline" size="sm" className="mt-3">
              {t("Open the full plan")}
            </LinkButton>
          </Card>
        ) : null}

        {planId && plan && planHidden ? (
          <Button variant="ghost" size="sm" onClick={() => setPlanHidden(false)}>
            <Compass className="h-4 w-4" aria-hidden />
            {t("Show the plan again")}
          </Button>
        ) : null}

        {planId && planChecked && !plan ? (
          <Card className="border-warning/40 bg-warning-mist">
            <p className="text-sm leading-relaxed text-ink">
              {t(
                "That plan is not on this account any more, so your guide has not been shown one. This chat works exactly as it did before — and a questionnaire you answer now comes with a plan of its own.",
              )}
            </p>
            <LinkButton href="/app/assessments" variant="ghost" size="sm" className="mt-2">
              {t("Back to assessments")}
            </LinkButton>
          </Card>
        ) : null}

        {notice ? (
          <p className="rounded-card bg-canvas px-4 py-2.5 text-xs leading-relaxed text-muted">
            {notice}
          </p>
        ) : null}

        {stageLine ? <p className="text-xs text-muted">{stageLine}</p> : null}

        <Card className="flex h-[52vh] min-h-[320px] flex-col p-0">
          <div ref={setListRef} className="cg-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="No messages yet"
                description="Ask anything — “What does an engineer actually do all day?”, “I like drawing but my family wants medicine”, or just tell the guide what you enjoy doing."
              />
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.id}-${index}`}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div className="max-w-[88%] sm:max-w-[76%]">
                    <div
                      className={cn(
                        "rounded-card px-4 py-3 text-sm leading-relaxed shadow-card",
                        message.role === "user"
                          ? "bg-brand text-white"
                          : "border border-line bg-surface text-ink",
                      )}
                    >
                      {message.content}
                    </div>
                    {message.role === "assistant" ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {message.demo_generated ? (
                          <Badge tone="warning">Demo guide answer</Badge>
                        ) : null}
                        {message.themes?.length
                          ? message.themes.map((theme) => (
                              <Badge key={theme} tone="teal">
                                {t(THEME_LABELS[theme as ThemeKey] ?? theme)}
                              </Badge>
                            ))
                          : null}
                        {message.saved?.length
                          ? message.saved.map((label) => (
                              <Badge key={label} tone="brand">
                                {tf("Saved: {fact}", { fact: label })}
                              </Badge>
                            ))
                          : null}
                        {index === messages.length - 1 && lastAudio ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (player.status === "playing") player.toggle();
                              else void player.play(lastAudio);
                            }}
                          >
                            {player.status === "playing" ? (
                              <Pause className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <Play className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {player.status === "playing"
                              ? t("Pause voice")
                              : t("Play voice")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {sending ? (
              <div className="flex justify-start">
                <div className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-muted">
                  <span role="status">{t("Your guide is thinking…")}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-line p-3 sm:p-4">
            {sendError ? (
              <p className="mb-2 rounded-card bg-danger-mist px-3 py-2 text-xs text-danger">
                {sendError}
              </p>
            ) : null}

            {dictation.error ? (
              <p className="mb-2 rounded-card bg-canvas px-3 py-2 text-xs text-muted">
                {t(MIC_ERROR_TEXT[dictation.error])}
              </p>
            ) : null}

            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (canSend) void replyTo(draft);
                  }
                }}
                rows={1}
                placeholder={t("Type your answer… (Enter sends, Shift+Enter makes a new line)")}
                aria-label={t("Message to your guide")}
                className="cg-scrollbar max-h-32 min-h-[46px] flex-1 resize-none rounded-card border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand-mist"
              />
              <Button
                variant="secondary"
                size="icon"
                aria-label={dictation.listening ? t("Stop dictating") : t("Speak your answer")}
                title={
                  dictation.supported
                    ? dictation.listening
                      ? t("Stop listening")
                      : t("Speak instead of typing")
                    : t("Speech input is not available in this browser")
                }
                disabled={!dictation.supported}
                onClick={() => {
                  if (dictation.listening) dictation.stop();
                  else dictation.start();
                }}
                className={cn(dictation.listening && "bg-teal text-white")}
              >
                {dictation.listening ? (
                  <MicOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden />
                )}
              </Button>
              <Button
                size="icon"
                aria-label={t("Send your message")}
                title={t("Send (Enter)")}
                disabled={!canSend}
                onClick={() => void replyTo(draft)}
              >
                {sending ? <Square className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-xs flex-1">
                <Toggle
                  checked={speakOn}
                  onChange={(next) => {
                    setSpeakOn(next);
                    if (!next) {
                      player.stop();
                      cancelBrowserTts();
                    }
                  }}
                  label="Read replies aloud"
                  description="The server's speech service reads replies aloud over the internet, with your browser's own voice as a fallback. Settings names the exact service."
                />
              </div>
              <div className="flex items-center gap-2">
                {player.status === "playing" || player.status === "paused" ? (
                  <Button variant="ghost" size="sm" onClick={() => player.stop()}>
                    <Square className="h-3.5 w-3.5" aria-hidden />
                    {t("Stop voice")}
                  </Button>
                ) : null}
                {messages.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => void clearMessages()}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    {t("Delete these messages")}
                  </Button>
                ) : null}
              </div>
            </div>

            {dictation.listening ? (
              <p className="mt-2 flex items-start gap-2 text-xs text-teal" role="status">
                <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {dictation.interim
                  ? tf("Still hearing: {words}", { words: dictation.interim })
                  : t("Listening… your finished words appear in the box above.")}
              </p>
            ) : null}
          </div>
        </Card>

        {!dictation.supported ? (
          <p className="text-xs leading-relaxed text-muted">
            {t(MIC_ERROR_TEXT.unsupported)}
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
