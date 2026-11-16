"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

export type MetaTone = "neutral" | "brand" | "teal" | "success" | "warning" | "danger";

/**
 * Compact metadata — a duration, a question count, a status — beside a title.
 *
 * It is the shared Badge recipe at a tighter fixed height rather than a second
 * chip system, so tone, wrapping and dark-theme colours stay identical.
 * Children are rendered as supplied; pass an already-translated label.
 */
export function MetaChip({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: MetaTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Badge
      tone={tone}
      icon={icon}
      className={cn(
        "h-6 shrink-0 gap-1 px-2 py-0 text-2xs font-medium leading-normal",
        className,
      )}
    >
      {children}
    </Badge>
  );
}
