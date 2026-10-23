import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RouteGuard } from "@/components/layout/route-guard";
import { NOINDEX } from "@/lib/site";

/**
 * The one screen outside `/app` that a student signs in to reach, so it guards itself the
 * way `/app` guards its children rather than living under that layout — the address the
 * feature was asked for is `/interview-prep`, and a dashboard card points straight at it.
 *
 * `access="student"` is deliberate: a parent watching from another seat would turn a
 * practice interview into an inspection, and the answers here are the raw material for
 * that. The backend refuses a parent on this route whatever the screen allows.
 */
export const metadata: Metadata = { robots: NOINDEX };

export default function InterviewPrepLayout({ children }: { children: ReactNode }) {
  return <RouteGuard access="student">{children}</RouteGuard>;
}
