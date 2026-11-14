"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  EyeOff,
  HeartHandshake,
  Info,
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  MessageCircle,
  MessagesSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge, EvidenceBadge } from "@/components/ui/badge";
import {
  EmptyState,
  ErrorState,
  LoadingPanel,
  ProgressBar,
  SkeletonCard,
  Stat,
} from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import type {
  GuardianLink,
  ParentGuidance,
  ThemeKey,
} from "@/lib/types";
import { THEME_LABELS } from "@/lib/types";
import { classLabel, cn, relativeTime } from "@/lib/utils";

/** Both sinks of this text — the field's error line and the toast — look the
 * string up themselves, so the fallback here stays in the source language. */
function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong loading this part of the dashboard.";
}

const EXAMPLE_CONCERNS = [
  "My child wants science but we cannot afford coaching fees",
  "My child is not interested in studies right now",
];

/** Conversation metadata a parent may read. Message content and the greeting
 * are deliberately absent: this card describes that a conversation happened,
 * never what was said. */
const SESSION_STATUS_LABELS: Record<string, string> = {
  active: "In progress",
  ended: "Ended",
  cleared: "Transcript cleared",
};

const SESSION_LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  hinglish: "Hinglish",
};

/** Parent-side descriptions of each theme. They name the area the guide
 * noticed and make no claim about ability — and they are not the child's
 * words, which stay in the child's own account. */
const PARENT_THEME_DESCRIPTIONS: Record<ThemeKey, string> = {
  creative_exploration: "Making, imagining and designing things.",
  analytical_problem_solving: "Puzzles, logic and working things out step by step.",
  practical_building: "Building, fixing and assembling things by hand.",
  communication_collaboration: "Explaining ideas, performing and working with others.",
  helping_others: "Supporting, caring for and standing up for people.",
  physical_activity_sports: "Moving, playing and staying active.",
  nature_scientific_curiosity: "Asking how the natural world and science work.",
  organization_leadership: "Planning, organising and leading a group.",
};

export default function ParentDashboard() {
  const { status, user, isParent } = useSession();
  const { toast } = useToast();
  const t = useT();
  const tf = useTf();

  const enabled = status === "ready" && isParent;
  const loadChildren = useCallback(() => api.parentChildren(), []);
  const loadGuardians = useCallback(() => api.guardians(), []);
  const loadHealth = useCallback(() => api.health(), []);
  const childrenRes = useResource(loadChildren, enabled);
  const guardiansRes = useResource(loadGuardians, enabled);
  const health = useResource(loadHealth, enabled);
  const { reload: reloadChildren } = childrenRes;
  const { reload: reloadGuardians } = guardiansRes;

  const kids = useMemo(() => childrenRes.data ?? [], [childrenRes.data]);
  // A request is not a link: until the student approves it, no child appears in
  // `children` and no summary can be fetched. These rows are shown separately so the
  // parent knows the request exists without being shown the child's data.
  const pendingLinks = useMemo(
    () => (guardiansRes.data ?? []).filter((link) => link.status === "pending"),
    [guardiansRes.data],
  );
  // Clicking a child pins the choice; until then the first child is shown, so a
  // list that arrives (or reloads) needs no effect to agree with the selection.
  const [pickedId, setPickedId] = useState<number | null>(null);
  const selectedId = pickedId ?? kids[0]?.student_id ?? null;

  // The summary is tagged with the child it was fetched for. The hook keeps the previous
  // value on screen while a new request runs, so without the tag a switch would look like
  // the new child's data. The tag lets the page dim what it is showing and say what it is
  // waiting for instead of letting one child's cards pass as another's.
  const loadSummary = useCallback(() => {
    if (selectedId === null) return Promise.resolve(null);
    const requested = selectedId;
    return api.parentSummary(requested).then((data) => ({ childId: requested, data }));
  }, [selectedId]);
  const summary = useResource(loadSummary, selectedId !== null);
  const { reload: reloadSummary } = summary;

  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [concern, setConcern] = useState("");
  const [guidance, setGuidance] = useState<ParentGuidance | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<GuardianLink | null>(null);
  const [removing, setRemoving] = useState(false);
  // At most one report's details are open, keyed by both child and report so a
  // child switch can never leave the previous child's row expanded.
  const [expandedReport, setExpandedReport] = useState<{
    childId: number;
    reportId: number;
  } | null>(null);
  // At most one recommendation's details are open, and only for the child the summary
  // belongs to — so a child switch can never leave another child's row expanded.
  const [expandedRec, setExpandedRec] = useState<{ childId: number; careerId: number } | null>(
    null,
  );

  const selectedChild = useMemo(
    () => kids.find((row) => row.student_id === selectedId) ?? null,
    [kids, selectedId],
  );
  // The children endpoint carries a name and class but no link date. With one child and
  // one guardian row the pairing is unambiguous, so the date can be shown; with several,
  // there is no id to match a row against and guessing by name could show another
  // family member's date.
  const singleChildLink =
    kids.length === 1 && guardiansRes.data?.length === 1 ? guardiansRes.data[0] : null;

  const linkChild = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setLinkError("Enter the 6-character code your child reads out from their Settings screen.");
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      await api.linkChild(trimmed);
      setCode("");
      toast(
        "Request sent. Your child will see it in Settings → Family access and choose whether to approve.",
        "success",
      );
      reloadChildren();
      reloadGuardians();
    } catch (error) {
      // Show the server's wording verbatim — it is written to be kind and clear.
      setLinkError(messageFor(error));
    } finally {
      setLinking(false);
    }
  }, [code, reloadChildren, reloadGuardians, toast]);

  const askGuidance = useCallback(async () => {
    if (selectedId == null || concern.trim().length < 3) return;
    setGuidanceLoading(true);
    try {
      setGuidance(await api.parentGuidance(selectedId, concern.trim()));
    } catch (error) {
      setGuidance(null);
      toast(messageFor(error), "error");
    } finally {
      setGuidanceLoading(false);
    }
  }, [selectedId, concern, toast]);

  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.removeGuardian(removeTarget.guardianship_id);
      toast("Access removed. Your child can share a new code any time they choose.", "success");
      setRemoveTarget(null);
      reloadChildren();
      reloadGuardians();
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setRemoving(false);
    }
  }, [removeTarget, toast, reloadChildren, reloadGuardians]);

  // A family-typed display name is data; only the greeting around it is interface text.
  const displayName = user?.display_name?.trim();
  const greeting = displayName ? tf("Welcome, {name}", { name: displayName }) : t("Welcome");
  const sum = summary.data?.data ?? null;
  const sumChildId = summary.data?.childId ?? null;
  // The retained value belongs to the child it was fetched for, so while a new child's
  // summary is in flight the old cards are visibly marked as stale rather than replaced
  // by a spinner that throws away readable content.
  const isSwitching = sum !== null && sumChildId !== selectedId;

  const toggleRecommendation = (careerId: number) => {
    if (sumChildId === null) return;
    setExpandedRec((current) =>
      current && current.childId === sumChildId && current.careerId === careerId
        ? null
        : { childId: sumChildId, careerId },
    );
  };

  const toggleReport = (reportId: number) => {
    if (sumChildId === null) return;
    setExpandedReport((current) =>
      current && current.childId === sumChildId && current.reportId === reportId
        ? null
        : { childId: sumChildId, reportId },
    );
  };

  /* ---------------------------------------------------------- link onboarding */

  if (childrenRes.state === "error") {
    const forbidden = childrenRes.error && /role|parent|account|forbidden/i.test(childrenRes.error);
    return (
      <Screen
        title="Parent Dashboard"
        description="A calm summary of what your child has been exploring."
        badge={<Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>{t("For parents")}</Badge>}
      >
        <ErrorState
          title={forbidden ? "This dashboard is for parent accounts" : "Could not load your linked children"}
          description={
            forbidden
              ? "You appear to be signed in as a student, so this page is not for you. Everything here is also visible to you on your own screens — and your conversations stay private unless you choose to share them."
              : childrenRes.error ?? undefined
          }
          onRetry={reloadChildren}
          extra={
            <LinkButton href="/app" variant="outline" size="sm">
              {t("Go to my home")}
            </LinkButton>
          }
        />
      </Screen>
    );
  }

  if (childrenRes.state === "loading") {
    return (
      <Screen
        title={greeting}
        description="Loading your family dashboard…"
        badge={<Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>{t("Parent dashboard")}</Badge>}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </Screen>
    );
  }

  if (kids.length === 0) {
    return (
      <Screen
        title={greeting}
        description="Before you can see anything, your child links you themselves — nothing here works by guessing ids."
        badge={<Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>{t("Parent dashboard")}</Badge>}
      >
        <div className="space-y-5">
          {pendingLinks.length > 0 ? (
            <Card className="border-amber-300/60 bg-warning-mist/40">
              <CardHeader
                icon={<Clock className="h-4 w-4" aria-hidden />}
                title="Waiting for your child's approval"
                description="A request shares nothing until your child approves it in their own Settings. They can decline it, and they can withdraw later."
              />
              <ul className="mt-4 space-y-2">
                {pendingLinks.map((link) => (
                  <li
                    key={link.guardianship_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface/70 px-3.5 py-2.5"
                  >
                    <span className="text-sm font-medium text-ink">{link.name}</span>
                    <span className="text-xs text-muted">
                      {tf("Requested {time}", { time: relativeTime(link.linked_at) })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card className="bg-gradient-to-br from-brand-mist/60 via-surface to-teal-mist/40">
            <div className="max-w-xl">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-solid text-on-brand">
                <Link2 className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold tracking-tight text-ink">{t("Link your child")}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {t("Ask your child to open")}{" "}
                <strong className="font-medium text-ink">
                  {t("Settings")} → {t("Family access")}
                </strong>{" "}
                {t("on their device and read out the 6-character code on their screen. Type it below.")}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                <li className="flex gap-2">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                  {t("The code is generated by your child, and sharing is their choice.")}
                </li>
                <li className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                  {t("The code only lets you ask. Your child approves the request in their own Settings.")}
                </li>
                <li className="flex gap-2">
                  <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                  {t("You will see a summary of what they have been exploring — not their conversations.")}
                </li>
                <li className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                  {t("Either of you can end the link at any time — they can revoke it from their Settings.")}
                </li>
              </ul>
              <form
                className="mt-5 max-w-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void linkChild();
                }}
              >
                <Input
                  label="Sharing code from your child"
                  placeholder="e.g. K7M2QP"
                  value={code}
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  error={linkError ?? undefined}
                  hint="Capital letters and numbers only. Wrong or expired codes simply do not match — nothing is revealed."
                />
                <Button type="submit" className="mt-3" loading={linking}>
                  <Link2 className="h-4 w-4" aria-hidden />
                  {t("Link my child")}
                </Button>
              </form>
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={<Info className="h-4 w-4" aria-hidden />}
              title="Guidance is free for families"
              description="Every career, stream, exam, resource, scholarship and institute is free on every plan, and a payment never changes what a child is suggested. A paid plan adds conversation volume, repeat questionnaires, a printed report and this view — and until the operator switches plan limits on, all of them still work without paying."
            />
          </Card>
        </div>
      </Screen>
    );
  }

  /* ------------------------------------------------------------ main dashboard */

  const themes = sum?.themes ?? [];
  // Recommendations are derived from what a child *might* like, not from what they have
  // done, so they cannot count as exploration. A child who has not touched anything yet
  // gets the just-started state even when generic directions are on offer.
  const hasExplored = !!sum && (themes.length > 0 || sum.saved_careers.length > 0);

  return (
    <Screen
      title={greeting}
      description={
        // A node, not a string: `Screen` translates plain strings again, which would
        // look up the sentence after the name had already been filled in.
        <>
          {tf(
            "A calm look at what {name} is exploring, and simple ways to support their learning journey.",
            { name: selectedChild?.label ?? t("your child") },
          )}
        </>
      }
      badge={<Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>{t("Parent dashboard")}</Badge>}
      titleClassName="font-serif text-[1.9rem] font-semibold leading-[1.12] tracking-tight text-heading sm:text-[2.35rem]"
    >
      <div className="space-y-6">
        {/* Child identity and switching. A single child still gets a row, because a class
            that only appears inside a selector otherwise disappears for one-child families. */}
        <Card className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Viewing")}</p>
          {kids.length > 1 ? (
            <div className="cg-scrollbar flex gap-2 overflow-x-auto pb-1">
              {kids.map((kid) => {
                const active = kid.student_id === selectedId;
                return (
                  <button
                    key={kid.student_id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPickedId(kid.student_id)}
                    className={
                      active
                        ? "flex shrink-0 items-center gap-1.5 rounded-full border border-brand bg-brand-solid px-3.5 py-1.5 text-sm font-medium text-on-brand"
                        : "flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-muted hover:border-brand-light hover:text-ink"
                    }
                  >
                    {kid.label}
                    {kid.class_level ? (
                      <span className={active ? "text-white/70" : "text-muted/70"}>
                        {classLabel(kid.class_level)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : selectedChild ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-sm font-semibold text-ink">{selectedChild.label}</span>
              {selectedChild.class_level ? (
                <Badge tone="neutral">{classLabel(selectedChild.class_level)}</Badge>
              ) : null}
              {singleChildLink ? (
                <span className="text-xs text-muted">
                  {tf("Linked {time}", { time: relativeTime(singleChildLink.linked_at) })}
                </span>
              ) : null}
            </div>
          ) : null}
        </Card>

        {/* Summary block */}
        {summary.state === "error" ? (
          <ErrorState
            title="The summary could not load"
            description={summary.error ?? undefined}
            onRetry={reloadSummary}
          />
        ) : sum ? (
          <div className="space-y-6" aria-busy={isSwitching || undefined}>
            {isSwitching ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-2.5 rounded-xl border border-brand/30 bg-brand-mist/40 px-3.5 py-2.5 text-sm leading-relaxed text-ink"
              >
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand" aria-hidden />
                {tf(
                  "Loading {name}'s summary… The faded cards below are from the child you were just viewing.",
                  { name: selectedChild?.label ?? t("your child") },
                )}
              </div>
            ) : null}
            {/* Previous content stays readable while the switch is in flight, but it is
                inert and visibly faded so it cannot be taken for the newly picked child. */}
            <div
              inert={isSwitching || undefined}
              className={cn(
                "space-y-6 transition-opacity duration-200",
                isSwitching && "pointer-events-none select-none opacity-40",
              )}
            >
            <Card className="border-teal/30 bg-teal-mist/40">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-teal">
                  <HeartHandshake className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-sm leading-relaxed text-ink">{sum.guidance_note}</p>
              </div>
            </Card>

            {/* Privacy status — rendered honestly, never a "view chat" affordance. */}
            <Card className="p-4 sm:p-6">
              <CardHeader
                icon={<Lock className="h-4 w-4" aria-hidden />}
                title="Your child's privacy"
                description={
                  sum.share_transcripts
                    ? "Your child has chosen to share their conversation text with you. It is their generosity, not your right — they can turn it off at any time."
                    : "Your child's conversation text stays private to them. You see themes, saved careers and progress — not what they typed or said."
                }
                action={
                  <Badge
                    tone={sum.share_transcripts ? "warning" : "success"}
                    icon={
                      sum.share_transcripts ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      )
                    }
                  >
                    {sum.share_transcripts ? t("Conversation text shared") : t("Conversation text private")}
                  </Badge>
                }
              />
            </Card>

            {/* What they're exploring */}
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">
                {t("What they have been exploring")}
              </h2>
              {!hasExplored ? (
                <EmptyState
                  icon={Compass}
                  title="Not much explored yet"
                  description={tf(
                    "{name} has just started. A friendly nudge to try one conversation with the guide is enough — pressure tends to close these conversations down.",
                    { name: sum.student.display_name },
                  )}
                  action={
                    <LinkButton href="/app/settings" size="sm" variant="outline">
                      {t("Read the family access notes")}
                    </LinkButton>
                  }
                />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {themes.length > 0 ? (
                    <Card>
                      <CardHeader
                        icon={<Lightbulb className="h-4 w-4" aria-hidden />}
                        title="Themes their conversations keep touching"
                        description="Themes from what your child chose to talk about — a starting point for conversation, not a conclusion."
                      />
                      <ul className="mt-4 space-y-3">
                        {themes.map((item) => (
                          <li key={item.theme} className="rounded-xl bg-canvas p-3.5">
                            <p className="text-sm font-semibold text-ink">
                              {THEME_LABELS[item.theme] ? t(THEME_LABELS[item.theme]) : item.label}
                            </p>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted">
                              {t(PARENT_THEME_DESCRIPTIONS[item.theme])}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ) : null}

                  {sum.recommendations.length > 0 ? (
                    <Card>
                      <CardHeader
                        icon={<Sparkles className="h-4 w-4" aria-hidden />}
                        title="Directions worth a family conversation"
                        description="Starting points based on exploration so far — never a verdict on who suits what."
                      />
                      <ul className="mt-4 space-y-3">
                        {sum.recommendations.map((rec) => {
                          const detailId = `rec-details-${rec.career.id}`;
                          const open =
                            expandedRec?.childId === sumChildId &&
                            expandedRec.careerId === rec.career.id;
                          const hasDetails =
                            !!rec.next_activity ||
                            rec.open_questions.length > 0 ||
                            rec.skills_to_try.length > 0;
                          return (
                            <li key={rec.career.id} className="rounded-xl border border-line p-3.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <Link
                                  href={`/careers/${rec.career.slug}`}
                                  className="rounded text-sm font-semibold text-ink underline-offset-4 hover:text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                                >
                                  {rec.career.title}
                                </Link>
                                <EvidenceBadge level={rec.evidence_level} />
                              </div>
                              <p className="mt-1.5 text-sm leading-relaxed text-muted">{rec.why}</p>
                              {/* Only a recommendation that actually carries something to open
                                  gets a control; an empty panel would be invented content. */}
                              {hasDetails ? (
                                <>
                                  <button
                                    type="button"
                                    aria-expanded={open}
                                    aria-controls={detailId}
                                    onClick={() => toggleRecommendation(rec.career.id)}
                                    className="mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                                  >
                                    {open ? t("Show less") : t("More details")}
                                    <ChevronDown
                                      className={cn(
                                        "h-3.5 w-3.5 transition-transform",
                                        open && "rotate-180",
                                      )}
                                      aria-hidden
                                    />
                                  </button>
                                  <div id={detailId} hidden={!open} className="mt-2.5 space-y-2.5">
                                    {rec.next_activity ? (
                                      <GuidanceSection
                                        title="What to try next"
                                        body={rec.next_activity}
                                      />
                                    ) : null}
                                    {rec.open_questions.length > 0 ? (
                                      <GuidanceList
                                        title="Questions worth asking"
                                        items={rec.open_questions}
                                      />
                                    ) : null}
                                    {rec.skills_to_try.length > 0 ? (
                                      <GuidanceList title="Skills to try" items={rec.skills_to_try} />
                                    ) : null}
                                  </div>
                                </>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  ) : null}

                  {sum.saved_careers.length > 0 ? (
                    // A truncated title is nowrap, and a grid item's automatic minimum size
                    // would otherwise widen the whole phone column to fit it.
                    <Card className="min-w-0">
                      <CardHeader
                        icon={<Bookmark className="h-4 w-4" aria-hidden />}
                        title="Careers they saved themselves"
                        description="These are their own choices to discuss with you — not approvals that need your sign-off."
                      />
                      <ul className="mt-4 space-y-2">
                        {sum.saved_careers.map((item) => (
                          <li key={item.career.id}>
                            <Link
                              href={`/careers/${item.career.slug}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3.5 py-2.5 transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-ink">
                                  {item.career.title}
                                </p>
                                <p className="truncate text-xs text-muted">
                                  {item.career.category} ·{" "}
                                  {tf("saved {time}", { time: relativeTime(item.saved_at) })}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ) : null}

                  {/* Journey counts */}
                  <Card>
                    <CardHeader
                      icon={<Compass className="h-4 w-4" aria-hidden />}
                      title="Their journey so far"
                      description="This counts exploration, not marks. There are no scores, rankings or predictions anywhere on this dashboard."
                    />
                    {/* Two tiles per row on a phone leaves the labels room; the third
                        takes the full width instead of squeezing into a third column. */}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                      <Stat label="Sessions" value={sum.journey.sessions_completed} tone="brand" />
                      <Stat label="Careers saved" value={sum.journey.careers_saved} tone="teal" />
                      <div className="col-span-2 sm:col-span-1">
                        <Stat label="Themes explored" value={sum.journey.themes_explored} tone="success" />
                      </div>
                    </div>
                    <ProgressBar
                      className="mt-4"
                      label="Explore activities completed"
                      value={sum.journey.activities_completed}
                      total={sum.journey.activities_total || 1}
                      tone="teal"
                    />
                    <p className="mt-2 text-xs text-muted">
                      {sum.journey.activities_total === 0
                        ? t("No activities started yet — that is completely fine at the beginning.")
                        : tf(
                            "{done} of {total} small exploration activities done. Stopping and starting is normal.",
                            {
                              done: sum.journey.activities_completed,
                              total: sum.journey.activities_total,
                            },
                          )}
                    </p>
                  </Card>
                </div>
              )}
            </section>

            {/* Reports: a short, parent-safe history. The stored report itself stays
                in the child's account; this only lists the note and career names. */}
            <Card>
              <CardHeader
                icon={<MessagesSquare className="h-4 w-4" aria-hidden />}
                title="Recent career reports"
                description="Short snapshots your child chose to generate. They describe interests, not a destiny — and each full report stays in your child's account."
              />
              {sum.recent_reports.length === 0 ? (
                <EmptyState
                  icon={MessagesSquare}
                  className="mt-4 py-8"
                  title="No career report yet"
                  description="Reports are made from your child's own Reports screen once they have explored a little. Nothing is created automatically."
                />
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {sum.recent_reports.map((report) => {
                    const isLatest = sum.latest_report?.id === report.id;
                    // The server sends only the parent-safe half of the newest report:
                    // note, directions with a quote-free why, and its canned next steps.
                    const latestReport = isLatest ? sum.latest_report : null;
                    const directions = latestReport?.career_directions ?? [];
                    const detailId = `report-details-${report.id}`;
                    const open =
                      expandedReport?.childId === sumChildId &&
                      expandedReport.reportId === report.id;
                    const hasDetails =
                      directions.length > 0 ||
                      (latestReport?.next_steps.length ?? 0) > 0 ||
                      report.career_titles.length > 0;
                    return (
                      <li key={report.id} className="min-w-0 rounded-xl border border-line p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 text-sm font-medium text-ink">
                            {tf("Generated {time}", {
                              time: relativeTime(report.generated_at),
                            })}
                          </p>
                          {isLatest ? <Badge tone="brand">{t("Newest")}</Badge> : null}
                        </div>
                        {report.note ? (
                          <p className="mt-1.5 break-words text-sm leading-relaxed text-muted">
                            {report.note}
                          </p>
                        ) : null}
                        {hasDetails ? (
                          <>
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-controls={detailId}
                              onClick={() => toggleReport(report.id)}
                              className="mt-2 inline-flex items-center gap-1 rounded text-xs font-semibold text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                            >
                              {open ? t("Hide the summary") : t("See a short summary")}
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform",
                                  open && "rotate-180",
                                )}
                                aria-hidden
                              />
                            </button>
                            <div id={detailId} hidden={!open} className="mt-2.5 space-y-2.5">
                              {directions.length > 0 ? (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                                    {t("Directions the report mentions")}
                                  </p>
                                  <ul className="mt-1 space-y-1.5">
                                    {directions.map((item) => (
                                      <li
                                        key={item.career_id ?? item.career}
                                        className="break-words text-sm leading-relaxed text-muted"
                                      >
                                        <span className="font-medium text-ink">
                                          {item.career}
                                        </span>{" "}
                                        — {item.why}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : report.career_titles.length > 0 ? (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                                    {t("Directions the report mentions")}
                                  </p>
                                  <ul className="mt-1 space-y-1">
                                    {report.career_titles.map((title) => (
                                      <li
                                        key={title}
                                        className="break-words text-sm leading-relaxed text-muted"
                                      >
                                        {title}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {latestReport && latestReport.next_steps.length > 0 ? (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                                    {t("Gentle next steps it suggests")}
                                  </p>
                                  <ul className="mt-1 space-y-1">
                                    {latestReport.next_steps.map((step) => (
                                      <li
                                        key={step}
                                        className="flex gap-2 break-words text-sm leading-relaxed text-ink"
                                      >
                                        <span
                                          className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal"
                                          aria-hidden
                                        />
                                        {step}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">
                {t("Only your child can open the full report, from their own Reports screen.")}
              </p>
            </Card>

            {/* Plans: progress a parent may read, never the child's goal, step detail
                or resource links. A plan is the child's own list, so there is nothing
                here to edit or approve. */}
            <Card>
              <CardHeader
                icon={<ListChecks className="h-4 w-4" aria-hidden />}
                title="Plans they are working through"
                description="Small steps your child chose for themselves. A plan is their curiosity, not an assignment — you can see how it is going without grading it."
              />
              {sum.study_plans.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  className="mt-4 py-8"
                  title="No plans yet"
                  description="Plans are made by your child, from their own Plans screen. Nothing is assigned to them."
                />
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {sum.study_plans.map((plan) => {
                    const complete =
                      plan.total_items > 0 && plan.completed_items === plan.total_items;
                    const statusLabel = complete
                      ? "Plan completed"
                      : plan.status === "active"
                        ? "Active"
                        : plan.status;
                    return (
                      <li key={plan.id} className="min-w-0 rounded-xl border border-line p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 break-words text-sm font-medium text-ink">
                            {plan.title}
                          </p>
                          <Badge tone={complete ? "success" : "neutral"}>{t(statusLabel)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {tf("Started {time}", { time: relativeTime(plan.created_at) })}
                        </p>
                        <ProgressBar
                          className="mt-3"
                          value={plan.completed_items}
                          total={plan.total_items}
                          label={tf(
                            plan.total_items === 1
                              ? "{done} of {total} step done"
                              : "{done} of {total} steps done",
                            { done: plan.completed_items, total: plan.total_items },
                          )}
                          tone={complete ? "success" : "teal"}
                        />
                        {plan.total_items === 0 ? (
                          <p className="mt-1.5 text-xs text-muted">
                            {t("No steps added yet — that is completely fine at the beginning.")}
                          </p>
                        ) : complete ? (
                          <p className="mt-1.5 text-xs text-muted">
                            {t("Every step in this plan is finished.")}
                          </p>
                        ) : plan.next_item_title ? (
                          <p className="mt-1.5 break-words text-xs text-muted">
                            {tf("Next step: {title}", { title: plan.next_item_title })}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">
                {t(
                  "Plans belong to your child. They decide what goes in them and how fast to move — you can read progress here, not change it.",
                )}
              </p>
            </Card>

            {/* Conversations: activity metadata only — when, what kind, in which
                language, and how it ended. No message text, no transcript control,
                and nothing here reads or changes the child's sharing preference. */}
            <Card>
              <CardHeader
                icon={<MessageCircle className="h-4 w-4" aria-hidden />}
                title="Recent AI Conversations"
                description="When your child talks to the guide, the date and type of each conversation appear here. What they said is not shown."
              />
              {sum.recent_sessions.length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  className="mt-4 py-8"
                  title="No conversations yet"
                  description="When your child starts a conversation with the guide, its date and type will appear here. Nothing they say is shown."
                />
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {sum.recent_sessions.slice(0, 5).map((session) => {
                    const started = relativeTime(session.created_at);
                    const language =
                      SESSION_LANGUAGE_LABELS[session.language] ?? session.language;
                    const meta = [
                      started ? tf("Started {time}", { time: started }) : null,
                      language ? t(language) : null,
                    ].filter(Boolean);
                    const statusLabel =
                      SESSION_STATUS_LABELS[session.status] ?? session.status;
                    return (
                      <li
                        key={session.id}
                        className="min-w-0 rounded-xl border border-line p-3.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 break-words text-sm font-medium text-ink">
                            {t(
                              session.kind === "voice"
                                ? "Voice conversation"
                                : "Text conversation",
                            )}
                          </p>
                          <Badge tone={session.status === "active" ? "brand" : "neutral"}>
                            {t(statusLabel)}
                          </Badge>
                        </div>
                        {meta.length > 0 ? (
                          <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">
                {t(
                  "This list shows when a conversation happened and how it ended — never what your child typed or said.",
                )}
              </p>
            </Card>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Concern panel */}
        <Card>
          <CardHeader
            icon={<HeartHandshake className="h-4 w-4" aria-hidden />}
            title="I have a concern about…"
            description="Describe the family situation in your own words. You will get a structured, honest answer — what the exploration supports, what remains unclear, and low-risk next steps to discuss."
          />
          <div className="mt-4 space-y-3">
            <div className="cg-scrollbar flex gap-2 overflow-x-auto pb-1">
              {EXAMPLE_CONCERNS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    // The chip's own words go into the box, so a Hindi parent types what they read.
                    setConcern(t(example));
                    setGuidance(null);
                  }}
                  className="shrink-0 rounded-full border border-line bg-canvas px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-brand-light hover:text-ink"
                >
                  {t(example)}
                </button>
              ))}
            </div>
            <Textarea
              label="Your concern"
              placeholder="For example: my child enjoys fixing things but says science is only for toppers…"
              value={concern}
              onChange={(event) => setConcern(event.target.value)}
              hint="Nothing you type here is shared with your child, and it does not change what they see."
            />
            <Button
              onClick={() => void askGuidance()}
              loading={guidanceLoading}
              disabled={selectedId == null || concern.trim().length < 3}
            >
              <Send className="h-4 w-4" aria-hidden />
              {t("Get a considered answer")}
            </Button>
            {guidanceLoading ? <LoadingPanel label="Thinking carefully about your concern…" /> : null}

            {guidance && !guidanceLoading ? (
              <div className="space-y-3 rounded-2xl bg-canvas p-4 sm:p-5">
                <p className="text-sm font-semibold text-ink">{guidance.concern}</p>
                <GuidanceSection title="What we hear you saying" body={guidance.acknowledgement} />
                <GuidanceSection title="What the exploration so far shows" body={guidance.evidence} />
                {guidance.what_remains_unclear.length > 0 ? (
                  <GuidanceList title="What remains unclear" items={guidance.what_remains_unclear} />
                ) : null}
                <GuidanceSection title="Routes and costs to check" body={guidance.routes_and_costs} />
                {guidance.alternatives.length > 0 ? (
                  <GuidanceList title="Alternatives worth knowing" items={guidance.alternatives} />
                ) : null}
                {guidance.low_risk_tests.length > 0 ? (
                  <GuidanceList title="Low-risk things to try together" items={guidance.low_risk_tests} />
                ) : null}
                <div className="rounded-xl border border-teal/30 bg-teal-mist/50 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                    {t("A sentence you could actually use")}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">“{guidance.discussion_prompt}”</p>
                  <p className="mt-1.5 text-xs text-muted">
                    {t("Their own words matter more than any answer on this screen.")}
                  </p>
                </div>
                <GuidanceSection title="Where else to seek help" body={guidance.seek_help_from} />
              </div>
            ) : null}
          </div>
        </Card>

        {/* Linked profiles / manage access */}
        <Card>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-subtle text-subtle-ink">
                  <Users className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-tight text-heading">
                    {t("Linked profiles and access")}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {t(
                      "Every link started because a child shared a code. Removing a link only ends your access — it never deletes their account.",
                    )}
                  </p>
                </div>
              </div>
              <ChevronDown
                className="mt-2 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="mt-4">
              {guardiansRes.state === "loading" ? (
                <LoadingPanel label="Loading linked profiles…" />
              ) : guardiansRes.state === "error" ? (
                <ErrorState description={guardiansRes.error ?? undefined} onRetry={reloadGuardians} />
              ) : (guardiansRes.data ?? []).length === 0 ? (
                <EmptyState
                  icon={Link2}
                  title="No links on this account"
                  description="Link your child above with the code they read out from their Settings screen."
                />
              ) : (
                <ul className="space-y-2.5">
                  {(guardiansRes.data ?? []).map((link) => (
                    <li
                      key={link.guardianship_id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {link.name}
                          {link.relationship ? (
                            <span className="ml-2 text-xs font-normal text-muted">{link.relationship}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {link.status === "pending"
                            ? tf("Requested {time}", { time: relativeTime(link.linked_at) })
                            : link.status === "revoked"
                              ? tf("Access ended {time}", {
                                  time: relativeTime(link.withdrawn_at ?? link.linked_at),
                                })
                              : tf("Linked {time}", { time: relativeTime(link.linked_at) })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            link.status === "active"
                              ? "brand"
                              : link.status === "pending"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {link.status === "active"
                            ? t("Sees summary")
                            : link.status === "pending"
                              ? t("Waiting for approval")
                              : t("Access ended")}
                        </Badge>
                        {link.status === "active" ? (
                          <Badge tone={link.can_see_transcripts ? "warning" : "success"}>
                            {link.can_see_transcripts
                              ? t("Sees conversation text")
                              : t("Conversation text private")}
                          </Badge>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRemoveTarget(link)}
                        >
                          {t("Remove access")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </Card>

        {/* How to talk about this */}
        <Card>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-subtle text-subtle-ink">
                  <HeartHandshake className="h-4 w-4" aria-hidden />
                </span>
                <h2 className="text-base font-semibold leading-tight text-heading">
                  {t("How to talk about this")}
                </h2>
              </div>
              <ChevronDown
                className="mt-2 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                {t("Curiosity works better than pressure: ask what they enjoyed about an activity, not what they achieved.")}
              </li>
              <li className="flex gap-2">
                <Compass className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                {t("Career interests change — most people's have, several times. Nothing on this screen is a decision being made today.")}
              </li>
              <li className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                {t("Almost every expensive route has a lower-cost alternative (government colleges, polytechnics, scholarships). Cost alone never rules a dream out.")}
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                {t("This app never charges families, and its guidance is not influenced by paid institutions or coaching services.")}
              </li>
            </ul>
            {health.state === "ready" && health.data?.demo_mode ? (
              <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-warning-mist/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
                {t("Heads-up: the AI guide is running in demo mode — its answers come from a built-in scripted guide until an AI key is configured on the server. The exploration data shown here is real.")}
              </p>
            ) : null}
          </details>
        </Card>
      </div>

      {/* Remove-access confirmation */}
      <Modal
        open={removeTarget !== null}
        onClose={() => !removing && setRemoveTarget(null)}
        title="Remove this link?"
        description={
          removeTarget
            ? tf("{name} will no longer appear on your dashboard.", { name: removeTarget.name })
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              {t("Keep the link")}
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()} loading={removing}>
              {t("Remove access")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {tf(
            "Removing access is quiet and reversible in one direction only: {name} would need to share a new code with you if they ever wanted you to see their summary again. That choice stays entirely theirs.",
            { name: removeTarget?.name ?? t("your child") },
          )}
        </p>
      </Modal>
    </Screen>
  );
}

function GuidanceSection({ title, body }: { title: string; body: string }) {
  const t = useT();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">{t(title)}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{body}</p>
    </div>
  );
}

function GuidanceList({ title, items }: { title: string; items: string[] }) {
  const t = useT();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">{t(title)}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
