"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Toggle } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, isOffline } from "@/lib/api";
import { useSession } from "@/lib/session";
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

export default function ChatPage() {
  const { settings, user, reload } = useSession();
  const { toast } = useToast();
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

  const openSession = useCallback(
    async (info: ConversationInfo, history: Turn[]) => {
      setSession(info);
      setMessages(history);
      setNotice(info.greeting ?? null);
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
            error instanceof Error ? error.message : "Could not open the conversation.",
          );
        })
        .finally(() => setBooting(false)),
    [openSession, spoken],
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
        const answer = await api.sendMessage(session.id, trimmed, speakOn);
        // The reply carries the guide's own judgement about whether this sounds
        // like a child asking for help, so a second request that fails cannot
        // decide whether the helpline card appears.
        setSafety(answer.needs_support);
        // Follow the guide's language for the next dictation and any fallback voice.
        setSpoken(answer.language || language);
        // Anything this turn revealed about the student is already saved on the
        // server. Saying so here keeps the storage visible instead of silent.
        const saved: string[] = [];
        for (const [key, value] of Object.entries(answer.profile_updates ?? {})) {
          const label =
            key === "class_level" ? classLabel(String(value)) : FACT_NOTICES[key] ?? key;
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
            setNotice(`${answer.audio_error} Your browser's own voice is reading this reply.`);
            speakWithBrowser(answer.reply.content, answer.language || language);
          }
        }
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : "The guide could not answer just now.",
        );
      } finally {
        setSending(false);
      }
    },
    [dictation, language, player, reload, sending, session, speakOn],
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
          toast("The previous chat may still be listed as open on the Journey page.", "info");
        }
      }
      const fresh = await api.startConversation("chat", spoken);
      await openSession(fresh, []);
      setNotice(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Could not start a new chat.");
    } finally {
      setBooting(false);
    }
  }, [openSession, player, session, spoken, toast]);

  const endConversation = useCallback(async () => {
    if (!session) return;
    player.stop();
    cancelBrowserTts();
    try {
      await api.endConversation(session.id);
      toast("Conversation closed. Your progress is on the Journey page.", "success");
      setSession(null);
      setMessages([]);
      setBooting(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not close the conversation.", "error");
    }
  }, [player, session, toast]);

  const clearMessages = useCallback(async () => {
    if (!session) return;
    try {
      await api.clearConversation(session.id);
      setMessages([]);
      setNotice("Earlier messages were deleted from the server.");
      toast("Messages deleted.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the messages.", "error");
    }
  }, [session, toast]);

  const stageLine = useMemo(() => {
    if (!session || session.stage <= 1) return null;
    return `Guide is at step ${Math.min(session.stage, GUIDE_STAGES)} of ${GUIDE_STAGES} — it simply asks a few friendly questions.`;
  }, [session]);

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
                The server at <code>localhost:8000</code> is not answering. In the
                <code> backend</code> folder run
                <code> uvicorn app.main:app --reload</code>, then press Try again.
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
      badge={<Badge tone="brand">Talk with your guide</Badge>}
      action={
        <>
          <Button variant="secondary" size="sm" onClick={() => void startNewConversation()}>
            <Plus className="h-4 w-4" aria-hidden />
            New chat
          </Button>
          {session ? (
            <Button variant="ghost" size="sm" onClick={() => void endConversation()}>
              <StopCircle className="h-4 w-4" aria-hidden />
              End
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
                <p className="font-semibold text-ink">Your safety comes first</p>
                <p className="mt-1 leading-relaxed text-ink/80">
                  If someone is hurting you or you feel unsafe at home, please tell a trusted adult
                  right away — a parent, relative, teacher or school counsellor. In India you can
                  also call <strong>Childline 1098</strong>, free, any time, day or night. Career
                  talk can wait.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setSafety(false)}
                >
                  I have read this
                </Button>
              </div>
            </div>
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
                                {THEME_LABELS[theme as ThemeKey] ?? theme}
                              </Badge>
                            ))
                          : null}
                        {message.saved?.length
                          ? message.saved.map((label) => (
                              <Badge key={label} tone="brand">
                                Saved: {label}
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
                            {player.status === "playing" ? "Pause voice" : "Play voice"}
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
                  <span role="status">Your guide is thinking…</span>
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
                {MIC_ERROR_TEXT[dictation.error]}
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
                placeholder="Type your answer… (Enter sends, Shift+Enter makes a new line)"
                aria-label="Message to your guide"
                className="cg-scrollbar max-h-32 min-h-[46px] flex-1 resize-none rounded-card border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand-mist"
              />
              <Button
                variant="secondary"
                size="icon"
                aria-label={dictation.listening ? "Stop dictating" : "Speak your answer"}
                title={
                  dictation.supported
                    ? dictation.listening
                      ? "Stop listening"
                      : "Speak instead of typing"
                    : "Speech input is not available in this browser"
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
                aria-label="Send your message"
                title="Send (Enter)"
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
                  description="Uses Microsoft Edge text-to-speech over the internet, or your browser's voice as a fallback."
                />
              </div>
              <div className="flex items-center gap-2">
                {player.status === "playing" || player.status === "paused" ? (
                  <Button variant="ghost" size="sm" onClick={() => player.stop()}>
                    <Square className="h-3.5 w-3.5" aria-hidden />
                    Stop voice
                  </Button>
                ) : null}
                {messages.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => void clearMessages()}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete these messages
                  </Button>
                ) : null}
              </div>
            </div>

            {dictation.listening ? (
              <p className="mt-2 flex items-start gap-2 text-xs text-teal" role="status">
                <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {dictation.interim
                  ? `Still hearing: ${dictation.interim}`
                  : "Listening… your finished words appear in the box above."}
              </p>
            ) : null}
          </div>
        </Card>

        {!dictation.supported ? (
          <p className="text-xs leading-relaxed text-muted">
            {MIC_ERROR_TEXT.unsupported}
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
