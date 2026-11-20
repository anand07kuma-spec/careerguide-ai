"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * The last boundary: a failure in the root layout itself, or in the providers it
 * mounts. Next renders this instead of the layout, so it has to bring its own
 * `<html>`, `<body>` and stylesheet — nothing above it survives.
 *
 * That is also why it uses no shared component: the theme provider, the session
 * provider and the router may be exactly what failed. What is left is a heading,
 * a sentence that does not claim more than it knows, and a reload that stays on
 * the same address. Only shown in production; in development the real stack is
 * the more useful screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <main className="mx-auto flex w-full max-w-focus flex-1 flex-col px-4 py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">
            CareerGuide AI
          </p>
          <h1 className="mt-2 text-2xl font-bold">The app couldn&apos;t start</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Nothing you saved was changed. Reloading is safe; if this keeps happening, the
            deployment needs attention rather than anything on your device.
          </p>
          {error.digest ? (
            <p className="mt-3 text-xs text-muted">
              Reference: <code className="rounded bg-canvas px-1.5 py-0.5 text-ink">{error.digest}</code>
            </p>
          ) : null}
          <div className="mt-5">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
