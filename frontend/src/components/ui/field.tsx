"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Callers write these props in plain English, the way `Screen` and `CardHeader` are
 * configured. Anything already rendered — a number, an element — is left alone, and a
 * translation that has not been written yet falls back to the English source. */
function shown(t: (en: string) => string, value: ReactNode): ReactNode {
  return typeof value === "string" ? t(value) : value;
}

const FIELD_BASE =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted";

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
          {shown(t, label)}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {shown(t, error)}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted">{shown(t, hint)}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, required, placeholder, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const t = useT();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} required={required}>
      <input
        ref={ref}
        id={inputId}
        required={required}
        placeholder={typeof placeholder === "string" ? t(placeholder) : placeholder}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_BASE, "h-11", error && "border-danger focus:border-danger focus:ring-danger/25", className)}
        {...rest}
      />
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, rows = 4, placeholder, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const t = useT();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        placeholder={typeof placeholder === "string" ? t(placeholder) : placeholder}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_BASE, "py-2.5 leading-relaxed", className)}
        {...rest}
      />
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, options, placeholder, required, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const t = useT();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} required={required}>
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          required={required}
          className={cn(FIELD_BASE, "h-11 appearance-none pr-10", className)}
          {...rest}
        >
          {placeholder ? <option value="">{t(placeholder)}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
    </Field>
  );
});

export function Checkbox({
  label,
  description,
  className,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const generated = useId();
  const inputId = id ?? generated;
  const t = useT();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-line text-brand accent-brand"
        {...rest}
      />
      <label htmlFor={inputId} className="cursor-pointer select-none">
        <span className="block text-sm font-medium leading-snug text-ink">{shown(t, label)}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted">{shown(t, description)}</span>
        ) : null}
      </label>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const labelId = useId();
  const t = useT();

  return (
    // A switch row is narrow on purpose and Hindi labels are long: `break-words` keeps a
    // word that is wider than the row inside it instead of pushing the switch out of the
    // card, which is what a 320px column measured at 340px of content here.
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <p id={labelId} className="break-words text-sm font-medium text-ink">
          {shown(t, label)}
        </p>
        {description ? (
          <p className="mt-0.5 break-words text-xs leading-relaxed text-muted">{shown(t, description)}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-brand" : "bg-slate-300",
        )}
      >
        {/* `left-0.5` is not decoration: a `<button>` is the knob's containing block, and a
            browser is free to resolve the static position of an absolutely positioned child
            inside button content however it likes. Without an explicit left this knob landed
            at the track's own left edge plus its translate, which measured 20px past the
            right edge of a 44px track — a white dot sitting outside every switch. The 20px of
            `translate-x-5` is exactly the slack left by 44px minus the knob minus two sides
            of 2px inset. */}
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
