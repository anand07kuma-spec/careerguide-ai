"use client";

import { MailQuestion } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

/**
 * What the older email routes show when this deployment has no Clerk key.
 *
 * Not an error, and not a mock of Clerk's widget. The email-and-password account
 * does not depend on this: it lives on the sign-in page, so the honest answer here
 * is that only the optional second identity is missing. The second paragraph is for
 * whoever runs the site, so the page tells the truth about how it would be switched
 * on rather than hiding a half-configured integration.
 */
export function EmailSignInNotSwitchedOn() {
  const t = useT();
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Card className="space-y-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark">
          <MailQuestion className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold text-ink">
          {t("A second email sign-in is not switched on for this site")}
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "You do not need it. Create an account or sign in with an email and password on the sign-in page, or keep using this browser — whatever you do here stays saved.",
          )}
        </p>
        <p className="rounded-xl bg-subtle p-3 text-xs leading-relaxed text-subtle-ink">
          {t(
            "Whoever runs this site can switch it on: set CLERK_SECRET_KEY on the backend, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY here, and point Clerk's webhook at /api/webhooks/clerk. Until all three are in place, this page says so instead of pretending to work.",
          )}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <LinkButton href="/login">{t("Go to sign in")}</LinkButton>
          <LinkButton href="/app/settings" variant="outline">
            {t("Open settings")}
          </LinkButton>
        </div>
      </Card>
    </main>
  );
}
