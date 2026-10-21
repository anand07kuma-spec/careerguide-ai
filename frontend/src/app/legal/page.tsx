"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LEGAL_PAGES, LegalLayout, LegalSection } from "@/components/legal/legal-layout";
import { useT } from "@/lib/i18n";

/**
 * The legal index. Privacy, terms and contact used to be reachable only from
 * small footer links, which is easy to miss when a parent is looking for one
 * particular answer. This page is that front door, and it promises nothing it
 * cannot keep: no compliance claim, no certification, no lawyer behind it.
 */

const SUMMARIES: Record<string, string> = {
  "/privacy": "What the server keeps, what it never asks for, and which outside services see your text.",
  "/terms": "What the guide promises — and, more usefully, what it refuses to do.",
  "/refund": "What a refund is owed for and who issues it — on a build where the checkout exists, has never taken money, and has no refund button in it.",
  "/disclaimer": "The limits of what this software knows: a language model, sample data, and no professional relationship.",
  "/contact": "The one channel anyone actually reads, and what to do if a child is in danger.",
};

export default function LegalIndexPage() {
  const t = useT();

  return (
    <LegalLayout
      badge={t("Legal")}
      title={t("Legal")}
      current="/legal"
      intro={t(
        "Five pages, written for the app that actually exists rather than from a template: what happens to your data, the terms of use, refunds, the limits of the advice, and how to reach this project.",
      )}
    >
      <LegalSection title={t("The five pages")}>
        <ul className="space-y-3">
          {LEGAL_PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="flex items-start justify-between gap-4 rounded-card border border-line bg-surface p-5 transition-colors hover:border-brand/40 hover:bg-brand-mist"
              >
                <span>
                  <span className="block font-semibold text-heading">{t(page.label)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    {t(SUMMARIES[page.href])}
                  </span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={t("What these pages do not claim")} tone="warn">
        <p>
          {t(
            "None of this is a legal opinion, and nothing here claims compliance with the DPDP Act, GDPR, COPPA or any other law. This build has not had qualified legal review, so it should not hold a real child’s data yet.",
          )}
        </p>
        <p>
          {t(
            "If a sentence here and a sentence on another page ever disagree, the other page is the one to read — this index only points the way.",
          )}
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
