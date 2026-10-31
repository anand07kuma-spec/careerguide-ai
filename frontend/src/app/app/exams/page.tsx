"use client";

import { useCallback } from "react";
import {
  BadgeCheck,
  ExternalLink,
  GraduationCap,
  Info,
  Landmark,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import { useT, useTf } from "@/lib/i18n";
import type { ExamCard } from "@/lib/types";

/**
 * The exam map, read from `/api/exams`.
 *
 * This screen used to carry its own copy of every sentence on it. The words are the same
 * ones — they were moved out of this bundle into the catalogue, not rewritten — and so is
 * the refusal they were built around.
 *
 * Deliberately absent everywhere on this screen: application deadlines, fee amounts,
 * eligibility percentages, age cut-offs, ranks, cutoffs, seat matrices, result dates and
 * placement figures. They change every year and we cannot verify them — the official
 * notification is named as the only authority instead.
 *
 * That is why a date or a fee on a card is not a row to fill in. The API answers both as
 * `null` for any exam nobody has read off a source, and the card then prints the
 * disclaimer it always printed. When a value *does* arrive, it arrives with the page it
 * came from and the day it was read, and the card shows both: a number a family cannot
 * trace is a number they cannot check.
 */

const CHECKLIST = [
  {
    icon: Search,
    text: "Search for the exam name together with the conducting body (NTA, UPSC, ICAI, SSC, IBPS, the Consortium, your state CET authority) and open the official site yourself — ideally one ending in .gov.in or the body's own known site.",
  },
  {
    icon: Landmark,
    text: "Open the current notification PDF on that official site and read it yourself. A screenshot, a WhatsApp forward or a coaching flyer is not a notification.",
  },
  {
    icon: Lock,
    text: "No agent can get you a seat. Applications go through the official site, and seats are allotted only through the official process. Never pay anyone for “direct admission”, a “guaranteed seat” or a “sure selection” — that is how students are cheated.",
  },
  {
    icon: ShieldCheck,
    text: "Before joining any college, verify it on the college's own official site and in the list of colleges the exam body's official allotment actually covers.",
  },
];

const NOT_COUNSELLING = [
  "This page is general information. It is not exam counselling, and it will never tell you which exam you “should” take. That conversation belongs to you, your family and a trusted teacher.",
  "This app is not affiliated with any exam authority, university or coaching institute. A conducting body is named here only to tell you whose official site is the authority — nothing more.",
  "No coaching brand is named or endorsed. Treat anyone claiming that a brand, an agent or a payment can guarantee you a seat as a red flag.",
  "No exam guarantees a selection, a career or a life. Every route has many entries and many exits — which is why this app explores and never gives a verdict.",
];

function recordedOn(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-IN");
}

/** One exam. The four sentences are general information; a date or a fee is a record. */
function ExamCardView({ exam }: { exam: ExamCard }) {
  const t = useT();
  const tf = useTf();
  const readOn = recordedOn(exam.verified_at);
  const hasFigure = Boolean(exam.exam_date || exam.fee_note);

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-tight text-ink">{exam.name}</h3>
        <Badge tone="brand">{t(exam.authority)}</Badge>
      </div>

      <dl className="mt-3 space-y-2 text-sm leading-relaxed">
        <div>
          <dt className="font-medium text-ink">{t("What it is for")}</dt>
          <dd className="text-muted">{t(exam.description)}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">{t("Careers it opens")}</dt>
          <dd className="text-muted">{t(exam.careers)}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">{t("When students usually notice it")}</dt>
          <dd className="text-muted">{t(exam.timeline)}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">{t("In class 9 or 10 now — costs nothing")}</dt>
          <dd className="text-muted">{t(exam.preparation)}</dd>
        </div>

        {/* Only ever present when a person read it off a source and named that source. */}
        {exam.exam_date ? (
          <div>
            <dt className="font-medium text-ink">{t("Date, as recorded")}</dt>
            <dd className="text-muted">{t(exam.exam_date)}</dd>
          </div>
        ) : null}
        {exam.fee_note ? (
          <div>
            <dt className="font-medium text-ink">{t("Fee, as recorded")}</dt>
            <dd className="text-muted">{t(exam.fee_note)}</dd>
          </div>
        ) : null}
      </dl>

      {hasFigure && exam.source_url ? (
        <div className="mt-3 rounded-xl border border-success/25 bg-success-mist px-3 py-2.5">
          <p className="text-xs leading-relaxed text-ink">
            {readOn
              ? tf("Recorded from the official page on {day}. Check it against this year's notification.", {
                  day: readOn,
                })
              : t("Recorded from the official page below. Check it against this year's notification.")}
          </p>
          <a
            href={exam.source_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-dark underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {t("Open the page it was read from")}
          </a>
        </div>
      ) : null}

      {/* Disclaimer — always visible, not hidden behind a tooltip */}
      <div className="mt-3 rounded-xl border border-warning/30 bg-warning-mist px-3 py-2.5">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(
            "The only authority is this year's official notification from the body named on this card. Search for its official site and open the notification there — dates, fees, eligibility and cutoffs are deliberately not written here.",
          )}
        </p>
      </div>
    </Card>
  );
}

export default function ExamsScreen() {
  const t = useT();
  const { status: sessionStatus } = useSession();

  const loadExams = useCallback(() => api.exams(), []);
  const list = useResource(loadExams, sessionStatus === "ready");
  const groups = list.data ?? [];

  return (
    <Screen
      title={t("Exams")}
      description={t(
        "A plain map of the Indian exams a class 11 or 12 student meets — what each one is for and what it opens. This is general information, not counselling, and every detail must be confirmed on the official notification.",
      )}
      badge={
        <Badge tone="teal" icon={<GraduationCap className="h-3.5 w-3.5" aria-hidden />}>
          {t("General information — verify officially")}
        </Badge>
      }
    >
      <div className="space-y-5">
        {/* What this page never states — persistent, above everything else */}
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(
            "This page never gives application dates, fees, eligibility percentages, age limits, cutoffs, ranks, seat counts, result dates or placement figures — they change every year and we cannot verify them. Wherever a number would normally sit, the official notification is named instead.",
          )}
        </p>

        {/* How to check an exam notification is real */}
        <Card className="border-brand-light/40 bg-brand-mist/40">
          <SectionHeading
            title={t("How to check an exam notification is real")}
            description={t(
              "Fake exam alerts and seat-selling agents hurt students every year. Do these four things before trusting anything.",
            )}
          />
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
            {CHECKLIST.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.text} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
                  <span>{t(item.text)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t(
              "Rules, dates and fees change every year. Nothing on this page replaces the official notification.",
            )}
          </p>
        </Card>

        {/* The map itself, from the catalogue */}
        {list.state === "loading" ? (
          <>
            <p className="text-sm text-muted">{t("Loading the exam map…")}</p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </>
        ) : list.state === "error" ? (
          <ErrorState
            title={t("The exam map could not be loaded")}
            description={list.error}
            onRetry={list.reload}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={t("No exams are listed yet")}
            description={t(
              "This map is read from the catalogue rather than written into the page, so an empty one is shown as empty instead of filled in from memory. Try again in a moment.",
            )}
            action={
              <Button size="sm" variant="outline" onClick={list.reload}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                {t("Try again")}
              </Button>
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.id} className="space-y-3">
              <SectionHeading title={t(group.title)} description={t(group.description)} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {group.exams.map((exam) => (
                  <ExamCardView key={exam.id} exam={exam} />
                ))}
              </div>
            </section>
          ))
        )}

        {/* General information, not counselling */}
        <Card className="border-teal/30 bg-teal-mist/40">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-teal" aria-hidden />
                {t("General information, not counselling")}
              </span>
            }
            description={t("Read this page with that line drawn clearly.")}
          />
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
            {NOT_COUNSELLING.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                <span>{t(line)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
