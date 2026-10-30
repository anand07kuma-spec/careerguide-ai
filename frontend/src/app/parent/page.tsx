"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bookmark,
  Compass,
  EyeOff,
  HeartHandshake,
  Info,
  Lightbulb,
  Link2,
  Lock,
  MessagesSquare,
  Quote,
  Send,
  Settings,
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
  Observation,
  ParentGuidance,
  ThemeKey,
} from "@/lib/types";
import { THEME_LABELS } from "@/lib/types";
import { classLabel, relativeTime } from "@/lib/utils";

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

/** Group the child's theme observations so each theme shows its evidence once. */
function groupObservations(observations: Observation[]) {
  const map = new Map<ThemeKey, string[]>();
  for (const item of observations) {
    const quotes = map.get(item.theme) ?? [];
    if (item.evidence && !quotes.includes(item.evidence)) quotes.push(item.evidence);
    map.set(item.theme, quotes);
  }
  return Array.from(map.entries());
}

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
  // Clicking a child pins the choice; until then the first child is shown, so a
  // list that arrives (or reloads) needs no effect to agree with the selection.
  const [pickedId, setPickedId] = useState<number | null>(null);
  const selectedId = pickedId ?? kids[0]?.student_id ?? null;

  const loadSummary = useCallback(
    () => (selectedId === null ? Promise.resolve(null) : api.parentSummary(selectedId)),
    [selectedId],
  );
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
  const [reportOpen, setReportOpen] = useState(false);

  const selectedChild = useMemo(
    () => kids.find((row) => row.student_id === selectedId) ?? null,
    [kids, selectedId],
  );

  const linkChild = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setLinkError("Enter the 6-character code your child reads out from their Settings screen.");
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      await api.linkChild(trimmed);
      setCode("");
      toast("Your child is now linked. You can see their exploration summary.", "success");
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
  const sum = summary.data;

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
          <Card className="bg-gradient-to-br from-brand-mist/60 via-surface to-teal-mist/40">
            <div className="max-w-xl">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white">
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

  const themes = sum ? groupObservations(sum.themes) : [];
  const hasExplored =
    !!sum && (themes.length > 0 || sum.recommendations.length > 0 || sum.saved_careers.length > 0);

  return (
    <Screen
      title={tf("What {name} has been exploring", {
        name: selectedChild?.label ?? t("your child"),
      })}
      description="A summary, not surveillance: themes, saved careers and progress — never a report card."
      badge={<Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>{t("Parent dashboard")}</Badge>}
      action={
        <LinkButton href="/app/settings" variant="outline" size="sm">
          <Settings className="h-4 w-4" aria-hidden />
          {t("Settings")}
        </LinkButton>
      }
    >
      <div className="space-y-6">
        {/* Child selector */}
        {kids.length > 1 ? (
          <Card className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Viewing")}</p>
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
                        ? "flex shrink-0 items-center gap-1.5 rounded-full border border-brand bg-brand px-3.5 py-1.5 text-sm font-medium text-white"
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
          </Card>
        ) : null}

        {/* Summary block */}
        {summary.state === "loading" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : summary.state === "error" ? (
          <ErrorState
            title="The summary could not load"
            description={summary.error ?? undefined}
            onRetry={reloadSummary}
          />
        ) : sum ? (
          <>
            <Card className="border-teal/30 bg-teal-mist/40">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-teal">
                  <HeartHandshake className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-sm leading-relaxed text-ink">{sum.guidance_note}</p>
              </div>
            </Card>

            {/* Privacy status — rendered honestly, never a "view chat" affordance. */}
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardHeader
                    icon={<Lock className="h-4 w-4" aria-hidden />}
                    title="Your child's privacy"
                    description={
                      sum.share_transcripts
                        ? "Your child has chosen to share their conversation text with you. It is their generosity, not your right — they can turn it off at any time."
                        : "Your child's conversation text stays private to them. You see themes, saved careers and progress — not what they typed or said."
                    }
                  />
                </div>
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
              </div>
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
                        description="Short quotes are what the guide noticed — signals to talk about, not conclusions."
                      />
                      <ul className="mt-4 space-y-3">
                        {themes.map(([theme, quotes]) => (
                          <li key={theme} className="rounded-xl bg-canvas p-3.5">
                            <p className="text-sm font-semibold text-ink">
                              {THEME_LABELS[theme] ? t(THEME_LABELS[theme]) : theme}
                            </p>
                            {quotes.slice(0, 3).map((quote) => (
                              <p
                                key={quote}
                                className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-muted"
                              >
                                <Quote className="mt-1 h-3 w-3 shrink-0 text-brand-light" aria-hidden />
                                {quote}
                              </p>
                            ))}
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
                        {sum.recommendations.map((rec) => (
                          <li key={rec.career.id} className="rounded-xl border border-line p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-ink">{rec.career.title}</p>
                              <EvidenceBadge level={rec.evidence_level} />
                            </div>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted">{rec.why}</p>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ) : null}

                  {sum.saved_careers.length > 0 ? (
                    <Card>
                      <CardHeader
                        icon={<Bookmark className="h-4 w-4" aria-hidden />}
                        title="Careers they saved themselves"
                        description="These are their own choices to discuss with you — not approvals that need your sign-off."
                      />
                      <ul className="mt-4 space-y-2">
                        {sum.saved_careers.map((item) => (
                          <li
                            key={item.career.id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3.5 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">{item.career.title}</p>
                              <p className="truncate text-xs text-muted">{t(item.career.category)}</p>
                            </div>
                            <span className="shrink-0 text-xs text-muted">
                              {tf("saved {time}", { time: relativeTime(item.saved_at) })}
                            </span>
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
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <Stat label="Sessions" value={sum.journey.sessions_completed} tone="brand" />
                      <Stat label="Careers saved" value={sum.journey.careers_saved} tone="teal" />
                      <Stat label="Themes explored" value={sum.journey.themes_explored} tone="success" />
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

            {/* Latest report, if any — a summary card, never raw conversation. */}
            {sum.latest_report ? (
              <Card>
                <CardHeader
                  icon={<MessagesSquare className="h-4 w-4" aria-hidden />}
                  title="A career exploration report exists"
                  description={tf(
                    "Generated {time} from what your child chose to explore. It describes interests, not a destiny — and it belongs to their account, so the full version stays with them.",
                    { time: relativeTime(sum.latest_report.generated_at) },
                  )}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReportOpen((open) => !open)}
                    >
                      {reportOpen ? t("Hide the summary") : t("See a short summary")}
                    </Button>
                  }
                />
                {reportOpen ? (
                  <div className="mt-4 space-y-3 rounded-2xl bg-canvas p-4">
                    {sum.latest_report.content.note ? (
                      <p className="text-sm leading-relaxed text-ink">
                        {t(sum.latest_report.content.note)}
                      </p>
                    ) : null}
                    {sum.latest_report.content.recommendations.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                          {t("Directions the report mentions")}
                        </p>
                        <ul className="mt-1 space-y-1.5">
                          {sum.latest_report.content.recommendations.map((item) => (
                            <li key={item.career_id} className="text-sm leading-relaxed text-muted">
                              <span className="font-medium text-ink">{item.career}</span> — {item.why}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {sum.latest_report.content.next_steps.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                          {t("Gentle next steps it suggests")}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {sum.latest_report.content.next_steps.map((step) => (
                            <li key={step} className="flex gap-2 text-sm leading-relaxed text-ink">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal" aria-hidden />
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted">
                      {t("Only your child can open the full report, from their own Reports screen.")}
                    </p>
                  </div>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}

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
          <CardHeader
            icon={<Users className="h-4 w-4" aria-hidden />}
            title="Linked profiles and access"
            description="Every link started because a child shared a code. Removing a link only ends your access — it never deletes their account."
          />
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
                        {tf("Linked {time}", { time: relativeTime(link.linked_at) })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={link.can_see_summary ? "brand" : "neutral"}>{t("Sees summary")}</Badge>
                      <Badge tone={link.can_see_transcripts ? "warning" : "success"}>
                        {link.can_see_transcripts ? t("Sees conversation text") : t("Conversation text private")}
                      </Badge>
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
        </Card>

        {/* How to talk about this */}
        <Card>
          <CardHeader
            icon={<HeartHandshake className="h-4 w-4" aria-hidden />}
            title="How to talk about this"
          />
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
