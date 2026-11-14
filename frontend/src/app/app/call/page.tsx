"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
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
  X,
} from "lucide-react";
import { GuideAvatar, VoiceWave, Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { api, ApiError, BACKEND_URL, isOffline } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { ConversationInfo } from "@/lib/types";
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

// The labels stay in English source text; the screen runs them through t() at
// render, so a dictionary key matches the source and a gap falls back to English.
const STATE_COPY: Record<CallState, { label: string; hint: string; tone: string }> = {
  ready: {
    label: "Ready to call",
    hint: "The microphone stays off until you press the button.",
    tone: "text-white/85",
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
    tone: "text-white/90",
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
    tone: "text-white/85",
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
  const t = useT();
  const tf = useTf();
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
            : t("The guide's voice service did not answer.");
        const handled = speakWithBrowser(text, used, () => onEndedRef.current());
        if (handled) {
          setNotice(`${reason} ${t("Your browser's own voice is reading this one.")}`);
        } else {
          setNotice(`${reason} ${t("Spoken replies are off right now; you can still type your answer.")}`);
          if (settings.continuous_conversation) beginListening();
          else go("ready");
        }
      }
    },
    [beginListening, go, player, settings.continuous_conversation, settings.voice, spoken, t],
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
        // The call has no transcript to hang a badge on, so the status line is where a
        // fallback says so. Without it a scripted reply would sound like the model.
        if (answer.reply.demo_generated) {
          setNotice(
            answer.error ??
              t("Demo mode: this reply came from the built-in guide, not an AI model."),
          );
        } else {
          // A real reply means last turn's fallback reason is stale.
          setNotice(null);
        }

        if (answer.audio_url && !mutedRef.current) {
          go("speaking");
          await player.play(answer.audio_url);
        } else {
          if (answer.audio_error && !mutedRef.current) {
            setNotice(`${answer.audio_error} ${t("Using your browser's voice instead.")}`);
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
            : t("The guide could not hear that. Try again, or type your answer."),
        );
        go("ready");
      } finally {
        sendingRef.current = false;
      }
    },
    [beginListening, clearSilenceTimer, go, player, settings.continuous_conversation, spoken, t],
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
      setNotice(error instanceof Error ? error.message : t("The call could not start."));
      go("ready");
    }
  }, [go, speak, spoken, t]);

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

  // The labels are translated here rather than at the call sites: this function
  // closes over the microphone handlers, and handing what it returns to another
  // function trips the rule against reading a ref during render.
  const centralAction = () => {
    switch (state) {
      case "ready":
      case "ended":
        return {
          label: state === "ended" ? t("Call again") : t("Start the call"),
          icon: Phone,
          run: startCall,
        };
      case "connecting":
      case "thinking":
      case "greeting":
      case "speaking":
        return { label: t("Interrupt and talk"), icon: Mic, run: interrupt };
      case "listening":
        return { label: t("Done talking"), icon: MicOff, run: stopListening };
      case "paused":
        return { label: t("Talk now"), icon: Mic, run: interrupt };
      case "silence":
        return { label: t("Try again"), icon: RefreshCw, run: beginListening };
      case "blocked":
        return { label: t("Try the microphone again"), icon: RefreshCw, run: beginListening };
      default:
        return { label: t("Talk"), icon: Mic, run: beginListening };
    }
  };

  const Central = centralAction().icon;
  const copy = STATE_COPY[state];
  const busy = state === "connecting" || state === "thinking";
  const guideTalking = state === "speaking" || state === "greeting";
  const avatarLive = state === "connecting" || state === "thinking" || guideTalking || state === "listening";
  const waveActive = state === "listening" || guideTalking;
  const halo =
    state === "listening"
      ? "bg-teal/25"
      : guideTalking
        ? "bg-brand-light/25"
        : busy
          ? "bg-brand/20"
          : "bg-brand/10";
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
    // The call is the screen, not a panel on it: the navy surface covers the
    // whole viewport, the stage takes the free height, and the controls sit on
    // the bottom edge. Nothing here is centred inside a max-width page column.
    <div className="relative isolate flex h-dvh flex-col overflow-hidden overscroll-none bg-navy text-white antialiased">
      {/* Two very low-alpha light sources keep the navy from reading as a flat
          rectangle; both live behind every control and take no layout space. */}
      <div aria-hidden className="cg-call-aurora pointer-events-none absolute inset-0 -z-10" />

      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10 lg:py-4">
        <Wordmark tone="white" compact />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMuted((current) => !current)}
            aria-pressed={muted}
            aria-label={muted ? t("Voice off") : t("Voice on")}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80",
              muted
                ? "border-white/15 bg-white/12 text-white hover:bg-white/16"
                : "border-white/10 bg-white/[0.06] text-white/75 hover:border-white/20 hover:bg-white/10 hover:text-white",
            )}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
            <span className="hidden sm:inline">{muted ? t("Voice off") : t("Voice on")}</span>
          </button>
          <Link
            href="/app"
            aria-label={t("Back to dashboard")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          >
            <X className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      {/* One centred column at every width: the call itself, nothing else. */}
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-2 text-center sm:gap-4 sm:px-6 lg:gap-5 lg:px-10">
          {/* An alert is the whole message: the avatar and the idle wave would
              only take the space the card needs to stay on one screen. */}
          {state === "blocked" || safety ? null : (
            <div className="relative flex shrink-0 items-center justify-center">
              {/* A soft ambient glow, tinted by whoever is active: teal while the
                  microphone captures, blue while the guide speaks or thinks. It
                  only breathes while the call is live. */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -inset-10 rounded-full blur-2xl transition-colors duration-700",
                  halo,
                  avatarLive && "cg-call-halo",
                )}
              />
              {/* The ring leaves the microphone only while it is capturing. */}
              {state === "listening" ? (
                <span
                  aria-hidden
                  className="cg-call-ring pointer-events-none absolute -inset-2 rounded-full border border-teal-bright/60"
                />
              ) : null}
              {/* A hairline rim so the sphere catches light like glass instead of
                  ending on a hard navy edge. */}
              <span className="relative rounded-full bg-gradient-to-b from-white/25 via-white/10 to-white/[0.03] p-px shadow-[0_24px_70px_-28px_rgba(37,99,235,0.8)]">
                <GuideAvatar state={avatarState} className="h-24 w-24 sm:h-28 sm:w-28 lg:h-36 lg:w-36" />
              </span>
            </div>
          )}

          <div className="shrink-0">
            <p
              className={cn("text-balance text-[1.375rem] font-semibold leading-tight sm:text-[1.75rem]", copy.tone)}
              role="status"
            >
              {t(copy.label)}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-white/65">{t(copy.hint)}</p>
          </div>

          {state === "blocked" || safety ? null : (
            <div
              className={cn(
                "shrink-0 transition-opacity duration-500",
                waveActive ? "opacity-100 [filter:drop-shadow(0_0_10px_rgba(45,212,191,0.4))]" : "opacity-80",
              )}
            >
              <VoiceWave active={waveActive} />
            </div>
          )}

          {stt.interim ? (
            <p className="max-w-md shrink-0 rounded-card bg-white/10 px-4 py-2 text-sm text-white/90">
              {stt.interim}…
            </p>
          ) : null}

          {state === "blocked" ? (
            <div className="w-full max-w-md shrink-0 space-y-3 text-left">
              {needVoiceConsent ? (
                <div className="rounded-card border border-amber-400/40 bg-amber-400/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                    <Headphones className="h-4 w-4" aria-hidden />
                    {t("Voice is switched off for this account")}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/75">
                    {t(
                      "Calling needs your permission to use the microphone. Turn it on in Settings — you can turn it off again any time, and typing works everywhere.",
                    )}
                  </p>
                  <Link
                    href="/app/settings"
                    className="mt-3 inline-flex rounded-full bg-brand-solid px-4 py-2 text-xs font-semibold text-on-brand"
                  >
                    {t("Open Settings")}
                  </Link>
                </div>
              ) : (
                <p className="rounded-card border border-red-400/30 bg-red-500/10 p-4 text-xs leading-relaxed text-white/85">
                  {t(MIC_ERROR_TEXT[micProblem ?? "unknown"])}
                </p>
              )}
            </div>
          ) : null}

          {safety ? (
            <div className="w-full max-w-md rounded-card border border-amber-400/40 bg-amber-400/10 p-4 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {t("Your safety comes first")}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                {t("Please tell a trusted adult right away — a parent, relative, teacher or school counsellor.")}{" "}
                {t("In India you can call a free helpline any time:")} <strong>Childline 1098</strong>.
              </p>
              <button
                type="button"
                onClick={() => setSafety(false)}
                className="mt-2 text-xs font-medium text-white/70 underline"
              >
                {t("I have read this")}
              </button>
            </div>
          ) : null}

          {notice ? (
            <p className="max-w-md shrink-0 text-xs leading-relaxed text-white/60">{notice}</p>
          ) : null}

          {offline ? (
            <p className="max-w-md shrink-0 text-xs leading-relaxed text-white/60">
              {/localhost|127\.0\.0\.1/.test(BACKEND_URL) ? (
                <>
                  {tf("The CareerGuide server at {api} is not reachable.", {
                    api: BACKEND_URL,
                  })}{" "}
                  {t("Start it with this command:")}
                  <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5">uvicorn app.main:app --reload</code>{" "}
                  {t("Then try again.")}
                </>
              ) : (
                t(
                  "The CareerGuide server is not reachable just now. Your call was not recorded. Try again in a moment, or switch to text.",
                )
              )}
            </p>
          ) : null}
      </section>

      <footer className="shrink-0 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:px-10">
        {/* One connected control group: pause and end sit beside the primary
            button instead of at opposite edges. Both side slots keep the same
            width whether or not their button is showing, so the microphone
            never drifts off centre. */}
        <div className="mx-auto flex w-fit flex-col items-center">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex w-10 items-center justify-center">
              {state === "speaking" || state === "greeting" || state === "paused" ? (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={state === "paused" ? t("Resume the voice") : t("Pause the voice")}
                  className="border border-white/12 bg-white/[0.07] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
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
            </div>

            <button
              type="button"
              onClick={centralAction().run}
              disabled={busy || (!isStudent && state === "ready")}
              className={cn(
                "relative flex h-18 w-18 items-center justify-center overflow-hidden rounded-full text-white transition-all duration-300 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/85 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:h-20 sm:w-20",
                state === "listening"
                  ? "bg-[linear-gradient(180deg,#2dd4bf,#0d9488)] shadow-[0_0_0_8px_rgba(20,184,166,0.12),0_18px_44px_-14px_rgba(13,148,136,0.85)] hover:brightness-105"
                  : busy
                    ? "bg-white/10 text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "bg-[linear-gradient(180deg,#3b82f6,#2563eb)] shadow-[0_0_0_1px_rgba(147,197,253,0.25),0_18px_44px_-14px_rgba(37,99,235,0.9),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110",
              )}
              aria-label={centralAction().label}
            >
              {/* A top-lit gloss gives the circle depth without a second border. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(120%_70%_at_50%_0%,rgba(255,255,255,0.30),transparent_58%)] opacity-80"
              />
              <Central className="relative h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
            </button>

            <div className="flex w-10 items-center justify-center">
              {state !== "ready" && state !== "ended" ? (
                <Button
                  variant="danger"
                  size="icon"
                  aria-label={t("End the call")}
                  className="border border-red-300/30 bg-red-600 text-white shadow-[0_10px_26px_-12px_rgba(239,68,68,0.8),inset_0_1px_0_rgba(255,255,255,0.18)] hover:border-red-200/40 hover:bg-red-500 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200"
                  onClick={() => void endCall()}
                >
                  <PhoneOff className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-white/85">{centralAction().label}</p>
        </div>

        <div className="mx-auto mt-2 flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-1 gap-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            onClick={speakAgain}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {t("Say that again")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            onClick={() => {
              player.stop();
              cancelBrowserTts();
              sttRef.current.stop();
              clearSilenceTimer();
              go("ready");
            }}
          >
            <CircleStop className="h-3.5 w-3.5" aria-hidden />
            {t("Stop voice")}
          </Button>
          <Link
            href="/app/chat"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            {t("Chat by typing instead")}
          </Link>
        </div>

        <form
          className="mx-auto mt-2.5 flex w-full max-w-2xl items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendTurn(typed);
          }}
        >
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={t("Or type your answer here…")}
            aria-label={t("Type your answer")}
            className="min-h-[46px] flex-1 rounded-card border border-white/12 bg-white/[0.07] px-4 py-2.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors placeholder:text-white/35 focus:border-brand-light/70 focus:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-light"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t("Send your message")}
            disabled={!typed.trim() || busy}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </footer>
    </div>
  );
}
