"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyRound, LogIn, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";

/** Groups of five are easier to read and copy than fifteen characters in a row. */
function formatCode(value: string): string {
  const raw = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 15);
  return `${raw.slice(0, 5)}${raw.length > 5 ? `-${raw.slice(5, 10)}` : ""}${
    raw.length > 10 ? `-${raw.slice(10, 15)}` : ""
  }`;
}

const CODE_LENGTH = 15;

export default function LoginPage() {
  const router = useRouter();
  const { status, isParent, signIn } = useSession();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Someone who is already signed in has nothing to do here.
  useEffect(() => {
    if (status === "ready") router.replace(isParent ? "/parent" : "/app");
  }, [status, isParent, router]);

  const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ready = raw.length === CODE_LENGTH;

  async function submit() {
    if (!ready) return;
    setError(null);
    setSubmitting(true);
    try {
      const next = await signIn(code);
      router.replace(next.user.role === "parent" ? "/parent" : "/app");
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Something went wrong signing you in. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Wordmark />
          <LinkButton href="/" variant="ghost" size="sm">
            Intro
          </LinkButton>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-8 sm:px-6">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              Welcome back
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-navy">
              Open your account again
              <br />
              on any device
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Your come-back code is the only thing needed. No email, no phone number, no password
              to reuse somewhere else.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
                  <KeyRound className="h-4 w-4" aria-hidden />
                </span>
                One code, shown once when the account was created
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-mist text-teal">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                Everything you explored comes back with you
              </li>
            </ul>
          </section>

          <Card className="p-6 sm:p-7">
            <h1 className="text-lg font-semibold tracking-tight text-ink lg:hidden">Sign in</h1>
            <form
              className="mt-4 space-y-4 lg:mt-0"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="hidden lg:block">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Sign in
                </p>
                <h2 className="mt-1 text-base font-semibold text-ink">Enter your come-back code</h2>
              </div>

              <Input
                label="Come-back code"
                hint="Letters and numbers only. Dashes are added for you."
                value={code}
                onChange={(event) => setCode(formatCode(event.target.value))}
                placeholder="ABCDE-FGHIJ-KLMNO"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                aria-describedby="code-help"
                className="font-mono tracking-[0.12em]"
                disabled={submitting}
              />

              {error ? (
                <p role="alert" className="rounded-card bg-danger-mist px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" loading={submitting} disabled={!ready}>
                <LogIn className="h-4 w-4" aria-hidden />
                Sign in
              </Button>

              <details id="code-help" className="rounded-card bg-canvas px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  Where do I find my code?
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  It appeared once, right after the account was created, and is kept in the
                  {" "}
                  <span className="font-medium text-ink">Sign-in code</span> section of Settings. The
                  server only stores an unreadable check of it, so a lost code cannot be shown
                  again — sign in on the device that already has the account and create a fresh one
                  there, or start a new account below.
                </p>
              </details>

              <div className="border-t border-line pt-4">
                <p className="text-sm text-muted">
                  No account yet?{" "}
                  <LinkButton href="/onboarding" variant="ghost" size="sm" className="-ml-2 px-2 text-brand-dark hover:bg-transparent">
                    Create one in a minute
                  </LinkButton>
                </p>
              </div>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
