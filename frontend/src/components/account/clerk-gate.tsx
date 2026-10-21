import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled, clerkPublishableKey } from "@/lib/clerk";

/**
 * Wraps the tree in Clerk only when this deployment actually has a key.
 *
 * This is a server component: `ClerkProvider` is the App Router one, and importing
 * it from a `"use client"` file is not supported. Nothing below it changes when
 * Clerk is off — the children render exactly as they did before, which is the whole
 * promise of "optional".
 */
export function ClerkGate({ children }: { children: ReactNode }) {
  if (!clerkEnabled()) return <>{children}</>;
  return <ClerkProvider publishableKey={clerkPublishableKey()}>{children}</ClerkProvider>;
}
