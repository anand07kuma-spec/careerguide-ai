"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/careers/theme-toggle";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  Failure,
  PasswordInput,
  failureMessage,
  passwordProblem,
} from "./email-forms";
import { LoginScene } from "./login-scene";

/**
 * The page a reset mail opens.
 *
 * The token is read after mount rather than during render so the server-rendered HTML
 * and the first client render agree. Success ends every session the account had,
 * including this browser's, so the way back in is a full load of `/login` — not a
 * client-side navigation that would keep the previous session in memory.
 */
export function ResetPassword() {
  const t = useT();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token");
    // The same post-mount read `login` does: the query string does not exist during the
    // server render, so reading it earlier would make the two renders disagree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(value && value.trim() ? value : null);
    setReady(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const problems = {
      password: passwordProblem(password, t) ?? undefined,
      confirm: !confirm
        ? t("Enter the password again.")
        : confirm === password
          ? undefined
          : t("The two passwords do not match."),
    };
    setErrors(problems);
    setFailure(null);
    if (problems.password || problems.confirm) return;

    setPending(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (error) {
      setFailure(failureMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative isolate min-h-dvh overflow-x-hidden bg-[#081326] text-white">
      <LoginScene />

      <div className="relative z-10 flex min-h-dvh flex-col px-4 pb-6 pt-4 sm:px-6">
        <a className="cg-skip-link" href="#main-content">
          {t("Skip to content")}
        </a>

        <header className="flex items-center justify-between gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#08152b]/55 px-3.5 py-2 text-xs font-medium text-white/85 backdrop-blur-md transition-colors hover:border-white/35 hover:bg-[#08152b]/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t("Back to sign in")}
          </Link>
          <div className="rounded-full border border-white/15 bg-[#08152b]/50 p-0.5 backdrop-blur-md">
            <ThemeToggle label={t("Switch between light and dark theme")} />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          aria-labelledby="reset-title"
          className="flex flex-1 flex-col items-center justify-center py-6"
        >
          <div className="cg-login-card relative w-full max-w-[24.5rem] overflow-hidden rounded-[26px] border border-white/15 p-5 text-center shadow-[0_40px_90px_-30px_rgba(2,6,18,0.9)] backdrop-blur-xl sm:p-7">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />

            <div className="flex justify-center">
              <Wordmark tone="white" />
            </div>
            <h1
              id="reset-title"
              className="mt-4 text-balance text-[22px] font-bold leading-tight tracking-tight text-white sm:mt-5 sm:text-2xl"
            >
              {t("Choose a new password")}
            </h1>
            <p className="mx-auto mt-1.5 max-w-[20rem] text-sm leading-relaxed text-white/60">
              {t("This link works once and expires shortly. Setting a new password signs out every browser on this account.")}
            </p>

            <div className="mt-5 sm:mt-6">
              {!ready ? (
                <div
                  role="status"
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-white/60"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("Checking your link…")}
                </div>
              ) : done ? (
                <div className="space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#8fd6a7]/30 bg-[#8fd6a7]/10">
                    <KeyRound className="h-5 w-5 text-[#9ce0b2]" aria-hidden />
                  </div>
                  <div role="status" className="space-y-2">
                    <p className="text-sm font-semibold text-white">
                      {t("Your password has been changed")}
                    </p>
                    <p className="text-xs leading-relaxed text-white/65">
                      {t("Every browser that was signed in to this account has been signed out. Use the new password to sign in again.")}
                    </p>
                  </div>
                  <a
                    href="/login"
                    className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#f2563b] text-sm font-semibold text-[#190c06] transition-colors hover:bg-[#f76d55]"
                  >
                    {t("Log in with the new password")}
                  </a>
                </div>
              ) : !token ? (
                <div className="space-y-4">
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[#f2563b]/40 bg-[#f2563b]/15 px-3 py-2.5 text-left"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#f7a08b]"
                      aria-hidden
                    />
                    <p className="text-[11px] leading-relaxed text-white/85">
                      {t("This reset link is incomplete or has expired. Ask for a new one from the sign-in page.")}
                    </p>
                  </div>
                  <a
                    href="/login"
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {t("Back to sign in")}
                  </a>
                </div>
              ) : (
                <form onSubmit={submit} noValidate className="space-y-3.5">
                  <PasswordInput
                    id="reset-password"
                    label={t("New password")}
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    error={errors.password}
                    hint={t("At least 10 characters, with a letter and a digit.")}
                    disabled={pending}
                  />
                  <PasswordInput
                    id="reset-confirm"
                    label={t("Confirm new password")}
                    value={confirm}
                    onChange={setConfirm}
                    autoComplete="new-password"
                    error={errors.confirm}
                    disabled={pending}
                  />

                  {failure ? <Failure message={failure} /> : null}

                  <button
                    type="submit"
                    disabled={pending}
                    className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#f2563b] px-5 text-sm font-semibold text-[#190c06] shadow-[0_16px_34px_-16px_rgba(242,86,59,0.9)] transition-colors hover:bg-[#f76d55] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-75"
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    {pending ? t("Saving…") : t("Set new password")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
