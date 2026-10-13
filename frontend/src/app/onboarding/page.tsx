"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, KeyRound, Mic, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/field";
import { useSession } from "@/lib/session";
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
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { status, isParent, completeOnboarding } = useSession();

  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [consentProfile, setConsentProfile] = useState(false);
  const [guardianOk, setGuardianOk] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The account's sign-in code, held in memory only for this one screen.
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Someone already signed in should land on their own dashboard, not create a
  // second profile by accident.
  useEffect(() => {
    if (status === "ready" && !issued) router.replace(isParent ? "/parent" : "/app");
  }, [status, isParent, router, issued]);

  async function submit() {
    setSubmitError(null);
    if (!role) {
      setErrors({ role: "Please choose who is using the app." });
      return;
    }
    if (!consentProfile || !guardianOk) {
      setErrors({ consent: "Both confirmations are needed before we can store a profile." });
      return;
    }

    setSubmitting(true);
    try {
      const next = await completeOnboarding({
        role,
        // A name is friendly, not required: the field is optional and defaults
        // to the role, so this screen still asks exactly one question.
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
      // Show the code before the dashboard: it is never displayed again.
      if (next.comeback_code) setIssued(next.comeback_code);
      else router.replace(role === "parent" ? "/parent" : "/app");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const roleChoices: { value: Role; icon: typeof UserRound; title: string; body: string }[] = [
    {
      value: "student",
      icon: UserRound,
      title: "I am a student",
      body: "Talk to the guide, explore careers, and keep track of your own progress.",
    },
    {
      value: "parent",
      icon: Users,
      title: "I am a parent or guardian",
      body: "See what a child is exploring and get practical guidance for the family.",
    },
  ];

  if (issued) {
    return (
      <Frame step="code">
        <Card className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-ink">
                Save your come-back code
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                It signs you back in on any device. It is shown once and cannot be read out of the
                server later.
              </p>
            </div>
          </div>

          <p
            className="mt-5 rounded-card bg-navy px-4 py-5 text-center font-mono text-lg tracking-[0.18em] text-white sm:text-xl"
            style={{ userSelect: "all" }}
          >
            {issued}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant={copied ? "success" : "outline"}
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(issued)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copied" : "Copy code"}
            </Button>
          </div>

          <ul className="mt-5 space-y-1.5 rounded-card bg-canvas p-4 text-xs leading-relaxed text-muted">
            <li>Write it down, or keep a screenshot somewhere private.</li>
            <li>
              This is <span className="font-medium text-ink">not</span> the sharing code you give a
              parent to link your profile.
            </li>
            <li>Anyone who has this code can open this account, so don&apos;t share it.</li>
            <li>You can create a fresh code any time in Settings; the old one dies instantly.</li>
          </ul>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => router.replace(isParent ? "/parent" : "/app")}>
              {role === "parent" ? "Open the parent dashboard" : "Start talking with the guide"}
            </Button>
          </div>
        </Card>
      </Frame>
    );
  }

  return (
    <Frame step="choose">
      <Card className="overflow-hidden p-0 sm:p-0">
          <div className="border-b border-line bg-navy px-5 py-5 text-white sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              One question before we start
            </p>
            <h1 className="mt-1 text-lg font-semibold sm:text-xl">Who is using CareerGuide AI?</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              Nothing else is asked here. Your class, your interests and your family situation come
              out naturally while you talk with the guide, one at a time.
            </p>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
            <div>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Who is using CareerGuide AI?">
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
                A parent account sees only what a child has agreed to share. To link your own child,
                ask them for the <span className="font-medium text-ink">sharing code</span> on their
                Settings page — that is different from the come-back code used to sign in.
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
                <p className="font-semibold">What we store, in plain words</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  <li>Your nickname and whether you are a student or a parent.</li>
                  <li>What you write in the conversation, so the guide can continue where you left off.</li>
                  <li>
                    When the guide learns something like your class, it stores a short fixed note
                    {" ("}Studies at a government school{")"}, not your exact sentence.
                  </li>
                  <li>Nothing else. No email, phone number, photo, address, school name, or documents.</li>
                  <li>Raw microphone audio is never saved. Speech-to-text happens in your browser.</li>
                  <li>Voice is off to start with. Turn it on in Settings if you want calls.</li>
                  <li>You can switch history off, delete conversations, and leave at any time.</li>
                  <li>We do not sell personal data, and no institution can pay to change a recommendation.</li>
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
                  The browser will ask for microphone permission only if you turn voice on and press
                  the talk button.
                </p>
              ) : null}
              {errors.consent ? <p className="text-sm text-danger">{errors.consent}</p> : null}
            </div>

            <div className="rounded-card bg-canvas p-4 text-xs leading-relaxed text-muted">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                One honest thing before you begin
              </p>
              <p className="mt-2">
                This guide explores careers with you. It does not predict results, does not guarantee
                admission, jobs or salary, and never says a child is suited or unsuited to a
                profession. Career information here is sample data until it has been checked against
                official sources, so always verify fees, exams and dates yourself.
              </p>
              <p className="mt-2">
                There is no email or password to collect. Instead your account gets a one-time
                come-back code, which you will be asked to save. That code is the only way to sign
                in again after you leave this browser, so keep it private and do not use a shared or
                public computer.
              </p>
            </div>

            {submitError ? (
              <div className="rounded-card border border-danger/30 bg-danger-mist p-4 text-sm text-danger">
                {submitError}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas px-5 py-4 sm:px-7">
            <Badge tone="neutral">No email, no password</Badge>
            <Button onClick={() => void submit()} loading={submitting}>
              {role === "parent" ? "Open the parent dashboard" : "Start talking with the guide"}
            </Button>
          </div>
        </Card>
    </Frame>
  );
}

/** The frame both steps share: a quiet header and one centred column. */
function Frame({ children, step }: { children: ReactNode; step: "choose" | "code" }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Wordmark />
          {step === "choose" ? (
            <LinkButton href="/login" variant="ghost" size="sm">
              I already have an account
            </LinkButton>
          ) : (
            <span className="text-xs font-medium text-muted">Step 2 of 2</span>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
