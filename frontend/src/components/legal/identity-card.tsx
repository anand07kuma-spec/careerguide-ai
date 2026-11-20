"use client";

import { useT } from "@/lib/i18n";
import { CONTACT_EMAIL, NO_EMAIL_SENTENCE } from "@/lib/legal-entity";

/**
 * Who operates this site, rendered the same way on every page that prints it.
 *
 * CareerGuide AI is an individually developed student project, not a registered
 * company, so there is no company name, registered office, phone line or officer
 * to list. The card shows what does exist: the project's own name, its status,
 * and the one contact route a deployment can configure. With no address
 * configured it says so in plain words rather than printing a sample inbox.
 */
export function OperatorCard({ className }: { className?: string }) {
  const t = useT();

  return (
    <div className={className ?? "rounded-card border border-line bg-canvas/50 p-5"}>
      <dl className="space-y-2 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <dt className="w-40 shrink-0 font-semibold text-ink">{t("Project")}</dt>
          <dd className="min-w-0 break-words text-ink">CareerGuide AI</dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <dt className="w-40 shrink-0 font-semibold text-ink">{t("Run by")}</dt>
          <dd className="min-w-0 break-words text-ink">
            {t(
              "An individual student developer. Not a registered company, and no officer or postal address is published.",
            )}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <dt className="w-40 shrink-0 font-semibold text-ink">{t("Contact email")}</dt>
          <dd className="min-w-0 break-words text-ink">
            {CONTACT_EMAIL ? (
              <a className="font-mono underline-offset-2 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            ) : (
              t(NO_EMAIL_SENTENCE)
            )}
          </dd>
        </div>
        {!CONTACT_EMAIL ? (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <dt className="w-40 shrink-0 font-semibold text-ink">{t("What works instead")}</dt>
            <dd className="min-w-0 break-words text-muted">
              {t(
                "The contact form and the public GitHub repository. The form says on screen when this deployment cannot send mail, and neither is a staffed support desk.",
              )}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
