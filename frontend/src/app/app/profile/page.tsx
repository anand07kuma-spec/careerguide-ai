"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Compass, ListChecks, Puzzle, UserRound, Users, type LucideIcon } from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { ProfileCard } from "@/components/profile/profile-card";
import { SettingsRow, SettingsSection } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import type { Sitting } from "@/lib/assessments";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { LANGUAGE_OPTIONS } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { classLabel, relativeTime } from "@/lib/utils";

const TYPE_ICON: Record<Sitting["assessment_type"], LucideIcon> = {
  interest: Compass,
  personality: Users,
  aptitude: Puzzle,
};

const TYPE_TONE: Record<Sitting["assessment_type"], string> = {
  interest: "bg-brand-mist text-brand-dark",
  personality: "bg-teal-mist text-teal",
  aptitude: "bg-slate-100 text-slate-600",
};

export default function ProfileScreen() {
  const t = useT();
  const tf = useTf();
  const router = useRouter();
  const { status, user, profile, settings, isStudent, isParent } = useSession();

  // A parent account holds no class, no interests and no assessments, and the
  // history endpoint refuses one anyway. Rather than show a page of "not set",
  // send them to the dashboard their own account actually has.
  useEffect(() => {
    if (isParent) router.replace("/parent");
  }, [isParent, router]);

  const ready = status === "ready" && isStudent;
  const language = settings.language;

  const loadClerk = useCallback(() => api.clerkStatus(), []);
  const loadSittings = useCallback(() => api.sittings(language), [language]);
  const clerk = useResource(loadClerk, ready);
  const sittings = useResource(loadSittings, ready);

  if (status !== "ready" || isParent) {
    return <LoadingPanel label={t("Taking you to your dashboard…")} />;
  }

  const languageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language;

  const history = sittings.data ?? [];

  return (
    <Screen
      title="My profile"
      description="This is what your account says about you. Every line came from an answer you gave — nothing here is a score, a ranking or a guess."
      badge={
        <Badge tone="brand" icon={<UserRound className="h-3.5 w-3.5" aria-hidden />}>
          {classLabel(profile?.class_level) ?? t("Class not set")}
        </Badge>
      }
      action={
        <LinkButton href="/app/settings" variant="outline" size="sm">
          {t("Settings")}
        </LinkButton>
      }
    >
      <div className="max-w-3xl space-y-5">
        <ProfileCard user={user} profile={profile} clerk={clerk.data} languageLabel={languageLabel} />

        <SettingsSection
          title="Assessment history"
          description="Each row is a set of questions you finished. Open one to read the result again, or turn it into a PDF."
          action={
            <LinkButton href="/app/assessments" size="sm">
              <ListChecks className="h-4 w-4" aria-hidden />
              {t("Take an assessment")}
            </LinkButton>
          }
        >
          {sittings.state === "loading" ? (
            <p className="px-4 py-4 text-sm text-muted" role="status">
              {t("Reading your finished assessments…")}
            </p>
          ) : sittings.state === "error" ? (
            <ErrorState
              title="Your assessment history could not load"
              description={sittings.error}
              onRetry={sittings.reload}
              className="rounded-none border-0 bg-transparent px-4 py-8"
            />
          ) : history.length > 0 ? (
            history.map((sitting) => {
              const Icon = TYPE_ICON[sitting.assessment_type];
              return (
                <SettingsRow
                  key={sitting.result_id}
                  icon={Icon}
                  tone={TYPE_TONE[sitting.assessment_type]}
                  title={sitting.name}
                  value={`${tf("{answered} of {total} answers", {
                    answered: sitting.answered,
                    total: sitting.total,
                  })} · ${relativeTime(sitting.completed_at)} · ${
                    sitting.language === "hi" ? "हिंदी" : "English"
                  }`}
                  href={`/app/assessments/result/${sitting.result_id}`}
                />
              );
            })
          ) : (
            <EmptyState
              title="No assessment finished yet"
              description="An assessment is a short set of questions about what you enjoy and what you find easy. It never gives a verdict on you."
              action={
                <LinkButton href="/app/assessments" size="sm">
                  {t("See the three assessments")}
                </LinkButton>
              }
              className="rounded-none border-0 bg-transparent px-4 py-10"
            />
          )}
        </SettingsSection>

        {clerk.state === "error" ? (
          <p className="px-1 text-xs leading-relaxed text-muted">
            {t("Your email sign-in status could not be checked.")} {clerk.error}
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
