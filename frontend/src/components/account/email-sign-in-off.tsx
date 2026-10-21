"use client";

import { MailQuestion } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

/**
 * What the email routes show when this deployment has no Clerk key.
 *
 * Not an error, and not a mock of Clerk's widget: the honest answer is that nothing
 * is missing from the student's side, because the device they are on already *is*
 * the account. The second paragraph is for whoever runs the site, so the page tells
 * the truth about how the feature would be switched on rather than hiding a
 * half-configured integration.
 */
export function EmailSignInNotSwitchedOn() {
  const t = useT();
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Card className="space-y-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark">
          <MailQuestion className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold text-ink">{t("Email sign-in is not switched on for this site")}</h1>
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "Nobody needs it to use CareerGuide AI. The work on this device is the account: close the tab, come back tomorrow, and everything is still here.",
          )}
        </p>
        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {t(
            "Whoever runs this site can switch it on: set CLERK_SECRET_KEY on the backend, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY here, and point Clerk's webhook at /api/webhooks/clerk. Until all three are in place, this page says so instead of pretending to work.",
          )}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <LinkButton href="/onboarding">{t("Continue without an email")}</LinkButton>
          <LinkButton href="/app/settings" variant="outline">
            {t("Open settings")}
          </LinkButton>
        </div>
      </Card>
    </main>
  );
}
