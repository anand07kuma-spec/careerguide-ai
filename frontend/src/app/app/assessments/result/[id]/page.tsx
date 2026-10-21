"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Compass,
  FileText,
  Languages,
  Printer,
  Puzzle,
  RotateCcw,
  Users,
} from "lucide-react";
import { ResultSummary } from "@/components/assessments/ResultSummary";
import { Screen } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { type AssessmentType } from "@/lib/assessments";
import { api } from "@/lib/api";
import { useT, useTf, useUiLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useResource, messageFor } from "@/lib/use-resource";

const ICONS: Record<AssessmentType, typeof Compass> = {
  interest: Compass,
  personality: Users,
  aptitude: Puzzle,
};

/** A relative time ("7 min ago") is true on screen and meaningless once the page is
 * printed and kept in a file, so the dates here are absolute. */
function printedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
}

/**
 * A finished sitting, read back.
 *
 * Two things here are deliberate. The labels are re-rendered in the interface
 * language the student is reading in, while `item_language` says plainly which
 * language the questions themselves were asked in — a Hindi sitting re-read on an
 * English interface would otherwise look like the answers changed. And nothing on
 * this page is editable: the numbers belong to the sitting that produced them, so
 * doing it again starts a new sitting instead of overwriting this one.
 *
 * "Download PDF report" asks the server to print the whole picture: every
 * questionnaire this account has finished, in one document, built by the renderer in
 * `app/services/pdf_report.py`. That file is kept in the database rather than on the
 * server's disk, because the deployed backend has no disk that survives a request —
 * and a copy of a child's answers that no delete path knows about is the one thing
 * this app has promised not to make. `Print / Save PDF` above it is still the
 * browser's own dialog, and prints only the questionnaire on this page.
 */
export default function AssessmentResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const tf = useTf();
  const language = useUiLang();
  const { status, isParent } = useSession();
  const [report, setReport] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  const resultId = Number(params.id);
  const valid = Number.isInteger(resultId) && resultId > 0;

  // A parent has no business reading a child's questionnaire answers, and the
  // backend would refuse the request anyway — so this screen sends them away
  // before it can show a bare 404 that looks like a broken link.
  useEffect(() => {
    if (status === "ready" && isParent) router.replace("/parent");
  }, [isParent, router, status]);

  const panel = useResource(
    useCallback(() => api.assessmentResult(resultId, language), [resultId, language]),
    valid && status === "ready" && !isParent,
  );

  const result = panel.data;
  const Icon = result ? ICONS[result.assessment_type] : ClipboardList;

  /** A failure stays on this page, in the server's own words: the result on screen is
   * unaffected by a PDF that could not be built, so it must not look spoiled. */
  async function printReport() {
    if (!result) return;
    setReport({ busy: true, error: null });
    try {
      const made = await api.generatePdfReport(result.assessment_id, language);
      router.push(`/app/reports/${made.id}`);
    } catch (error) {
      setReport({ busy: false, error: messageFor(error) });
    }
  }

  if (!valid) {
    return (
      <Screen title="No such result">
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="This address does not name a result"
            description={t(
              "The page address has no valid number in it, so nothing was asked of the server. Your own results are listed under Assessments.",
            )}
            action={
              <LinkButton href="/app/assessments">
                {t("Back to assessments")}
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </LinkButton>
            }
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={result?.name ?? t("Assessment result")}
      description={
        result
          ? tf(
              "Calculated from {answered} of {total} answers on {date}. Only this account can open it, and it has not been changed since.",
              {
                answered: result.totals.answered,
                total: result.totals.items,
                date: printedDate(result.completed_at),
              },
            )
          : panel.state === "loading"
            ? t("Reading the answers back from the server.")
            : undefined
      }
      badge={
        result ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="teal" icon={<Icon className="h-3.5 w-3.5" aria-hidden />}>
              {t("Self-questionnaire")}
            </Badge>
            <Badge tone="neutral" icon={<Languages className="h-3.5 w-3.5" aria-hidden />}>
              {result.item_language === "hi"
                ? t("Questions were asked in Hindi")
                : t("Questions were asked in English")}
            </Badge>
          </div>
        ) : null
      }
      action={
        result ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button size="sm" onClick={printReport} loading={report.busy}>
              <FileText className="h-4 w-4" aria-hidden />
              {t("Download PDF report")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden />
              {t("Print / Save PDF")}
            </Button>
            <LinkButton
              href={`/app/assessments/${result.assessment_type}`}
              variant="ghost"
              size="sm"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t("Answer again")}
            </LinkButton>
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        {report.error ? (
          <p role="alert" className="text-sm font-medium text-danger print:hidden">
            {report.error}
          </p>
        ) : null}
        {panel.state === "loading" ? (
          <LoadingPanel label="Loading your result…" />
        ) : panel.state === "error" ? (
          <ErrorState
            title="This result is not on this device"
            description={panel.error}
            onRetry={panel.reload}
            extra={
              <LinkButton href="/app/assessments" variant="ghost" size="sm">
                {t("Back to assessments")}
              </LinkButton>
            }
          />
        ) : result ? (
          <>
            <ResultSummary result={result} />

            <p className="text-xs leading-relaxed text-muted print:hidden">
              {t(
                "Saved answers, not a record anyone else can see. If a school or a counsellor ever asks for this, print it yourself and hand it over — this app does not send results to anyone.",
              )}
            </p>

            {/* Only appears on paper: the sheet needs to say where it came from and
                which sitting it is, since a printed page carries no account. */}
            <p className="hidden border-t border-line pt-3 text-[11px] leading-relaxed text-muted print:block">
              {tf("CareerGuide AI — {name}, answered {date}. A self-questionnaire, not a diagnosis.", {
                name: result.name,
                date: printedDate(result.completed_at),
              })}
            </p>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link
            href="/app/assessments"
            className="text-xs font-medium text-muted hover:text-ink"
          >
            {t("Back to the three questionnaires")}
          </Link>
        </div>
      </div>
    </Screen>
  );
}
