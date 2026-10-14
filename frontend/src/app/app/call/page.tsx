"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Captions,
  CircleStop,
  Headphones,
  Keyboard,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneOff,
  Play,
  RefreshCw,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { GuideAvatar, VoiceWave, Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError, BACKEND_URL, isOffline } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { THEME_LABELS, type ConversationInfo, type ThemeKey } from "@/lib/types";
import {
  MIC_ERROR_TEXT,
  cancelBrowserTts,
  speakWithBrowser,
  useAudioPlayer,
  useSpeechInput,
  type MicErrorKind,
} from "@/lib/voice";

/** Every state the student can see, with its own words and controls. */
type CallState =
  | "ready"
  | "connecting"
  | "greeting"
  | "listening"
  | "thinking"
  | "speaking"
  | "paused"
  | "silence"
  | "blocked"
  | "ended";

interface Caption {
  id: number;
  from: "you" | "guide";
  text: string;
  demo?: boolean;
  themes?: string[];
}

const STATE_COPY: Record<CallState, { label: string; hint: string; tone: string }> = {
  ready: {
    label: "Ready to call",
    hint: "The microphone stays off until you press the button.",
    tone: "text-white/70",
  },
  connecting: {
    label: "Connecting…",
    hint: "Opening your conversation and waking the guide.",
    tone: "text-amber-300",
  },
  greeting: {
    label: "Guide is talking",
    hint: "Press Interrupt any time you want to answer.",
    tone: "text-white",
  },
  listening: {
    label: "Listening — speak now",
    hint: "Nothing is sent until you finish your sentence.",
    tone: "text-teal-300",
  },
  thinking: {
    label: "Thinking…",
    hint: "Sending your words to the guide.",
    tone: "text-white",
  },
  speaking: {
    label: "Guide is answering",
    hint: "Interrupt to speak over the guide whenever you like.",
    tone: "text-blue-300",
  },
  paused: {
    label: "Voice paused",
    hint: "Press Play to hear the rest, or Talk to answer now.",
    tone: "text-white/80",
  },
  silence: {
    label: "Didn't catch that",
    hint: "Tap Talk and say it again — or type your answer.",
    tone: "text-amber-300",
  },
  blocked: {
    label: "Microphone not available",
    hint: "You can still use this guide by typing.",
    tone: "text-red-300",
  },
  ended: {
    label: "Call ended",
    hint: "Everything you said is on your Journey page.",
    tone: "text-white/70",
  },
};

const SILENCE_TIMEOUT_MS = 15000;

/** Only used if the server opens a conversation without a greeting. */
const FALLBACK_GREETING: Record<string, string> = {
  hi: "नमस्ते! मैं तुम्हारा AI करियर गाइड हूँ। बताओ, फ्री टाइम में तुम्हें क्या करना पसंद है?",
  hinglish: "Hi! Main tumhara AI career guide hoon. Batao, free time me tumhe kya karna pasand hai?",
  en: "Hello! Tell me one thing you enjoy doing.",
};

export default function VoiceCallPage() {
  const { settings, user, isStudent } = useSession();
  const language = settings.language || user?.preferred_language || "hinglish";
  // Which language this call is actually running in right now. The guide
  // answers in whatever the student last spoke, so voice output and dictation
  // have to follow that rather than the account default.
  const [spoken, setSpoken] = useState(language);

  const [state, setState] = useState<CallState>("ready");
  const [session, setSession] = useState<ConversationInfo | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [muted, setMuted] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [micProblem, setMicProblem] = useState<MicErrorKind | null>(null);
  const [needVoiceConsent, setNeedVoiceConsent] = useState(false);
  const [safety, setSafety] = useState(false);
  const [typed, setTyped] = useState("");
  const [offline, setOffline] = useState(false);

  const stateRef = useRef<CallState>("ready");
  const sessionRef = useRef<ConversationInfo | null>(null);
  const mutedRef = useRef(false);
  const sendingRef = useRef(false);
  const prePauseRef = useRef<CallState>("speaking");
  const silenceTimer = useRef<number | null>(null);
  const onFinalRef = useRef<(text: string) => void>(() => {});
  const onMicErrorRef = useRef<(kind: MicErrorKind) => void>(() => {});
  const onEndedRef = useRef<() => void>(() => {});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // These three refs hold the newest values for callbacks that fire from browser
  // events (recognition results, audio ending, a timer). They are written after
  // commit, never during render.
  useEffect(() => {
    sessionRef.current = session;
    mutedRef.current = muted;
  }, [session, muted]);

  const go = useCallback((next: CallState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const player = useAudioPlayer({ onEnded: () => onEndedRef.current() });
  const stt = useSpeechInput({
    language: spoken,
    onFinal: (text) => onFinalRef.current(text),
    onError: (kind) => onMicErrorRef.current(kind),
  });
  const sttRef = useRef(stt);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current !== null) {
      window.clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  }, []);

  const beginListening = useCallback(() => {
    if (!sttRef.current.supported) {
      setMicProblem("unsupported");
      go("blocked");
      return;
    }
    sttRef.current.reset();
    setMicProblem(null);
    go("listening");
    sttRef.current.start();
    clearSilenceTimer();
    silenceTimer.current = window.setTimeout(() => {
      if (stateRef.current === "listening") {
        sttRef.current.stop();
        go("silence");
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer, go]);

  const speak = useCallback(
    async (text: string, opening: boolean, lang?: string) => {
      const used = lang ?? spoken;
      if (mutedRef.current) {
        // Muted means no spoken audio at all — straight back to listening.
        if (settings.continuous_conversation) beginListening();
        else go("ready");
        return;
      }
      go(opening ? "greeting" : "speaking");
      try {
        const result = await api.speak(text, used, settings.voice);
        await player.play(result.audio_url);
      } catch (failure) {
        // The server's speech service answers from some networks and not others.
        // Saying which reason stopped it keeps a blocked service from looking
        // like a broken microphone to the student.
        const reason =
          failure instanceof ApiError
            ? failure.message
            : "The guide's voice service did not answer.";
        const handled = speakWithBrowser(text, used, () => onEndedRef.current());
        if (handled) {
          setNotice(`${reason} Your browser's own voice is reading this one.`);
        } else {
          setNotice(`${reason} Spoken replies are off right now; captions still work.`);
          if (settings.continuous_conversation) beginListening();
          else go("ready");
        }
      }
    },
    [beginListening, go, player, settings.continuous_conversation, settings.voice, spoken],
  );

  const sendTurn = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      const active = sessionRef.current;
      if (!text || !active || sendingRef.current) return;

      sendingRef.current = true;
      clearSilenceTimer();
      sttRef.current.stop();
      setTyped("");
      go("thinking");
      setCaptions((current) => [
        ...current,
        { id: Date.now(), from: "you", text },
      ]);

      try {
        const answer = await api.sendMessage(active.id, text, !mutedRef.current);
        // The guide's verdict on whether this sounds like a child asking for help
        // travels with the reply, so no extra request decides whether help shows.
        if (answer.needs_support) setSafety(true);
        setSession({ ...active, stage: answer.stage });
        setSpoken(answer.language || spoken);
        setCaptions((current) => [
          ...current,
          {
            id: answer.reply.id,
            from: "guide",
            text: answer.reply.content,
            demo: answer.reply.demo_generated,
            themes: answer.detected_themes,
          },
        ]);

        if (answer.audio_url && !mutedRef.current) {
          go("speaking");
          await player.play(answer.audio_url);
        } else {
          if (answer.audio_error && !mutedRef.current) {
            setNotice(`${answer.audio_error} Using your browser's voice instead.`);
            const handled = speakWithBrowser(answer.reply.content, answer.language || spoken, () =>
              onEndedRef.current(),
            );
            if (!handled) {
              if (settings.continuous_conversation) beginListening();
              else go("ready");
            } else {
              go("speaking");
            }
          } else if (settings.continuous_conversation) {
            beginListening();
          } else {
            go("ready");
          }
        }
      } catch (error) {
        setOffline(isOffline(error));
        setNotice(
          error instanceof Error
            ? error.message
            : "The guide could not hear that. Try again, or type your answer.",
        );
        go("ready");
      } finally {
        sendingRef.current = false;
      }
    },
    [beginListening, clearSilenceTimer, go, player, settings.continuous_conversation, spoken],
  );

  // The recognition and audio callbacks are wired after commit, so each one sees
  // the same closures the rendered call screen uses.
  useEffect(() => {
    sttRef.current = stt;
    onFinalRef.current = (text) => {
      // Recognition closes a sentence on its own; one turn per sentence keeps the
      // conversation from doubling up if a word arrives twice.
      if (stateRef.current !== "listening") return;
      void sendTurn(text);
    };
    onEndedRef.current = () => {
      if (stateRef.current !== "speaking" && stateRef.current !== "greeting") return;
      if (settings.continuous_conversation) beginListening();
      else go("ready");
    };
    // A microphone problem is a state the student must see, not a silent failure.
    onMicErrorRef.current = (kind) => {
      clearSilenceTimer();
      setMicProblem(kind);
      if (kind === "no-speech") go("silence");
      else if (kind === "aborted") go("ready");
      else go("blocked");
    };
  }, [beginListening, clearSilenceTimer, go, sendTurn, settings.continuous_conversation, stt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [captions]);

  useEffect(
    () => () => {
      clearSilenceTimer();
      sttRef.current.stop();
      cancelBrowserTts();
    },
    [clearSilenceTimer],
  );

  const startCall = useCallback(async () => {
    setNotice(null);
    setOffline(false);
    setNeedVoiceConsent(false);
    go("connecting");
    try {
      const fresh = await api.startConversation("voice", spoken);
      const opening = fresh.language || spoken;
      setSpoken(opening);
      setSession(fresh);
      const greeting = fresh.greeting ?? FALLBACK_GREETING[opening] ?? FALLBACK_GREETING.en;
      setCaptions([
        {
          id: Date.now(),
          from: "guide",
          text: greeting,
          demo: true,
        },
      ]);
      await speak(greeting, true, opening);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setNeedVoiceConsent(true);
        setMicProblem(null);
        go("blocked");
        return;
      }
      setOffline(isOffline(error));
      setNotice(error instanceof Error ? error.message : "The call could not start.");
      go("ready");
    }
  }, [go, speak, spoken]);

  const endCall = useCallback(async () => {
    clearSilenceTimer();
    sttRef.current.stop();
    player.stop();
    cancelBrowserTts();
    const active = sessionRef.current;
    if (active) {
      try {
        await api.endConversation(active.id);
      } catch {
        // Ending is best-effort: the call is already over on this side.
      }
    }
    setSession(null);
    go("ended");
  }, [clearSilenceTimer, go, player]);

  const speakAgain = useCallback(() => {
    const last = captions.filter((item) => item.from === "guide").pop();
    if (!last) return;
    void speak(last.text, false);
  }, [captions, speak]);

  const interrupt = useCallback(() => {
    player.stop();
    cancelBrowserTts();
    beginListening();
  }, [beginListening, player]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    sttRef.current.stop();
    // Recognition may still be finishing a sentence; whatever is on the screen
    // is what the student believes they said, so that is what we send.
    const heard = `${sttRef.current.text} ${sttRef.current.interim}`.trim();
    if (heard) void sendTurn(heard);
    else go("silence");
  }, [clearSilenceTimer, go, sendTurn]);

  const centralAction = () => {
    switch (state) {
      case "ready":
      case "ended":
        return { label: state === "ended" ? "Call again" : "Start the call", icon: Phone, run: startCall };
      case "connecting":
      case "thinking":
      case "greeting":
      case "speaking":
        return { label: "Interrupt and talk", icon: Mic, run: interrupt };
      case "listening":
        return { label: "Done talking", icon: MicOff, run: stopListening };
      case "paused":
        return { label: "Talk now", icon: Mic, run: interrupt };
      case "silence":
        return { label: "Try again", icon: RefreshCw, run: beginListening };
      case "blocked":
        return { label: "Try the microphone again", icon: RefreshCw, run: beginListening };
      default:
        return { label: "Talk", icon: Mic, run: beginListening };
    }
  };

  const Central = centralAction().icon;
  const copy = STATE_COPY[state];
  const busy = state === "connecting" || state === "thinking";
  const avatarState =
    state === "listening"
      ? "listening"
      : state === "thinking"
        ? "thinking"
        : state === "speaking" || state === "greeting"
          ? muted
            ? "muted"
            : "speaking"
          : state === "connecting"
            ? "connecting"
            : muted || state === "blocked"
              ? "muted"
              : "idle";

  return (
    <div className="min-h-dvh bg-navy text-white lg:h-dvh">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <Wordmark tone="white" compact />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMuted((current) => !current)}
              aria-pressed={muted}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                muted ? "bg-white/15 text-white" : "bg-white/8 text-white/70 hover:bg-white/12",
              )}
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
              {muted ? "Voice off" : "Voice on"}
            </button>
            <button
              type="button"
              onClick={() => setCaptionsOn((current) => !current)}
              aria-pressed={captionsOn}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                captionsOn ? "bg-white/15 text-white" : "bg-white/8 text-white/70 hover:bg-white/12",
              )}
            >
              <Captions className="h-3.5 w-3.5" aria-hidden />
              Captions
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
          <div className="relative">
            <GuideAvatar state={avatarState} className="h-28 w-28 sm:h-32 sm:w-32" />
            {state === "listening" ? (
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-teal/20" aria-hidden />
            ) : null}
          </div>

          <div>
            <p className={cn("text-lg font-semibold sm:text-xl", copy.tone)} role="status">
              {copy.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/55">{copy.hint}</p>
          </div>

          <VoiceWave active={state === "listening" || state === "speaking" || state === "greeting"} />

          {stt.interim ? (
            <p className="max-w-md rounded-card bg-white/10 px-4 py-2 text-sm text-white/90">
              {stt.interim}…
            </p>
          ) : null}

          {state === "blocked" ? (
            <div className="w-full max-w-md space-y-3 text-left">
              {needVoiceConsent ? (
                <div className="rounded-card border border-amber-400/40 bg-amber-400/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                    <Headphones className="h-4 w-4" aria-hidden />
                    Voice is switched off for this account
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/75">
                    Calling needs your permission to use the microphone. Turn it on in Settings —
                    you can turn it off again any time, and typing works everywhere.
                  </p>
                  <Link
                    href="/app/settings"
                    className="mt-3 inline-flex rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white"
                  >
                    Open Settings
                  </Link>
                </div>
              ) : (
                <p className="rounded-card border border-red-400/30 bg-red-500/10 p-4 text-xs leading-relaxed text-white/85">
                  {MIC_ERROR_TEXT[micProblem ?? "unknown"]}
                </p>
              )}
            </div>
          ) : null}

          {safety ? (
            <div className="w-full max-w-md rounded-card border border-amber-400/40 bg-amber-400/10 p-4 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Your safety comes first
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                Please tell a trusted adult right away — a parent, relative, teacher or school
                counsellor. In India you can call <strong>Childline 1098</strong>, free, any time.
              </p>
              <button
                type="button"
                onClick={() => setSafety(false)}
                className="mt-2 text-xs font-medium text-white/70 underline"
              >
                I have read this
              </button>
            </div>
          ) : null}

          {notice ? (
            <p className="max-w-md text-xs leading-relaxed text-white/60">{notice}</p>
          ) : null}

          {offline ? (
            <p className="max-w-md text-xs leading-relaxed text-white/60">
              {/localhost|127\.0\.0\.1/.test(BACKEND_URL) ? (
                <>
                  The CareerGuide server is not reachable on port 8000. Start it with
                  <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5">uvicorn app.main:app --reload</code>
                  and try again.
                </>
              ) : (
                "The CareerGuide server is not reachable just now. Your call was not recorded. " +
                  "Try again in a moment, or switch to text."
              )}
            </p>
          ) : null}
        </div>

        {captionsOn ? (
          <div
            ref={scrollRef}
            className="cg-scrollbar max-h-[26vh] min-h-[92px] space-y-2.5 overflow-y-auto rounded-card bg-black/25 p-4"
          >
            {captions.length === 0 ? (
              <p className="text-xs text-white/45">
                Captions appear here as you speak, so you can always follow along in text.
              </p>
            ) : (
              captions.map((item) => (
                <div key={item.id} className={cn("flex", item.from === "you" ? "justify-end" : "justify-start")}>
                  <div className="max-w-[88%]">
                    <p
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        item.from === "you" ? "bg-brand text-white" : "bg-white/12 text-white/95",
                      )}
                    >
                      {item.text}
                    </p>
                    {item.from === "guide" ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 justify-start">
                        {item.demo ? <Badge tone="warning">Demo guide</Badge> : null}
                        {item.themes?.map((theme) => (
                          <Badge key={theme} tone="teal">
                            {THEME_LABELS[theme as ThemeKey] ?? theme}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-center gap-3">
          {state === "speaking" || state === "greeting" || state === "paused" ? (
            <Button
              variant="secondary"
              size="icon"
              aria-label={state === "paused" ? "Resume the voice" : "Pause the voice"}
              onClick={() => {
                if (stateRef.current === "paused") {
                  player.toggle();
                  go(prePauseRef.current);
                } else {
                  prePauseRef.current = stateRef.current;
                  player.toggle();
                  go("paused");
                }
              }}
            >
              {state === "paused" ? (
                <Play className="h-4 w-4" aria-hidden />
              ) : (
                <Pause className="h-4 w-4" aria-hidden />
              )}
            </Button>
          ) : null}

          <button
            type="button"
            onClick={centralAction().run}
            disabled={busy || (!isStudent && state === "ready")}
            className={cn(
              "flex h-18 w-18 items-center justify-center rounded-full transition-all",
              state === "listening"
                ? "bg-teal text-white shadow-[0_0_0_10px_rgba(20,184,166,0.18)]"
                : busy
                  ? "bg-white/15 text-white/60"
                  : "bg-brand text-white shadow-[0_10px_30px_-10px_rgba(37,99,235,0.9)] hover:bg-brand-dark",
            )}
            aria-label={centralAction().label}
          >
            <Central className="h-7 w-7" aria-hidden />
          </button>

          {state !== "ready" && state !== "ended" ? (
            <Button variant="danger" size="icon" aria-label="End the call" onClick={() => void endCall()}>
              <PhoneOff className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>

        <p className="mt-2 text-center text-sm font-medium text-white/80">{centralAction().label}</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={speakAgain}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Say that again
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => {
              player.stop();
              cancelBrowserTts();
              sttRef.current.stop();
              clearSilenceTimer();
              go("ready");
            }}
          >
            <CircleStop className="h-3.5 w-3.5" aria-hidden />
            Stop voice
          </Button>
          <Link
            href="/app/chat"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            Chat by typing instead
          </Link>
        </div>

        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendTurn(typed);
          }}
        >
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Or type your answer here…"
            aria-label="Type your answer"
            className="min-h-[46px] flex-1 rounded-card border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-brand-light"
          />
          <Button type="submit" size="icon" aria-label="Send your message" disabled={!typed.trim() || busy}>
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </form>

        <p className="mt-4 pb-6 text-center text-[11px] leading-relaxed text-white/40">
          The microphone only records while the call screen is listening — never in the background,
          and raw audio is not stored. Speech recognition is your browser&apos;s, spoken replies come
          from Microsoft Edge text-to-speech over the internet, and this is not full-duplex
          streaming: one voice speaks at a time.
        </p>
      </div>
    </div>
  );
}
