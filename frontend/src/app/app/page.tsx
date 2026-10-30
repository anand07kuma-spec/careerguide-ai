"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Briefcase,
  Building2,
  ClipboardList,
  Compass,
  FileText,
  GraduationCap,
  Handshake,
  Info,
  Lightbulb,
  MessagesSquare,
  Mic,
  Settings2,
  ShieldCheck,
  Sparkles,
  Split,
  Wallet,
  X,
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
  Stat,
} from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Health, Journey, RecommendationSet, SavedCareer } from "@/lib/types";
import { classLabel } from "@/lib/utils";

/**
 * The dashboard is an instrument panel, not an article: a number, an icon, and
 * nothing else until the student asks. Every explanation lives in `Detail`
 * behind the control it describes, so the screen stays scannable while the full
 * honest wording remains one tap away. Disclosures that a person must not miss
 * (demo mode, the note under a suggestion) stay printed on the page.
 */

/** What a tile says when it is opened: a short truth, then a way to act. */
interface Detail {
  title: string;
  icon: ReactNode;
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

const TONE = {
  brand: "bg-brand-mist text-brand-dark",
  teal: "bg-teal-mist text-teal",
  success: "bg-success-mist text-success",
  warning: "bg-warning-mist text-amber-700",
} as const;

type Tone = keyof typeof TONE;

/** The places a student can go, described once so the tile itself can stay quiet. */
const PLACES: { href: string; label: string; icon: typeof Briefcase; tone: Tone; detail: Detail }[] = [
  {
    href: "/app/careers",
    label: "Careers",
    icon: Briefcase,
    tone: "brand",
    detail: {
      title: "Career Explorer",
      icon: <Briefcase className="h-5 w-5" aria-hidden />,
      lines: [
        "More than forty profiles: a working day, the skills, the real cost, and routes that work from smaller towns.",
        "Nothing here is sorted by how much a career earns, and no career is ever marked out of reach.",
      ],
      href: "/app/careers",
      cta: "Open Career Explorer",
    },
  },
  {
    href: "/app/streams",
    label: "Streams",
    icon: Split,
    tone: "teal",
    detail: {
      title: "Choose your stream",
      icon: <Split className="h-5 w-5" aria-hidden />,
      lines: [
        "What Science, Commerce and Humanities are actually like, plus the routes that never appear on the usual list.",
        "No recommendation and no score. It explains the streams and tells you exactly what to ask your own school.",
      ],
      href: "/app/streams",
      cta: "Read the streams",
    },
  },
  {
    href: "/app/exams",
    label: "Exams",
    icon: ClipboardList,
    tone: "warning",
    detail: {
      title: "Exams & entrances",
      icon: <ClipboardList className="h-5 w-5" aria-hidden />,
      lines: [
        "JEE, NEET, CUET, CLAT, CA Foundation and the others, grouped by what you become through them.",
        "No dates, fees, cutoffs or eligibility numbers — those change every year, so each entry names the official notification instead.",
      ],
      href: "/app/exams",
      cta: "Open the exams map",
    },
  },
  {
    href: "/app/interests",
    label: "Interests",
    icon: Lightbulb,
    tone: "warning",
    detail: {
      title: "Discover My Interests",
      icon: <Lightbulb className="h-5 w-5" aria-hidden />,
      lines: [
        "A few friendly questions. Answers are stored as short theme notes, not as a profile of you.",
        "This is not a test. There is no score, and no wrong answer changes what you are told later.",
      ],
      href: "/app/interests",
      cta: "Answer the questions",
    },
  },
  {
    href: "/app/plans",
    label: "Plans",
    icon: GraduationCap,
    tone: "teal",
    detail: {
      title: "Study & Skill Plans",
      icon: <GraduationCap className="h-5 w-5" aria-hidden />,
      lines: [
        "Turn a direction into small steps you can actually do this week, and tick them off.",
        "Steps lean on free material first. A plan never turns into a sales pitch for a course.",
      ],
      href: "/app/plans",
      cta: "Build a plan",
    },
  },
  {
    href: "/app/resources",
    label: "Resources",
    icon: BookOpen,
    tone: "brand",
    detail: {
      title: "Resources",
      icon: <BookOpen className="h-5 w-5" aria-hidden />,
      lines: [
        "Videos, books, practice and people to talk to, sorted by what a family can actually reach.",
        "Every listing says what it costs. Verify the details on the source website before you count on them.",
      ],
      href: "/app/resources",
      cta: "Browse resources",
    },
  },
  {
    href: "/app/scholarships",
    label: "Money help",
    icon: Wallet,
    tone: "success",
    detail: {
      title: "Scholarships & Aid",
      icon: <Wallet className="h-5 w-5" aria-hidden />,
      lines: [
        "Support that may exist for your class, state or subject, with what each one asks for.",
        "Rules and deadlines change every year, so these are leads to check on the official site — never a promise.",
      ],
      href: "/app/scholarships",
      cta: "Look at aid",
    },
  },
  {
    href: "/app/institutes",
    label: "Institutes",
    icon: Building2,
    tone: "teal",
    detail: {
      title: "Institutes & Courses",
      icon: <Building2 className="h-5 w-5" aria-hidden />,
      lines: [
        "Where a field can be studied, with fees and entry routes shown side by side.",
        "If a listing was paid for, it says so. Payment has no effect on what the guide suggests.",
      ],
      href: "/app/institutes",
      cta: "Compare institutes",
    },
  },
  {
    href: "/app/reports",
    label: "Report",
    icon: FileText,
    tone: "brand",
    detail: {
      title: "Reports",
      icon: <FileText className="h-5 w-5" aria-hidden />,
      lines: [
        "One page that gathers what you explored, meant for showing a parent or a teacher.",
        "It lists what the guide actually heard from you, and what is still unverified.",
      ],
      href: "/app/reports",
      cta: "Make a report",
    },
  },
  {
    href: "/interview-prep",
    label: "Practice Interview",
    icon: Handshake,
    tone: "teal",
    detail: {
      title: "Practice Interview",
      icon: <Handshake className="h-5 w-5" aria-hidden />,
      lines: [
        "Five questions about you for any job you pick, a short note after each answer, then a few things to try next time.",
        "This tab holds the conversation and the server keeps nothing of it. With no AI configured you get this app's own questions, and no score.",
      ],
      href: "/interview-prep",
      cta: "Start practising",
    },
  },
  {
    href: "/app/journey",
    label: "Journey",
    icon: Compass,
    tone: "warning",
    detail: {
      title: "My Journey",
      icon: <Compass className="h-5 w-5" aria-hidden />,
      lines: [
        "The record of conversations, saved careers and steps you finished, newest first.",
        "You can delete any conversation from here. Nothing is kept to build a profile of you.",
      ],
      href: "/app/journey",
      cta: "Open my journey",
    },
  },
];

function Tile({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: typeof Briefcase;
  label: string;
  tone: Tone;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-2 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONE[tone]} transition-transform group-hover:scale-105`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-xs font-medium leading-relaxed text-ink break-words">{t(label)}</span>
    </button>
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

  useEffect(() => {
    if (status !== "ready" || isParent) return;
    // Filling the dashboard is the whole point of this effect, and every setState
    // inside those loaders happens after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.allSettled([loadHealth(), loadJourney(), loadRecs(), loadSaved()]);
  }, [status, isParent, loadHealth, loadJourney, loadRecs, loadSaved]);

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
  const done = journey.data?.activities_completed ?? 0;
  const total = journey.data?.activities_total ?? 0;

  const statDetails: (Detail & { value: ReactNode; tone: Tone })[] = [
    {
      title: "Sessions completed",
      value: journey.data?.sessions_completed ?? 0,
      tone: "brand",
      icon: <MessagesSquare className="h-5 w-5" aria-hidden />,
      lines: [
        "Conversations you started and finished. The guide uses them to remember what you already said, so you are never asked the same thing twice.",
        isYounger
          ? "Talking again is how this number grows. Short chats are fine."
          : "A short chat every few days gives the guide enough to work with.",
      ],
      href: "/app/chat",
      cta: "Start a conversation",
    },
    {
      title: "Careers saved",
      value: savedItems.length,
      tone: "teal",
      icon: <Bookmark className="h-5 w-5" aria-hidden />,
      lines: [
        "Profiles you bookmarked to look at again. Saving says nothing about whether a career suits you — it is only a note to self.",
        "You can remove any of them at any time, from the list below this one.",
      ],
      href: "/app/careers",
      cta: "Browse careers",
    },
    {
      title: "Themes explored",
      value: journey.data?.themes_explored ?? 0,
      tone: "success",
      icon: <Sparkles className="h-5 w-5" aria-hidden />,
      lines: [
        "Broad interests the guide heard from you, such as building things, working with people, or patterns and numbers.",
        "Themes come from what you said out loud. They are never inferred from your voice, your accent or how fast you speak.",
      ],
      href: "/app/interests",
      cta: "Add more interests",
    },
    {
      title: "Activities done",
      // "0/0" reads as a score of zero out of zero. With no plan there is
      // nothing to be out of, so the denominator only appears once there is one.
      value: total ? `${done}/${total}` : "0",
      tone: "teal",
      icon: <Compass className="h-5 w-5" aria-hidden />,
      lines: [
        total
          ? `You have finished ${done} of ${total} suggested explorations — a video, a career read, a conversation with someone who does the work.`
          : "No activities yet, because no study plan has been made for you. The guide suggests them inside a plan, so this count starts once you have one.",
        "They are ideas to try, not homework. Skipping one costs nothing and changes no suggestion.",
      ],
      href: total ? "/app/journey" : "/app/plans",
      cta: total ? "See my journey" : "Look at study plans",
    },
  ];

  return (
    <Screen
      title={tf("Hi {name}", { name })}
      badge={<Badge tone="brand" icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>{t("Student")}</Badge>}
      action={
        profile?.class_level ? (
          <span className="text-sm text-muted">{classLabel(profile.class_level)}</span>
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
        {/* Guide + the two ways in. */}
        <Card className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
          <GuideAvatar state="idle" className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-muted">
              {isYounger ? t("Ready to explore some cool jobs?") : t("Pick up where you left off.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton href="/app/call" size="sm">
                <Mic className="h-4 w-4" aria-hidden />
                {t("Voice call")}
              </LinkButton>
              <LinkButton href="/app/chat" variant="outline" size="sm">
                <MessagesSquare className="h-4 w-4" aria-hidden />
                {t("Chat")}
              </LinkButton>
              <LinkButton href="/app/settings" variant="ghost" size="sm">
                <Settings2 className="h-4 w-4" aria-hidden />
                {t("Settings")}
              </LinkButton>
            </div>
          </div>
        </Card>

        {health.state === "ready" && health.data?.demo_mode ? (
          <p className="flex items-start gap-1.5 px-1 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t(
              "You are using the built-in demo guide, so replies come from a scripted sample until an AI key is configured. It still helps you explore.",
            )}
          </p>
        ) : null}

        {/* Numbers, each one explained on tap. */}
        <section aria-labelledby="stats-heading">
          <SectionHeading id="stats-heading" title="Your journey so far" className="mb-3" />
          {journey.state === "loading" ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Skeleton className="h-[88px]" />
              <Skeleton className="h-[88px]" />
              <Skeleton className="h-[88px]" />
              <Skeleton className="h-[88px]" />
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
              {statDetails.map((item) => (
                <Stat
                  key={item.title}
                  label={item.title}
                  value={item.value}
                  tone={item.tone}
                  onClick={() => setDetail(item)}
                  footer={
                    item.title === "Activities done" ? (
                      <ProgressBar className="mt-3" value={done} total={total || 1} tone="teal" />
                    ) : null
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Where to go next: icons only, the explaining waits inside each one. */}
        <section aria-labelledby="places-heading">
          <SectionHeading id="places-heading" title="Explore" className="mb-3" />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {PLACES.map((place) => (
              <Tile
                key={place.href}
                icon={place.icon}
                label={place.label}
                tone={place.tone}
                onClick={() => setDetail(place.detail)}
              />
            ))}
          </div>
        </section>

        {/* Directions */}
        <section aria-labelledby="recs-heading">
          <SectionHeading
            id="recs-heading"
            title="Directions worth exploring"
            action={
              <LinkButton href="/app/careers" variant="outline" size="sm">
                {t("Browse all")}
              </LinkButton>
            }
            className="mb-3"
          />
          {recs.state === "loading" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-[104px]" />
              <Skeleton className="h-[104px]" />
              <Skeleton className="h-[104px]" />
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
              <div className="grid gap-3 sm:grid-cols-3">
                {recItems.slice(0, 3).map((rec) => (
                  <Card key={rec.career.id} className="flex flex-col justify-between gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 text-base font-semibold leading-tight text-ink break-words">
                        {t(rec.career.title)}
                      </h3>
                      <EvidenceBadge level={rec.evidence_level} className="shrink-0" />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() =>
                        setDetail({
                          title: rec.career.title,
                          icon: <Compass className="h-5 w-5" aria-hidden />,
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
              {recs.data?.note ? (
                <p className="text-xs leading-relaxed text-muted">{recs.data.note}</p>
              ) : null}
            </div>
          )}
        </section>

        {/* Saved careers */}
        <section aria-labelledby="saved-heading">
          <SectionHeading id="saved-heading" title="Saved careers" className="mb-3" />
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
                <div key={item.career.id} className="flex items-center gap-3 p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
                    <Briefcase className="h-4 w-4" aria-hidden />
                  </span>
                  <LinkButton
                    href={`/app/careers/${item.career.slug}`}
                    variant="ghost"
                    size="sm"
                    className="min-w-0 flex-1 justify-start px-0 text-left text-ink hover:bg-transparent"
                  >
                    <span className="truncate font-medium">{item.career.title}</span>
                    <span className="ml-2 hidden truncate text-xs text-muted sm:inline">
                      {item.career.category}
                    </span>
                  </LinkButton>
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
            <SectionHeading id="family-heading" title="Family" className="mb-3" />
            <LinkButton
              href="/app/settings"
              variant="outline"
              size="md"
              className="w-full justify-between gap-3 p-4 text-left"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-mist text-success">
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

      {/* One dialog for every explanation on this screen. */}
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
              {detail.icon}
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
