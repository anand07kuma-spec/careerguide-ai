"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/feedback";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Access = "any" | "student" | "parent";

/** Where a signed-in user of the wrong role is sent instead. */
const OTHER_HOME: Record<Exclude<Access, "any">, string> = {
  student: "/parent",
  parent: "/app",
};

/** A browser the server does not know yet goes to the welcome screen, which offers
 * the two ways in, rather than being dropped on an empty dashboard. */
const FIRST_STOP = "/welcome";

export function RouteGuard({
  children,
  access = "any",
}: {
  children: ReactNode;
  access?: Access;
}) {
  const { status, isStudent, isParent, reload } = useSession();
  const router = useRouter();
  const t = useT();
  const [retrying, setRetrying] = useState(false);

  const roleOk =
    access === "any" || (access === "student" ? isStudent : isParent);

  const redirect =
    status === "new-device" ? FIRST_STOP : status === "ready" && !roleOk
      ? OTHER_HOME[access === "student" ? "student" : "parent"]
      : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (status === "loading") {
    return (
      <>
        <DashboardSkeleton />
        {/* The skeleton is decorative, so the sentence stays for anyone who is
            not looking at it. Reusing the existing key keeps the Hindi for free. */}
        <p className="sr-only" role="status">
          {t("Checking your account…")}
        </p>
      </>
    );
  }

  // The server was reachable but did not answer, or refused the request outright.
  // Saying so and offering a retry beats an endless spinner on a screen that
  // cannot tell the difference between "no internet" and "wrong role".
  if (status === "offline") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Wordmark />
          <p className="text-sm font-semibold text-ink">{t("The server is not answering")}</p>
          <p className="text-xs leading-relaxed text-muted">
            {t(
              "Nothing has been cleared on this device. This usually means the backend is starting up, or the internet dropped for a moment.",
            )}
          </p>
          <Button
            variant="secondary"
            loading={retrying}
            onClick={() => {
              setRetrying(true);
              void reload().finally(() => setRetrying(false));
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("Try again")}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "new-device" || !roleOk) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-6 text-center">
        <p className="max-w-sm text-sm text-muted" role="status">
          {t("Taking you to the right place…")}
        </p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
