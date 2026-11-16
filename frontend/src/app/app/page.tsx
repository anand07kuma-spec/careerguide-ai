"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bookmark,
  Briefcase,
  Building2,
  ChevronRight,
  ClipboardList,
  Compass,
  FileText,
  FileUser,
  GraduationCap,
  Handshake,
  Info,
  Lightbulb,
  MessagesSquare,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Split,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { GuideAvatar } from "@/components/brand";
import { Screen } from "@/components/layout/app-shell";
import { Card, SectionHeading } from "@/components/ui/card";
import { useT, useTf } from "@/lib/i18n";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge, EvidenceBadge } from "@/components/ui/badge";
import {
  EmptyState,
  ErrorState,
  LoadingPanel,
  ProgressBar,
  Skeleton,
  SkeletonCard,
  Stat,
} from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Sitting } from "@/lib/assessments";
import type {
  CareerReport,
  ConversationInfo,
  Health,
  Journey,
  RecommendationSet,
  Resume,
  SavedCareer,
  StudyPlan,
} from "@/lib/types";
import { classLabel, cn, relativeTime } from "@/lib/utils";

/**
 * The dashboard is an instrument panel, not an article: a label, a number, an
 * icon, and the page it leads to. Shortcuts and progress tiles are ordinary
 * links, so reaching a part of the guide costs one click. Disclosures that a
 * person must not miss (demo mode, the note under a suggestion) stay printed on
 * the page.
 */

/** The recommendation's own explanation: why this one, then a way to read more. */
interface Detail {
  title: string;
  icon: LucideIcon;
  lines: string[];
  href?: string;
  cta?: string;
}

/** Each data card owns its own load state, so one failure never blanks the page. */
type Resource<T> = {
  state: "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
};

function initial<T>(): Resource<T> {
  return { state: "loading", data: null, error: null };
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong loading this part of your dashboard.";
}

function classNumber(classLevel: string | null | undefined): number {
  if (!classLevel) return 0;
  const digits = classLevel.replace(/\D/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

/** The places a student can go, described once so the card only has to point. */
const PLACES: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  {
    href: "/app/careers",
    label: "Careers",
    hint: "Forty-plus profiles, honestly written",
    icon: Briefcase,
  },
  {
    href: "/app/streams",
    label: "Streams",
    hint: "Science, Commerce, Humanities",
    icon: Split,
  },
  {
    href: "/app/exams",
    label: "Exams",
    hint: "JEE, NEET, CUET and more",
    icon: ClipboardList,
  },
  {
    href: "/app/interests",
    label: "Interests",
    hint: "A few friendly questions",
    icon: Lightbulb,
  },
  {
    href: "/app/plans",
    label: "Plans",
    hint: "Small steps for this week",
    icon: GraduationCap,
  },
  {
    href: "/app/resources",
    label: "Resources",
    hint: "Free-first videos and books",
    icon: BookOpen,
  },
  {
    href: "/app/scholarships",
    label: "Money help",
    hint: "Scholarships and aid",
    icon: Wallet,
  },
  {
    href: "/app/institutes",
    label: "Institutes",
    hint: "Where it can be studied",
    icon: Building2,
  },
  {
    href: "/app/reports",
    label: "Report",
    hint: "One page for a parent",
    icon: FileText,
  },
  {
    href: "/interview-prep",
    label: "Practice Interview",
    hint: "Five questions, no score",
    icon: Handshake,
  },
  {
    href: "/app/journey",
    label: "Journey",
    hint: "What you have done so far",
    icon: Compass,
  },
];

/** The dashboard names a questionnaire by its type, not by the server's copy in
 * whichever language the last sitting happened to use. */
const ASSESSMENT_LABELS: Record<Sitting["assessment_type"], string> = {
  interest: "Interest questionnaire",
  personality: "Personality questionnaire",
  aptitude: "Aptitude questionnaire",
};

const CHAT_LANGUAGES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  hinglish: "Hinglish",
};

function PlaceCard({
  icon: Icon,
  label,
  hint,
  href,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  href: string;
}) {
  const t = useT();
  // One card per place, and the card is the whole target: the icon is a wayfinding
  // mark rather than a button, the sentence underneath is the same hint that used
  // to live only in a tooltip, and the chevron answers the tap before it happens.
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-card border border-line bg-surface p-3 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lift focus-visible:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 sm:p-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-mist text-brand-dark ring-1 ring-inset ring-brand/10 transition-colors duration-200 group-hover:bg-brand-mist group-hover:text-brand group-hover:ring-brand/25">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <ChevronRight
          className="mt-1 h-3.5 w-3.5 shrink-0 text-muted/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand motion-reduce:transform-none"
          aria-hidden
        />
      </div>
      <span className="mt-2.5 block text-[13px] font-semibold leading-snug tracking-tight text-heading">
        {t(label)}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-muted line-clamp-2">{t(hint)}</span>
    </Link>
  );
}

/**
 * A quiet original drawing for the guide panel: an open book, a dotted route
 * rising out of it past three markers, ending at a compass. Decoration only —
 * the panel already carries its own words and its own calls to action.
 */
function GuideRoute({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 240" fill="none" aria-hidden className={className}>
      <g stroke="#93C5FD" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M42 190c20-9 41-9 61 0v36c-20-9-41-9-61 0v-36Z" opacity=".55" />
        <path d="M103 190c20-9 41-9 61 0v36c-20-9-41-9-61 0v-36Z" opacity=".55" />
        <path
          d="M133 186c6-20 26-18 38-34 11-15 12-30 30-37 16-6 31 1 41-14"
          strokeDasharray="1.5 7"
          opacity=".6"
        />
        <circle cx="171" cy="152" r="3.5" opacity=".9" />
        <circle cx="201" cy="115" r="3" opacity=".75" />
        <circle cx="236" cy="99" r="2.5" opacity=".6" />
        <circle cx="286" cy="62" r="28" opacity=".6" />
        <path d="M286 46v32M270 62h32" opacity=".35" />
        <path d="M277 70l6-20 6 20-6-4-6 4Z" fill="#93C5FD" stroke="none" opacity=".8" />
      </g>
      <g fill="#93C5FD" opacity=".5">
        <circle cx="322" cy="30" r="1.6" />
        <circle cx="56" cy="52" r="1.4" />
        <circle cx="338" cy="150" r="1.5" />
        <circle cx="24" cy="120" r="1.2" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------ latest work cards
//
// One card per part of the account, each showing only what the server actually
// answered. An empty answer is printed as an empty state rather than as a filled-in
// example, and a failed read is contained to its own card.

function LatestCard({
  icon: Icon,
  label,
  title,
  children,
  footer,
  className,
}: {
  icon: LucideIcon;
  label: string;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <Card className={cn("flex flex-col gap-3 p-5", className)}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-subtle-ink">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted">{t(label)}</p>
      </div>
      <h3 className="text-base font-semibold leading-snug text-heading break-words">{title}</h3>
      {children ? (
        <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
      ) : null}
      {footer ? <div className="mt-auto flex flex-wrap items-center gap-2 pt-0.5">{footer}</div> : null}
    </Card>
  );
}

function LatestError({
  icon: Icon,
  label,
  message,
  onRetry,
  className,
}: {
  icon: LucideIcon;
  label: string;
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <Card className={cn("flex flex-col gap-3 p-5", className)}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-subtle-ink">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted">{t(label)}</p>
      </div>
      <p role="alert" className="flex items-start gap-2 text-sm leading-relaxed text-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span className="min-w-0 break-words">{message}</span>
      </p>
      <Button variant="outline" size="sm" className="mt-auto self-start" onClick={onRetry}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {t("Try again")}
      </Button>
    </Card>
  );
}

function LatestAssessmentCard({
  resource,
  onRetry,
  className,
}: {
  resource: Resource<Sitting[]>;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();
  const tf = useTf();
  const icon = ClipboardList;
  const label = "Latest assessment";

  if (resource.state === "loading") {
    return (
      <div className={className}>
        <SkeletonCard />
      </div>
    );
  }
  if (resource.state === "error") {
    return (
      <LatestError
        icon={icon}
        label={label}
        message={resource.error ?? ""}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  const latest = resource.data?.[0];
  if (!latest) {
    return (
      <LatestCard
        icon={icon}
        label={label}
        title={t("No questionnaire finished yet")}
        className={className}
        footer={
          <LinkButton href="/app/assessments" size="sm" variant="outline">
            {t("Open assessments")}
          </LinkButton>
        }
      >
        <p>{t("Each questionnaire takes six to ten minutes. Finish one and its result sits here.")}</p>
      </LatestCard>
    );
  }

  return (
    <LatestCard
      icon={icon}
      label={label}
      title={t(ASSESSMENT_LABELS[latest.assessment_type])}
      className={className}
      footer={
        <>
          <LinkButton href={`/app/assessments/result/${latest.result_id}`} size="sm">
            {t("View result")}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </LinkButton>
          <LinkButton
            href={`/app/assessments/${latest.assessment_type}`}
            size="sm"
            variant="ghost"
          >
            {t("Retake")}
          </LinkButton>
        </>
      }
    >
      <p>{tf("Finished {when}", { when: relativeTime(latest.completed_at) })}</p>
      {latest.total > 0 ? (
        <p className="text-xs">
          {tf("{answered} of {total} questions answered", {
            answered: latest.answered,
            total: latest.total,
          })}
        </p>
      ) : null}
    </LatestCard>
  );
}

function LatestPlanCard({
  resource,
  onRetry,
  className,
}: {
  resource: Resource<StudyPlan[]>;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();
  const tf = useTf();
  const icon = GraduationCap;
  const label = "Study plan";

  if (resource.state === "loading") {
    return (
      <div className={className}>
        <SkeletonCard />
      </div>
    );
  }
  if (resource.state === "error") {
    return (
      <LatestError
        icon={icon}
        label={label}
        message={resource.error ?? ""}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  const all = resource.data ?? [];
  // Newest plan with work left; if every plan is finished, the newest one still
  // has the steps the student last looked at.
  const plan =
    all.find((item) =>
      item.items.some((step) => step.status === "pending" || step.status === "in_progress"),
    ) ?? all[0];

  if (!plan) {
    return (
      <LatestCard
        icon={icon}
        label={label}
        title={t("No study plan yet")}
        className={className}
        footer={
          <LinkButton href="/app/plans" size="sm" variant="outline">
            {t("Build a plan")}
          </LinkButton>
        }
      >
        <p>
          {t(
            "A plan turns a direction into small steps you can do this week. The guide can build one from a career you are exploring.",
          )}
        </p>
      </LatestCard>
    );
  }

  const steps = [...plan.items].sort((a, b) => a.order - b.order);
  const open = steps.filter(
    (step) => step.status === "pending" || step.status === "in_progress",
  );
  const completed = steps.filter((step) => step.status === "completed").length;
  const next = open[0];

  return (
    <LatestCard
      icon={icon}
      label={label}
      title={plan.title}
      className={className}
      footer={
        <LinkButton href="/app/plans" size="sm">
          {t("Continue plan")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </LinkButton>
      }
    >
      {steps.length === 0 ? (
        <p>{t("This plan has no steps yet.")}</p>
      ) : next ? (
        <div className="rounded-xl border border-line bg-canvas/60 px-3 py-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
            {t("Next step")}
          </p>
          <p className="mt-1 text-sm font-medium leading-snug text-ink break-words">{next.title}</p>
          {next.estimated_effort ? (
            <p className="mt-1 text-xs text-muted">{next.estimated_effort}</p>
          ) : null}
        </div>
      ) : (
        <p>
          {completed === steps.length
            ? t("Every step in this plan is finished.")
            : t("Nothing is waiting in this plan. Skipped steps can be reopened on the plan page.")}
        </p>
      )}
      {steps.length > 0 ? (
        <>
          <ProgressBar value={completed} total={steps.length} />
          <p className="text-xs">
            {tf("{done} of {total} steps finished", { done: completed, total: steps.length })}
          </p>
        </>
      ) : null}
    </LatestCard>
  );
}

function LatestReportCard({
  resource,
  onRetry,
  className,
}: {
  resource: Resource<CareerReport | null>;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();
  const tf = useTf();
  const icon = FileText;
  const label = "Latest report";

  if (resource.state === "loading") {
    return (
      <div className={className}>
        <SkeletonCard />
      </div>
    );
  }
  if (resource.state === "error") {
    return (
      <LatestError
        icon={icon}
        label={label}
        message={resource.error ?? ""}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  const report = resource.data;
  if (!report) {
    return (
      <LatestCard
        icon={icon}
        label={label}
        title={t("No report yet")}
        className={className}
        footer={
          <LinkButton href="/app/reports" size="sm" variant="outline">
            {t("Open reports")}
          </LinkButton>
        }
      >
        <p>
          {t(
            "A report gathers what the guide has heard from you. It can be made after a conversation or two.",
          )}
        </p>
      </LatestCard>
    );
  }

  const name = report.content.student.name?.trim();
  const count = report.content.recommendations.length;

  return (
    <LatestCard
      icon={icon}
      label={label}
      title={tf("Prepared for {name}", { name: name || t("this student") })}
      className={className}
      footer={
        <LinkButton href="/app/reports" size="sm">
          {t("View report")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </LinkButton>
      }
    >
      <p>{tf("Updated {when}", { when: relativeTime(report.generated_at) })}</p>
      <p className="text-xs">
        {count === 1
          ? tf("{n} direction suggested", { n: count })
          : count > 1
            ? tf("{n} directions suggested", { n: count })
            : t("No directions are listed in this report yet.")}
      </p>
    </LatestCard>
  );
}

function LatestConversationCard({
  resource,
  onRetry,
  className,
}: {
  resource: Resource<ConversationInfo[]>;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();
  const tf = useTf();
  const icon = MessagesSquare;
  const label = "Recent conversation";

  if (resource.state === "loading") {
    return (
      <div className={className}>
        <SkeletonCard />
      </div>
    );
  }
  if (resource.state === "error") {
    return (
      <LatestError
        icon={icon}
        label={label}
        message={resource.error ?? ""}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  // The list route answers newest first, so the first row is the most recent
  // conversation — never a preview assembled from it.
  const latest = resource.data?.[0];
  if (!latest) {
    return (
      <LatestCard
        icon={icon}
        label={label}
        title={t("No conversation yet")}
        className={className}
        footer={
          <LinkButton href="/app/chat" size="sm" variant="outline">
            {t("Talk to your guide")}
          </LinkButton>
        }
      >
        <p>{t("Nothing has been said yet. The guide is ready whenever you are.")}</p>
      </LatestCard>
    );
  }

  const active = latest.status === "active";
  const voice = latest.kind === "voice";
  const language = CHAT_LANGUAGES[latest.language];

  return (
    <LatestCard
      icon={icon}
      label={label}
      title={voice ? t("Voice call with your guide") : t("Chat with your guide")}
      className={className}
      footer={
        <LinkButton href={voice ? "/app/call" : "/app/chat"} size="sm">
          {voice
            ? active
              ? t("Continue voice call")
              : t("Open voice call")
            : active
              ? t("Continue chat")
              : t("Open chat")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </LinkButton>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={active ? "success" : "neutral"}>
          {active ? t("Open now") : t("Closed")}
        </Badge>
        {language ? (
          <span className="text-xs text-muted">{tf("In {language}", { language: t(language) })}</span>
        ) : null}
      </div>
      <p className="text-xs">{tf("Started {when}", { when: relativeTime(latest.created_at) })}</p>
    </LatestCard>
  );
}

function LatestResumeCard({
  resource,
  onRetry,
  className,
}: {
  resource: Resource<Resume>;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();
  const tf = useTf();
  const icon = FileUser;
  const label = "Resume";

  if (resource.state === "loading") {
    return (
      <div className={className}>
        <SkeletonCard />
      </div>
    );
  }
  if (resource.state === "error") {
    return (
      <LatestError
        icon={icon}
        label={label}
        message={resource.error ?? ""}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  const resume = resource.data;
  if (!resume || !resume.saved_at) {
    return (
      <LatestCard
        icon={icon}
        label={label}
        title={t("Not saved yet")}
        className={className}
        footer={
          <LinkButton href="/app/resume" size="sm" variant="outline">
            {t("Start resume")}
          </LinkButton>
        }
      >
        <p>{t("Nothing saved so far. Write it once and it stays on your account.")}</p>
      </LatestCard>
    );
  }

  const plural = (n: number, one: string, many: string) =>
    n === 1 ? tf(`{n} ${one}`, { n }) : tf(`{n} ${many}`, { n });
  const parts = [
    resume.education.length ? plural(resume.education.length, "class", "classes") : null,
    resume.skills.length ? plural(resume.skills.length, "skill", "skills") : null,
    resume.projects.length ? plural(resume.projects.length, "project", "projects") : null,
  ].filter((part): part is string => part !== null);

  return (
    <LatestCard
      icon={icon}
      label={label}
      title={resume.target_role?.trim() || t("Saved resume")}
      className={className}
      footer={
        <LinkButton href="/app/resume" size="sm">
          {t("Edit resume")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </LinkButton>
      }
    >
      <p>{tf("Saved {when}", { when: relativeTime(resume.saved_at) })}</p>
      {parts.length > 0 ? <p className="text-xs">{parts.join(" · ")}</p> : null}
    </LatestCard>
  );
}

export default function StudentHome() {
  const router = useRouter();
  const { status, isParent, user, profile } = useSession();
  const { toast } = useToast();
  const t = useT();
  const tf = useTf();

  const [health, setHealth] = useState<Resource<Health>>(initial);
  const [journey, setJourney] = useState<Resource<Journey>>(initial);
  const [recs, setRecs] = useState<Resource<RecommendationSet>>(initial);
  const [saved, setSaved] = useState<Resource<SavedCareer[]>>(initial);
  const [sittings, setSittings] = useState<Resource<Sitting[]>>(initial);
  const [plans, setPlans] = useState<Resource<StudyPlan[]>>(initial);
  const [report, setReport] = useState<Resource<CareerReport | null>>(initial);
  const [conversations, setConversations] = useState<Resource<ConversationInfo[]>>(initial);
  const [resume, setResume] = useState<Resource<Resume>>(initial);
  const [detail, setDetail] = useState<Detail | null>(null);

  // A parent should never land on the student home.
  useEffect(() => {
    if (status === "ready" && isParent) router.replace("/parent");
  }, [status, isParent, router]);

  // Nothing here sets state before its first await: an effect may start a load,
  // it may not render twice on the way in.
  const loadHealth = useCallback(async () => {
    try {
      const data = await api.health();
      setHealth({ state: "ready", data, error: null });
    } catch (error) {
      setHealth({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadJourney = useCallback(async () => {
    try {
      const data = await api.journey();
      setJourney({ state: "ready", data, error: null });
    } catch (error) {
      setJourney({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadRecs = useCallback(async () => {
    try {
      const data = await api.recommendations();
      setRecs({ state: "ready", data, error: null });
    } catch (error) {
      setRecs({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      const data = await api.savedCareers();
      setSaved({ state: "ready", data, error: null });
    } catch (error) {
      setSaved({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadSittings = useCallback(async () => {
    try {
      setSittings({ state: "ready", data: await api.sittings(), error: null });
    } catch (error) {
      setSittings({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      setPlans({ state: "ready", data: await api.plans(), error: null });
    } catch (error) {
      setPlans({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setReport({ state: "ready", data: await api.latestReport(), error: null });
    } catch (error) {
      setReport({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setConversations({
        state: "ready",
        data: await api.listConversations(),
        error: null,
      });
    } catch (error) {
      setConversations({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadResume = useCallback(async () => {
    try {
      setResume({ state: "ready", data: await api.resume(), error: null });
    } catch (error) {
      setResume({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    if (status !== "ready" || isParent) return;
    // Filling the dashboard is the whole point of this effect, and every setState
    // inside those loaders happens after an await. The latest-work cards go in two
    // smaller waves after the page's own numbers, because nine reads at once trip
    // the server's per-minute throttle on a page that is opened and reloaded.
    void (async () => {
      await Promise.allSettled([loadHealth(), loadJourney(), loadRecs(), loadSaved()]);
      await Promise.allSettled([loadPlans(), loadReport(), loadConversations()]);
      await Promise.allSettled([loadResume(), loadSittings()]);
    })();
  }, [
    status,
    isParent,
    loadHealth,
    loadJourney,
    loadRecs,
    loadSaved,
    loadPlans,
    loadReport,
    loadConversations,
    loadResume,
    loadSittings,
  ]);

  const unsave = useCallback(
    async (item: SavedCareer) => {
      const previous = saved.data ?? [];
      // Optimistic: drop the card first, restore it if the server disagrees.
      setSaved({ state: "ready", data: previous.filter((s) => s.career.id !== item.career.id), error: null });
      try {
        await api.unsaveCareer(item.career.id);
        toast(`Removed ${item.career.title} from saved careers.`, "success");
        void loadJourney();
      } catch (error) {
        setSaved({ state: "ready", data: previous, error: null });
        toast(messageFor(error), "error");
      }
    },
    [saved.data, toast, loadJourney],
  );

  const name = user?.display_name?.trim() || "there";
  const cls = classNumber(profile?.class_level);
  const isYounger = cls >= 3 && cls <= 8;
  const recItems = recs.data?.recommendations ?? [];
  const savedItems = saved.data ?? [];
  const sessions = journey.data?.sessions_completed ?? 0;
  const savedCount = journey.data?.careers_saved ?? savedItems.length;
  const done = journey.data?.activities_completed ?? 0;
  const total = journey.data?.activities_total ?? 0;

  const heroTitle = isYounger
    ? t("Ready to explore some cool jobs?")
    : sessions > 0
      ? t("Pick up where you left off.")
      : t("What should we explore first?");
  const heroBody = isYounger
    ? t("Tell the guide what you enjoy doing. It will show you a few jobs and what they are really like.")
    : t(
        "Ask about a stream, a subject, or a career you have never heard of. The guide works from what you tell it — no scores, no wrong questions.",
      );

  const statCards: {
    label: string;
    value: ReactNode;
    hint: string;
    tone: "brand" | "teal" | "success" | "warning" | "indigo";
    icon: LucideIcon;
    href: string;
  }[] = [
    {
      label: "Conversations",
      value: sessions,
      tone: "brand",
      icon: MessagesSquare,
      hint: t("Chats and voice calls you finished."),
      href: "/app/chat",
    },
    {
      label: "Careers saved",
      value: savedCount,
      tone: "teal",
      icon: Bookmark,
      hint: t("Profiles you bookmarked to revisit."),
      href: "/app/careers",
    },
    {
      label: "Themes explored",
      value: journey.data?.themes_explored ?? 0,
      tone: "indigo",
      icon: Sparkles,
      hint: t("Interests the guide heard in your words."),
      href: "/app/interests",
    },
    {
      label: "Activities done",
      // "0/0" reads as a score of zero out of zero. With no plan there is
      // nothing to be out of, so the denominator only appears once there is one.
      value: total ? `${done}/${total}` : "0",
      tone: "success",
      icon: Compass,
      hint: total
        ? tf("{done} of {total} steps in your plans are finished.", { done, total })
        : t("Starts once you have a study plan."),
      href: total ? "/app/journey" : "/app/plans",
    },
  ];

  return (
    <Screen
      title={tf("Hi {name}", { name })}
      description={t(
        "A workspace built from what you tell the guide — your conversations, saves and next steps, with nothing ranked.",
      )}
      badge={<Badge tone="brand" icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>{t("Student")}</Badge>}
      action={
        profile?.class_level ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink">
            <GraduationCap className="h-3.5 w-3.5 text-brand" aria-hidden />
            {classLabel(profile.class_level)}
          </span>
        ) : (
          // Onboarding no longer asks for a class, so this points at the
          // conversation where the guide asks for it, not at a form.
          <LinkButton href="/app/chat" variant="outline" size="sm">
            {t("Tell the guide your class")}
          </LinkButton>
        )
      }
    >
      <div className="space-y-6 sm:space-y-7">
        {/* The guide, given the one place on this page that outranks every number:
            a dark panel the student is invited into, with one obvious way in and
            the voice option beside it. */}
        <section className="relative overflow-hidden rounded-card bg-navy p-5 text-white shadow-lift sm:p-7 lg:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0 cg-aurora opacity-80" />
          <div aria-hidden className="pointer-events-none absolute inset-0 cg-grid-lines opacity-30" />
          <GuideRoute className="pointer-events-none absolute -bottom-6 -right-6 h-44 w-64 opacity-20 sm:h-56 sm:w-80 sm:opacity-30 lg:right-0 lg:h-64 lg:w-96 lg:opacity-35" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <GuideAvatar state="idle" className="h-16 w-16 shrink-0 sm:h-24 sm:w-24" />
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-brand-light">
                {t("Your career guide")}
              </p>
              <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                {heroTitle}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">{heroBody}</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <LinkButton
                  href="/app/chat"
                  size="lg"
                  className="w-full justify-center border border-transparent bg-white text-navy shadow-none hover:bg-white/90 sm:w-auto"
                >
                  <MessagesSquare className="h-4 w-4" aria-hidden />
                  {t("Start a conversation")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </LinkButton>
                <LinkButton
                  href="/app/call"
                  variant="outline"
                  size="lg"
                  className="w-full justify-center border-white/30 bg-white/5 text-white hover:border-white/45 hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  <Mic className="h-4 w-4" aria-hidden />
                  {t("Voice call")}
                </LinkButton>
              </div>
            </div>
          </div>
        </section>

        {health.state === "ready" && health.data?.demo_mode ? (
          <p className="flex items-start gap-2.5 rounded-control border border-line bg-surface px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span>
              {t(
                "You are using the built-in demo guide, so replies come from a scripted sample until an AI key is configured. It still helps you explore.",
              )}
            </span>
          </p>
        ) : null}

        {/* The guide's own places, one card each: the label says where it goes and
            the sentence under it says what it is for, so a student can choose a
            destination without opening any of them. */}
        <section aria-labelledby="places-heading">
          <SectionHeading
            id="places-heading"
            eyebrow="Your tools"
            title="Explore"
            description={t("Go straight to any part of the guide.")}
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-6">
            {PLACES.map((place) => (
              <PlaceCard
                key={place.href}
                icon={place.icon}
                label={place.label}
                hint={place.hint}
                href={place.href}
              />
            ))}
          </div>
        </section>

        {/* Directions come first: they are the only part of this page written for
            this student in particular, so the guide's own reasoning is visible
            here rather than hidden behind a second tap. */}
        <section aria-labelledby="recs-heading">
          <SectionHeading
            id="recs-heading"
            eyebrow="Made from what you said"
            title="Recommended for you"
            description={t(
              "The guide's own notes on what you told it. Treat them as starting points, and check anything before you plan around it.",
            )}
            action={
              <LinkButton href="/app/careers" variant="outline" size="sm">
                {t("Browse all careers")}
              </LinkButton>
            }
            className="mb-3"
          />
          {recs.state === "loading" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-[196px] md:col-span-2 xl:col-span-1" />
              <Skeleton className="h-[196px]" />
              <Skeleton className="h-[196px]" />
            </div>
          ) : recs.state === "error" ? (
            <ErrorState
              description={recs.error}
              onRetry={() => {
                setRecs(initial());
                void loadRecs();
              }}
            />
          ) : recItems.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="No directions yet"
              description={
                isYounger
                  ? "Chat with your guide or share what you like, and ideas will show up here."
                  : "A short conversation or the interest questions give the guide enough to suggest directions."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <LinkButton href="/app/chat" size="sm">
                    {t("Talk to your guide")}
                  </LinkButton>
                  <LinkButton href="/app/interests" size="sm" variant="outline">
                    {t("Answer interest questions")}
                  </LinkButton>
                </div>
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-card border border-brand/20 bg-brand-mist/40 p-3 sm:p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {recItems.slice(0, 3).map((rec, index) => (
                    <Card
                      key={rec.career.id}
                      className={`flex flex-col gap-3 border-brand/15 p-5 shadow-none transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift ${
                        index === 0 ? "md:col-span-2 xl:col-span-1" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-mist text-teal">
                          <Compass className="h-5 w-5" aria-hidden />
                        </span>
                        <EvidenceBadge level={rec.evidence_level} className="shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-brand break-words">
                          {t(rec.career.category)}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold leading-snug text-heading break-words">
                          {t(rec.career.title)}
                        </h3>
                      </div>
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted">{t(rec.why)}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 mt-auto self-start px-2 text-brand hover:bg-brand-mist/60"
                        onClick={() =>
                          setDetail({
                            title: rec.career.title,
                            icon: Compass,
                            lines: [
                              rec.why,
                              ...(rec.open_questions ?? []).slice(0, 2).map(
                                (question) => `Worth asking: ${question}`,
                              ),
                              "This is a starting point built from what you said. You are allowed to disagree with it.",
                            ],
                            href: `/app/careers/${rec.career.slug}`,
                            cta: "Explore this career",
                          })
                        }
                      >
                        <Info className="h-4 w-4" aria-hidden />
                        {t("Why this one")}
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
              {recs.data?.note ? (
                <p className="px-1 text-xs leading-relaxed text-muted">{t(recs.data.note)}</p>
              ) : null}
            </div>
          )}
        </section>

        {/* Numbers, each one a door to the part of the account it counts. */}
        <section aria-labelledby="stats-heading">
          <SectionHeading
            id="stats-heading"
            eyebrow="Your progress"
            title="What you have built so far"
            description={t(
              "Counted from your own account — conversations, saves and finished steps. Nothing here is estimated.",
            )}
            className="mb-3"
          />
          {journey.state === "loading" ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Skeleton className="h-[156px]" />
              <Skeleton className="h-[156px]" />
              <Skeleton className="h-[156px]" />
              <Skeleton className="h-[156px]" />
            </div>
          ) : journey.state === "error" ? (
            <ErrorState
              description={journey.error}
              onRetry={() => {
                setJourney(initial());
                void loadJourney();
              }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {statCards.map((item) => (
                <Stat
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  tone={item.tone}
                  icon={item.icon}
                  hint={item.hint}
                  href={item.href}
                  footer={
                    item.label === "Activities done" ? (
                      <ProgressBar className="mt-3" value={done} total={total || 1} />
                    ) : null
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* The latest real item in each part of the account, so the page says what
            is finished and what is waiting rather than only how many of each. */}
        <section aria-labelledby="latest-heading">
          <SectionHeading
            id="latest-heading"
            eyebrow="From your account"
            title="Your latest work"
            description={t(
              "The newest thing in each part of your account — a finished questionnaire, a plan, a report, a chat, your resume. Nothing here is estimated.",
            )}
            className="mb-3"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <LatestAssessmentCard
              resource={sittings}
              onRetry={() => {
                setSittings(initial());
                void loadSittings();
              }}
            />
            <LatestPlanCard
              resource={plans}
              onRetry={() => {
                setPlans(initial());
                void loadPlans();
              }}
            />
            <LatestReportCard
              resource={report}
              onRetry={() => {
                setReport(initial());
                void loadReport();
              }}
            />
            <LatestConversationCard
              resource={conversations}
              className="xl:col-span-2"
              onRetry={() => {
                setConversations(initial());
                void loadConversations();
              }}
            />
            <LatestResumeCard
              resource={resume}
              className="md:col-span-2 xl:col-span-1"
              onRetry={() => {
                setResume(initial());
                void loadResume();
              }}
            />
          </div>
        </section>


        {/* Saved careers */}
        <section aria-labelledby="saved-heading">
          <SectionHeading
            id="saved-heading"
            eyebrow="Kept for later"
            title="Saved careers"
            description={t("Bookmarks only. Saving a career says nothing about whether it suits you.")}
            action={
              saved.state === "ready" && savedItems.length > 0 ? (
                <Badge tone="teal">{tf("{n} saved", { n: savedItems.length })}</Badge>
              ) : undefined
            }
            className="mb-3"
          />
          {saved.state === "loading" ? (
            <LoadingPanel label="Loading your saved careers…" />
          ) : saved.state === "error" ? (
            <ErrorState
              description={saved.error}
              onRetry={() => {
                setSaved(initial());
                void loadSaved();
              }}
            />
          ) : savedItems.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Nothing saved yet"
              description="Tap the bookmark on any career to keep it here for later."
              action={
                <LinkButton href="/app/careers" size="sm">
                  {t("Find careers to explore")}
                </LinkButton>
              }
            />
          ) : (
            <Card className="divide-y divide-line p-0">
              {savedItems.slice(0, 6).map((item) => (
                <div
                  key={item.career.id}
                  className="flex items-start gap-3 p-3.5 transition-colors hover:bg-canvas sm:px-4 sm:py-4"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-mist text-teal">
                    <Briefcase className="h-4 w-4" aria-hidden />
                  </span>
                  <Link
                    href={`/app/careers/${item.career.slug}`}
                    className="group flex min-w-0 flex-1 items-start gap-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug text-ink break-words transition-colors group-hover:text-brand sm:text-[0.95rem]">
                        {item.career.title}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted break-words">
                        {item.career.category}
                      </span>
                    </span>
                    <ChevronRight
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                      aria-hidden
                    />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void unsave(item)}
                    aria-label={`Remove ${item.career.title} from saved careers`}
                    className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-danger-mist hover:text-danger"
                  >
                    <Bookmark className="h-4 w-4 fill-current" aria-hidden />
                  </button>
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* Parent door, only where it is real. */}
        {isYounger ? null : (
          <section aria-labelledby="family-heading">
            <SectionHeading
              id="family-heading"
              eyebrow="Trust and privacy"
              title="Family"
              className="mb-3"
            />
            <LinkButton
              href="/app/settings"
              variant="outline"
              size="md"
              className="w-full justify-between gap-3 p-4 text-left"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-subtle-ink">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {t("Privacy, consent and a parent link")}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {t("What is stored, who may see it, and what this device remembers.")}
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </LinkButton>
          </section>
        )}
      </div>

      {/* The recommendation's own explanation; navigation never passes through here. */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? t(detail.title) : ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              <X className="h-4 w-4" aria-hidden />
              {t("Close")}
            </Button>
            {detail?.href ? (
              <LinkButton href={detail.href} onClick={() => setDetail(null)}>
                {detail.cta ? t(detail.cta) : t("Open")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
            ) : null}
          </>
        }
      >
        <div className="flex gap-3">
          {detail ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark">
              <detail.icon className="h-5 w-5" aria-hidden />
            </span>
          ) : null}
          <div className="space-y-3 text-sm leading-relaxed text-ink">
            {detail?.lines.map((line) => (
              <p key={line}>{t(line)}</p>
            ))}
          </div>
        </div>
      </Modal>
    </Screen>
  );
}
