"use client";

import { cn } from "@/lib/utils";

/**
 * The approved horizontal artwork, used whole: emblem, name and tagline are all
 * in the delivered file. Only the outer white margin was removed (and made
 * transparent), so the wordmark must not be repeated beside it.
 *
 * The artwork's lettering is navy, which disappears on a dark header. The dark
 * file is the same artwork with only that lettering lifted to white; the emblem
 * keeps its exact pixels. CSS swaps the two files with the theme, so no plate,
 * card or background ever sits behind the logo.
 *
 * `tone="onDark"` pins the white-lettering file for surfaces that stay navy in
 * both themes — the footer, the app sidebar, the call screen and the auth cards.
 */
export function HorizontalLogo({
  className,
  tone = "auto",
  compact = false,
}: {
  className?: string;
  tone?: "auto" | "onDark";
  compact?: boolean;
}) {
  const size = compact ? "h-7 sm:h-8" : "h-9 sm:h-10";
  return (
    <span
      role="img"
      aria-label="CareerGuide AI"
      className={cn(
        "cg-horizontal-logo inline-flex max-w-full shrink-0 items-center",
        tone === "onDark" && "cg-logo-on-dark",
        className,
      )}
    >
      {/* Served exactly as delivered: `next/image` would re-encode the file. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/careerguide-horizontal-logo.png"
        alt=""
        width={726}
        height={195}
        className={cn("cg-logo-light w-auto max-w-full object-contain", size)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/careerguide-horizontal-logo-dark.png"
        alt=""
        width={726}
        height={195}
        aria-hidden
        className={cn("cg-logo-dark w-auto max-w-full object-contain", size)}
      />
    </span>
  );
}

/**
 * Kept as the one brand component every screen imports. `tone="white"` still
 * means "this surface is dark in both themes", which now selects the artwork's
 * white-lettering file instead of recolouring hand-drawn text.
 */
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
    <HorizontalLogo
      className={className}
      tone={tone === "white" ? "onDark" : "auto"}
      compact={compact}
    />
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
            "w-[3px] rounded-full bg-teal-bright transition-all duration-300",
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
