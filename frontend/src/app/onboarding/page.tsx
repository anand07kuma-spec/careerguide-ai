"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Mic,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { Checkbox, Input, Select, Textarea, Toggle } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/feedback";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  AGE_BANDS,
  CLASS_OPTIONS,
  INTEREST_OPTIONS,
  LANGUAGE_OPTIONS,
  type AgeBand,
  type Language,
  type Role,
} from "@/lib/types";

const STEPS = ["Who is using this", "A little about you", "Your situation", "Permission and privacy"];

const EDUCATION_PRESETS = [
  "Government school",
  "Private school",
  "Home schooling",
  "Government college",
  "Private college",
  "Currently not studying",
];

const MONEY_PRESETS = [
  "We need low-cost or free options",
  "We can manage some expenses",
  "Fees are a big worry right now",
  "I would rather not say",
];

const RELATIONSHIPS = ["Parent", "Guardian", "Grandparent / relative", "Teacher or mentor", "Other"];

const CLASS_OPTIONS_TYPED = CLASS_OPTIONS.map((option) => ({
  value: option.value as string,
  label: option.label,
}));

const AGE_OPTIONS = AGE_BANDS.map((band) => ({ value: band.value, label: band.label }));

function ageBandFromClass(classLevel: string): AgeBand | null {
  if (!classLevel) return null;
  const number = Number(classLevel.replace("class-", ""));
  if (number <= 5) return "9-10";
  if (number <= 8) return "11-12";
  return "adult";
}

export default function OnboardingPage() {
  const router = useRouter();
  const { status, isParent, completeOnboarding } = useSession();

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<Language>("hinglish");

  const [classLevel, setClassLevel] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const [childName, setChildName] = useState("");
  const [childClass, setChildClass] = useState("");
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);

  const [education, setEducation] = useState("");
  const [educationNote, setEducationNote] = useState("");
  const [money, setMoney] = useState("");
  const [moneyNote, setMoneyNote] = useState("");

  const [consentAge, setConsentAge] = useState<AgeBand>("11-12");
  const [consentProfile, setConsentProfile] = useState(false);
  const [consentVoice, setConsentVoice] = useState(false);
  const [guardianOk, setGuardianOk] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Someone already signed in should land on their own dashboard, not create a
  // second profile by accident.
  useEffect(() => {
    if (status === "ready") router.replace(isParent ? "/parent" : "/app");
  }, [status, isParent, router]);

  const activeClass = role === "parent" ? childClass : classLevel;
  const derivedBand = ageBandFromClass(activeClass);

  useEffect(() => {
    if (derivedBand) setConsentAge(derivedBand);
  }, [derivedBand]);

  const stepReady = useMemo(() => {
    if (step === 0) return Boolean(role) && displayName.trim().length >= 2;
    if (step === 1) {
      if (role === "parent") return childName.trim().length >= 2 || childClass !== "";
      return true;
    }
    if (step === 3) return consentProfile && guardianOk;
    return true;
  }, [step, role, displayName, childName, childClass, consentProfile, guardianOk]);

  function toggleInterest(value: string) {
    setInterests((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      // The backend stores at most twelve; saying so beats a silent failure.
      if (current.length >= 12) return current;
      return [...current, value];
    });
  }

  function joinContext(preset: string, note: string) {
    const parts = [preset, note.trim()].filter(Boolean);
    return parts.length ? parts.join(" — ") : null;
  }

  async function submit() {
    setSubmitError(null);
    if (!role || displayName.trim().length < 2) {
      setStep(0);
      setErrors({ displayName: "Please enter a name with at least 2 letters." });
      return;
    }
    if (!consentProfile || !guardianOk) {
      setStep(3);
      setErrors({ consent: "Both confirmations are needed before we can store a profile." });
      return;
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        role,
        display_name: displayName.trim(),
        preferred_language: language,
        class_level: role === "student" ? classLevel || null : null,
        age_range: role === "student" ? ageRange || null : null,
        interest_areas: role === "student" ? interests : [],
        relationship: role === "parent" ? relationship : null,
        student_name: role === "parent" ? childName.trim() || null : null,
        student_class_level: role === "parent" ? childClass || null : null,
        education_context: joinContext(education, educationNote),
        financial_context: joinContext(money, moneyNote),
        consent_profile: consentProfile,
        consent_voice: consentVoice,
        consent_age: consentAge,
      });
      router.replace(role === "parent" ? "/parent" : "/app");
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

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Wordmark />
          <LinkButton href="/" variant="ghost" size="sm">
            Back to the intro
          </LinkButton>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="border-b border-line bg-navy px-5 py-5 text-white sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mt-1 text-lg font-semibold sm:text-xl">{STEPS[step]}</h1>
            <div className="mt-4">
              <ProgressBar
                value={step + 1}
                total={STEPS.length}
                tone="teal"
                label={STEPS[step]}
                className="[&>div]:bg-white/20"
              />
            </div>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
            {step === 0 ? (
              <>
                <p className="text-sm leading-relaxed text-muted">
                  CareerGuide AI has no passwords and asks for no email. Your sign-in lives only on
                  this device, so please do not use a shared or public computer for a child's
                  account.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        value: "student" as const,
                        icon: UserRound,
                        title: "I am a student",
                        body: "Explore careers, talk to the guide, and keep track of your own progress.",
                      },
                      {
                        value: "parent" as const,
                        icon: Users,
                        title: "I am a parent or guardian",
                        body: "Support a child, see the topics they explore, and get practical guidance.",
                      },
                    ]
                  ).map((option) => {
                    const Icon = option.icon;
                    const active = role === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRole(option.value)}
                        aria-pressed={active}
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

                <Input
                  label="What should we call you?"
                  hint="A first name or nickname is enough. Please don't use a surname, school or city."
                  value={displayName}
                  maxLength={80}
                  onChange={(event) => setDisplayName(event.target.value)}
                  error={errors.displayName}
                />

                <Select
                  label="Language you are most comfortable in"
                  hint="Hinglish means the guide may mix Hindi and English, the way many of us actually speak."
                  value={language}
                  options={LANGUAGE_OPTIONS.map((option) => ({
                    value: option.value as string,
                    label: option.label,
                  }))}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                />
              </>
            ) : null}

            {step === 1 ? (
              <>
                {role === "parent" ? (
                  <>
                    <p className="text-sm leading-relaxed text-muted">
                      We create a student profile for your child alongside your own account. Later,
                      your child can also link you with a code they generate, and they can undo that
                      at any time.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Child's name or nickname"
                        value={childName}
                        maxLength={80}
                        onChange={(event) => setChildName(event.target.value)}
                      />
                      <Select
                        label="Child's class"
                        placeholder="Not in class 3 to 12"
                        value={childClass}
                        options={CLASS_OPTIONS_TYPED}
                        onChange={(event) => setChildClass(event.target.value)}
                      />
                    </div>
                    <Select
                      label="Your relationship"
                      value={relationship}
                      options={RELATIONSHIPS.map((value) => ({ value, label: value }))}
                      onChange={(event) => setRelationship(event.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label="Your class"
                        placeholder="Not in class 3 to 12"
                        value={classLevel}
                        options={CLASS_OPTIONS_TYPED}
                        onChange={(event) => setClassLevel(event.target.value)}
                      />
                      <Select
                        label="Your age group"
                        hint="Only if you are not in class 3 to 12."
                        value={ageRange}
                        placeholder="Choose one"
                        options={AGE_OPTIONS}
                        onChange={(event) => setAgeRange(event.target.value)}
                      />
                    </div>

                    <div>
                      <SectionHeading
                        title="What do you already enjoy?"
                        description="Pick up to 12. This is only a starting point — interests change, and nothing here decides your future."
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {INTEREST_OPTIONS.map((option) => {
                          const active = interests.includes(option);
                          const locked = !active && interests.length >= 12;
                          return (
                            <button
                              key={option}
                              type="button"
                              disabled={locked}
                              onClick={() => toggleInterest(option)}
                              aria-pressed={active}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                active
                                  ? "border-brand bg-brand text-white"
                                  : "border-line bg-surface text-ink hover:border-brand/60",
                                locked && "cursor-not-allowed opacity-40",
                              )}
                            >
                              {active ? <Check className="h-3 w-3" aria-hidden /> : null}
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {interests.length} of 12 chosen. Skipping this is completely fine.
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm leading-relaxed text-muted">
                  This is optional, and it changes nothing about your worth. We ask only so the guide
                  can suggest affordable routes instead of expensive ones. Never enter bank details,
                  document numbers, addresses or passwords here.
                </p>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-ink">Where are you studying now?</p>
                  <div className="flex flex-wrap gap-2">
                    {EDUCATION_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEducation(education === preset ? "" : preset)}
                        aria-pressed={education === preset}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          education === preset
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-surface text-ink hover:border-brand/60",
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    label="Anything else about your studies?"
                    hint="For example: school closed for a year, preparing for an exam at home."
                    value={educationNote}
                    rows={3}
                    onChange={(event) => setEducationNote(event.target.value)}
                  />
                </div>

                <div className="space-y-3 border-t border-line pt-5">
                  <p className="text-sm font-medium text-ink">How much can your family spend on studies?</p>
                  <div className="flex flex-wrap gap-2">
                    {MONEY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMoney(money === preset ? "" : preset)}
                        aria-pressed={money === preset}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          money === preset
                            ? "border-teal bg-teal text-white"
                            : "border-line bg-surface text-ink hover:border-teal/60",
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    label="In your own words (optional)"
                    hint="A short sentence is enough. This stays on this account only."
                    value={moneyNote}
                    rows={2}
                    onChange={(event) => setMoneyNote(event.target.value)}
                  />
                  <p className="text-xs leading-relaxed text-muted">
                    Whatever you answer, the guide will always show low-cost and free paths first
                    alongside other options. Money limits some routes; it does not limit what you can
                    become good at.
                  </p>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div className="flex items-start gap-3 rounded-card bg-brand-mist p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" aria-hidden />
                  <div className="text-sm leading-relaxed text-brand-dark">
                    <p className="font-semibold">What we store, in plain words</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      <li>Your nickname, class or age group, chosen language, and the answers you give.</li>
                      <li>Conversation text you send, so the guide can continue where you left off.</li>
                      <li>Nothing else. No email, phone number, photo, address, school name, or documents.</li>
                      <li>Raw microphone audio is never saved. Speech-to-text happens in your browser.</li>
                      <li>You can switch history off, delete conversations, and remove a parent link at any time.</li>
                      <li>We do not sell personal data, and no institution can pay to change a recommendation.</li>
                    </ul>
                  </div>
                </div>

                <Select
                  label="Age band for consent"
                  hint="Questions and wording change with age, and this decides how a child's data is treated."
                  value={consentAge}
                  options={AGE_BANDS.map((band) => ({
                    value: band.value as string,
                    label: `${band.label} — ${band.note}`,
                  }))}
                  onChange={(event) => setConsentAge(event.target.value as AgeBand)}
                />

                <Checkbox
                  label="I allow this app to store this profile and the answers given to it"
                  description="Required. Without it we cannot keep progress or recommendations. You can withdraw it later in Settings."
                  checked={consentProfile}
                  onChange={(event) => setConsentProfile(event.target.checked)}
                />
                <Checkbox
                  label="A parent or guardian agrees for a user under 18"
                  description="If the student is a minor, a grown-up who cares for them should be the one agreeing here."
                  checked={guardianOk}
                  onChange={(event) => setGuardianOk(event.target.checked)}
                />

                <div className="rounded-card border border-line bg-surface p-4">
                  <Toggle
                    checked={consentVoice}
                    onChange={setConsentVoice}
                    label="Allow voice calls and microphone use"
                    description="Optional. Off means you can still chat by typing. When on, the microphone records only while you hold the talk button — never in the background, and nothing is uploaded as raw audio."
                  />
                  {consentVoice ? (
                    <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted">
                      <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Your browser will ask for microphone permission the first time you start a call.
                      Declining it is fine — text fallback always works.
                    </p>
                  ) : null}
                </div>

                {errors.consent ? <p className="text-sm text-danger">{errors.consent}</p> : null}

                <div className="rounded-card bg-canvas p-4 text-xs leading-relaxed text-muted">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    One honest thing before you begin
                  </p>
                  <p className="mt-2">
                    This guide explores careers with you. It does not predict results, does not
                    guarantee admission, jobs or salary, and never says a child is suited or unsuited
                    to a profession. Career information here is sample data until it has been checked
                    against official sources, so always verify fees, exams and dates yourself.
                  </p>
                </div>
              </>
            ) : null}

            {submitError ? (
              <div className="rounded-card border border-danger/30 bg-danger-mist p-4 text-sm text-danger">
                {submitError}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas px-5 py-4 sm:px-7">
            <Button
              variant="ghost"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {step === 2 ? (
                <Button variant="secondary" onClick={() => setStep(3)} disabled={submitting}>
                  Skip this
                </Button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <Button
                  onClick={() => {
                    setErrors({});
                    if (!stepReady) {
                      if (step === 0) {
                        setErrors({
                          displayName: role
                            ? "Please choose one option and enter a name with at least 2 letters."
                            : "Please tell us who is using the app and enter a name.",
                        });
                        return;
                      }
                    }
                    setStep((current) => current + 1);
                  }}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : (
                <Button onClick={() => void submit()} loading={submitting} disabled={!stepReady}>
                  <Eye className="h-4 w-4" aria-hidden />
                  Start exploring
                </Button>
              )}
            </div>
          </div>
        </Card>

        <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-muted">
          <Badge tone="neutral">No password needed</Badge>
          <Badge tone="neutral">Free to use</Badge>
          <Badge tone="neutral">Works on phones</Badge>
        </p>
      </main>
    </div>
  );
}
