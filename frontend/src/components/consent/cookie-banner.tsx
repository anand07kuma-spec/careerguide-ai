"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { analyticsConfigured } from "@/components/analytics/Analytics";
import { useT } from "@/lib/i18n";
import { useCookieConsent } from "@/lib/use-cookie-consent";
import { CookiePreferences } from "./cookie-preferences";

/**
 * The storage notice.
 *
 * It started life as a banner that had nothing to ask, because this site set no
 * cookies, no analytics and no advertising — so the honest notice was about the
 * four values the app keeps in this browser to know who is coming back. That is
 * still true of the default build, and this component says that when it is true.
 *
 * What changed is that there is now something worth asking about: a deployment
 * that names a Google Analytics and a Clarity project. So the copy is read from
 * the same flag the scripts themselves are gated on (`analyticsConfigured()`),
 * not from a fixed sentence. A banner that promises "no analytics" while an
 * analytics script is loading is worse than no banner at all, and a banner that
 * warns about measurement nobody has switched on teaches a visitor that nothing
 * here is accurate.
 *
 * Accepting, rejecting and managing all record a real answer that survives a
 * reload — none of them is a decorative button.
 */
export function CookieBanner() {
  const t = useT();
  const { settled, answered, acceptAll, rejectAll } = useCookieConsent();
  const [manageOpen, setManageOpen] = useState(false);
  // The same flag `Analytics.tsx` gates its own scripts on, read once here so the
  // banner cannot promise something the page then does.
  const measurementOn = analyticsConfigured();

  // Pending means the device has never answered. Opening the dialog does not
  // unmount this panel — the dialog is mounted inside it, and hiding the panel
  // would hide the dialog with it.
  const pending = settled && !answered;

  if (!pending) return null;

  return (
    <section aria-label={t("Storage and privacy")} className="cg-rise fixed inset-x-0 bottom-0 z-[60] print:hidden">
      <div className="mx-auto max-w-3xl px-3 pb-3 sm:px-6 sm:pb-6">
        <div className="rounded-card border border-line bg-surface p-4 shadow-[var(--shadow-lift)] sm:p-5">
          <p className="text-sm font-semibold text-heading">
            {measurementOn
              ? t("Your choice decides whether anything is measured")
              : t("This site sets no cookies")}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {t(
              "It keeps four values in this browser — a random student id, a session token, your language choice, and the answer you give this banner — so the same student can come back without a password.",
            )}{" "}
            {measurementOn ? (
              t(
                "With your agreement this site loads two measurement services by name: Google Analytics for page counts, and Microsoft Clarity for how a page is used. They run only on the public pages — never on a student's or a parent's screen, where an answer or a name could be recorded along with it. Rejecting keeps both off. Changing your mind later turns them off and clears what they stored in this browser.",
              )
            ) : (
              t(
                "There is no analytics, no advertising and nothing that follows you to another site.",
              )
            )}{" "}
            {t(
              "If whoever runs this site later switches on the optional email sign-in, the service that runs it keeps its own session here for the students who use it; the privacy policy says so in plain words.",
            )}{" "}
            <Link className="font-medium text-brand underline-offset-2 hover:underline" href="/privacy#cookies">
              {t("Read the privacy policy")}
            </Link>
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {measurementOn
              ? t(
                  "Rejecting changes nothing about how this app runs — the four values above are the ones it needs to work, and they are kept whichever answer you give. What rejecting does is keep the two measurement services from ever loading, on this page or on any student's screen.",
                )
              : t(
                  "Rejecting changes nothing about how this app runs today, because the four values above are the ones it needs to work. What you choose is recorded, and anything added later has to obey it.",
                )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={acceptAll}>
              {t("Accept all")}
            </Button>
            <Button size="sm" variant="outline" onClick={rejectAll}>
              {t("Reject all")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setManageOpen(true)}>
              {t("Manage preferences")}
            </Button>
          </div>
        </div>
      </div>
      {manageOpen ? (
        <CookiePreferences open={manageOpen} onClose={() => setManageOpen(false)} />
      ) : null}
    </section>
  );
}
