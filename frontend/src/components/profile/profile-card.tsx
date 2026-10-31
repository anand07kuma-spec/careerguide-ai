"use client";

import { Lightbulb, Mail, Pencil, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { useT, useTf } from "@/lib/i18n";
import type { ClerkStatus, StudentProfile, User } from "@/lib/types";
import { AGE_BANDS } from "@/lib/types";
import { classLabel, initials } from "@/lib/utils";

/**
 * Who this account says it is, in the student's own words: the name they gave,
 * the class they are in, what they have marked as interesting, and — only if they
 * chose to add one — the email that opens the same work elsewhere.
 *
 * Nothing here is editable. Editing belongs to Settings, where the same fields
 * have their hints and their save handling; this card is the read-only summary,
 * which is why the only control on it is the way there.
 */
export function ProfileCard({
  user,
  profile,
  clerk,
  languageLabel,
}: {
  user: User | null;
  profile: StudentProfile | null;
  clerk: ClerkStatus | null;
  languageLabel: string;
}) {
  const t = useT();
  const tf = useTf();
  const interests = profile?.interest_areas ?? [];
  const ageBand = AGE_BANDS.find((band) => band.value === profile?.age_range);

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl font-semibold text-white"
        >
          {initials(user?.display_name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold tracking-tight text-ink">
            {user?.display_name}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {clerk?.linked ? (
              <>
                <Mail className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
                <span>{t("Opened by your email sign-in, and by this browser")}</span>
              </>
            ) : (
              <>
                <Smartphone className="h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden />
                <span>{t("This browser is the account — no email, no password")}</span>
              </>
            )}
          </p>
        </div>
        <LinkButton href="/app/settings" variant="outline" size="sm">
          <Pencil className="h-4 w-4" aria-hidden />
          {t("Edit")}
        </LinkButton>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-canvas p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("Class")}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-ink">
            {classLabel(profile?.class_level) ?? t("Not set yet")}
          </dd>
          <dd className="mt-0.5 text-xs text-muted">
            {/* The number the student typed comes first; a band is only shown for a profile
                that was made before there was a way to type one. */}
            {profile?.age !== null && profile?.age !== undefined
              ? tf("{years} years old", { years: profile.age })
              : ageBand
                ? ageBand.label
                : t("Age not set yet")}
          </dd>
        </div>
        <div className="rounded-2xl bg-canvas p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("Replies in")}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{languageLabel}</dd>
          <dd className="mt-0.5 text-xs text-muted">
            {t("The guide follows whichever language you type or speak in")}
          </dd>
        </div>
      </dl>

      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("Career interests")}
        </p>
        {interests.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t(
              "Nothing marked yet. Add a few in Settings, or just talk about what you enjoy — the guide notes what it hears.",
            )}
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {interests.map((interest) => (
              <li
                key={interest}
                className="rounded-full bg-brand-mist px-3 py-1 text-xs font-medium text-brand-dark"
              >
                {interest}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
