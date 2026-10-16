"use client";

/**
 * Voice input and output for the AI call and chat screens.
 *
 * Two honest limits shape everything here:
 * - Speech recognition is the browser's Web Speech API. It is missing in some
 *   browsers, needs a microphone permission, and is not our server's capability.
 * - Replies are spoken by whichever server-side speech service is configured,
 *   which needs an internet connection. Neither is offline, and neither is a
 *   human voice.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type LanguageCode = "en" | "hi" | "hinglish" | string;

/** Speech recognition only understands regional locales, not "Hinglish". */
export function recognitionLocale(language: LanguageCode): string {
  if (language === "hi") return "hi-IN";
  return "en-IN";
}

export function speechSynthesisLocale(language: LanguageCode): string {
  if (language === "hi") return "hi-IN";
  return "en-IN";
}

interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface RecognitionResult {
  isFinal: boolean;
  length: number;
  0: RecognitionAlternative;
}

interface RecognitionResultList {
  length: number;
  [index: number]: RecognitionResult;
}

interface RecognitionResultsEvent extends Event {
  resultIndex: number;
  results: RecognitionResultList;
}

interface RecognitionErrorEvent extends Event {
  error: string;
}

interface RecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionResultsEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type RecognitionConstructor = new () => RecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

function getRecognitionClass(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type MicErrorKind =
  | "unsupported"
  | "denied"
  | "no-microphone"
  | "network"
  | "no-speech"
  | "aborted"
  | "unknown";

/** Wording a 10-year-old can act on, not an error code. */
export const MIC_ERROR_TEXT: Record<MicErrorKind, string> = {
  unsupported:
    "This browser can't turn speech into text. You can still type your answer below, or open this page in Chrome or Edge.",
  denied:
    "The microphone is blocked for this site. Allow it in your browser's address bar, then tap Try again — nothing is recorded until you do.",
  "no-microphone":
    "No microphone was found. Plug one in or use another device, or keep going by typing.",
  network:
    "Speech recognition needs the internet and couldn't reach it. Type your answer instead, or try again in a moment.",
  "no-speech": "I couldn't hear anything. Tap Start talking and try once more.",
  aborted: "Listening was stopped. Tap Start talking whenever you are ready.",
  unknown: "Something went wrong with the microphone. You can type your answer instead.",
};

function classifyMicError(raw: string): MicErrorKind {
  switch (raw) {
    case "not-allowed":
    case "service-not-allowed":
    case "permission-denied":
      return "denied";
    case "audio-capture":
      return "no-microphone";
    case "network":
      return "network";
    case "no-speech":
      return "no-speech";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

export interface SpeechInput {
  /** Whether this browser can do speech-to-text at all. */
  supported: boolean;
  listening: boolean;
  /** Words recognised so far in this turn. */
  text: string;
  /** Partial words still being heard. */
  interim: string;
  error: MicErrorKind | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  clearError: () => void;
}

/**
 * Push-to-talk recognition. `continuous` is left on so a longer answer is not
 * cut off, but the session only ever runs between an explicit start and stop —
 * the microphone is never monitored in the background.
 *
 * `onError` lets a screen react the moment the microphone reports a problem,
 * instead of the page having to watch `error` and translate it afterwards.
 */
export function useSpeechInput(options: {
  language: LanguageCode;
  onFinal?: (text: string) => void;
  onError?: (error: MicErrorKind) => void;
}): SpeechInput {
  const { language, onFinal, onError } = options;
  // Every screen that dictates lives behind the client-only route guard, so this
  // is read on the real browser's first render and never needs a correction.
  const [supported] = useState(() => getRecognitionClass() !== null);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<MicErrorKind | null>(null);

  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const textRef = useRef("");
  const finalHandlerRef = useRef(onFinal);
  const errorHandlerRef = useRef(onError);
  const languageRef = useRef(language);

  // Latest-value refs, written after commit rather than during render: the
  // recognition callbacks that read them only ever fire once this render exists.
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    finalHandlerRef.current = onFinal;
    errorHandlerRef.current = onError;
  }, [onFinal, onError]);

  // Release the recognition session if the screen goes away mid-turn.
  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  const stop = useCallback(() => {
    setListening(false);
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    textRef.current = "";
    setText("");
    setInterim("");
  }, []);

  const start = useCallback(() => {
    // Every failure leaves the same trail: the hook keeps the wording available
    // for a screen that merely displays it, and tells the screen that owns a
    // conversation flow so it can move on straight away.
    const fail = (kind: MicErrorKind) => {
      setError(kind);
      errorHandlerRef.current?.(kind);
    };

    const Ctor = getRecognitionClass();
    if (!Ctor) {
      fail("unsupported");
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = recognitionLocale(languageRef.current);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let pending = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const words = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const trimmed = words.trim();
          if (trimmed) {
            textRef.current = textRef.current ? `${textRef.current} ${trimmed}` : trimmed;
            setText(textRef.current);
            finalHandlerRef.current?.(trimmed);
          }
        } else {
          pending += words;
        }
      }
      setInterim(pending.trim());
    };

    recognition.onerror = (event) => {
      setListening(false);
      setInterim("");
      fail(classifyMicError(event.error));
    };

    recognition.onend = () => {
      // Recognition closes itself after a pause. The screen owns the state
      // machine, so we only report that the microphone has gone quiet.
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    setError(null);
    setInterim("");
    try {
      recognition.start();
    } catch {
      // start() throws if a previous session is still tearing down.
      setError("unknown");
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, text, interim, error, start, stop, reset, clearError };
}

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface AudioPlayer {
  status: PlaybackStatus;
  url: string | null;
  /** Starts a clip, always stopping the previous one first. */
  play: (url: string) => Promise<void>;
  toggle: () => void;
  stop: () => void;
}

/**
 * One clip at a time: a new reply must never overlap the voice still playing,
 * which is what makes interruption feel sane rather than chaotic.
 *
 * `onEnded` fires only when a clip finishes by itself. Manual stops do not call
 * it, so a caller can safely resume listening without a double transition.
 */
export function useAudioPlayer(handlers: { onEnded?: () => void } = {}): AudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endedRef = useRef(handlers.onEnded);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [url, setUrl] = useState<string | null>(null);

  // Written after commit so the `ended` listener always calls the newest handler.
  useEffect(() => {
    endedRef.current = handlers.onEnded;
  }, [handlers.onEnded]);

  const release = useCallback(() => {
    const node = audioRef.current;
    if (node) {
      node.pause();
      node.removeAttribute("src");
      node.load();
    }
    audioRef.current = null;
  }, []);

  useEffect(
    () => () => {
      release();
    },
    [release],
  );

  const stop = useCallback(() => {
    release();
    setUrl(null);
    setStatus("idle");
  }, [release]);

  const play = useCallback(
    async (next: string) => {
      if (typeof window === "undefined") return;
      release();
      setUrl(next);
      setStatus("loading");
      const node = new Audio(next);
      audioRef.current = node;
      node.onplaying = () => setStatus("playing");
      node.onpause = () => setStatus((current) => (current === "loading" ? "paused" : current));
      node.onended = () => {
        const finished = audioRef.current === node;
        audioRef.current = null;
        setUrl(null);
        setStatus("idle");
        if (finished) endedRef.current?.();
      };
      node.onerror = () => {
        setStatus("error");
      };
      try {
        await node.play();
      } catch {
        if (audioRef.current === node) setStatus("error");
      }
    },
    [release],
  );

  const toggle = useCallback(() => {
    const node = audioRef.current;
    if (!node) return;
    if (node.paused) {
      void node.play();
      setStatus("playing");
    } else {
      node.pause();
      setStatus("paused");
    }
  }, []);

  return { status, url, play, toggle, stop };
}

export function browserTtsSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

/**
 * Used when the server's speech service is unavailable. It must be
 * labelled as the browser's own voice, because it sounds different.
 */
export function speakWithBrowser(
  text: string,
  language: LanguageCode,
  onEnd?: () => void,
): boolean {
  if (!browserTtsSupported()) return false;
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechSynthesisLocale(language);
  utterance.rate = 0.95;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  synthesis.speak(utterance);
  return true;
}

export function cancelBrowserTts() {
  if (browserTtsSupported()) window.speechSynthesis.cancel();
}