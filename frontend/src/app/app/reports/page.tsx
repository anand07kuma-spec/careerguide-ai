"use client";

import { useCallback, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  Compass,
  ExternalLink,
  FileText,
  Lightbulb,
  MessageCircle,
  Printer,
  Quote,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge, EvidenceBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { messageFor, useResource } from "@/lib/use-resource";
import type { ReportRecommendation } from "@/lib/types";
import { categoryTint, classLabel } from "@/lib/utils";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  hinglish: "Hinglish",
};
/** The three reply-language codes the report carries, read off the server's own
 * enum. Kept pure — the caller is the one that knows whether a `t` is in scope,
 * and the render site wraps this result so the label follows the interface. */
function languageLabel(value: string): string {
  return LANGUAGE_LABELS[value] ?? value;
}

function generatedDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * A titled section card that only renders when it has content.
 *
 * `title` and `description` are English source keys here, the way `CardHeader`
 * takes them, so the callers stay plain and this component translates its own
 * headings.
 */
function Section({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <Card className={className}>
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{t(title)}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{t(description)}</p> : null}
        </div>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </Card>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((text, index) => (
        <li key={index} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-light" aria-hidden />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function RecommendationBlock({ item }: { item: ReportRecommendation }) {
  // Everything on `item` is the server's own answer, so it is printed as written;
  // only the headings above it are the app's words, and only those are translated.
  const t = useT();
  return (
    <div className="rounded-2xl border border-line bg-canvas/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-ink">{item.career}</h3>
        <Badge className={categoryTint(item.category)}>{item.category}</Badge>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted">{item.why}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <EvidenceBadge level={item.evidence_level} />
        <span className="text-xs text-muted">{item.evidence_note}</span>
      </div>

      {item.supporting_statements.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t("What you said that points here")}</p>
          <ul className="mt-1.5 space-y-1.5">
            {item.supporting_statements.map((statement, index) => (
              <li key={index} className="flex items-start gap-2 text-sm italic leading-relaxed text-muted">
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-light" aria-hidden />
                <span>{statement}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {item.open_questions.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t("Still worth finding out")}</p>
          <Bullets items={item.open_questions} />
        </div>
      ) : null}

      {item.skills_to_try.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t("Skills to try")}</p>
          <Bullets items={item.skills_to_try} />
        </div>
      ) : null}

      {item.qualifications_to_check.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t("Qualifications to check")}</p>
          <Bullets items={item.qualifications_to_check} />
        </div>
      ) : null}

      {item.alternatives.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t("Related options to keep open")}</p>
          <Bullets items={item.alternatives} />
        </div>
      ) : null}

      {item.next_activity ? (
        <p className="mt-3 rounded-xl bg-brand-mist/60 px-3 py-2 text-sm leading-relaxed text-brand-dark">
          <span className="font-semibold">{t("A small next step:")}</span> {item.next_activity}
        </p>
      ) : null}
    </div>
  );
}

export default function ReportsScreen() {
  const t = useT();
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();

  const load = useCallback(() => api.latestReport(), []);
  const { state, data: report, error, reload } = useResource(load, sessionStatus === "ready");

  const [generating, setGenerating] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const runGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await api.generateReport();
      setConfirmGenerate(false);
      toast(t("Your report has been refreshed."), "success");
    } catch (err) {
      toast(messageFor(err), "error");
    } finally {
      setGenerating(false);
    }
    // The report is the server's answer, so the screen reads it back rather than
    // holding a copy of what it hoped the answer would be.
    reload();
  }, [reload, t, toast]);

  const runDelete = useCallback(async () => {
    if (!report) return;
    setDeleting(true);
    try {
      await api.deleteReport(report.id);
      setConfirmDelete(false);
      toast(t("This report has been deleted."), "success");
    } catch (err) {
      toast(messageFor(err), "error");
    } finally {
      setDeleting(false);
    }
    reload();
  }, [reload, report, t, toast]);

  const content = report?.content;

  return (
    <Screen
      title="My Career Report"
      description="An exploratory summary of what you have shared so far. It is not a prediction, an assessment or a verdict about you."
      badge={<Badge tone="teal" icon={<FileText className="h-3.5 w-3.5" aria-hidden />}>{t("Exploratory document")}</Badge>}
      action={
        report ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden />
              {t("Print / Save PDF")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmGenerate(true)}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t("Fresh report")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-danger hover:bg-danger-mist">
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("Delete")}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        {state === "loading" ? (
          <LoadingPanel label="Loading your report…" />
        ) : state === "error" ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !report || !content ? (
          <EmptyState
            icon={Compass}
            title="No report yet"
            description="A report needs a few conversations or interest answers first. Talk with your guide or note what you enjoy, then come back and generate it here."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <LinkButton href="/app/call" variant="primary" size="sm">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {t("Start a conversation")}
                </LinkButton>
                <LinkButton href="/app/interests" variant="outline" size="sm">
                  <Lightbulb className="h-4 w-4" aria-hidden />
                  {t("Explore interests")}
                </LinkButton>
                <Button size="sm" loading={generating} onClick={() => void runGenerate()}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {t("Generate my report")}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-5" id="career-report">
            {/* Framing — large, at the very top */}
            {content.framing ? (
              <Card className="border-brand-light/50 bg-brand-mist/40">
                <p className="text-lg font-semibold leading-snug text-ink sm:text-xl">{content.framing}</p>
              </Card>
            ) : null}

            {/* Student line + generated timestamp */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
              <p>
                {t("Prepared for")}{" "}
                <span className="font-semibold text-ink">{content.student.name || t("this student")}</span>
                {content.student.class_level ? ` · ${classLabel(content.student.class_level)}` : ""}
                {/* The code is stored on the report, the label is the app's own word,
                    so it is translated where it is printed. */}
                {content.student.language ? ` · ${t(languageLabel(content.student.language))}` : ""}
              </p>
              <p className="text-xs">{t("Generated")} {generatedDate(report.generated_at)}</p>
            </div>

            {/* Note — prominent, verbatim */}
            {content.note ? (
              <Card className="border-warning/40 bg-warning-mist/50">
                <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {content.note}
                </p>
              </Card>
            ) : null}

            {/* Themes observed */}
            {content.themes_observed.length > 0 ? (
              <Section title="Themes we noticed" description="Patterns from what you shared — not labels or limits." icon={<Search className="h-4 w-4" aria-hidden />}>
                {content.themes_observed.map((theme) => (
                  <div key={theme.theme} className="rounded-2xl border border-line bg-canvas/50 p-4">
                    <p className="text-sm font-semibold text-ink">{theme.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{theme.blurb}</p>
                    {theme.evidence.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {theme.evidence.map((quote, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm italic leading-relaxed text-muted">
                            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-light" aria-hidden />
                            <span>{quote}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </Section>
            ) : null}

            {/* Activities enjoyed */}
            {content.activities_enjoyed.length > 0 ? (
              <Section title="Things you mentioned enjoying" icon={<Sparkles className="h-4 w-4" aria-hidden />}>
                <Bullets items={content.activities_enjoyed} />
              </Section>
            ) : null}

            {/* Named ambitions — handled respectfully */}
            {content.named_ambitions.length > 0 ? (
              <Section title="Careers you named" description="Naming a job you're curious about now is completely normal — and it is allowed to change later. Nothing here is locked in." icon={<Compass className="h-4 w-4" aria-hidden />}>
                <div className="flex flex-wrap gap-1.5">
                  {content.named_ambitions.map((ambition, index) => (
                    <Badge key={index} tone="teal">{ambition}</Badge>
                  ))}
                </div>
              </Section>
            ) : null}

            {/* Recommendations */}
            {content.recommendations.length > 0 ? (
              <Section title="Fields worth exploring" description="These are directions to look into based on what you've said — not recommendations about who you should become.">
                {content.recommendations.map((item) => (
                  <RecommendationBlock key={item.career_id} item={item} />
                ))}
              </Section>
            ) : null}

            {/* Saved careers */}
            {content.saved_careers.length > 0 ? (
              <Section title="Careers you saved" icon={<Bookmark className="h-4 w-4" aria-hidden />}>
                <div className="flex flex-wrap gap-1.5">
                  {content.saved_careers.map((career) => (
                    <LinkButton key={career.id} href="/app/careers" variant="outline" size="sm">
                      {career.title}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </LinkButton>
                  ))}
                </div>
              </Section>
            ) : null}

            {/* Suggested experiments */}
            {content.suggested_experiments.length > 0 ? (
              <Section title="Small experiments to try" description="Low-pressure ways to test what actually interests you." icon={<Lightbulb className="h-4 w-4" aria-hidden />}>
                <Bullets items={content.suggested_experiments} />
              </Section>
            ) : null}

            {/* Next steps */}
            {content.next_steps.length > 0 ? (
              <Section title="Suggested next steps">
                <Bullets items={content.next_steps} />
              </Section>
            ) : null}

            {/* Financial resources to verify */}
            {content.financial_resources_to_verify ? (
              <Section title="About costs and support" icon={<AlertTriangle className="h-4 w-4" aria-hidden />}>
                <p className="text-sm leading-relaxed text-muted">{content.financial_resources_to_verify}</p>
              </Section>
            ) : null}

            {/* Unanswered questions — MANDATORY, always rendered */}
            <Section
              title="What we still don't know"
              description="This part is just as important as the rest. These gaps are normal, not a problem with you."
            >
              {content.unanswered_questions.length > 0 ? (
                <Bullets items={content.unanswered_questions} />
              ) : (
                <p className="text-sm leading-relaxed text-muted">
                  {t(
                    "There are no specific gaps flagged right now — but plans can always change as you learn more, and that is expected.",
                  )}
                </p>
              )}
            </Section>

            {/* Sessions reviewed */}
            <p className="text-xs text-muted">
              {t("Based on")} {content.sessions_reviewed}{" "}
              {content.sessions_reviewed === 1 ? t("conversation") : t("conversations")}{" "}
              {t("reviewed so far.")}
            </p>

            {/* Closing panel — what this report cannot do */}
            <Card className="border-line bg-canvas">
              <SectionHeading title="What this report cannot do" />
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span>{t("It does not predict your results, marks or future.")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span>{t("It does not certify, rank or assess you in any official way.")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span>{t(
                    "No school, admission office or employer should treat it as an assessment. It is only a mirror of conversations you chose to have here.",
                  )}</span>
                </li>
              </ul>
            </Card>
          </div>
        )}
      </div>

      {/* Confirm: generate a fresh report */}
      <Modal
        open={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        title="Generate a fresh report?"
        description="This creates a new report from what you've shared so far and replaces the one you're viewing."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmGenerate(false)} disabled={generating}>
              {t("Keep current")}
            </Button>
            <Button loading={generating} onClick={() => void runGenerate()}>
              {t("Generate fresh report")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "Your current report stays until the new one is ready. If the new one is empty, you can simply explore more and generate again later.",
          )}
        </p>
      </Modal>

      {/* Confirm: delete report */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this report?"
        description="This removes the report from your account. It cannot be undone from here."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              {t("Cancel")}
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void runDelete()}>
              {t("Delete report")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "You can always generate a new report later. Nothing else you have saved is affected.",
          )}
        </p>
      </Modal>
    </Screen>
  );
}
