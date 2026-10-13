"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  HeartHandshake,
  Info,
  Layers,
  ListChecks,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { THEME_LABELS, type Career, type ThemeKey } from "@/lib/types";
import { categoryTint, cn } from "@/lib/utils";

type Status = "loading" | "ready" | "error";

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "We couldn't load this career.";
}

/** A titled block that only renders when it actually has something to show. */
function Section({
  title,
  description,
  icon,
  children,
  show,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <Card className="space-y-4">
      <CardHeader title={title} description={description} icon={icon} />
      <div>{children}</div>
    </Card>
  );
}

function Bullets({ items, tone = "brand" }: { items: string[]; tone?: "brand" | "warning" }) {
  return (
    <ul className="space-y-2">
      {items.map((text, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
          <span
            className={cn(
              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
              tone === "warning" ? "bg-warning" : "bg-brand",
            )}
            aria-hidden
          />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CareerDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ? decodeURIComponent(params.slug) : "";
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();

  const [career, setCareer] = useState<Career | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [related, setRelated] = useState<Career[]>([]);

  const load = useCallback(async () => {
    if (!slug) return;
    setStatus("loading");
    setNotFound(false);
    setErrorMessage(null);
    try {
      const data = await api.career(slug);
      setCareer(data);
      setStatus("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
      } else {
        setErrorMessage(messageFor(error));
      }
      setStatus("error");
    }
  }, [slug]);

  useEffect(() => {
    if (sessionStatus !== "ready") return;
    void load();
  }, [sessionStatus, load]);

  // Saved state comes from the saved list so the button reflects the server.
  useEffect(() => {
    if (sessionStatus !== "ready") return;
    let active = true;
    void api
      .savedCareers()
      .then((data) => {
        if (active) setSavedIds(new Set(data.map((s) => s.career.id)));
      })
      .catch(() => {
        /* bookmarking still works; the button just starts optimistic */
      });
    return () => {
      active = false;
    };
  }, [sessionStatus]);

  // Related careers: fetch each, ignore individual failures.
  useEffect(() => {
    const slugs = career?.related_slugs ?? [];
    if (slugs.length === 0) {
      setRelated([]);
      return;
    }
    let active = true;
    void Promise.all(slugs.map((s) => api.career(s).catch(() => null))).then((results) => {
      if (!active) return;
      setRelated(results.filter((r): r is Career => r !== null));
    });
    return () => {
      active = false;
    };
  }, [career]);

  const toggleSave = useCallback(async () => {
    if (!career) return;
    const wasSaved = savedIds.has(career.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(career.id);
      else next.add(career.id);
      return next;
    });
    setSaving(true);
    try {
      if (wasSaved) {
        await api.unsaveCareer(career.id);
        toast(`Removed ${career.title} from saved.`, "success");
      } else {
        await api.saveCareer(career.id);
        toast(`Saved ${career.title} to explore later.`, "success");
      }
    } catch (error) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(career.id);
        else next.delete(career.id);
        return next;
      });
      toast(messageFor(error), "error");
    } finally {
      setSaving(false);
    }
  }, [career, savedIds, toast]);

  if (status === "loading") {
    return (
      <Screen title="Loading career…">
        <LoadingPanel label="Fetching the details…" />
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen
        title={notFound ? "Career not found" : "This career didn't load"}
        action={
          <LinkButton href="/app/careers" variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to explorer
          </LinkButton>
        }
      >
        <ErrorState
          title={notFound ? "We couldn't find that career" : "That did not load"}
          description={notFound ? "The link may be old or the career may have moved." : errorMessage ?? undefined}
          onRetry={notFound ? undefined : load}
          extra={
            <LinkButton href="/app/careers" size="sm">
              Browse all careers
            </LinkButton>
          }
        />
      </Screen>
    );
  }

  if (!career) {
    return (
      <Screen title="Career">
        <EmptyState title="No career to show" action={<LinkButton href="/app/careers">Back to explorer</LinkButton>} />
      </Screen>
    );
  }

  const isSaved = savedIds.has(career.id);
  const hasList = (arr: string[]) => Array.isArray(arr) && arr.length > 0;
  const themes = career.interest_themes.filter((t): t is ThemeKey => t in THEME_LABELS);

  return (
    <Screen
      title={career.title}
      description={career.summary}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={categoryTint(career.category)}>{career.category}</Badge>
          <VerificationBadge verified={!career.needs_verification} />
        </div>
      }
      action={
        <div className="flex items-center gap-2">
          <LinkButton href="/app/careers" variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </LinkButton>
          <button
            type="button"
            onClick={() => void toggleSave()}
            disabled={saving}
            aria-pressed={isSaved}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-60",
              isSaved
                ? "border-brand bg-brand text-white hover:bg-brand-dark"
                : "border-line bg-surface text-ink hover:border-brand-light hover:text-brand-dark",
            )}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} aria-hidden />
            {isSaved ? "Saved" : "Save career"}
          </button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="space-y-5">
          {career.needs_verification ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning-mist/60 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p>
                The details on this page are a helpful starting point, but the numbers and rules here
                still need checking against official sources before you rely on them.
              </p>
            </div>
          ) : null}

          <Section title="What the work looks like" icon={<Users className="h-5 w-5" aria-hidden />} show={hasList(career.typical_activities)}>
            <Bullets items={career.typical_activities} />
          </Section>

          <Section title="A day in this work" icon={<Clock className="h-5 w-5" aria-hidden />} show={Boolean(career.typical_day)}>
            <p className="text-sm leading-relaxed text-ink">{career.typical_day}</p>
          </Section>

          <Section
            title="Skills that help"
            description="You build these over time — they're not a test you have to pass today."
            icon={<Layers className="h-5 w-5" aria-hidden />}
            show={hasList(career.useful_skills)}
          >
            <div className="flex flex-wrap gap-2">
              {career.useful_skills.map((skill) => (
                <Badge key={skill} tone="teal">
                  {skill}
                </Badge>
              ))}
            </div>
          </Section>

          <Section title="School subjects that connect" icon={<GraduationCap className="h-5 w-5" aria-hidden />} show={hasList(career.school_subjects)}>
            <div className="flex flex-wrap gap-2">
              {career.school_subjects.map((subject) => (
                <Badge key={subject} tone="brand">
                  {subject}
                </Badge>
              ))}
            </div>
          </Section>

          <Section title="How people get there" description="Different routes can lead to the same work." icon={<ListChecks className="h-5 w-5" aria-hidden />} show={hasList(career.education_pathways)}>
            <Bullets items={career.education_pathways} />
          </Section>

          <Section
            title="What to check before you commit"
            description="Requirements change — verify these against the official links below."
            icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
            show={hasList(career.entry_requirements)}
          >
            <Bullets items={career.entry_requirements} tone="warning" />
          </Section>

          <Section title="Steps to prepare" icon={<ListChecks className="h-5 w-5" aria-hidden />} show={hasList(career.preparation_stages)}>
            <ol className="space-y-2.5">
              {career.preparation_stages.map((stage, i) => (
                <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-ink">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-mist text-xs font-semibold text-brand-dark">
                    {i + 1}
                  </span>
                  <span>{stage}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Costs and the routes around them" description="Money shapes choices, but it rarely closes every door." icon={<Wallet className="h-5 w-5" aria-hidden />} show={Boolean(career.costs_and_alternatives)}>
            <p className="text-sm leading-relaxed text-ink">{career.costs_and_alternatives}</p>
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-teal-mist/60 px-3 py-2 text-xs leading-relaxed text-teal">
              <HeartHandshake className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              If one route costs more than your family can spend, look at government and state
              colleges, scholarships, skill-based entry and self-study — many careers have more than
              one way in.
            </p>
          </Section>

          <div className="grid gap-5 sm:grid-cols-2">
            <Section title="What people enjoy" icon={<CheckCircle2 className="h-5 w-5 text-success" aria-hidden />} show={hasList(career.benefits)}>
              <Bullets items={career.benefits} />
            </Section>
            <Section title="What's harder" icon={<AlertTriangle className="h-5 w-5 text-warning" aria-hidden />} show={hasList(career.challenges)}>
              <Bullets items={career.challenges} tone="warning" />
            </Section>
          </div>

          <Section
            title="Try it before you decide"
            description="Small, low-risk ways to see if this kind of work interests you."
            icon={<HeartHandshake className="h-5 w-5" aria-hidden />}
            show={hasList(career.explore_activities)}
          >
            <Bullets items={career.explore_activities} />
            <div className="mt-4">
              <LinkButton href="/app/plans" size="sm">
                <GraduationCap className="h-4 w-4" aria-hidden />
                Turn these into a study plan
              </LinkButton>
            </div>
          </Section>

          {/* Honest closing panel */}
          <Card className="border-brand-light/40 bg-brand-mist/40">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
              <div className="text-sm leading-relaxed text-ink">
                <p className="font-semibold text-brand-dark">What this page can and can&apos;t do</p>
                <p className="mt-1 text-muted">
                  This page does not guarantee admission, a salary or success. Costs, exams and entry
                  rules change over time, so please confirm anything important using the official
                  links on this page before you make a decision.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          <Card className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Interest themes</p>
              {themes.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {themes.map((t) => (
                    <LinkButton key={t} href={`/app/careers?theme=${t}`} variant="outline" size="sm">
                      {THEME_LABELS[t]}
                    </LinkButton>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted">No themes tagged for this career.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Good to know</p>
              <p className="mt-1 text-sm text-ink">
                You can start exploring this from <span className="font-semibold">class {career.min_class}</span>.
              </p>
            </div>
          </Card>

          <Section title="Official links" description="The best place to verify details yourself." icon={<ExternalLink className="h-5 w-5" aria-hidden />} show={hasList(career.official_links.map((l) => l.url))}>
            <div className="space-y-2">
              {career.official_links.map((link) => (
                <LinkButton
                  key={link.url}
                  href={link.url}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate">{link.label}</span>
                  </span>
                </LinkButton>
              ))}
            </div>
          </Section>

          {related.length > 0 ? (
            <Card>
              <p className="mb-3 text-sm font-semibold text-ink">Related careers</p>
              <div className="space-y-2">
                {related.map((r) => (
                  <LinkButton
                    key={r.id}
                    href={`/app/careers/${r.slug}`}
                    variant="ghost"
                    size="sm"
                    className="flex h-auto w-full flex-col items-start gap-1 rounded-xl bg-canvas/60 px-3 py-2.5 text-left hover:bg-canvas"
                  >
                    <span className="font-semibold text-ink">{r.title}</span>
                    <Badge className={cn("pointer-events-none", categoryTint(r.category))}>{r.category}</Badge>
                  </LinkButton>
                ))}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </Screen>
  );
}
