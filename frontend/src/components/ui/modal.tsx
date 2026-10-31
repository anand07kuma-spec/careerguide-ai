"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Everything a keyboard can stop on, in the order the browser would visit it. A trap built
// from a shorter list — links and buttons only — skips the text box a child is meant to
// type into, so the dialog looks like it has no way in.
const FOCUSABLE =
  "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), " +
  "select:not([disabled]), [tabindex]:not([tabindex='-1'])";

function reachable(element: HTMLElement): boolean {
  if (element.getAttribute("aria-hidden") === "true") return false;
  // `offsetWidth` is zero for anything hidden by an ancestor too, which is how a footer that
  // closed but stayed mounted would otherwise end up in the tab ring.
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const box = frame.current;
      if (!box) return;
      const stops = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(reachable);
      if (stops.length === 0) {
        event.preventDefault();
        panel.current?.focus();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      const here = document.activeElement as HTMLElement | null;
      // Three ways out of a dialog and each needs its own answer: the end of the ring, a
      // focus still sitting on the frame itself (the first Tab after opening), and a focus
      // that has escaped into the page behind — which happens whenever something else takes
      // it while this is open.
      if (event.shiftKey && (here === first || here === panel.current || !box.contains(here))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && here === last) {
        event.preventDefault();
        first.focus();
      } else if (!here || here === panel.current || !box.contains(here)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.activeElement as HTMLElement | null;
    // Focus the dialog, not its first control: a screen reader then reads the title before
    // the close button, which is the difference between a listener being told a dialog
    // opened and being told the caret jumped somewhere nobody named.
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      // Hand the caret back only if that element is still on the page. A screen that
      // navigated away when this closed has already moved focus, and dragging it back lands
      // the user on a control they cannot see.
      if (previous && previous.isConnected) previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" }[size];
  // Callers pass plain English keys here, the way Screen and CardHeader do.
  const shownTitle = typeof title === "string" ? t(title) : title;
  const shownDescription = typeof description === "string" ? t(description) : description;

  return (
    <div
      ref={frame}
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
    >
      <button
        type="button"
        aria-label={t("Close dialog")}
        onClick={onClose}
        className="absolute inset-0 bg-navy/45 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={typeof shownTitle === "string" ? shownTitle : undefined}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[var(--shadow-lift)] outline-none sm:rounded-3xl",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{shownTitle}</h2>
            {shownDescription ? (
              <p className="mt-1 text-sm text-muted">{shownDescription}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="-mr-1 -mt-1 rounded-full p-2 text-muted hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="cg-scrollbar flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          /* This dialog is a sheet that sits on the bottom edge of the phone, so its buttons
             are exactly where the home indicator is. The app's own bottom bar already reserves
             `env(safe-area-inset-bottom)`; a footer with a flat `py-3` did not, and "Save" was
             under the gesture bar on a real device. */
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas/60 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
