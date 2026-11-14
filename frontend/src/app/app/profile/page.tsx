"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AccountPanel,
  AssessmentHistory,
  ProfileFacts,
  ProfileHero,
  ProTipBanner,
} from "@/components/profile/profile-card";
import { LoadingPanel } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";

/** The short name of a reply language, so the hero line stays one glance wide. */
const LANGUAGE_NAME: Record<string, string> = {
  hinglish: "Hinglish",
  hi: "Hindi",
  en: "English",
};

export default function ProfileScreen() {
  const t = useT();
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
  const loadMethods = useCallback(() => api.signInMethods(), []);
  const clerk = useResource(loadClerk, ready);
  const sittings = useResource(loadSittings, ready);
  const methods = useResource(loadMethods, ready);

  if (status !== "ready" || isParent) {
    return <LoadingPanel label={t("Taking you to your dashboard…")} />;
  }

  return (
    <div className="mx-auto w-full max-w-page px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="sr-only">{t("My profile")}</h1>
      <div className="space-y-5 sm:space-y-6">
        <ProfileHero
          user={user}
          profile={profile}
          languageLabel={t(LANGUAGE_NAME[language] ?? language)}
        />
        <ProfileFacts profile={profile} />
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.72fr)_minmax(300px,1fr)] lg:items-start">
          <AssessmentHistory sittings={sittings} />
          <AccountPanel user={user} clerk={clerk} methods={methods} />
        </div>
        <ProTipBanner />
      </div>
    </div>
  );
}
