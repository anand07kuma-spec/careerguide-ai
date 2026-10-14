"use client";

import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand-dark active:translate-y-px disabled:hover:bg-brand",
  secondary:
    "bg-navy text-white shadow-sm hover:bg-navy-600 active:translate-y-px",
  ghost: "bg-transparent text-ink hover:bg-brand-mist/60",
  danger: "bg-danger text-white shadow-sm hover:bg-red-700 active:translate-y-px",
  success: "bg-success text-white shadow-sm hover:bg-green-700 active:translate-y-px",
  outline:
    "bg-surface text-ink border border-line hover:border-brand-light hover:bg-canvas",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-13 px-6 text-base gap-2.5 rounded-2xl",
  icon: "h-10 w-10 justify-center rounded-full",
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
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors",
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
    "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors",
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
