"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { SignInMethods, StudentProfile } from "@/lib/types";
import { CLASS_OPTIONS, INTEREST_OPTIONS } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { useProfilePhoto } from "@/lib/use-profile-photo";
import {
  DetailNote,
  SettingsCard,
  SettingsItem,
  StatusPill,
} from "./settings-page-shell";
import { initial, messageFor, type Resource } from "./settings-shared";

const EDUCATION_CONTEXT_OPTIONS = [
  "Government school",
  "Private school",
  "Home-schooled",
  "Other or not sure",
];

const FINANCIAL_CONTEXT_OPTIONS = [
  "Need low-cost options",
  "Some budget for books or courses",
  "Not sure yet",
  "Cost is not a concern right now",
];

/** Same bounds the server refuses outside of: `AGE_MIN`/`AGE_MAX` in
 * `backend/app/services/profile_facts.py` and `ge=3, le=99` on `ProfileIn.age`. */
const AGE_MIN = 3;
const AGE_MAX = 99;

/**
 * The student's age, typed.
 *
 * This used to be a five-option dropdown of bands, which asked a fourteen-year-old to
 * decide whether they belonged in "Age 11 to 12" or "Age 13 or above" — and then the
 * server had no number to check that choice against. Here the number is the input and the
 * band is what the server works out from it, so the answer can be exactly right.
 *
 * The two details that keep it honest: it commits on blur or Enter rather than on every
 * keystroke, because "1" while somebody is typing fourteen is not a valid age; and an
 * invalid number is refused here with a message, not sent to be rejected as an opaque 422.
 */
function AgeField({
  age,
  onCommit,
}: {
  age: number | null;
  onCommit: (years: number | null) => void;
}) {
  const [text, setText] = useState(age === null ? "" : String(age));
  const [error, setError] = useState<string | null>(null);

  // The server's answer wins whenever it changes underneath us — after a successful commit,
  // or after a failed one that rolled the profile back. Remembering the age last shown is
  // what lets the field reset while rendering instead of in an effect that copies the prop.
  const [shown, setShown] = useState(age);
  if (shown !== age) {
    setShown(age);
    setText(age === null ? "" : String(age));
    setError(null);
  }

  const commit = () => {
    const typed = text.trim();
    if (!typed) {
      setError(null);
      onCommit(null);
      return;
    }
    const years = Number(typed);
    if (!Number.isInteger(years) || years < AGE_MIN || years > AGE_MAX) {
      setError(`Type your age as a whole number between ${AGE_MIN} and ${AGE_MAX}.`);
      return;
    }
    setError(null);
    if (years !== age) onCommit(years);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <Input
        aria-label="Age"
        error={error}
        className="w-28"
        inputMode="numeric"
        autoComplete="off"
        placeholder="e.g. 14"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
      />
    </form>
  );
}

type Draft = Pick<
  StudentProfile,
  | "class_level"
  | "age"
  | "education_context"
  | "financial_context"
  | "interest_areas"
> & { display_name: string };

const DRAFT_KEYS = [
  "display_name",
  "class_level",
  "age",
  "education_context",
  "financial_context",
  "interest_areas",
] as const;

/** The date the account was opened, written the way the rest of the app writes dates. */
function memberSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function ProfileSettings() {
  const { user, profile, isStudent, saveProfile, reload } = useSession();
  const { toast } = useToast();
  const t = useT();
  const photo = useProfilePhoto(profile?.profile_photo_url ?? null);

  // Every edit stays on this page until Save Changes, so the session's own
  // profile — and the name in the sidebar — never disagree with what was stored.
  const [draft, setDraft] = useState<Partial<Draft>>({});
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [methods, setMethods] = useState<Resource<SignInMethods>>(initial);

  const loadMethods = useCallback(async () => {
    try {
      setMethods({ state: "ready", data: await api.signInMethods(), error: null });
    } catch (error) {
      setMethods({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    // The four sign-in answers live on the server; the card only reads them.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMethods();
  }, [loadMethods]);

  const base: Draft = useMemo(
    () => ({
      display_name: user?.display_name ?? "",
      class_level: profile?.class_level ?? null,
      age: profile?.age ?? null,
      education_context: profile?.education_context ?? null,
      financial_context: profile?.financial_context ?? null,
      interest_areas: profile?.interest_areas ?? [],
    }),
    [profile, user?.display_name],
  );

  const view: Draft = useMemo(() => ({ ...base, ...draft }), [base, draft]);
  const dirty = DRAFT_KEYS.some(
    (key) => JSON.stringify(view[key]) !== JSON.stringify(base[key]),
  );

  const toggleInterest = useCallback(
    (interest: string) => {
      const current = view.interest_areas;
      const next = current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest];
      if (next.length > 12) {
        toast("You can keep up to 12 interests — remove one to add another.", "info");
        return;
      }
      setDraft((currentDraft) => ({ ...currentDraft, interest_areas: next }));
    },
    [view.interest_areas, toast],
  );

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    const name = view.display_name.trim();
    if (!name) {
      setNameError("A name is needed — it is what your guide calls you.");
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      await saveProfile({ ...draft, display_name: name });
      if ("display_name" in draft) {
        // `/profile` answers with the profile only, so the account's own name in
        // the sidebar is refreshed from `/me` rather than left showing the old one.
        await reload();
      }
      setDraft({});
      toast("Profile saved.", "success");
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, view.display_name, draft, saveProfile, reload, toast]);

  const editProfile = useCallback(() => {
    document.getElementById("personal-information")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.setTimeout(() => {
      document.getElementById("settings-profile-name")?.focus({ preventScroll: true });
    }, 400);
  }, []);

  const classOptions = CLASS_OPTIONS.map((option) => ({ ...option }));

  const storedOptions = (value: string | null, options: string[]) =>
    value && !options.includes(value)
      ? [{ value, label: value }, ...options.map((v) => ({ value: v, label: v }))]
      : options.map((v) => ({ value: v, label: v }));

  const joined = memberSince(user?.created_at);
  const emailConnected = methods.state === "ready" && methods.data?.email === true;
  const googleConnected = methods.state === "ready" && methods.data?.google === true;
  const checkingMethods = methods.state === "loading";

  const overview = (
    <SettingsCard
      title="Profile Overview"
      description="The face and name your guide uses. Everything here can be changed below."
      action={
        isStudent ? (
          <Button variant="outline" size="sm" onClick={editProfile}>
            <Pencil className="h-4 w-4" aria-hidden />
            {t("Edit Profile")}
          </Button>
        ) : null
      }
      bodyClassName="divide-y divide-settings-line"
    >
      <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-lg font-semibold text-subtle-ink">
          {photo.url ? (
            // The bytes come from an authenticated endpoint, so the face is an
            // object URL rather than a stored link.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(user?.display_name)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">
            {view.display_name.trim() || t("Your name is not set")}
          </p>
          <StatusPill tone="brand" className="mt-1">
            {isStudent ? "Student" : "Parent"}
          </StatusPill>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {isStudent
              ? t("A student account, signed in on this device.")
              : t("A parent account · sees only what a child shares")}
          </p>
        </div>
      </div>
    </SettingsCard>
  );

  const accountCard = (
    <SettingsCard
      icon={ShieldCheck}
      tone="bg-tile-slate text-on-tile-slate"
      title="Account Information"
      description="What this account is, and which doors open it."
      action={
        <LinkButton href="/app/settings/account" variant="outline" size="sm">
          {t("Account & Sign-in")}
        </LinkButton>
      }
      bodyClassName="divide-y divide-settings-line"
    >
      <SettingsItem title="Account type">
        <StatusPill tone="neutral">{isStudent ? "Student" : "Parent"}</StatusPill>
      </SettingsItem>
      <SettingsItem
        title="Email sign-in"
        description={
          checkingMethods
            ? "Checking what opens this account…"
            : methods.state === "error"
              ? "The server could not be reached, so this is unknown."
              : emailConnected
                ? "An email you added also opens this account. The address itself is not shown here."
                : "No email is attached. This browser is what opens the account."
        }
      >
        <StatusPill tone={emailConnected ? "success" : "neutral"}>
          {checkingMethods ? "Checking…" : emailConnected ? "Connected" : "Not connected"}
        </StatusPill>
      </SettingsItem>
      <SettingsItem
        title="Google sign-in"
        description={
          checkingMethods
            ? "Checking what opens this account…"
            : methods.state === "error"
              ? "The server could not be reached, so this is unknown."
              : googleConnected
                ? "A Google account is linked, and can open this work."
                : "No Google account is linked to this work."
        }
      >
        <StatusPill tone={googleConnected ? "success" : "neutral"}>
          {checkingMethods ? "Checking…" : googleConnected ? "Connected" : "Not connected"}
        </StatusPill>
      </SettingsItem>
      <SettingsItem
        title="Member since"
        description="When this account first opened on CareerGuide AI."
      >
        <p className="text-sm font-medium text-ink">{joined ?? t("Not recorded")}</p>
      </SettingsItem>
      <div className="px-5 py-4 sm:px-6">
        <DetailNote>
          {t(
            "Only coarse details are stored here — never a school roll number, home address, documents, Aadhaar, bank details or passwords. CareerGuide AI does not ask for those, ever.",
          )}
        </DetailNote>
      </div>
    </SettingsCard>
  );

  if (!isStudent) {
    return (
      <div className="space-y-4">
        {overview}
        <SettingsCard
          title="Your child's profile"
          description="A parent account holds no class, age or interests of its own."
        >
          <div className="space-y-3 px-5 py-4 sm:px-6">
            <p className="text-sm leading-relaxed text-muted">
              {t(
                "Class, age, school setting and interests belong to your child's account and are changed from there, so the guide always hears them in your child's own words.",
              )}
            </p>
            <p className="text-xs leading-relaxed text-muted">
              {t(
                "What you can see is what your child chose to share. The Family Access page explains the summary and the transcripts.",
              )}
            </p>
          </div>
        </SettingsCard>
        {accountCard}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {overview}

      <SettingsCard
        id="personal-information"
        icon={UserRound}
        tone="bg-tile-blue text-on-tile-blue"
        title="Personal Information"
        description="The few details the guide uses to pitch its answers at your level."
        bodyClassName="divide-y divide-settings-line"
      >
        <SettingsItem title="Full name" description="The name your guide calls you by.">
          <div className="w-full sm:w-64">
            <Input
              id="settings-profile-name"
              aria-label={t("Full name")}
              autoComplete="name"
              maxLength={80}
              value={view.display_name}
              error={nameError}
              onChange={(event) => {
                setNameError(null);
                setDraft((current) => ({ ...current, display_name: event.target.value }));
              }}
            />
          </div>
        </SettingsItem>
        <SettingsItem title="Class" description="Sets how simply the guide explains things.">
          <div className="w-full sm:w-64">
            <Select
              id="settings-profile-class"
              aria-label={t("Class")}
              options={classOptions}
              placeholder="Not set"
              value={view.class_level ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  class_level: event.target.value || null,
                }))
              }
            />
          </div>
        </SettingsItem>
        <SettingsItem
          title="Age"
          description="Type it in years, the way it is written on your school card. The band is worked out from it."
        >
          <AgeField
            age={view.age}
            onCommit={(years) =>
              setDraft((current) => ({ ...current, age: years }))
            }
          />
        </SettingsItem>
        <SettingsItem
          title="School setting"
          description="Helps the guide suggest realistic routes. Change it any time — nothing here is a judgment about you."
        >
          <div className="w-full sm:w-64">
            <Select
              aria-label={t("School setting")}
              options={storedOptions(view.education_context, EDUCATION_CONTEXT_OPTIONS)}
              placeholder="Not set"
              value={view.education_context ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  education_context: event.target.value || null,
                }))
              }
            />
          </div>
        </SettingsItem>
      </SettingsCard>

      <SettingsCard
        icon={Sparkles}
        tone="bg-tile-green text-on-tile-green"
        title="Learning Preferences"
        description="Things you enjoy trying. The guide uses them to suggest routes — they never rule anything out."
        bodyClassName="divide-y divide-settings-line"
      >
        <div className="px-5 py-4 sm:px-6">
          <p className="text-sm font-medium text-ink">
            {t("Interests")}{" "}
            <span className="text-xs font-normal text-muted">{t("(pick up to 12)")}</span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => {
              const selected = view.interest_areas.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleInterest(interest)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-brand-solid bg-brand-mist text-brand-dark"
                      : "border-settings-line bg-surface text-muted hover:border-brand-light hover:text-ink",
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                  {t(interest)}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            {t(
              "Interests are things you might enjoy trying — they never decide what you are allowed to become.",
            )}
          </p>
        </div>
        <SettingsItem
          title="Cost situation"
          description="A coarse band used only to suggest affordable routes and scholarships — never a judgment about your family."
        >
          <div className="w-full sm:w-64">
            <Select
              aria-label={t("Cost situation")}
              options={storedOptions(view.financial_context, FINANCIAL_CONTEXT_OPTIONS)}
              placeholder="Not set"
              value={view.financial_context ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  financial_context: event.target.value || null,
                }))
              }
            />
          </div>
        </SettingsItem>
        <div className="px-5 py-4 sm:px-6">
          <DetailNote>
            {t(
              "Favourite subjects and career interests are not separate stored fields yet. The guide learns them from what you say in a conversation, so mention them there and they stay with your chats.",
            )}
          </DetailNote>
        </div>
      </SettingsCard>

      {accountCard}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p
          className={cn(
            "text-xs leading-relaxed",
            dirty ? "font-medium text-brand-dark" : "text-muted",
          )}
        >
          {dirty ? t("Unsaved changes") : t("All changes saved")}
        </p>
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          <Check className="h-4 w-4" aria-hidden />
          {t("Save Changes")}
        </Button>
      </div>
    </div>
  );
}
