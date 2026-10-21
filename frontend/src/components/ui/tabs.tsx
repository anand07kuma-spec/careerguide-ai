"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

/**
 * The `id` and `aria-labelledby` a panel needs to complete a `Tabs` group.
 *
 * The tab ids are built inside `Tabs` from the same base, so a caller cannot name them
 * differently by accident — and a `role="tabpanel"` with no label pointing back at the tab
 * that opened it is the half of this pattern that screen readers actually announce.
 */
export function tabpanelProps(base: string, activeValue: string) {
  return {
    id: `${base}-panel`,
    role: "tabpanel" as const,
    "aria-labelledby": `${base}-tab-${activeValue}`,
    tabIndex: 0,
  };
}

export function Tabs({
  items,
  value,
  onChange,
  className,
  scrollable = true,
  idBase,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
  scrollable?: boolean;
  /** Prefix for the tab and panel ids. Pass the same string to `tabpanelProps`. */
  idBase?: string;
  /** Names the group out loud: "Filter the journal by". */
  label?: string;
}) {
  const t = useT();
  const generated = useId();
  const base = idBase ?? generated;
  const stops = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (items.length === 0) return;
    const targets: Record<string, number> = {
      ArrowRight: (activeIndex + 1) % items.length,
      ArrowLeft: (activeIndex - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const item = items[next];
    onChange(item.value);
    // Move the caret with the selection. A tablist where the arrow keys change the panel
    // underneath but leave focus where it was shows a keyboard user a list they have already
    // left, and the next Tab then lands somewhere they did not choose.
    stops.current[item.value]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label ? t(label) : undefined}
      onKeyDown={onKeyDown}
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
            ref={(node) => {
              stops.current[item.value] = node;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${item.value}`}
            aria-controls={`${base}-panel`}
            aria-selected={active}
            // One tab stop for the whole group: every tab in the sequence would otherwise eat
            // a Tab press, so reaching the panel below costs the user as many presses as there
            // are tabs. Arrow keys are the way to move inside a tablist.
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            {t(item.label)}
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
  const t = useT();
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
            {t(item.label)}
          </button>
        );
      })}
    </div>
  );
}
