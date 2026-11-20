"use client";

import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Wordmark } from "@/components/brand";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The screen a failed render lands on, inside the root layout.
 *
 * It says what happened without saying what broke: the visitor gets the fact
 * (this screen did not load, nothing they saved was changed) and the one part of
 * the error that is safe to repeat — the digest, which is a hash rather than the
 * message. The stack trace goes to the console and nowhere else. `reset()` asks
 * the server for the same page again, which is the honest retry: it either works
 * or it lands back here with a fresh digest.
 */
export default function Error({
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
    <main className="mx-auto flex w-full max-w-focus flex-1 flex-col px-4 py-10 sm:py-16">
      <Wordmark />
      <Card className="mt-6 p-6 sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">This screen couldn&apos;t load</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Nothing you saved was changed. Trying again asks the server for this page once more;
          the rest of CareerGuide AI is still there if it keeps failing.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-muted">
            Reference:{" "}
            <code className="rounded bg-canvas px-1.5 py-0.5 text-ink">{error.digest}</code>
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
          <LinkButton href="/" variant="outline">
            <Home className="h-4 w-4" aria-hidden />
            Go to the homepage
          </LinkButton>
        </div>
      </Card>
    </main>
  );
}
