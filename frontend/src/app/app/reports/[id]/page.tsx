"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { messageFor, useResource } from "@/lib/use-resource";

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function printedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
}

/**
 * The printed report, shown before it is kept.
 *
 * The bytes are fetched with the bearer token in a header and handed to this page as
 * a blob URL, which the browser forgets when the screen unmounts. Putting
 * `/api/reports/pdf/{id}` in an `href` would turn a child's answers into a link that
 * works in an address bar, and on a shared laptop in a history list too.
 *
 * Two things are said plainly rather than hidden. An embedded PDF viewer is the
 * browser's own, so on a phone that shows nothing here the download still works —
 * this screen does not pretend a blank frame is a rendered page. And the file lives on
 * the server until it is deleted here, or until the questionnaire inside it is
 * deleted; the renderer never writes one to disk.
 */
export default function PdfReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const tf = useTf();
  const { status, isParent } = useSession();

  const reportId = Number(params.id);
  const valid = Number.isInteger(reportId) && reportId > 0;

  // A parent is sent away before this can show a bare 404 that looks like a broken
  // link; the backend would refuse the request anyway.
  useEffect(() => {
    if (status === "ready" && isParent) router.replace("/parent");
  }, [isParent, router, status]);

  const panel = useResource(useCallback(() => api.pdfReports(), []), valid && status === "ready" && !isParent);
  const row = panel.data?.find((item) => item.id === reportId) ?? null;

  const [file, setFile] = useState<{ url: string | null; error: string | null }>({
    url: null,
    error: null,
  });
  const [removing, setRemoving] = useState(false);
  // Bumped by the Retry button. The fetch is driven by `row`, and a failed download leaves
  // `row` untouched, so without a counter of its own there is nothing a second press could
  // change — the spinner would sit there forever with the error next to it.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!row) return;
    let created: string | null = null;
    let active = true;
    setFile({ url: null, error: null });
    void api
      .pdfReportFile(row.id)
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setFile({ url: created, error: null });
      })
      .catch((error) => {
        if (active) setFile({ url: null, error: messageFor(error) });
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [row, attempt]);

  function save() {
    if (!row || !file.url) return;
    const link = document.createElement("a");
    link.href = file.url;
    link.download = row.filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function remove() {
    if (!row) return;
    setRemoving(true);
    try {
      await api.deletePdfReport(row.id);
      router.replace("/app/assessments");
    } catch (error) {
      setFile((current) => ({ ...current, error: messageFor(error) }));
      setRemoving(false);
    }
  }

  if (!valid) {
    return (
      <Screen title="No such report">
        <Card>
          <EmptyState
            icon={FileText}
            title="This address does not name a report"
            description={t(
              "The page address has no valid number in it, so nothing was asked of the server. Open a finished questionnaire and press Download PDF report to make one.",
            )}
            action={
              <LinkButton href="/app/assessments">{t("Back to assessments")}</LinkButton>
            }
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={t("Your printed report")}
      description={
        row
          ? tf(
              "{filename} — {size}, printed {when}. It holds the {count} questionnaire(s) finished on this account.",
              {
                filename: row.filename,
                size: sizeLabel(row.size_bytes),
                when: printedDate(row.generated_at),
                count: row.result_ids.length,
              },
            )
          : panel.state === "loading"
            ? t("Fetching the file from the server.")
            : undefined
      }
      badge={
        row ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="teal" icon={<FileText className="h-3.5 w-3.5" aria-hidden />}>
              {row.language === "hi" ? t("Printed in Hindi") : t("Printed in English")}
            </Badge>
            <Badge tone="neutral" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
              {t("Only this account can open it")}
            </Badge>
          </div>
        ) : null
      }
      action={
        row ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={save} disabled={!file.url}>
              <Download className="h-4 w-4" aria-hidden />
              {t("Download")}
            </Button>
            {/* Deleting needs no bytes in hand — the row on the server is what goes, and a
                report this screen cannot open is exactly the one a child should be able to
                throw away. */}
            <Button size="sm" variant="ghost" onClick={remove} loading={removing}>
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("Delete this file")}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        {panel.state === "loading" ? (
          <LoadingPanel label="Loading your report…" />
        ) : panel.state === "error" ? (
          <ErrorState title="This report could not be read" description={panel.error} onRetry={panel.reload} />
        ) : row ? (
          <>
            {file.url ? (
              <>
                {file.error ? (
                  <p role="alert" className="text-sm font-medium text-danger">
                    {file.error}
                  </p>
                ) : null}
                <iframe
                  src={file.url}
                  title={t("Report preview")}
                  className="h-[70vh] w-full rounded-2xl border border-line bg-surface"
                />
                <p className="text-xs leading-relaxed text-muted">
                  {t(
                    "This preview is drawn by your browser, and some browsers on phones do not show a PDF inside a page. If the box above stayed empty, the Download button still gives you the same file.",
                  )}
                </p>
              </>
            ) : file.error ? (
              <ErrorState
                title="The report file did not arrive"
                description={file.error}
                retryLabel="Fetch it again"
                onRetry={() => setAttempt((count) => count + 1)}
                extra={
                  <p className="max-w-md text-xs leading-relaxed text-muted">
                    {t(
                      "Nothing has been deleted. The file is still on the server, and “Delete this file” above works whether this preview loads or not.",
                    )}
                  </p>
                }
              />
            ) : (
              <LoadingPanel label="Fetching the file…" />
            )}

            <Card>
              <div className="space-y-2 text-sm leading-relaxed">
                <p>
                  {t(
                    "The file is kept on the server so you can come back for it, and it is deleted the moment you delete it here or delete a questionnaire inside it. Nothing is written to a folder beside your answers.",
                  )}
                </p>
                <p className="text-muted">
                  {t(
                    "Finish another questionnaire and the next request prints again, with everything you have answered by then. This copy is not quietly swapped out from under you.",
                  )}
                </p>
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <LinkButton href="/app/assessments" variant="ghost" size="sm">
                {t("Back to the three questionnaires")}
              </LinkButton>
            </div>
          </>
        ) : (
          <Card>
            <EmptyState
              icon={FileText}
              title="No report with that number is on this account"
              description={t(
                "It may have been deleted here, or the questionnaire inside it was deleted. Making a new one takes a moment from any finished result page.",
              )}
              action={
                <LinkButton href="/app/assessments" size="sm">
                  {t("Back to assessments")}
                </LinkButton>
              }
            />
          </Card>
        )}
      </div>
    </Screen>
  );
}
