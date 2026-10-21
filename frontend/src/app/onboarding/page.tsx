"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Mic, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/field";
import { useSession } from "@/lib/session";
import { useT, useTf } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

/**
 * One question: are you a student, or the parent of one?
 *
 * Class, age, interests, where a student studies and what a family can spend are
 * no longer demanded up front. The guide asks for those inside the conversation,
 * one fact at a time, and only when the chat has reached the point where the
 * answer changes what it suggests — see backend/app/services/profile_facts.py.
 * Consent is the exception, and it stays here: the backend refuses to store a
 * profile without it.
 *
 * There is no sign-up either. This browser is given a random id and the profile is
 * bound to it, so coming back here means coming back to the same work.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { status, isParent, completeOnboarding } = useSession();
  const t = useT();
  const tf = useTf();

  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [consentProfile, setConsentProfile] = useState(false);
  const [guardianOk, setGuardianOk] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Somebody this device already knows about should land on their own dashboard,
  // not create a second profile by accident.
  useEffect(() => {
    if (status === "ready") router.replace(isParent ? "/parent" : "/app");
  }, [status, isParent, router]);

  async function submit() {
    setSubmitError(null);
    if (!role) {
      setErrors({ role: t("Please choose who is using the app.") });
      return;
    }
    if (!consentProfile || !guardianOk) {
      setErrors({
        consent: t("Both confirmations are needed before we can store a profile."),
      });
      return;
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        role,
        // A name is friendly, not required: the field is optional and defaults
        // to the role, so this screen still asks exactly one question. The two
        // defaults below are stored on the profile, so they stay in English.
        display_name: displayName.trim() || (role === "parent" ? "Parent" : "Student"),
        // The guide opens in Hinglish and then follows whichever language the
        // student actually uses. Anyone who prefers otherwise can change it in
        // Settings.
        preferred_language: "hinglish",
        relationship: role === "parent" ? "Parent" : null,
        consent_profile: true,
        // Off to begin with, so no microphone use happens before anyone chooses it.
        consent_voice: false,
        // Unknown age is treated as the youngest band, which is the protective
        // default. The guide learns the class during the conversation.
        consent_age: "6-8",
      });
      router.replace(role === "parent" ? "/parent" : "/app");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("Something went wrong while saving. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const roleChoices: { value: Role; icon: typeof UserRound; title: string; body: string }[] = [
    {
      value: "student",
      icon: UserRound,
      title: t("I am a student"),
      body: t("Talk to the guide, explore careers, and keep track of your own progress."),
    },
    {
      value: "parent",
      icon: Users,
      title: t("I am a parent or guardian"),
      body: t("See what a child is exploring and get practical guidance for the family."),
    },
  ];

  return (
    <Frame>
      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-line bg-navy px-5 py-5 text-white sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
            {t("One question before we start")}
          </p>
          <h1 className="mt-1 text-lg font-semibold sm:text-xl">{t("Who is using CareerGuide AI?")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
            {t(
              "Nothing else is asked here. No email, no password, nothing to verify. Your class, your interests and your family situation come out naturally while you talk with the guide, one at a time.",
            )}
          </p>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
          <div>
            <div
              className="grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label={t("Who is using CareerGuide AI?")}
            >
              {roleChoices.map((option) => {
                const Icon = option.icon;
                const active = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setRole(option.value);
                      setErrors({});
                    }}
                    className={cn(
                      "rounded-card border p-4 text-left transition-all",
                      active
                        ? "border-brand bg-brand-mist shadow-lift"
                        : "border-line bg-surface hover:border-brand/60 hover:shadow-card",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full",
                        active ? "bg-brand text-white" : "bg-canvas text-brand-dark",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-ink">{option.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">{option.body}</span>
                  </button>
                );
              })}
            </div>
            {errors.role ? <p className="mt-2 text-sm text-danger">{errors.role}</p> : null}
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t(
                "A parent account sees only what a child has agreed to share. To link your own child, ask them for the",
              )}{" "}
              <span className="font-medium text-ink">{t("sharing code")}</span>{" "}
              {t("shown on their Settings page.")}
            </p>
          </div>

          <Input
            label="What should we call you? (optional)"
            hint="A first name or nickname is enough. Leave it blank and we will simply say Student or Parent. Please don't use a surname, school or city."
            value={displayName}
            maxLength={80}
            onChange={(event) => setDisplayName(event.target.value)}
          />

          <div className="flex items-start gap-3 rounded-card bg-brand-mist p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" aria-hidden />
            <div className="text-sm leading-relaxed text-brand-dark">
              <p className="font-semibold">{t("What we store, in plain words")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li>{t("Your nickname and whether you are a student or a parent.")}</li>
                <li>
                  {t(
                    "What you write in the conversation, so the guide can continue where you left off.",
                  )}
                </li>
                <li>
                  {tf(
                    "When the guide learns something like your class, it stores a short fixed note ({example}), not your exact sentence.",
                    { example: t("Studies at a government school") },
                  )}
                </li>
                <li>
                  {t("Nothing else. No email, phone number, photo, address, school name, or documents.")}
                </li>
                <li>
                  {t("Raw microphone audio is never saved. Speech-to-text happens in your browser.")}
                </li>
                <li>{t("Voice is off to start with. Turn it on in Settings if you want calls.")}</li>
                <li>
                  {t("You can switch history off, delete conversations, and leave at any time.")}
                </li>
                <li>
                  {t(
                    "We do not sell personal data, and no institution can pay to change a recommendation.",
                  )}
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <Checkbox
              label="I allow this app to store this profile and what I tell it"
              description="Required. Without it there is no progress to keep, and the guide cannot remember the conversation."
              checked={consentProfile}
              onChange={(event) => {
                setConsentProfile(event.target.checked);
                setErrors({});
              }}
            />
            <Checkbox
              label="A parent or guardian agrees for a user under 18"
              description="If the student is a minor, a grown-up who cares for them should be the one agreeing here."
              checked={guardianOk}
              onChange={(event) => {
                setGuardianOk(event.target.checked);
                setErrors({});
              }}
            />
            {consentProfile && guardianOk ? (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Mic className="h-3.5 w-3.5" aria-hidden />
                {t(
                  "The browser will ask for microphone permission only if you turn voice on and press the talk button.",
                )}
              </p>
            ) : null}
            {errors.consent ? <p className="text-sm text-danger">{errors.consent}</p> : null}
          </div>

          <div className="rounded-card bg-canvas p-4 text-xs leading-relaxed text-muted">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("One honest thing before you begin")}
            </p>
            <p className="mt-2">
              {t(
                "This guide explores careers with you. It does not predict results, does not guarantee admission, jobs or salary, and never says a child is suited or unsuited to a profession. Career information here is sample data until it has been checked against official sources, so always verify fees, exams and dates yourself.",
              )}
            </p>
            <p className="mt-2">
              {t(
                "This is a prototype, so there is no login. Your progress is tied to this browser by a random id it keeps for itself. Coming back on the same phone or laptop resumes the same conversation. Clearing this site's data, using a private window, or switching device starts a fresh student — there is nothing to recover it with. Don't use a shared or public computer, and use Settings to start over when you are done.",
              )}
            </p>
          </div>

          {submitError ? (
            <div className="rounded-card border border-danger/30 bg-danger-mist p-4 text-sm text-danger">
              {submitError}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas px-5 py-4 sm:px-7">
          <Badge tone="neutral">{t("No email, no password")}</Badge>
          <Button onClick={() => void submit()} loading={submitting}>
            {role === "parent" ? t("Open the parent dashboard") : t("Start talking with the guide")}
          </Button>
        </div>
      </Card>
    </Frame>
  );
}

/** The frame the single step sits in: a quiet header and one centred column. */
function Frame({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Wordmark />
          <span className="text-xs font-medium text-muted">{t("Prototype")}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
