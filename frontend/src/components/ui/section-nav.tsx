"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface SectionNavItem {
  id: string;
  label: string;
}

/**
 * A contents list for a long printed-style page.
 *
 * Links are plain hashes — no router state — so the URL still points at a real
 * section and opening it directly lands in the right place. On a phone the list
 * is a horizontal strip; at `lg` it becomes a vertical rail that can stick.
 * Give each target `scroll-mt-*` so the app's header does not cover its heading.
 */
export function SectionNav({
  items,
  label = "Sections",
  activeId,
  sticky = false,
  className,
}: {
  items: SectionNavItem[];
  label?: string;
  /** Lets the page own the highlight; otherwise the visible section is tracked. */
  activeId?: string;
  sticky?: boolean;
  className?: string;
}) {
  const t = useT();
  const [observed, setObserved] = useState(activeId ?? items[0]?.id ?? "");
  const ids = items.map((item) => item.id).join("|");
  const active = activeId ?? observed;

  useEffect(() => {
    if (activeId) return;

    const order = ids.split("|").filter(Boolean);
    if (order.length === 0) return;

    let frame = 0;
    const sync = () => {
      frame = 0;
      // The current section is the last one whose heading has crossed the
      // upper reading line. A visibility band alone is ambiguous when two tall
      // sections meet, which leaves the highlight on the wrong link.
      const line = window.innerHeight * 0.4;
      let next = order[0];
      for (const id of order) {
        const node = document.getElementById(id);
        if (node && node.getBoundingClientRect().top <= line) next = id;
      }
      if (next) setObserved(next);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(sync);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [activeId, ids]);

  return (
    <nav
      aria-label={t(label)}
      className={cn("min-w-0", sticky && "lg:sticky lg:top-6 lg:self-start", className)}
    >
      <ul className="cg-scrollbar flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="shrink-0 lg:shrink">
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={() => setObserved(item.id)}
                className={cn(
                  "flex min-h-11 items-center rounded-full px-3 text-xs font-medium transition-colors lg:rounded-control lg:text-sm",
                  isActive
                    ? "bg-brand-mist text-brand"
                    : "text-muted hover:bg-subtle hover:text-ink",
                )}
              >
                {t(item.label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
