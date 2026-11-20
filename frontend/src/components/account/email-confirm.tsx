"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/careers/theme-toggle";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { failureMessage } from "./email-forms";
import { LoginScene } from "./login-scene";

type Answer = { confirmed: boolean; note: string };

type State =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "confirmed"; note: string }
  | { kind: "refused"; note: string }
  | { kind: "failed"; note: string };

/**
 * The page a confirmation mail opens.
 *
 * The backend's only public route that makes an address usable, so the token in the
 * query string is the whole credential and this page never asks anybody to sign in.
 * A route that demanded a session would be one a parent cannot open on the family
 * phone, which is where this link usually lands.
 *
 * The request is held in a ref so a development double-mount cannot open the link
 * twice: redeeming is single-use, and the second answer would say "already used" about
 * a link that had just worked.
 */
export function EmailConfirm() {
  const t = useT();
  const [state, setState] = useState<State>({ kind: "checking" });
  const asked = useRef<Promise<Answer> | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: "missing" });
      return;
    }
    let live = true;
    asked.current ??= api.confirmEmailAddress(token);
    asked.current
      .then((answer) => {
        if (!live) return;
        setState(
          answer.confirmed
            ? { kind: "confirmed", note: answer.note }
            : { kind: "refused", note: answer.note },
        );
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState({ kind: "failed", note: failureMessage(error) });
      });
    return () => {
      live = false;
    };
  }, []);

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
          aria-labelledby="confirm-title"
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
              id="confirm-title"
              className="mt-4 text-balance text-[22px] font-bold leading-tight tracking-tight text-white sm:mt-5 sm:text-2xl"
            >
              {t("Confirm this email address")}
            </h1>

            <div className="mt-5 sm:mt-6">
              {state.kind === "checking" ? (
                <div
                  role="status"
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-white/60"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("Opening your link…")}
                </div>
              ) : null}

              {state.kind === "confirmed" ? (
                <div className="space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#8fd6a7]/30 bg-[#8fd6a7]/10">
                    <CheckCircle2 className="h-5 w-5 text-[#9ce0b2]" aria-hidden />
                  </div>
                  <div role="status" className="space-y-2">
                    <p className="text-sm font-semibold text-white">
                      {t("This address is confirmed")}
                    </p>
                    <p className="text-xs leading-relaxed text-white/65">{state.note}</p>
                  </div>
                  <Link
                    href="/app/settings"
                    className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#f2563b] text-sm font-semibold text-[#190c06] transition-colors hover:bg-[#f76d55]"
                  >
                    {t("Open email settings")}
                  </Link>
                  <p className="text-[11px] leading-relaxed text-white/40">
                    {t("Nothing else changed. Each kind of message — a result, a weekly summary, a receipt — is switched on separately in settings.")}
                  </p>
                </div>
              ) : null}

              {state.kind === "missing" ? (
                <div className="space-y-4">
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[#f2563b]/40 bg-[#f2563b]/15 px-3 py-2.5 text-left"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f7a08b]" aria-hidden />
                    <p className="text-[11px] leading-relaxed text-white/85">
                      {t("This link is incomplete. Open the whole address from the message we sent, or ask for a new one from settings.")}
                    </p>
                  </div>
                  <Link
                    href="/app/settings"
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {t("Open email settings")}
                  </Link>
                </div>
              ) : null}

              {state.kind === "refused" ? (
                <div className="space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
                    <MailCheck className="h-5 w-5 text-white/70" aria-hidden />
                  </div>
                  <div role="status" className="space-y-2">
                    <p className="text-sm font-semibold text-white">
                      {t("This link no longer works")}
                    </p>
                    <p className="text-xs leading-relaxed text-white/65">{state.note}</p>
                  </div>
                  <Link
                    href="/app/settings"
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {t("Open email settings")}
                  </Link>
                </div>
              ) : null}

              {state.kind === "failed" ? (
                <div className="space-y-4">
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[#f2563b]/40 bg-[#f2563b]/15 px-3 py-2.5 text-left"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f7a08b]" aria-hidden />
                    <p className="text-[11px] leading-relaxed text-white/85">{state.note}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {t("Try again")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
