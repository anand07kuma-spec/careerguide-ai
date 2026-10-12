"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "teal" | "neutral" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-mist text-brand-dark",
  teal: "bg-teal-mist text-teal",
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-success-mist text-success",
  warning: "bg-warning-mist text-amber-700",
  danger: "bg-danger-mist text-danger",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Data-trust labels. Anything the family must verify themselves is marked here
 * rather than presented as settled fact.
 */
export function VerificationBadge({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  return (
    <Badge tone={verified ? "success" : "warning"} className={className}>
      {verified ? "Verified source" : "Verify on official site"}
    </Badge>
  );
}

export function EvidenceBadge({
  level,
  className,
}: {
  level: "early" | "some" | "good";
  className?: string;
}) {
  const map = {
    early: { tone: "warning" as Tone, label: "Early signal" },
    some: { tone: "brand" as Tone, label: "Some evidence" },
    good: { tone: "success" as Tone, label: "Several signals" },
  };
  const item = map[level];
  return (
    <Badge tone={item.tone} className={className}>
      {item.label}
    </Badge>
  );
}
