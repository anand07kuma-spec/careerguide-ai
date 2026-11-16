"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { SiteHeader } from "@/components/layout/site-header";
import { useT } from "@/lib/i18n";

/**
 * The old first-run form, kept as a compatibility route.
 *
 * Links that were shared, bookmarked or printed before Google sign-in existed still
 * point at `/onboarding?role=…`. The account is now created by the sign-in page, so
 * this route forwards to it and carries the role preference along — nothing is read
 * from the parameter as permission, and an account that already exists keeps its own
 * role. The form itself is not mounted here, and `POST /api/auth/onboarding` still
 * works for anything that calls it directly.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get("role");
    router.replace(role === "parent" || role === "student" ? `/login?role=${role}` : "/login");
  }, [router]);

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader width="focus" skipTo="#main-content" skipLabel={t("Skip to content")}>
        <Wordmark />
      </SiteHeader>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-focus flex-col items-center px-4 py-20 text-center"
      >
        <Loader2 className="h-6 w-6 animate-spin text-brand-dark" aria-hidden />
        <p className="mt-3 text-sm text-muted">{t("Taking you to sign in…")}</p>
      </main>
    </div>
  );
}

