"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { deviceId } from "@/lib/device";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "min-h-11 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3.5 text-sm text-white placeholder:text-white/35 transition-colors focus:border-[#f2563b]/80 focus:outline-none focus:ring-2 focus:ring-[#f2563b]/25 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-[#f2563b]/70";

const LABEL_CLASS =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45";

const ERROR_CLASS = "mt-1.5 text-[11px] leading-relaxed text-[#f7a08b]";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailProblem(value: string, t: (en: string) => string): string | null {
  const email = value.trim();
  if (!email) return t("Enter your email address.");
  if (!EMAIL_RE.test(email)) return t("That email address does not look right.");
  return null;
}

/** Mirrors `services/passwords.py` sentence for sentence, so the answer arrives before
 * the request. The server still decides: it also refuses the common strings and the
 * address itself, and its 422 is shown if this lighter check misses one. */
export function passwordProblem(value: string, t: (en: string) => string): string | null {
  if (!value) return t("Enter a password.");
  if (value.length < 10) return t("Use at least 10 characters.");
  if (value.length > 200) return t("Use no more than 200 characters.");
  if (!/[\p{L}]/u.test(value) || !/\p{Nd}/u.test(value))
    return t("Use at least one letter and one digit.");
  return null;
}

/** Every 4xx message this API writes for these forms is already a sentence for a
 * family, so it is shown unchanged. Only the two states a person cannot act on — a
 * missing mail configuration and a dead connection — get their own wording. */
export function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return "Password reset email is not set up on this server yet. Please ask the operator to enable it.";
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="text-left">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={ERROR_CLASS}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[11px] leading-relaxed text-white/40">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(INPUT_CLASS, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={t(visible ? "Hide password" : "Show password")}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-white/55 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:opacity-60"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </Field>
  );
}

function SubmitButton({
  pending,
  idle,
  busy,
}: {
  pending: boolean;
  idle: string;
  busy: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[linear-gradient(100deg,#f2563b,#f4735a_55%,#f7a05a)] px-5 text-sm font-semibold text-[#190c06] shadow-[0_16px_34px_-16px_rgba(242,86,59,0.9)] transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-75"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {pending ? busy : idle}
    </button>
  );
}

export function Failure({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[#f2563b]/40 bg-[#f2563b]/15 px-3 py-2.5 text-left"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f7a08b]" aria-hidden />
      <p className="text-[11px] leading-relaxed text-white/85">{message}</p>
    </div>
  );
}

export function EmailLoginForm({ onForgot }: { onForgot: () => void }) {
  const t = useT();
  const { adopt } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = {
      email: emailProblem(email, t) ?? undefined,
      password: password ? undefined : t("Enter your password."),
    };
    setErrors(problems);
    setFailure(null);
    if (problems.email || problems.password) return;

    setPending(true);
    try {
      adopt(await api.emailLogin(email.trim(), password, deviceId()));
    } catch (error) {
      setFailure(failureMessage(error));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3.5">
      <Field id="login-email" label={t("Email address")} error={errors.email}>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          disabled={pending}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          className={INPUT_CLASS}
        />
      </Field>

      <div>
        <PasswordInput
          id="login-password"
          label={t("Password")}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={errors.password}
          disabled={pending}
        />
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={onForgot}
            className="rounded text-[11px] font-medium text-white/60 underline decoration-white/25 underline-offset-2 transition-colors hover:text-white"
          >
            {t("Forgot password?")}
          </button>
        </div>
      </div>

      {failure ? <Failure message={failure} /> : null}

      <SubmitButton pending={pending} idle={t("Log in")} busy={t("Signing in…")} />
    </form>
  );
}

export function EmailSignupForm({ role }: { role: Role }) {
  const t = useT();
  const { adopt } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems = {
      name: name.trim() ? undefined : t("Please enter your name."),
      email: emailProblem(email, t) ?? undefined,
      password: passwordProblem(password, t) ?? undefined,
      confirm: !confirm
        ? t("Enter the password again.")
        : confirm === password
          ? undefined
          : t("The two passwords do not match."),
    };
    setErrors(problems);
    setFailure(null);
    if (problems.name || problems.email || problems.password || problems.confirm) return;

    setPending(true);
    try {
      adopt(
        await api.emailRegister({
          role,
          display_name: name.trim(),
          email: email.trim(),
          password,
          device_id: deviceId(),
        }),
      );
    } catch (error) {
      setFailure(failureMessage(error));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3.5">
      <Field id="signup-name" label={t("Full name")} error={errors.name}>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={80}
          disabled={pending}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "signup-name-error" : undefined}
          className={INPUT_CLASS}
        />
      </Field>

      <Field id="signup-email" label={t("Email address")} error={errors.email}>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          disabled={pending}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          className={INPUT_CLASS}
        />
      </Field>

      <PasswordInput
        id="signup-password"
        label={t("Password")}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        error={errors.password}
        hint={t("At least 10 characters, with a letter and a digit.")}
        disabled={pending}
      />

      <PasswordInput
        id="signup-confirm"
        label={t("Confirm password")}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        error={errors.confirm}
        disabled={pending}
      />

      {failure ? <Failure message={failure} /> : null}

      <SubmitButton pending={pending} idle={t("Create account")} busy={t("Creating your account…")} />
    </form>
  );
}

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = emailProblem(email, t);
    setError(problem ?? undefined);
    setFailure(null);
    if (problem) return;

    setPending(true);
    try {
      const answer = await api.requestPasswordReset(email.trim());
      setSent(answer.message);
    } catch (caught) {
      setFailure(failureMessage(caught));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#8fd6a7]/30 bg-[#8fd6a7]/10">
          <MailCheck className="h-5 w-5 text-[#9ce0b2]" aria-hidden />
        </div>
        <div role="status" className="space-y-2">
          <p className="text-sm font-semibold text-white">{t("Check your inbox")}</p>
          <p className="text-xs leading-relaxed text-white/65">{sent}</p>
          <p className="text-[11px] leading-relaxed text-white/40">
            {t("The link works once and expires in 30 minutes. If it does not arrive, check the spam folder or ask for another.")}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-sm font-medium text-white transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("Back to sign in")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3.5">
      <p className="text-left text-xs leading-relaxed text-white/55">
        {t("Enter the email address this account uses and we will send a link to choose a new password.")}
      </p>

      <Field id="forgot-email" label={t("Email address")} error={error}>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "forgot-email-error" : undefined}
          className={INPUT_CLASS}
        />
      </Field>

      {failure ? <Failure message={failure} /> : null}

      <SubmitButton
        pending={pending}
        idle={t("Send reset link")}
        busy={t("Sending the link…")}
      />

      <button
        type="button"
        onClick={onBack}
        className="mx-auto flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-white/55 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t("Back to sign in")}
      </button>
    </form>
  );
}

