"use client";

import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  // `brand-solid` and `on-brand` are a pair because the readable bright blue in
  // the dark theme needs dark ink on top of it, not white.
  primary:
    "bg-brand-solid text-on-brand shadow-[0_10px_24px_-12px_rgb(37_99_235/0.75)] hover:bg-brand-dark hover:shadow-[0_14px_28px_-12px_rgb(37_99_235/0.8)] active:translate-y-px",
  secondary:
    "bg-navy text-white hover:bg-navy-600 active:translate-y-px",
  ghost: "bg-transparent text-ink hover:bg-brand-mist/60",
  danger: "bg-danger-solid text-white hover:bg-danger-solid/90 active:translate-y-px",
  success: "bg-success-solid text-white hover:bg-success-solid/90 active:translate-y-px",
  outline:
    "bg-surface text-ink border border-line hover:border-brand/50 hover:bg-canvas hover:text-brand",
};

/**
 * No `whitespace-nowrap` here. It used to be on this recipe, and it is inherited:
 * a button holding a whole sentence in a nested block (the Family card on Home)
 * could never wrap it, so the line ran past the card and `body { overflow-x:
 * hidden }` quietly cut the end off. A long Hindi label did the same inside a
 * `w-full` button. Labels now wrap, and the heights below are floors rather than
 * fixed so a second line has somewhere to go.
 */
const BASE =
  "inline-flex select-none items-center justify-center text-center font-medium tracking-[-0.01em] transition-colors";

/* Small still clears a 40px touch target and the icon size clears 44px: the
   header controls and the bottom bar are pressed with a thumb, not a cursor. */
const SIZES: Record<Size, string> = {
  sm: "min-h-10 px-4 py-2 text-sm gap-1.5 rounded-full",
  md: "min-h-11 px-5 py-2.5 text-sm gap-2 rounded-full",
  lg: "min-h-13 px-7 py-3 text-base gap-2.5 rounded-full",
  icon: "h-11 w-11 shrink-0 justify-center rounded-full",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Every control here is a real button: `disabled` truly blocks activation, so a
 * feature that is not wired up can never look like it works.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        BASE,
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

/** The same visual recipe as Button, but it navigates instead of acting. */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const external = /^https?:\/\//.test(href);
  const className2 = buttonClasses(variant, size, className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className2} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className2} {...rest}>
      {children}
    </Link>
  );
}
