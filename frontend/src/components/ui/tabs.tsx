"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
  scrollable = true,
}: {
  items: TabItem[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
  scrollable?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 rounded-2xl border border-line bg-surface p-1",
        scrollable && "cg-scrollbar -mx-1 overflow-x-auto px-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active ? "bg-white/20" : "bg-canvas text-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function PillGroup({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: string; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("cg-scrollbar flex gap-2 overflow-x-auto pb-1", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-muted hover:border-brand-light hover:text-ink",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
