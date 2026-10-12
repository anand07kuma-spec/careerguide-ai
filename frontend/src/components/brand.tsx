"use client";

import { cn } from "@/lib/utils";

/** Original mark: a guide robot under a graduation cap. No emoji, no stock icon. */
export function BrandMark({ className, tone = "brand" }: { className?: string; tone?: "brand" | "white" }) {
  const shell = tone === "white" ? "#FFFFFF" : "#2563EB";
  const face = tone === "white" ? "#0B1730" : "#0B1730";
  const eye = tone === "white" ? "#60A5FA" : "#60A5FA";
  return (
    <svg viewBox="0 0 48 48" className={cn("h-9 w-9", className)} role="img" aria-label="CareerGuide AI logo">
      <path d="M24 3 6 11l18 8 14-6.2V21h4V11L24 3Z" fill={shell} opacity={tone === "white" ? 0.9 : 1} />
      <path d="M10 20.5V28c0 4.4 6.3 8 14 8s14-3.6 14-8v-7.5l-14 6-14-6Z" fill={shell} />
      <rect x="12" y="27" width="24" height="16" rx="6" fill={face} />
      <circle cx="19.5" cy="35" r="2.4" fill={eye} />
      <circle cx="28.5" cy="35" r="2.4" fill={eye} />
      <rect x="21.6" y="40" width="4.8" height="1.8" rx="0.9" fill={eye} opacity="0.75" />
      <rect x="8" y="24" width="3.5" height="8" rx="1.75" fill={shell} opacity="0.7" />
      <rect x="36.5" y="24" width="3.5" height="8" rx="1.75" fill={shell} opacity="0.7" />
      <path d="M38 26v6c0 1.5 2.5 2.6 5 2.6" stroke={shell} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="43" cy="35.5" r="2" fill="#14B8A6" />
    </svg>
  );
}

export function Wordmark({
  className,
  tone = "brand",
  compact = false,
}: {
  className?: string;
  tone?: "brand" | "white";
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark tone={tone === "white" ? "white" : "brand"} className={compact ? "h-7 w-7" : "h-9 w-9"} />
      <div className="min-w-0 leading-tight">
        <p
          className={cn(
            "truncate font-semibold tracking-tight",
            compact ? "text-sm" : "text-base",
            tone === "white" ? "text-white" : "text-brand",
          )}
        >
          CareerGuide AI
        </p>
        {!compact ? (
          <p className={cn("truncate text-[11px]", tone === "white" ? "text-white/60" : "text-muted")}>
            Your Future, Our Guidance
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The guide avatar used on the call screen. `state` drives the ring so the
 * student always knows whether the microphone, the guide, or neither is active.
 */
export function GuideAvatar({
  state = "idle",
  className,
}: {
  state?: "idle" | "connecting" | "listening" | "thinking" | "speaking" | "muted";
  className?: string;
}) {
  const ring = {
    idle: "shadow-[0_0_0_6px_rgba(96,165,250,0.12)]",
    connecting: "shadow-[0_0_0_8px_rgba(245,158,11,0.18)] animate-pulse",
    listening: "shadow-[0_0_0_10px_rgba(20,184,166,0.22)]",
    thinking: "shadow-[0_0_0_8px_rgba(96,165,250,0.22)] animate-pulse",
    speaking: "shadow-[0_0_0_12px_rgba(37,99,235,0.28)]",
    muted: "shadow-[0_0_0_6px_rgba(100,116,139,0.2)]",
  }[state];

  const eyes = state === "speaking" ? "M17 34c2.5 2.5 8.5 2.5 11 0" : null;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-navy-600 to-navy transition-shadow duration-500",
        ring,
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 60 60" className="h-3/5 w-3/5">
        <rect x="14" y="20" width="32" height="28" rx="11" fill="#0B1730" stroke="#60A5FA" strokeWidth="1.5" />
        <rect x="19" y="26" width="22" height="16" rx="7" fill="#12233F" />
        {eyes ? (
          <path d={eyes} stroke="#60A5FA" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ) : (
          <>
            <circle cx="25" cy="33" r="2.6" fill="#60A5FA" />
            <circle cx="35" cy="33" r="2.6" fill="#60A5FA" />
          </>
        )}
        <rect x="27" y="38.5" width="6" height="2" rx="1" fill="#60A5FA" opacity="0.6" />
        <rect x="9" y="28" width="4" height="11" rx="2" fill="#2563EB" />
        <rect x="47" y="28" width="4" height="11" rx="2" fill="#2563EB" />
        <path d="M30 8 13 15l17 7 13-5.4V24h4V15L30 8Z" fill="#2563EB" />
        <path d="M18 24.5V29c0 3 5.4 5.4 12 5.4S42 32 42 29v-4.5L30 29.5 18 24.5Z" fill="#1d4ed8" />
        <circle cx="46" cy="27" r="2.2" fill="#14B8A6" />
      </svg>
    </div>
  );
}

/** Compact waveform used for listening and speaking indicators. */
export function VoiceWave({ active, className }: { active: boolean; className?: string }) {
  const bars = [10, 18, 26, 16, 22, 30, 14, 20, 12];
  return (
    <div className={cn("flex h-8 items-center justify-center gap-[3px]", className)} aria-hidden>
      {bars.map((height, index) => (
        <span
          key={index}
          className={cn(
            "w-[3px] rounded-full bg-teal transition-all duration-300",
            active ? "cg-wave-bar opacity-100" : "opacity-25",
          )}
          style={{
            height: active ? height : 5,
            animationDelay: active ? `${index * 90}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
