"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  CircleDot,
  Compass,
  GraduationCap,
  Lightbulb,
  Mic,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import {
  EmptyState,
  ErrorState,
  LoadingPanel,
  ProgressBar,
  SkeletonCard,
  Stat,
} from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { JourneyEvent } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

/** How each known event kind reads and looks; unknown kinds get a neutral dot. */
const KIND_META: Record<string, { label: string; icon: LucideIcon; tint: string }> = {
  session_completed: { label: "Conversation", icon: Mic, tint: "bg-brand-mist text-brand-dark" },
  interest_noted: { label: "Interest noted", icon: Lightbulb, tint: "bg-teal-mist text-teal" },
  interest_activity: { label: "Interest question", icon: Sparkles, tint: "bg-teal-mist text-teal" },
  career_saved: { label: "Saved career", icon: Bookmark, tint: "bg-warning-mist text-amber-700" },
  plan_created: { label: "New plan", icon: GraduationCap, tint: "bg-brand-mist text-brand-dark" },
  activity_completed: {
    label: "Plan step done",
    icon: CheckCircle2,
    tint: "bg-success-mist text-success",
  },
  safety_note: { label: "Safety note", icon: ShieldCheck, tint: "bg-danger-mist text-danger" },
};

function kindLabel(kind: string) {
  const known = KIND_META[kind];
  if (known) return known.label;
  const words = kind.replace(/_/g, " ").trim();
  return words.length > 0 ? words.charAt(0).toUpperCase() + words.slice(1) : "Activity";
}

function dayKey(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toDateString();
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sometime";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export default function JourneyPage() {
  const loadJourney = useCallback(() => api.journey(), []);
  const loadEvents = useCallback(() => api.journeyEvents(60), []);
  const {
    state: journeyState,
    data: journey,
    error: journeyError,
    reload: reloadJourney,
  } = useResource(loadJourney);
  const {
    state: eventsState,
    data: events,
    error: eventsError,
    reload: reloadEvents,
  } = useResource(loadEvents);

  const [kindFilter, setKindFilter] = useState("all");

  const visibleEvents = useMemo(() => events ?? [], [events]);
  const tabs = useMemo(() => {
    if (!events) return [];
    const counts = new Map<string, number>();
    for (const event of events) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    return [
      { value: "all", label: "All", count: events.length },
      ...[...counts.entries()].map(([kind, count]) => ({
        value: kind,
        label: kindLabel(kind),
        count,
      })),
    ];
  }, [events]);

  const filtered = useMemo(
    () => (kindFilter === "all" ? visibleEvents : visibleEvents.filter((e) => e.kind === kindFilter)),
    [visibleEvents, kindFilter],
  );

  // Group by day, keeping the newest-first order the API returns.
  const days = useMemo(() => {
    const groups: { key: string; label: string; events: JourneyEvent[] }[] = [];
    for (const event of filtered) {
      const key = dayKey(event.created_at);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.events.push(event);
      else groups.push({ key, label: dayLabel(event.created_at), events: [event] });
    }
    return groups;
  }, [filtered]);

  return (
    <Screen
      title="My Journey"
      description="A record of everything you've explored so far — chats, questions, careers you saved, plans you started. It is a story, not a score."
      badge={
        <Badge tone="teal" icon={<Compass className="h-3.5 w-3.5" aria-hidden />}>
          Exploration, not ranking
        </Badge>
      }
    >
      <div className="space-y-6">
        {/* ------------------------------------------------------ Stats header */}
        <Card>
          <CardHeader
            icon={<Compass className="h-4 w-4" aria-hidden />}
            title="How much you've explored"
            description="These numbers count exploration only — not achievement, not ability, and not how good you are at anything."
          />
          <div className="mt-4">
            {journeyState === "loading" ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : journeyState === "error" ? (
              <ErrorState
                title="We couldn't load your journey stats"
                description={journeyError}
                onRetry={reloadJourney}
              />
            ) : journey ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat
                    label="Chats finished"
                    value={journey.sessions_completed}
                    hint="Conversations you completed"
                  />
                  <Stat
                    label="Careers saved"
                    value={journey.careers_saved}
                    hint="Profiles you bookmarked"
                    tone="teal"
                  />
                  <Stat
                    label="Themes explored"
                    value={journey.themes_explored}
                    hint="Interest areas noticed"
                  />
                  <Stat
                    label="Plans going"
                    value={journey.plans_active}
                    hint="Study plans you set yourself"
                    tone="teal"
                  />
                </div>
                <ProgressBar
                  value={journey.activities_completed}
                  total={journey.activities_total}
                  label={`Plan steps you chose to do: ${journey.activities_completed} of ${journey.activities_total}`}
                  tone="teal"
                />
                <p className="text-xs leading-relaxed text-muted">
                  Every number here just counts things you explored. Nobody is ranked by it, and
                  taking a break never erases anything.
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        {/* --------------------------------------------------------- Timeline */}
        <Card>
          <CardHeader
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
            title="Your timeline"
            description="The most recent things you did, grouped by day."
            action={
              eventsState === "ready" ? (
                <button
                  type="button"
                  onClick={reloadEvents}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand-light hover:text-ink"
                >
                  Refresh
                </button>
              ) : undefined
            }
          />

          <div className="mt-4">
            {eventsState === "loading" ? (
              <LoadingPanel label="Loading your timeline…" />
            ) : eventsState === "error" ? (
              <ErrorState
                title="We couldn't load your timeline"
                description={eventsError}
                onRetry={reloadEvents}
              />
            ) : visibleEvents.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="Your journey starts with one small step"
                description="Nothing here yet — that just means you haven't explored much so far, and that's completely fine. Talk to the AI guide or browse a few careers and they'll appear here."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <LinkButton href="/app/call" size="sm">
                      Start a conversation
                    </LinkButton>
                    <LinkButton href="/app/careers" size="sm" variant="outline">
                      Browse careers
                    </LinkButton>
                  </div>
                }
              />
            ) : (
              <>
                {tabs.length > 1 ? (
                  <Tabs items={tabs} value={kindFilter} onChange={setKindFilter} />
                ) : null}

                {filtered.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      title="Nothing of this type yet"
                      description="Try another filter, or go explore something new."
                      action={
                        <button
                          type="button"
                          onClick={() => setKindFilter("all")}
                          className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-brand-light hover:text-ink"
                        >
                          Show everything
                        </button>
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-5 space-y-6">
                    {days.map((day) => (
                      <section key={day.key} aria-label={day.label}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                          {day.label}
                        </p>
                        <ol className="relative space-y-4 border-l-2 border-line pl-5">
                          {day.events.map((event) => {
                            const meta = KIND_META[event.kind];
                            const Icon = meta?.icon ?? CircleDot;
                            return (
                              <li key={event.id} className="relative">
                                <span
                                  className={cn(
                                    "absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-surface",
                                    meta?.tint ?? "bg-slate-100 text-slate-500",
                                  )}
                                  aria-hidden
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <div className="rounded-2xl border border-line bg-canvas/50 px-4 py-3">
                                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <p className="text-sm font-medium leading-snug text-ink">
                                      {event.title}
                                    </p>
                                    <span className="shrink-0 text-xs text-muted">
                                      {relativeTime(event.created_at)}
                                    </span>
                                  </div>
                                  {event.detail ? (
                                    <p className="mt-1 text-sm leading-relaxed text-muted">
                                      {event.detail}
                                    </p>
                                  ) : null}
                                  {!meta ? (
                                    <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted/70">
                                      {kindLabel(event.kind)}
                                    </p>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </section>
                    ))}
                    <p className="text-xs leading-relaxed text-muted">
                      This timeline is only a record of what you explored. It is private to you, it
                      never grades anything, and skipping days changes nothing.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </Screen>
  );
}
