"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

/**
 * What a signed-in screen shows when it throws, instead of a white page.
 *
 * The blank-screen case this exists for is the one a student on a shared handset
 * cannot diagnose or explain: something in the page threw before React got the chance
 * to hydrate, the browser painted nothing, and there is no button to press. An error
 * boundary is the only thing between that and a page that says what happened in words
 * the child can read.
 *
 * Two deliberate omissions:
 *
 *  * The error's own message is not shown. It is a JavaScript sentence written for a
 *    developer, it is the one text in this app that is guaranteed to be in English, and
 *    a stack string on a child's screen is not information, it is noise with a digest
 *    attached. It goes to `console.error` instead, where the person who can act on it
 *    is already looking.
 *  * There is no automatic retry. A page that threw will throw again, and a loop of
 *    reloads on a metered connection spends the family's data to prove a point.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  if (typeof console !== "undefined") console.error(error);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-ink">{t("This page could not open.")}</p>
        <p className="text-xs leading-relaxed text-muted">
          {t(
            "Nothing has been lost and nothing has been cleared. Press the button below, or open another page from the menu.",
          )}
        </p>
        <Button variant="secondary" onClick={reset}>
          {t("Try again")}
        </Button>
      </div>
    </div>
  );
}
