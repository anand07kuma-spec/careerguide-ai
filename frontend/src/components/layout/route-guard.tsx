"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "@/lib/session";

type Access = "any" | "student" | "parent";

/** Where a signed-in user of the wrong role is sent instead. */
const OTHER_HOME: Record<Exclude<Access, "any">, string> = {
  student: "/parent",
  parent: "/app",
};

export function RouteGuard({
  children,
  access = "any",
}: {
  children: ReactNode;
  access?: Access;
}) {
  const { status, isStudent, isParent } = useSession();
  const router = useRouter();

  const roleOk =
    access === "any" || (access === "student" ? isStudent : isParent);

  const redirect =
    status === "signed-out" ? "/onboarding" : status === "ready" && !roleOk
      ? OTHER_HOME[access === "student" ? "student" : "parent"]
      : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <Wordmark />
          <p className="text-sm text-muted" role="status">
            Checking your account…
          </p>
        </div>
      </div>
    );
  }

  if (status === "signed-out" || !roleOk) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-6 text-center">
        <p className="max-w-sm text-sm text-muted" role="status">
          Taking you to the right place…
        </p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
