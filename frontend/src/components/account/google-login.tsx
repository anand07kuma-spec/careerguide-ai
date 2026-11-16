"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  GraduationCap,
  Info,
  Loader2,
  Users,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { api } from "@/lib/api";
import { deviceId } from "@/lib/device";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmailLoginForm, EmailSignupForm, ForgotPasswordForm } from "./email-forms";
import { LoginScene } from "./login-scene";

/** Google's four-colour mark, drawn at the size its sign-in button specifies. */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const ERROR_COPY: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled. Nothing was created or changed.",
  google_state:
    "That sign-in link expired, or it belonged to another browser. Please start again from this page.",
  google_conflict:
    "This account is already connected to a different Google account. Sign in with that one, or disconnect it in Settings first.",
  google_failed: "Google could not confirm that sign-in. Please try again.",
  google_unavailable: "Google sign-in is not available on this server right now.",
  consent: "Please read the note below and continue again.",
};

function RoleOption({
  role,
  current,
  icon: Icon,
  label,
  onSelect,
}: {
  role: Role;
  current: Role;
  icon: typeof GraduationCap;
  label: string;
  onSelect: (role: Role) => void;
}) {
  const active = current === role;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(role)}
      className={cn(
        "flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
        active
          ? "bg-[linear-gradient(100deg,#f2563b,#f4735a_60%,#f7a05a)] text-[#1a0d07] shadow-[0_8px_20px_-8px_rgba(242,86,59,0.9)]"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

/**
 * The sign-in for a new or returning account.
 *
 * The button is a link to *this server*, not to Google directly: the server mints the
 * state, the PKCE challenge and the nonce, sends the browser to Google, and verifies the
 * signed identity token when it comes back. That is why no Google client id or secret is
 * in this bundle, and why the role chosen here is a preference inside a signed,
 * short-lived cookie rather than something a URL can change. Switching the role control
 * writes that preference and nothing else — an existing account keeps its own role.
 *
 * A visitor who chose Student or Parent on the screen before this one arrives with
 * `?role=`. That answer is shown, not asked again: only a direct visit has no role to
 * carry, and only then does this page offer the role control. A password login never
 * uses it at all — the session the server returns decides the dashboard.
 *
 * The page decides nothing about where to go afterwards. `useSession` lands the account
 * from the server's own answer and the role on that answer picks the dashboard.
 */
export function GoogleLogin() {
  const t = useT();
  const router = useRouter();
  const { status, isParent } = useSession();
  const [role, setRole] = useState<Role | null>(null);
  /** `null` until the query string is read, then whether it named a role — that
   * arrival already answered this page's only question, so the control is not shown. */
  const [roleFromLink, setRoleFromLink] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [view, setView] = useState<"auth" | "forgot">("auth");
  const shellRef = useRef<HTMLDivElement>(null);

  // `dvh` follows the URL bar but not the on-screen keyboard on iOS, where the
  // keyboard shrinks only the visual viewport. Shrinking the shell to that viewport
  // keeps the panel scrollable instead of leaving its lower half behind the keys.
  useEffect(() => {
    const viewport = window.visualViewport;
    const shell = shellRef.current;
    if (!viewport || !shell) return;
    const fit = () => {
      // Pinch zoom also shrinks the visual viewport, but the page is not underneath a keyboard then.
      const keyboard = viewport.scale === 1 && viewport.height < window.innerHeight - 80;
      shell.style.height = keyboard ? `${Math.round(viewport.height)}px` : "";
      // The panel just got shorter; bring the field that opened the keyboard back into view.
      const active = document.activeElement;
      if (keyboard && active instanceof HTMLElement && shell.contains(active)) {
        requestAnimationFrame(() => active.scrollIntoView({ block: "center" }));
      }
    };
    fit();
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
      shell.style.height = "";
    };
  }, []);

  // Somebody this browser already knows should go to their own dashboard rather than
  // choose a way in for a second account.
  useEffect(() => {
    if (status === "ready") router.replace(isParent ? "/parent" : "/app");
  }, [status, isParent, router]);

  // Query parameters are read after mount so the server-rendered page and the first
  // client render agree. `role` is context shown to the person; it becomes an
  // authorisation input only inside the server-signed state cookie.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chosen = params.get("role");
    const denied = params.get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (chosen === "student" || chosen === "parent") setRole(chosen);
    setRoleFromLink(chosen === "student" || chosen === "parent");
    if (denied) setError(ERROR_COPY[denied] ?? ERROR_COPY.google_failed);
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .googleStatus()
      .then((answer) => {
        if (alive) setConfigured(answer.configured);
      })
      .catch(() => {
        if (alive) setStatusError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  function chooseRole(next: Role) {
    setRole(next);
    // Kept in the address bar so a refresh or a shared link still shows the same choice.
    // It is a preference for a new account, never permission: the server signs it into
    // the state cookie and an existing account's stored role still wins.
    const url = new URL(window.location.href);
    url.searchParams.set("role", next);
    window.history.replaceState(null, "", url);
  }

  // A tablist is expected to move with the arrow keys, not only with a click or Tab.
  function onTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home" || event.key === "ArrowLeft" ? "login" : "signup";
    setTab(next);
    document.getElementById(`${next}-tab`)?.focus();
  }

  function continueWithGoogle() {
    setError(null);
    setRedirecting(true);
    window.location.assign(api.googleStartUrl(role, deviceId()));
  }

  const selected: Role = role ?? "student";

  // Only a direct visit asks for a role: a link that already named one arrives with
  // that answer stored server-side, so the control is not shown again.
  const roleControl =
    roleFromLink === false ? (
      <div className="mt-5">
        <p
          id="role-label"
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40"
        >
          {t("Continue as")}
        </p>
        <div
          role="radiogroup"
          aria-labelledby="role-label"
          className="mt-2 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.07] p-1"
        >
          <RoleOption
            role="student"
            current={selected}
            icon={GraduationCap}
            label={t("Student")}
            onSelect={chooseRole}
          />
          <RoleOption
            role="parent"
            current={selected}
            icon={Users}
            label={t("Parent")}
            onSelect={chooseRole}
          />
        </div>
      </div>
    ) : null;

  return (
    <div ref={shellRef} className="relative isolate h-dvh overflow-hidden bg-[#081326] text-white">
      <LoginScene />

      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[12%] h-72 w-72 rounded-full bg-[#f2563b]/25 blur-[110px]" />
        <div className="absolute -right-24 top-[4%] h-80 w-80 rounded-full bg-[#8b7cf6]/25 blur-[120px]" />
        <div className="absolute bottom-[-14%] left-1/2 h-64 w-[34rem] -translate-x-1/2 rounded-full bg-[#2dd4bf]/20 blur-[130px]" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col px-4 pb-6 pt-4 sm:px-6">
        <a className="cg-skip-link" href="#main-content">
          {t("Skip to content")}
        </a>

        <header className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#08152b]/55 px-3.5 py-2 text-xs font-medium text-white/85 backdrop-blur-md transition-colors hover:border-white/35 hover:bg-[#08152b]/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t("Back to home")}
          </Link>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          aria-label={t("Choose sign in or sign up")}
          className="flex min-h-0 flex-1 flex-col items-center justify-center py-6"
        >
          <div className="cg-login-card relative max-h-full w-full max-w-[24.5rem] overflow-y-auto overscroll-contain rounded-[26px] border border-white/15 p-5 text-center shadow-[0_40px_90px_-30px_rgba(2,6,18,0.9),0_0_80px_-34px_rgba(139,124,246,0.5)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(242,86,59,0.75)_22%,rgba(247,178,103,0.9)_50%,rgba(139,124,246,0.75)_78%,transparent_100%)]"
            />

            {/* The card is navy in both themes, so the logo is the white-lettering file. */}
            <div className="mb-4 flex justify-center sm:mb-5">
              <Wordmark tone="white" compact />
            </div>

            {view === "forgot" ? (
              <ForgotPasswordForm onBack={() => setView("auth")} />
            ) : (
              <>
                <div
                  role="tablist"
                  aria-label={t("Choose sign in or sign up")}
                  onKeyDown={onTabKeyDown}
                  className="relative grid grid-cols-2 rounded-full border border-white/15 p-1"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-[linear-gradient(100deg,#3b6cf6,#1d4ed8)] shadow-[0_12px_28px_-14px_rgba(37,99,235,0.9)] transition-transform duration-300 ease-out",
                      tab === "signup" ? "translate-x-full" : "translate-x-0",
                    )}
                  />
                  <button
                    id="login-tab"
                    type="button"
                    role="tab"
                    aria-selected={tab === "login"}
                    aria-controls="login-panel"
                    tabIndex={tab === "login" ? 0 : -1}
                    onClick={() => setTab("login")}
                    className={cn(
                      "relative z-10 flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80",
                      tab === "login" ? "text-white" : "bg-transparent text-white/70 hover:text-white",
                    )}
                  >
                    {t("Log in")}
                  </button>
                  <button
                    id="signup-tab"
                    type="button"
                    role="tab"
                    aria-selected={tab === "signup"}
                    aria-controls="signup-panel"
                    tabIndex={tab === "signup" ? 0 : -1}
                    onClick={() => setTab("signup")}
                    className={cn(
                      "relative z-10 flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80",
                      tab === "signup" ? "text-white" : "bg-transparent text-white/70 hover:text-white",
                    )}
                  >
                    {t("Sign up")}
                  </button>
                </div>

                {roleControl}

                <div
                  id={tab === "login" ? "login-panel" : "signup-panel"}
                  role="tabpanel"
                  aria-labelledby={`${tab}-tab`}
                  className="mt-5"
                >
                  {tab === "login" ? (
                    <EmailLoginForm onForgot={() => setView("forgot")} />
                  ) : (
                    <EmailSignupForm role={selected} />
                  )}
                </div>

                <div className="my-4 flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#f2563b]/40 to-white/15" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    {t("or")}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/15 via-[#8b7cf6]/40 to-transparent" />
                </div>

                <div>
              {configured === null && !statusError ? (
                <div
                  role="status"
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-white/60"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("Checking sign-in…")}
                </div>
              ) : configured === true ? (
                <button
                  type="button"
                  onClick={continueWithGoogle}
                  disabled={redirecting}
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#dadce0] bg-white px-5 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f8f9fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70"
                >
                  {redirecting ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <GoogleMark className="h-5 w-5" />
                  )}
                  {redirecting ? t("Opening Google…") : t("Continue with Google")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-describedby="google-unavailable"
                  title={t("Google sign-in is not configured yet")}
                  className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-white/70 bg-white/95 px-5 text-sm font-medium text-[#3c4043] shadow-[0_14px_34px_-18px_rgba(0,0,0,0.8)]"
                >
                  <GoogleMark className="h-5 w-5" />
                  {t("Continue with Google")}
                </button>
              )}

              {statusError ? (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#f2563b]/30 bg-[#f2563b]/10 px-3 py-2.5 text-left"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#f7a08b]"
                    aria-hidden
                  />
                  <p className="text-[11px] leading-relaxed text-white/70">
                    {t("Couldn't reach the server to check sign-in. Refresh and try again.")}
                  </p>
                </div>
              ) : null}

              {configured === false ? (
                <div
                  id="google-unavailable"
                  role="status"
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#f2563b]/30 bg-[#f2563b]/10 px-3 py-2.5 text-left"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#f7a08b]" aria-hidden />
                  <p className="text-[11px] leading-relaxed text-white/70">
                    <span className="font-semibold text-white">
                      {t("Google sign-in isn't connected yet.")}
                    </span>{" "}
                    {t(
                      "An operator must enable it for this server — nothing here pretends it works.",
                    )}
                  </p>
                </div>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-[#f2563b]/40 bg-[#f2563b]/15 px-3 py-2.5 text-[11px] leading-relaxed text-white/85"
                >
                  {error}
                </div>
              ) : null}
                </div>
              </>
            )}

            <p className="mx-auto mt-4 max-w-[19.5rem] text-[10.5px] leading-relaxed text-white/40 sm:mt-5">
              {t("By continuing you agree to our")}{" "}
              <Link
                className="font-medium text-white/70 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white"
                href="/terms"
              >
                {t("Terms")}
              </Link>{" "}
              {t("and")}{" "}
              <Link
                className="font-medium text-white/70 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white"
                href="/privacy"
              >
                {t("Privacy Policy")}
              </Link>
              .{" "}
              {t(
                "We store only your progress, preferences and consent. Your password is kept only as a one-way hash, never as text anyone can read.",
              )}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
