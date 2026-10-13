"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  Compass,
  GraduationCap,
  Info,
  Lightbulb,
  MessagesSquare,
  Mic,
  Sparkles,
} from "lucide-react";
import { GuideAvatar } from "@/components/brand";
import { Screen } from "@/components/layout/app-shell";
import { Card, SectionHeading } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
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
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Health, Journey, RecommendationSet, SavedCareer } from "@/lib/types";
import { classLabel } from "@/lib/utils";

/** Every data card owns its own load state so one failure never blanks the page. */
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

/** Classes 3–8 get short, concrete wording; older students get full sentences. */
function classNumber(classLevel: string | null | undefined): number {
  if (!classLevel) return 0;
  const digits = classLevel.replace(/\D/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

export default function StudentHome() {
  const router = useRouter();
  const { status, isParent, user, profile } = useSession();
  const { toast } = useToast();

  const [health, setHealth] = useState<Resource<Health>>(initial);
  const [journey, setJourney] = useState<Resource<Journey>>(initial);
  const [recs, setRecs] = useState<Resource<RecommendationSet>>(initial);
  const [saved, setSaved] = useState<Resource<SavedCareer[]>>(initial);

  // A parent should never land on the student home.
  useEffect(() => {
    if (status === "ready" && isParent) router.replace("/parent");
  }, [status, isParent, router]);

  const loadHealth = useCallback(async () => {
    setHealth({ state: "loading", data: null, error: null });
    try {
      setHealth({ state: "ready", data: await api.health(), error: null });
    } catch (error) {
      setHealth({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadJourney = useCallback(async () => {
    setJourney({ state: "loading", data: null, error: null });
    try {
      setJourney({ state: "ready", data: await api.journey(), error: null });
    } catch (error) {
      setJourney({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadRecs = useCallback(async () => {
    setRecs({ state: "loading", data: null, error: null });
    try {
      setRecs({ state: "ready", data: await api.recommendations(), error: null });
    } catch (error) {
      setRecs({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadSaved = useCallback(async () => {
    setSaved({ state: "loading", data: null, error: null });
    try {
      setSaved({ state: "ready", data: await api.savedCareers(), error: null });
    } catch (error) {
      setSaved({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    if (status !== "ready" || isParent) return;
    // allSettled so a single failing endpoint only degrades its own card.
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
  const greeting = isYounger
    ? `Hi ${name}! Ready to explore some cool jobs?`
    : `Welcome back, ${name}`;
  const greetingSub = isYounger
    ? "Let's find out what kind of work you might enjoy."
    : "Pick up where you left off, or start a fresh conversation with your guide.";

  const recItems = (recs.data?.recommendations ?? []).slice(0, 3);
  const savedItems = saved.data ?? [];
  const activitiesTotal = journey.data?.activities_total ?? 0;
  const activitiesDone = journey.data?.activities_completed ?? 0;

  return (
    <Screen
      title={greeting}
      description={greetingSub}
      badge={<Badge tone="brand" icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>Student dashboard</Badge>}
      action={
        profile?.class_level ? (
          <span className="text-sm text-muted">{classLabel(profile.class_level)}</span>
        ) : (
          // Onboarding no longer asks for a class, so this points at the
          // conversation where the guide asks for it, not at a form.
          <LinkButton href="/app/chat" variant="outline" size="sm">
            Tell the guide your class
          </LinkButton>
        )
      }
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Hero — the guide, with the two real ways in. */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-brand-mist/70 via-surface to-teal-mist/40">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <GuideAvatar state="idle" className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
                Your AI guide is ready
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                {isYounger
                  ? "Talk to the guide about what you like. There are no wrong answers."
                  : "Ask questions, explore directions and turn ideas into a study plan. Talk out loud or type — your choice."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href="/app/call">
                  <Mic className="h-4 w-4" aria-hidden />
                  Start a voice call
                </LinkButton>
                <LinkButton href="/app/chat" variant="outline">
                  <MessagesSquare className="h-4 w-4" aria-hidden />
                  Chat instead
                </LinkButton>
              </div>
              {health.state === "ready" && health.data?.demo_mode ? (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  You're using the built-in demo guide right now, so replies come from a scripted
                  sample until an AI key is configured. It still helps you explore.
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Quick stats */}
        <section aria-labelledby="stats-heading">
          <SectionHeading title="Your journey so far" className="mb-3" />
          {journey.state === "loading" ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Skeleton className="h-[92px]" />
              <Skeleton className="h-[92px]" />
              <Skeleton className="h-[92px]" />
              <Skeleton className="h-[92px]" />
            </div>
          ) : journey.state === "error" ? (
            <ErrorState description={journey.error} onRetry={loadJourney} />
          ) : journey.data ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Sessions completed" value={journey.data.sessions_completed} tone="brand" />
              <Stat label="Careers saved" value={journey.data.careers_saved} tone="teal" />
              <Stat label="Themes explored" value={journey.data.themes_explored} tone="success" />
              <div className="cg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Activities done</p>
                <p className="mt-1.5 text-2xl font-semibold leading-none text-brand-dark">
                  {activitiesDone}
                  <span className="text-base font-medium text-muted">/{activitiesTotal}</span>
                </p>
                <ProgressBar
                  className="mt-3"
                  value={activitiesDone}
                  total={activitiesTotal || 1}
                  tone="teal"
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* Directions worth exploring */}
        <section aria-labelledby="recs-heading">
          <SectionHeading
            title="Directions worth exploring"
            description="These are starting points to look into, not a verdict on what you should do."
            className="mb-3"
          />
          {recs.state === "loading" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : recs.state === "error" ? (
            <ErrorState description={recs.error} onRetry={loadRecs} />
          ) : recItems.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="No directions yet"
              description={
                isYounger
                  ? "Chat with your guide or share what you like, and ideas will show up here."
                  : "A short conversation or the interests questions give the guide enough to suggest directions worth a look."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <LinkButton href="/app/chat" size="sm">
                    Talk to your guide
                  </LinkButton>
                  <LinkButton href="/app/interests" size="sm" variant="outline">
                    Answer interest questions
                  </LinkButton>
                </div>
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recItems.map((rec) => (
                  <Card key={rec.career.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-tight text-ink">{rec.career.title}</h3>
                      <EvidenceBadge level={rec.evidence_level} />
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{rec.why}</p>
                    {rec.open_questions[0] ? (
                      <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-xs leading-relaxed text-ink">
                        <span className="font-medium text-brand-dark">Worth asking: </span>
                        {rec.open_questions[0]}
                      </p>
                    ) : null}
                    <LinkButton
                      href={`/app/careers/${rec.career.slug}`}
                      variant="ghost"
                      size="sm"
                      className="mt-3 self-start px-0 text-brand-dark hover:bg-transparent"
                    >
                      Explore this career
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </LinkButton>
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
          <SectionHeading
            title="Saved careers"
            description="Careers you've kept to look at again."
            action={
              <LinkButton href="/app/careers" variant="outline" size="sm">
                Browse more
              </LinkButton>
            }
            className="mb-3"
          />
          {saved.state === "loading" ? (
            <LoadingPanel label="Loading your saved careers…" />
          ) : saved.state === "error" ? (
            <ErrorState description={saved.error} onRetry={loadSaved} />
          ) : savedItems.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Nothing saved yet"
              description="Tap the bookmark on any career to keep it here for later."
              action={
                <LinkButton href="/app/careers" size="sm">
                  Find careers to explore
                </LinkButton>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedItems.map((item) => (
                <Card key={item.career.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <LinkButton
                      href={`/app/careers/${item.career.slug}`}
                      variant="ghost"
                      size="sm"
                      className="-ml-2 max-w-full justify-start px-0 text-left text-ink hover:bg-transparent"
                    >
                      <span className="truncate font-semibold">{item.career.title}</span>
                    </LinkButton>
                    <p className="mt-1 truncate text-xs text-muted">{item.career.category}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void unsave(item)}
                    aria-label={`Remove ${item.career.title} from saved careers`}
                    className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-danger-mist hover:text-danger"
                  >
                    <Bookmark className="h-4 w-4 fill-current" aria-hidden />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Next best step */}
        <section aria-labelledby="next-heading">
          <SectionHeading title="Next best step" className="mb-3" />
          <div className="grid gap-3 sm:grid-cols-3">
            <LinkButton
              href="/app/interests"
              variant="outline"
              size="md"
              className="h-auto flex-col items-start gap-2 p-5 text-left"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
                <Lightbulb className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-ink">
                <span className="block font-semibold">Discover your interests</span>
                <span className="mt-0.5 block text-xs text-muted">
                  A few friendly questions to guide suggestions.
                </span>
              </span>
            </LinkButton>
            <LinkButton
              href="/app/plans"
              variant="outline"
              size="md"
              className="h-auto flex-col items-start gap-2 p-5 text-left"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-mist text-teal">
                <GraduationCap className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-ink">
                <span className="block font-semibold">Build a study plan</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Turn a direction into small, doable steps.
                </span>
              </span>
            </LinkButton>
            <LinkButton
              href="/app/careers"
              variant="outline"
              size="md"
              className="h-auto flex-col items-start gap-2 p-5 text-left"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-mist text-amber-700">
                <Briefcase className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-ink">
                <span className="block font-semibold">Explore careers</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Browse every field and see what the work looks like.
                </span>
              </span>
            </LinkButton>
          </div>
        </section>
      </div>
    </Screen>
  );
}
