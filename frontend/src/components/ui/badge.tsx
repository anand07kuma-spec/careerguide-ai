"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useT, useTf, useUiLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Modal } from "./modal";

type Tone = "brand" | "teal" | "neutral" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-mist text-brand-dark",
  teal: "bg-teal-mist text-teal",
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-success-mist text-success",
  warning: "bg-warning-mist text-amber-700",
  danger: "bg-danger-mist text-danger",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        // `text-xs` on its own leaves a 16px line box; `leading-none` shrank it to 12px
        // and clipped 4px off the top of every label — measured on both scripts, since a
        // Devanagari matra and a Latin ascender both need that room.
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Data-trust labels. Anything the family must verify themselves is marked here
 * rather than presented as settled fact.
 */
export function VerificationBadge({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <Badge tone={verified ? "success" : "warning"} className={className}>
      {verified ? t("Verified source") : t("Verify on official site")}
    </Badge>
  );
}

/** One page, listed in `SourceBadge`'s dialog. */
export interface SourceLink {
  label: string;
  url: string;
}

function checkedDate(iso: string, lang: "en" | "hi"): string {
  // The stamp arrives naive, in UTC. Without the suffix a browser reads it in the visitor's
  // own zone, so an attestation made in the Indian evening prints tomorrow's date here.
  const stamped = /(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso.replace(" ", "T")}Z`;
  const date = new Date(stamped);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}

/**
 * The trust label on a catalogue card, and the dialog behind it.
 *
 * There are two states and the difference between them is a fact about the database, not a
 * style: `checkedAt` is stamped by the code that certified the row, so a date means somebody
 * opened a page on that day, and no date means nobody has. Nothing here can produce a date on
 * its own — a row that has been checked shows one and a row that has not says so.
 *
 * The unchecked state is deliberately grey rather than red. A warning badge on the page a
 * fifteen-year-old chooses a career from reads as an error in the app, when what it means is
 * an ordinary unfinished step in checking a number; the dialog says that step in full.
 */
export function SourceBadge({
  verified,
  checkedAt,
  sourceUrl,
  alternatives = [],
  className,
}: {
  verified: boolean;
  checkedAt?: string | null;
  /** The page a person opened when they certified this row, when one was recorded. */
  sourceUrl?: string | null;
  /** Where else the same figure would have to be checked — the apply portal, a regulator. */
  alternatives?: SourceLink[];
  className?: string;
}) {
  const t = useT();
  const tf = useTf();
  const lang = useUiLang();
  const [open, setOpen] = useState(false);

  const date = checkedAt ? checkedDate(checkedAt, lang) : null;
  const label = verified
    ? date
      ? tf("Verified {date}", { date })
      : t("Verified source")
    : t("Not yet checked against a source");

  const links: SourceLink[] = [
    ...(sourceUrl ? [{ label: t("The page that was read"), url: sourceUrl }] : []),
    ...alternatives.filter((link) => link.url !== sourceUrl),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "rounded-full transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          className,
        )}
      >
        <Badge tone={verified ? "success" : "neutral"} icon={verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : undefined}>
          {label}
        </Badge>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={t("Where this record came from")}
        description={
          verified && date
            ? tf("On {date} somebody opened the page below and read this record against it.", { date })
            : t("Nobody has read this record against a source yet. It is the app's own note, and the numbers in it need checking before you plan around them.")
        }
      >
        {links.length > 0 ? (
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-start gap-1.5 text-sm font-medium text-brand underline underline-offset-2 break-all"
                >
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t(link.label)}
                    <span className="mt-0.5 block font-mono text-xs font-normal text-muted">{link.url}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("No page was recorded for this row.")}</p>
        )}
      </Modal>
    </>
  );
}

export function EvidenceBadge({
  level,
  className,
}: {
  level: "early" | "some" | "good";
  className?: string;
}) {
  const t = useT();
  const map = {
    early: { tone: "warning" as Tone, label: "Early signal" },
    some: { tone: "brand" as Tone, label: "Some evidence" },
    good: { tone: "success" as Tone, label: "Several signals" },
  };
  const item = map[level];
  return (
    <Badge tone={item.tone} className={className}>
      {t(item.label)}
    </Badge>
  );
}
