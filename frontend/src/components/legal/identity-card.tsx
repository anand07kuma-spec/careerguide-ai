"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import {
  BUSINESS_FIELDS,
  IS_SAMPLE,
  OFFICER_FIELDS,
  PHONE,
  SAMPLE_NOTE,
} from "@/lib/legal-entity";

/**
 * The operator's contact details, rendered the same way on every legal page that
 * prints them.
 *
 * This existed as four copies of one `<dl>` — privacy, contact twice, about — each
 * with its own amber warning badge and its own paragraph apologising for the
 * brackets inside it. The brackets are gone, so the apologies go with them, and
 * what is left is one list plus, while the values are still the samples, one
 * sentence saying so. That sentence is the honest part; the badge that used to
 * carry the warning was the loud part, and it is gone by request.
 */
export function IdentityCard({
  fields,
  showNote = true,
  className,
}: {
  fields: "officer" | "business";
  showNote?: boolean;
  className?: string;
}) {
  const t = useT();
  const rows = fields === "officer" ? OFFICER_FIELDS() : BUSINESS_FIELDS();

  return (
    <div
      className={
        className ??
        "rounded-card border border-line bg-canvas/50 p-5"
      }
    >
      <dl className="space-y-2 text-xs">
        {rows.map((field) => (
          <div key={field.label} className="flex flex-wrap items-baseline gap-x-3">
            <dt className="w-40 shrink-0 font-semibold text-ink">{t(field.label)}</dt>
            {/* Values are the operator's, not this site's prose: never run them through t(). */}
            <dd className="min-w-0 break-words font-mono text-ink">{field.value}</dd>
          </div>
        ))}
        {fields === "business" && !PHONE ? (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <dt className="w-40 shrink-0 font-semibold text-ink">{t("Phone")}</dt>
            <dd className="min-w-0 break-words text-muted">
              {t("None — the email above is the only line in.")}
            </dd>
          </div>
        ) : null}
      </dl>
      {IS_SAMPLE && showNote ? (
        <div className="mt-4 border-t border-line pt-3">
          <Badge tone="neutral">{t("Sample values")}</Badge>
          <p className="mt-2 text-xs leading-relaxed text-muted">{t(SAMPLE_NOTE)}</p>
        </div>
      ) : null}
    </div>
  );
}

/** The same sentence for a page that names the operator in running text instead of a list. */
export function SampleNote() {
  const t = useT();
  if (!IS_SAMPLE) return null;
  return (
    <p className="mt-3 text-xs leading-relaxed text-muted">{t(SAMPLE_NOTE)}</p>
  );
}
